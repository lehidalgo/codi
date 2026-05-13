#!/usr/bin/env node
/**
 * ISSUE-017 architectural guard — project-name / project-dir hardcoding.
 *
 * Scans src/ for hardcoded `.codi` paths and `"codi"` / `"Codi"` literals
 * that should derive from constants:
 *   - `.codi` literals  → use `PROJECT_DIR`
 *   - `"codi"` literal  → use `PROJECT_NAME` / `MANAGED_BY_FRAMEWORK`
 *   - `"Codi"` literal  → use `PROJECT_NAME_DISPLAY`
 *
 * The guard ONLY flags string-literal occurrences in TypeScript source. It
 * tolerates:
 *   - constants.ts itself (the canonical source)
 *   - markdown / documentation files
 *   - template literal interpolation `${PROJECT_DIR}`
 *   - JSDoc / // comments that document `.codi/` to readers
 *   - regex character classes (escaping semantics matter)
 *   - URLs / npm package refs (codi-cli, github.com/.../codi)
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one literal found
 *   2 — internal error
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const ROOT = join(REPO, "src");

// Files allowed to contain the canonical literals.
const WHITELIST = new Set(["src/constants.ts"]);

// Patterns to scan for, line-by-line. Each entry has a matcher + a fix hint.
const RULES = [
  {
    name: "bare-dot-codi-string",
    re: /"\.codi"/,
    fix: "Use `PROJECT_DIR` from #src/constants.js (or build with template literal)",
  },
  {
    name: "dot-codi-subpath",
    re: /"\.codi\/[^"]+"/,
    fix: "Use template literal: `${PROJECT_DIR}/...`",
  },
  {
    name: "managed-by-codi-string",
    re: /\bmanaged_?[Bb]y[:=]\s*"codi"/,
    fix: "Use `MANAGED_BY_FRAMEWORK` from #src/constants.js",
  },
  {
    name: "managed-by-user-string",
    re: /\bmanaged_?[Bb]y[:=]\s*"user"/,
    fix: "Use `MANAGED_BY_USER` from #src/constants.js",
  },
  {
    name: "codi-user-literal-union",
    re: /"codi"\s*\|\s*"user"|"user"\s*\|\s*"codi"/,
    fix: "Use `ManagedBy` type from #src/constants.js",
  },
];

// Substrings that, if present on a line, mark the line as a legitimate
// non-literal usage and skip the line entirely.
const LINE_ESCAPES = [
  "PROJECT_DIR", // already using the constant
  "PROJECT_NAME", // ditto
  "MANAGED_BY_", // ditto
  "ManagedBy", // type usage
  "// ", // line comment
  "* ", // JSDoc continuation
  " * ", // JSDoc continuation
  "/*", // block comment open
  "*/", // block comment close
  "codi-cli", // npm package name
  "github.com", // URL
  "@codi", // npm scope
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
    const line = raw.trim();
    // Track block comments rudimentarily
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line.startsWith("/*") && !line.includes("*/")) {
      inBlockComment = true;
      continue;
    }
    if (LINE_ESCAPES.some((esc) => raw.includes(esc))) continue;
    for (const rule of RULES) {
      if (rule.re.test(raw)) {
        hits.push({ line: i + 1, text: raw.trim(), rule: rule.name, fix: rule.fix });
        break;
      }
    }
  }
  return hits;
}

async function main() {
  const files = [];
  try {
    await walk(ROOT, files);
  } catch (err) {
    console.error(`[guard-project-literals] walk failed: ${err.message ?? err}`);
    process.exit(2);
  }

  const failures = [];
  for (const abs of files) {
    const rel = relative(REPO, abs);
    if (WHITELIST.has(rel)) continue;
    let text;
    try {
      text = await readFile(abs, "utf8");
    } catch (err) {
      console.error(`[guard-project-literals] cannot read ${rel}: ${err.message ?? err}`);
      process.exit(2);
    }
    const hits = scan(text);
    if (hits.length > 0) failures.push({ rel, hits });
  }

  if (failures.length === 0) {
    console.log("[guard-project-literals] no hardcoded project-name/dir literals found — pass.");
    process.exit(0);
  }

  console.error("[guard-project-literals] FAIL — hardcoded project-name / dir literals:");
  for (const f of failures) {
    console.error(`\n  ${f.rel}`);
    for (const h of f.hits) {
      console.error(`    line ${h.line} [${h.rule}]: ${h.text}`);
      console.error(`      fix: ${h.fix}`);
    }
  }
  console.error(
    "\nWhy: project-name / dir / managed-by literals must derive from\n" +
      "src/constants.ts so a rebrand or rename is a one-file change. See the\n" +
      "rule codi-code-style.md (Single Source of Truth) for details.",
  );
  process.exit(1);
}

main();
