#!/usr/bin/env node
/**
 * CORE-022 — advisory file-size guard.
 *
 * Walks `src/cli/**` and `src/core/**` (excluding `.d.ts`, test files,
 * and known intentional large modules) and emits a warning for every
 * `.ts` file > 700 LOC. Unlike the other guards, this one is
 * ADVISORY: it always exits 0. The purpose is to surface candidate
 * refactor targets early — exceeding the threshold is a signal that
 * the file is doing too many things, not a hard error.
 *
 * Thresholds:
 *   - 700 LOC  → WARN (advisory)
 *   - 1200 LOC → STRONG WARN (top of refactor queue)
 *
 * Exit code:
 *   0 — always (advisory; never blocks CI)
 *
 * Out of scope (allow-listed):
 *   - `src/cli/init-helpers.ts` — phase library, intentionally a tall
 *     module since CORE-020 (12 phase helpers + types). Splitting
 *     further fragments init flow legibility for zero gain.
 */
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const REPO = process.cwd();
const ROOTS = ["src/cli", "src/core"];

const WARN_THRESHOLD = 700;
const STRONG_THRESHOLD = 1200;

/**
 * Files that legitimately exceed the threshold. Each entry justifies
 * why the cost of further splitting outweighs the cohesion win.
 */
const ALLOWLIST = new Set([
  // CORE-020 — init phase library. The 12 phase helpers + InitState/Context
  // types are co-located here because the orchestrator in src/cli/init.ts
  // needs all of them and splitting per-phase fragments without value.
  "src/cli/init-helpers.ts",
]);

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

async function countLines(file) {
  let count = 0;
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    void line;
    count += 1;
  }
  return count;
}

async function main() {
  const offenders = [];
  for (const root of ROOTS) {
    const files = [];
    try {
      await walk(join(REPO, root), files);
    } catch (err) {
      console.error(`[guard-file-size] walk failed for ${root}: ${err.message ?? err}`);
      process.exit(0); // advisory: still don't fail
    }
    for (const abs of files) {
      const rel = relative(REPO, abs);
      if (ALLOWLIST.has(rel)) continue;
      let lines;
      try {
        lines = await countLines(abs);
      } catch (err) {
        console.error(`[guard-file-size] cannot read ${rel}: ${err.message ?? err}`);
        continue;
      }
      if (lines > WARN_THRESHOLD) {
        offenders.push({ path: rel, lines, strong: lines > STRONG_THRESHOLD });
      }
    }
  }

  if (offenders.length === 0) {
    console.log(
      `[guard-file-size] no advisory hits (every src/{cli,core}/**/*.ts ≤ ${WARN_THRESHOLD} LOC) — pass.`,
    );
    process.exit(0);
  }

  offenders.sort((a, b) => b.lines - a.lines);
  console.warn(
    `[guard-file-size] advisory — ${offenders.length} file(s) over ${WARN_THRESHOLD} LOC:`,
  );
  for (const off of offenders) {
    const tag = off.strong ? `STRONG (> ${STRONG_THRESHOLD})` : "warn";
    console.warn(`  ${off.path}: ${off.lines} LOC — ${tag}`);
  }
  console.warn(
    "\n" +
      "Advisory only — does not block CI. Files past 700 LOC are good\n" +
      "refactor candidates; files past 1200 LOC are top of the queue.\n" +
      "To allowlist a module, add its path to ALLOWLIST in this script\n" +
      "with a one-line justification.",
  );
  process.exit(0);
}

main();
