#!/usr/bin/env node
/**
 * CORE-007 — bans `process.exitCode = ...` and `process.exit(...)` from
 * non-CLI layers. The composition root (`src/cli/**`) owns exit-code
 * routing; helper layers must return Result-shaped data and let the CLI
 * map it to an exit code.
 *
 * Pre-CORE-007 offender: `src/utils/conflict-resolver.ts:387` set
 * `process.exitCode = 2` as a hidden side-effect on hard conflicts in
 * non-TTY mode. The CLI never saw the failure unless it happened to read
 * `process.exitCode` after the call — composition by accident, not by
 * design. The new contract surfaces unresolvable conflicts on the
 * returned `ConflictResolution.unresolvable[]` so every caller is
 * forced to handle them at the type level.
 *
 * Scanned roots:
 *   src/utils/   — pure helpers, must be side-effect-free.
 *
 * NOTE on scope: `src/core/**`, `src/adapters/**`, and `src/runtime/**`
 * legitimately ship strings that contain `process.exit(1)` because they
 * generate standalone hook scripts (e.g. `core/hooks/hook-templates.ts`,
 * `core/hooks/heartbeat-hooks.ts`). Static analysis cannot reliably
 * distinguish a template literal payload from a real call, so this guard
 * keeps the narrow CORE-007 contract: only `src/utils/**` is banned.
 * The other layers stay free of real exit-code writes by convention and
 * the per-caller Result handling that CORE-007 introduced (see
 * `src/core/generator/generator.ts`, `src/cli/update.ts`).
 *
 * Allowed in `src/cli/**` (and indirectly via template strings in
 * `src/core/hooks/**`), where `process.exit(EXIT_CODES.*)` is the
 * canonical exit channel after `handleOutput(result, options)`.
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one banned write found
 *   2 — internal error walking the tree
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const ROOTS = ["src/utils"];

// `process.exitCode = …` (assignment) OR `process.exit(…)` (invocation).
// Negative lookbehind avoids matching `process.exitCode === 2` (read,
// allowed) and `process.exit` mentioned in a comment.
const BANNED = /^\s*process\.(exit|exitCode)\s*[=(]/;

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
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(full);
  }
}

async function findOffenders() {
  const offenders = [];
  for (const root of ROOTS) {
    const rootDir = join(REPO, root);
    const files = [];
    try {
      await walk(rootDir, files);
    } catch (err) {
      console.error(`[guard-no-process-exit] walk failed for ${root}: ${err.message ?? err}`);
      process.exit(2);
    }
    for (const abs of files) {
      let src;
      try {
        src = await readFile(abs, "utf8");
      } catch (err) {
        console.error(
          `[guard-no-process-exit] cannot read ${relative(REPO, abs)}: ${err.message ?? err}`,
        );
        process.exit(2);
      }
      const lines = src.split(/\r?\n/);
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        if (BANNED.test(lines[i])) {
          hits.push({ line: i + 1, text: lines[i].trim() });
        }
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
      "[guard-no-process-exit] no banned process.exit / process.exitCode writes outside src/cli/** — pass.",
    );
    process.exit(0);
  }

  console.error(
    "[guard-no-process-exit] FAIL — banned process.exit{,Code} writes outside src/cli/**:",
  );
  for (const off of offenders) {
    console.error(`\n  ${off.path}`);
    for (const hit of off.hits) {
      console.error(`    line ${hit.line}: ${hit.text}`);
    }
  }
  console.error(
    "\nWhy: helper layers must return Result-shaped data so the CLI can\n" +
      "map outcomes to exit codes deterministically. Setting process.exitCode\n" +
      "or calling process.exit() inside utils/, core/, adapters/, or runtime/\n" +
      "creates hidden global state that callers and tests cannot observe.\n" +
      "Move the exit-code mapping to src/cli/** after inspecting the returned\n" +
      "Result (see src/cli/generate.ts and src/cli/update.ts for the pattern).",
  );
  process.exit(1);
}

main();
