/**
 * file-lines-check — pre-commit check. Warns when a staged source file
 * exceeds the line-count threshold defined by codi rules (~800 LOC
 * default). Block if hard ceiling (1500) is hit. ADR-013 Paso 8.
 *
 * Refines capellai's check_file_lines.py with codi-native limits.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const WARN_THRESHOLD = 800;
const BLOCK_THRESHOLD = 1500;

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".cs",
  ".cpp",
  ".c",
  ".h",
]);

function isCodeFile(path: string): boolean {
  return CODE_EXTENSIONS.has(extname(path));
}

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

function countLines(absPath: string): number | null {
  try {
    if (!existsSync(absPath)) return null;
    const st = statSync(absPath);
    if (!st.isFile()) return null;
    const text = readFileSync(absPath, "utf8");
    return text.split("\n").length;
  } catch {
    return null;
  }
}

export function checkFileLines(ctx: GitHookContext): GitHookVerdict {
  try {
    const files = stagedFiles(ctx.cwd);
    const blocks: string[] = [];
    const warns: string[] = [];
    for (const rel of files) {
      if (!isCodeFile(rel)) continue;
      const lines = countLines(join(ctx.cwd, rel));
      if (lines === null) continue;
      if (lines >= BLOCK_THRESHOLD) {
        blocks.push(`${rel}: ${lines} lines (hard limit ${BLOCK_THRESHOLD})`);
      } else if (lines >= WARN_THRESHOLD) {
        warns.push(`${rel}: ${lines} lines (warn at ${WARN_THRESHOLD})`);
      }
    }
    if (blocks.length > 0) {
      return {
        severity: "block",
        check: "file-lines-check",
        messages: [
          "Staged source files exceed the codi hard line limit:",
          ...blocks.map((s) => "  " + s),
          "Split the module before committing. Use codi-architecture / codi-simplicity-first rules.",
        ],
      };
    }
    if (warns.length > 0) {
      return {
        severity: "warn",
        check: "file-lines-check",
        messages: [
          "Staged source files exceed the codi warn line threshold:",
          ...warns.map((s) => "  " + s),
          "Refactor candidate. Not blocking.",
        ],
      };
    }
    return { severity: "pass", check: "file-lines-check", messages: [] };
  } catch (err) {
    return failOpen("file-lines-check", err);
  }
}
