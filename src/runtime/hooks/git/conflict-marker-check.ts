/**
 * conflict-marker-check — pre-commit. Blocks staged files with
 * unresolved git merge conflict markers. ADR-013 Paso 9.
 *
 * Replaces CONFLICT_MARKER_CHECK_TEMPLATE. Same fence-aware logic
 * (markers inside fenced code blocks or <example> blocks are ignored
 * — those are legitimate documentation of merge syntax).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const MARKER_RE = /^(<{7}|={7}|>{7}|\|{7})( |$)/;
const FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})/;
const EXAMPLE_OPEN_RE = /<\s*example\s*>/i;
const EXAMPLE_CLOSE_RE = /<\s*\/\s*example\s*>/i;
const BINARY_EXT: readonly RegExp[] = [
  /\.png$/i,
  /\.jpe?g$/i,
  /\.gif$/i,
  /\.webp$/i,
  /\.ico$/i,
  /\.pdf$/i,
  /\.ttf$/i,
  /\.woff2?$/i,
  /\.eot$/i,
  /\.zip$/i,
  /\.tar(\.gz)?$/i,
  /\.gz$/i,
  /\.7z$/i,
  /\.mp[34]$/i,
  /\.mov$/i,
  /\.webm$/i,
];

interface Finding {
  file: string;
  line: number;
  text: string;
}

function scanForMarkers(content: string): { line: number; text: string }[] {
  const lines = content.split("\n");
  const findings: { line: number; text: string }[] = [];
  let inFence = false;
  let inExample = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (inFence) {
      if (FENCE_RE.test(line)) inFence = false;
      continue;
    }
    if (inExample) {
      if (EXAMPLE_CLOSE_RE.test(line)) inExample = false;
      continue;
    }
    if (FENCE_RE.test(line)) {
      inFence = true;
      continue;
    }
    const open = EXAMPLE_OPEN_RE.exec(line);
    if (open) {
      const tail = line.slice(open.index + open[0].length);
      if (!EXAMPLE_CLOSE_RE.test(tail)) inExample = true;
      continue;
    }
    if (MARKER_RE.test(line)) {
      findings.push({ line: i + 1, text: line.slice(0, 80) });
    }
  }
  return findings;
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

export function checkConflictMarkers(ctx: GitHookContext): GitHookVerdict {
  try {
    const files = stagedFiles(ctx.cwd).filter((f) => !BINARY_EXT.some((re) => re.test(f)));
    const findings: Finding[] = [];
    for (const rel of files) {
      const abs = join(ctx.cwd, rel);
      if (!existsSync(abs)) continue;
      let content: string;
      try {
        content = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      for (const hit of scanForMarkers(content)) {
        findings.push({ file: rel, line: hit.line, text: hit.text });
      }
    }
    if (findings.length === 0) {
      return { severity: "pass", check: "conflict-marker-check", messages: [] };
    }
    return {
      severity: "block",
      check: "conflict-marker-check",
      messages: [
        "Git merge-conflict markers detected in staged files:",
        ...findings.slice(0, 20).map((f) => `  ${f.file}:${f.line}  ${f.text}`),
        findings.length > 20 ? `  ...and ${findings.length - 20} more` : "",
        "Resolve the conflict, re-stage the file, and commit again. Do not bypass with --no-verify.",
      ].filter((s) => s.length > 0),
    };
  } catch (err) {
    return failOpen("conflict-marker-check", err);
  }
}
