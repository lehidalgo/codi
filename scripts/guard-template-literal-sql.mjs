#!/usr/bin/env node
/**
 * CORE-023 — bans template-literal interpolation inside `raw.prepare(...)`,
 * `raw.exec(...)`, `.prepare(\`...\${...}\`)`, and `.exec(\`...\${...}\`)`.
 *
 * Why: `src/runtime/brain/db.ts:204` enables `raw.unsafeMode(true)`
 * permanently because the FTS5 contentless-sync command inside our
 * triggers requires it. The docstring there documents the invariant
 * that protects against SQL injection at the application layer:
 *
 *   > Safety: every SQL statement on this handle is a static
 *   > `raw.prepare("...")` parameterised query — no `raw.exec(<dynamic>)`,
 *   > no template-literal SQL composition.
 *
 * This guard makes that invariant CI-enforced. Two existing legitimate
 * call-sites interpolate controlled SQL identifiers (column-name list
 * and PRAGMA table name) that SQLite cannot parameterise — they carry
 * an inline `// codi-sql-allow: <reason>` marker that opts them out.
 *
 * Allowed forms (NOT flagged):
 *   - `.prepare("...static string...")` — bind parameters use `?`.
 *   - `.prepare(\`...static string...\`)` — backticks WITHOUT `${...}`.
 *   - Lines / preceding line carrying `codi-sql-allow:` comment.
 *
 * Banned forms (FAIL):
 *   - `.prepare(\`...\${var}...\`)`
 *   - `.exec(\`...\${var}...\`)`
 *   - `raw.prepare(\`...\${var}...\`)`
 *   - `raw.exec(\`...\${var}...\`)`
 *
 * Scope: src/runtime/** and src/core/** (anywhere a brain handle could
 * surface). Skips .d.ts and *.test.ts.
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one banned interpolation found
 *   2 — internal error walking the tree
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const ROOTS = ["src/runtime", "src/core"];

// Match `.prepare(\`...\${...}\`)` and `.exec(\`...\${...}\`)`.
// Anchored on `.prepare(` or `.exec(` followed by a backtick that
// contains `${`. Multiline mode (m) lets us scan line by line below.
const BANNED = /\.(prepare|exec)\(\s*`[^`]*\$\{/;

// Allow-marker on same line or directly above.
const ALLOW_MARKER = /codi-sql-allow:/;

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
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    out.push(full);
  }
}

async function findOffenders() {
  const offenders = [];
  for (const root of ROOTS) {
    const files = [];
    try {
      await walk(join(REPO, root), files);
    } catch (err) {
      console.error(
        `[guard-template-literal-sql] walk failed for ${root}: ${err.message ?? err}`,
      );
      process.exit(2);
    }
    for (const abs of files) {
      let src;
      try {
        src = await readFile(abs, "utf8");
      } catch (err) {
        console.error(
          `[guard-template-literal-sql] cannot read ${relative(REPO, abs)}: ${err.message ?? err}`,
        );
        process.exit(2);
      }
      const lines = src.split(/\r?\n/);
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!BANNED.test(line)) continue;
        // Allow when the same line or any of the 5 lines immediately
        // above carries an explicit `codi-sql-allow:` marker. The window
        // accommodates multi-line block comments explaining the
        // exception.
        if (ALLOW_MARKER.test(line)) continue;
        let allowed = false;
        for (let j = i - 1; j >= Math.max(0, i - 5); j -= 1) {
          if (ALLOW_MARKER.test(lines[j])) {
            allowed = true;
            break;
          }
        }
        if (allowed) continue;
        hits.push({ line: i + 1, text: line.trim() });
      }
      if (hits.length > 0) {
        offenders.push({ path: relative(REPO, abs), hits });
      }
    }
  }
  return offenders;
}

async function main() {
  const offenders = await findOffenders();
  if (offenders.length === 0) {
    console.log(
      "[guard-template-literal-sql] no template-literal SQL interpolation in runtime/core — pass.",
    );
    process.exit(0);
  }

  console.error(
    "[guard-template-literal-sql] FAIL — banned `${var}` interpolation inside prepare/exec calls:",
  );
  for (const off of offenders) {
    console.error(`\n  ${off.path}`);
    for (const hit of off.hits) {
      console.error(`    line ${hit.line}: ${hit.text}`);
    }
  }
  console.error(
    "\n" +
      "Why: src/runtime/brain/db.ts:204 enables raw.unsafeMode(true)\n" +
      "permanently (required by FTS5 contentless-sync triggers). The\n" +
      "docstring there documents that every brain SQL statement MUST be\n" +
      "a static prepared statement with `?` parameters — never a template\n" +
      "literal that interpolates a value.\n" +
      "\n" +
      "Fix:\n" +
      "  - Replace `${value}` with a `?` placeholder and pass value as a\n" +
      "    bind parameter to .run(...) / .get(...) / .all(...).\n" +
      "  - If the interpolated token is a controlled SQL identifier (e.g.\n" +
      "    a column/table name that SQLite cannot parameterise), add an\n" +
      "    inline `// codi-sql-allow: <reason>` comment on the same line\n" +
      "    or the line immediately above. The marker is grepable so future\n" +
      "    audits can review the exception list.",
  );
  process.exit(1);
}

main();
