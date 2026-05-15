#!/usr/bin/env node
/**
 * ISSUE-014 architectural guard.
 *
 * Rejects pure-reexport `index.ts` files in `src/` that are NOT at a
 * deliberate boundary surface.
 *
 * Permitted barrels (boundary surfaces):
 *   - `src/index.ts`                                — public npm API entry
 *   - `src/adapters/index.ts`                       — adapter registry (carries logic)
 *   - `src/core/hooks/registry/**`/index.ts         — hook registry (carries logic)
 *   - "src/templates/AGENTS/index.ts"               — template-loader contracts
 *   - "src/templates/AGENTS/NAME/index.ts"          — template-loader contracts (e.g. skills)
 *   - "src/runtime/workflows/.../index.ts"          — workflow adapter registry
 *   - "src/templates/skills/NAME/scripts/lib/index.ts" — sub-package public surface
 *
 * Any other `index.ts` is treated as an organisational barrel and rejected
 * unless its body contains non-reexport statements (i.e. actual logic). The
 * guard exists because Codi previously accumulated 16 organisational barrels
 * that broke tree-shaking and slowed tests; the rule
 * `codi-typescript.md` v2 now prohibits the pattern.
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one prohibited barrel found
 *   2 — internal error walking the tree
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const ROOT = join(REPO, "src");

/** Anchors matched against the path *relative to repo root*. */
const ALLOWED_PATTERNS = [
  /^src\/index\.ts$/,
  /^src\/adapters\/index\.ts$/,
  /^src\/core\/hooks\/registry\/index\.ts$/,
  /^src\/core\/hooks\/registry\/runtime\/index\.ts$/,
  /^src\/templates\/agents\/index\.ts$/,
  /^src\/templates\/rules\/index\.ts$/,
  /^src\/templates\/presets\/index\.ts$/,
  /^src\/templates\/mcp-servers\/index\.ts$/,
  /^src\/templates\/skills\/index\.ts$/,
  /^src\/templates\/skills\/[^/]+\/index\.ts$/,
  /^src\/templates\/skills\/[^/]+\/scripts\/lib\/index\.ts$/,
  /^src\/runtime\/workflows\/index\.ts$/,
  /^src\/runtime\/workflows\/[^/]+\/index\.ts$/,
];

/**
 * A file is a "pure barrel" if every non-blank, non-comment line is either a
 * single-line `export ... from "..."` re-export or a top-level docstring.
 * We tolerate `import type` lines on the way to a re-export, but reject any
 * statement that produces runtime behaviour (constants, function calls,
 * side-effecting imports).
 */
function isPureReexport(source) {
  const lines = source.split(/\r?\n/);
  let inBlockComment = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith("//")) continue;
    if (line.startsWith("/*")) {
      inBlockComment = !line.includes("*/");
      continue;
    }
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line.startsWith("*")) continue;
    // Match: `export { ... } from "..."` (single-line or final line of a multi-line)
    if (/^export\s+(type\s+)?\{[^}]*\}\s+from\s+"[^"]+"\s*;?\s*$/.test(line)) continue;
    // Match: `export * (as Foo)? from "..."`
    if (/^export\s+\*(\s+as\s+\w+)?\s+from\s+"[^"]+"\s*;?\s*$/.test(line)) continue;
    // Match: multi-line export body — we accept the opening line and tolerate
    // the closing line. Symbol-only lines inside a multi-line export are fine.
    if (/^export\s+(type\s+)?\{\s*$/.test(line)) continue;
    if (/^\}\s+from\s+"[^"]+"\s*;?\s*$/.test(line)) continue;
    // Pure identifier inside an export brace
    if (/^(type\s+)?[A-Za-z_$][\w$]*(\s+as\s+[A-Za-z_$][\w$]*)?\s*,?\s*$/.test(line)) continue;
    return false;
  }
  return true;
}

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
    if (entry.name === "index.ts") out.push(full);
  }
}

async function main() {
  const indexFiles = [];
  try {
    await walk(ROOT, indexFiles);
  } catch (err) {
    console.error(`[guard-no-internal-barrels] walk failed: ${err.message ?? err}`);
    process.exit(2);
  }

  const offenders = [];
  for (const abs of indexFiles) {
    const rel = relative(REPO, abs);
    if (ALLOWED_PATTERNS.some((re) => re.test(rel))) continue;
    let src;
    try {
      src = await readFile(abs, "utf8");
    } catch (err) {
      console.error(`[guard-no-internal-barrels] cannot read ${rel}: ${err.message ?? err}`);
      process.exit(2);
    }
    if (isPureReexport(src)) offenders.push(rel);
  }

  if (offenders.length === 0) {
    console.log("[guard-no-internal-barrels] no organisational barrels found — pass.");
    process.exit(0);
  }

  console.error("[guard-no-internal-barrels] FAIL — prohibited organisational barrels:");
  for (const f of offenders) console.error(`  - ${f}`);
  console.error(
    "\nWhy: organisational barrels (pure re-export `index.ts` files) break tree-shaking,\n" +
      "amplify test/HMR cache invalidation, and hide the origin of each symbol.\n" +
      "Fix: import directly from the source file. Barrels are permitted only at\n" +
      "deliberate boundary surfaces (see `codi-typescript.md` v2).",
  );
  process.exit(1);
}

main();
