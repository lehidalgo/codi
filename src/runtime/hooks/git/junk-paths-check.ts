/**
 * junk-paths-check — pre-commit check. Blocks staged files that match
 * known-junk path patterns: editor swaps, OS metadata, large binaries
 * unintentionally committed, .env files, etc. ADR-013 Paso 8.
 *
 * Refines capellai's block-junk-paths.sh.
 */

import { execFileSync } from "node:child_process";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const JUNK_PATTERNS: readonly { re: RegExp; reason: string }[] = [
  { re: /(^|\/)\.DS_Store$/, reason: "macOS Finder metadata" },
  { re: /(^|\/)Thumbs\.db$/i, reason: "Windows thumbnail cache" },
  { re: /(^|\/)\..*\.sw[po]$/, reason: "Vim swap file" },
  { re: /~$/, reason: "editor backup file" },
  { re: /(^|\/)#.*#$/, reason: "Emacs autosave file" },
  { re: /(^|\/)\.env(\..+)?$/, reason: ".env file (use .env.example)" },
  { re: /(^|\/)\.env\.local$/, reason: ".env.local (gitignored by convention)" },
  { re: /(^|\/)node_modules\//, reason: "node_modules directory" },
  { re: /(^|\/)\.idea\//, reason: "JetBrains IDE config" },
  { re: /(^|\/)__pycache__\//, reason: "Python bytecode cache" },
  { re: /\.pyc$/, reason: "Python compiled file" },
];

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

export function checkJunkPaths(ctx: GitHookContext): GitHookVerdict {
  try {
    const files = stagedFiles(ctx.cwd);
    const offenders: string[] = [];
    for (const file of files) {
      const hit = JUNK_PATTERNS.find((p) => p.re.test(file));
      if (hit) offenders.push(`${file} — ${hit.reason}`);
    }
    if (offenders.length === 0) return { severity: "pass", check: "junk-paths-check", messages: [] };
    return {
      severity: "block",
      check: "junk-paths-check",
      messages: [
        "Staged paths look like junk and should not be committed:",
        ...offenders.map((s) => "  " + s),
        "Unstage with `git restore --staged <path>` and add to .gitignore.",
      ],
    };
  } catch (err) {
    return failOpen("junk-paths-check", err);
  }
}
