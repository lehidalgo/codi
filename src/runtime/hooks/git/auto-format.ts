/**
 * auto-format — pre-commit check. Runs the project's formatter on
 * staged files of the matching language. Detects formatter via
 * package.json (Node) / pyproject.toml (Python) / etc. ADR-013 Paso 8.
 *
 * Replaces capellai's auto-format.sh (which fired on PostToolUse —
 * moved to pre-commit per ADR-013 Paso 8 decision to avoid Read/Write
 * feedback loops).
 *
 * Skip-silent design: if no formatter is detected for a file's
 * language, the file is left alone. No error.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

function stagedFiles(cwd: string): string[] {
  try {
    const out = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      { cwd, encoding: "utf8" },
    );
    return out.split("\n").filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

interface NodeFormatter {
  command: string;
  args: (files: readonly string[]) => string[];
}

function detectNodeFormatter(cwd: string): NodeFormatter | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  const devDeps = (pkg["devDependencies"] ?? {}) as Record<string, string>;
  const deps = (pkg["dependencies"] ?? {}) as Record<string, string>;
  const has = (name: string): boolean => name in devDeps || name in deps;

  if (has("@biomejs/biome")) {
    return { command: "npx", args: (files) => ["biome", "format", "--write", ...files] };
  }
  if (has("prettier")) {
    return { command: "npx", args: (files) => ["prettier", "--write", "--ignore-unknown", ...files] };
  }
  return null;
}

function runFormatter(cwd: string, fmt: NodeFormatter, files: readonly string[]): string[] {
  const result = spawnSync(fmt.command, fmt.args(files), { cwd, encoding: "utf8" });
  const errLines: string[] = [];
  if (result.status !== 0) {
    errLines.push(
      `Formatter exited ${result.status ?? "?"}: ${(result.stderr ?? "").trim().slice(0, 500)}`,
    );
  }
  // Re-stage the formatted files so the commit picks up the changes.
  try {
    execFileSync("git", ["add", "--", ...files], { cwd });
  } catch (err) {
    errLines.push(`re-stage failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return errLines;
}

export function runAutoFormat(ctx: GitHookContext): GitHookVerdict {
  try {
    const files = stagedFiles(ctx.cwd);
    if (files.length === 0) return { severity: "pass", check: "auto-format", messages: [] };

    // Bucket by language. For now we wire only the JS/TS bucket; other
    // language formatters can be added the same way.
    const nodeExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml"]);
    const nodeFiles = files.filter((f) => nodeExts.has(extname(f)));

    const messages: string[] = [];
    if (nodeFiles.length > 0) {
      const fmt = detectNodeFormatter(ctx.cwd);
      if (fmt) {
        const errs = runFormatter(ctx.cwd, fmt, nodeFiles);
        messages.push(...errs);
      }
    }

    if (messages.length === 0) return { severity: "pass", check: "auto-format", messages: [] };
    return {
      severity: "warn",
      check: "auto-format",
      messages: ["Auto-format encountered issues (non-blocking):", ...messages],
    };
  } catch (err) {
    return failOpen("auto-format", err);
  }
}
