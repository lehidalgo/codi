#!/usr/bin/env node
/**
 * ISSUE-023 architectural guard — direct `console.*` usage policy.
 *
 * Codi exports a `Logger` (`src/core/output/logger.ts`) that handles
 * level filtering, JSON-mode suppression, and consistent stderr output.
 * CLI command handlers and adapters MUST route through Logger so users get
 * uniform `[INF] [WRN] [ERR]` prefixed output.
 *
 * `console.*` IS still legitimate in five places:
 *   1. Hook script templates (string literals emitted to `.git/hooks/` or
 *      `.claude/hooks/`) — those scripts run OUTSIDE the Codi process.
 *   2. Shipped skill scripts (`src/templates/skills/<name>/scripts/`) —
 *      independent CLI tools, no Codi runtime.
 *   3. Hook orchestrators (`src/cli/agent-hooks.ts`,
 *      `src/runtime/capture/{stop,prompt,tool}-hook.ts`) — Claude Code
 *      reads `[codi pre-tool-use]` / `[capture]` stderr prefixes by
 *      protocol; routing through Logger would corrupt that contract.
 *   4. JSDoc `@example` blocks — documentation, not executable.
 *   5. The Logger module itself.
 *
 * Anywhere else in `src/` is treated as a regression.
 *
 * Exit codes:
 *   0 — clean
 *   1 — violations found
 *   2 — internal error
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const ROOT = join(REPO, "src");

const ALLOWED_PATTERNS = [
  /^src\/core\/output\/logger\.ts$/,
  /^src\/templates\//, // shipped templates + skill scripts
  /^src\/core\/hooks\/.*template.*\.ts$/, // hook template builders
  /^src\/core\/hooks\/heartbeat-hooks\.ts$/,
  /^src\/cli\/agent-hooks\.ts$/, // hook stderr contract
  /^src\/runtime\/capture\/(stop|prompt|tool)-hook\.ts$/, // hook stderr contract
];

async function walk(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await walk(full, out);
      continue;
    }
    if (entry.name.endsWith(".ts")) out.push(full);
  }
}

function scan(text) {
  const lines = text.split(/\r?\n/);
  const hits = [];
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*") && !trimmed.includes("*/")) {
      inBlockComment = true;
      continue;
    }
    // Skip JSDoc continuation lines (start with `* `) and `//` line comments
    if (/^\*\s/.test(trimmed) || trimmed.startsWith("//")) continue;
    if (/\bconsole\.(log|warn|error|info|debug)\b/.test(raw)) {
      hits.push({ line: i + 1, text: trimmed });
    }
  }
  return hits;
}

async function main() {
  const files = [];
  try {
    await walk(ROOT, files);
  } catch (err) {
    console.error(`[guard-console-usage] walk failed: ${err.message ?? err}`);
    process.exit(2);
  }

  const failures = [];
  for (const abs of files) {
    const rel = relative(REPO, abs);
    if (ALLOWED_PATTERNS.some((re) => re.test(rel))) continue;
    let text;
    try {
      text = await readFile(abs, "utf8");
    } catch (err) {
      console.error(`[guard-console-usage] cannot read ${rel}: ${err.message ?? err}`);
      process.exit(2);
    }
    const hits = scan(text);
    if (hits.length > 0) failures.push({ rel, hits });
  }

  if (failures.length === 0) {
    console.log("[guard-console-usage] no out-of-policy console.* calls — pass.");
    process.exit(0);
  }

  console.error("[guard-console-usage] FAIL — direct console.* in non-allowed files:");
  for (const f of failures) {
    console.error(`\n  ${f.rel}`);
    for (const h of f.hits) console.error(`    line ${h.line}: ${h.text}`);
  }
  console.error(
    "\nWhy: CLI command handlers, adapters, and core/runtime code MUST route\n" +
      "output through `Logger.getInstance()` so users get consistent level-\n" +
      "filtered, JSON-suppressible stderr. `console.*` is permitted only in\n" +
      "hook templates, shipped skill scripts, hook orchestrators (where the\n" +
      "stderr prefix IS the Claude Code protocol contract), and JSDoc blocks.\n" +
      "See `codi-code-style.md` for the policy.",
  );
  process.exit(1);
}

main();
