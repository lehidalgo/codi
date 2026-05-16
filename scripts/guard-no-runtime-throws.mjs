#!/usr/bin/env node
/**
 * CORE-017 — bans new `throw new Error(...)` / `throw new SomeError(...)`
 * statements in CLI-facing runtime handler files. Handlers must return
 * `Result<T, ProjectError[]>` so the CLI layer can map outcomes to exit
 * codes deterministically.
 *
 * Scope:
 *   src/runtime/cli-handlers/**.ts  — every CLI handler returns Result.
 *   src/runtime/replay.ts            — Result-returning library function.
 *
 * Out of scope (intentional):
 *   src/runtime/brain/seed-workflows.ts — public API (readBuiltinDefinitions,
 *     seedWorkflowDefinitions) returns Result. Its private validateShape /
 *     validatePhaseChains / validateChainEntry helpers throw because the
 *     `asserts ... is ...` narrowing semantics require it; throws are
 *     caught at the public boundary and mapped to
 *     E_WORKFLOW_DEFINITION_INVALID. Documented in the file header.
 *
 * KEEP scope (NOT enforced — these throws are intentional, documented in
 * the CORE-017 closure notes):
 *   src/runtime/reducer.ts              — event-sourcing panic semantics
 *   src/runtime/workflow-graph.ts       — typed errors used with instanceof
 *   src/runtime/event-factory.ts        — writer-bug guards (asserts)
 *   src/runtime/brain-event-log.ts      — SQL ordering invariants
 *   src/runtime/brain/db.ts             — fatal infra (BrainBindingsError)
 *   src/runtime/workflow-id.ts          — invariant: 100-attempt limit
 *   src/runtime/brain-ui/cli-server.ts  — script entry point
 *   src/runtime/subagent-runner.ts      — boundary rethrow
 *   src/runtime/capture/session.ts      — retry-loop control-flow signal
 *   src/runtime/brain/render-chains.ts  — role-hint invariant
 *
 * Allowed in the scoped files:
 *   - `throw e` inside a catch block that re-throws after type narrowing
 *     (e.g. `if (e instanceof KnownError) {...} else { throw e; }`).
 *   - `throw new Error(...)` inside a function marked with an
 *     `asserts ... is ...` return signature (preserved for type narrowing).
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one banned throw found
 *   2 — internal error walking the tree
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const SCOPED_FILES_OR_DIRS = [
  "src/runtime/cli-handlers",
  "src/runtime/replay.ts",
];

// `throw new <Identifier>(` — covers `throw new Error(...)`,
// `throw new NoActiveWorkflowError()`, etc.
const BANNED = /^\s*throw\s+new\s+[A-Z]\w*\s*\(/;

// Allowed patterns that should NOT count as offenders:
//   1) `throw e;` or `throw err;` — typed-rethrow inside a catch.
//   2) line is inside a function body whose declaration line carries
//      `: asserts ... is ...` (TypeScript assertion functions).
const ALLOW_RETHROW = /^\s*throw\s+[a-z_]\w*\s*;?\s*(?:\/\/.*)?$/;

async function walk(target, out) {
  let s;
  try {
    s = await stat(target);
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    throw err;
  }
  if (s.isFile()) {
    if (target.endsWith(".ts") && !target.endsWith(".d.ts")) out.push(target);
    return;
  }
  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(target, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await walk(full, out);
      continue;
    }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(full);
  }
}

/**
 * Walk back from `lineIdx` to find the enclosing function declaration line.
 * If that line contains `: asserts ` or `asserts ... is `, the throw is
 * inside a TypeScript assertion function and is allowed (the asserts
 * narrowing semantics REQUIRE throwing).
 */
function isInsideAssertionFunction(lines, lineIdx) {
  let depth = 0;
  for (let i = lineIdx; i >= 0; i -= 1) {
    const line = lines[i];
    for (let j = line.length - 1; j >= 0; j -= 1) {
      const ch = line[j];
      if (ch === "}") depth += 1;
      else if (ch === "{") {
        depth -= 1;
        if (depth < 0) {
          // Found the enclosing brace — the function header is on this
          // line or the previous one or two (multiline signature).
          const header = `${lines[i - 2] ?? ""}\n${lines[i - 1] ?? ""}\n${lines[i] ?? ""}`;
          return /:\s*asserts\s+\w+(?:\s+is\s+[^{]+)?/.test(header);
        }
      }
    }
  }
  return false;
}

async function findOffenders() {
  const offenders = [];
  for (const root of SCOPED_FILES_OR_DIRS) {
    const rootPath = join(REPO, root);
    const files = [];
    try {
      await walk(rootPath, files);
    } catch (err) {
      console.error(`[guard-no-runtime-throws] walk failed for ${root}: ${err.message ?? err}`);
      process.exit(2);
    }
    for (const abs of files) {
      let src;
      try {
        src = await readFile(abs, "utf8");
      } catch (err) {
        console.error(
          `[guard-no-runtime-throws] cannot read ${relative(REPO, abs)}: ${err.message ?? err}`,
        );
        process.exit(2);
      }
      const lines = src.split(/\r?\n/);
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (ALLOW_RETHROW.test(line)) continue;
        if (!BANNED.test(line)) continue;
        if (isInsideAssertionFunction(lines, i)) continue;
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
      "[guard-no-runtime-throws] no banned `throw new …` in CLI-handler runtime files — pass.",
    );
    process.exit(0);
  }

  console.error("[guard-no-runtime-throws] FAIL — banned throws in runtime handler scope:");
  for (const off of offenders) {
    console.error(`\n  ${off.path}`);
    for (const hit of off.hits) {
      console.error(`    line ${hit.line}: ${hit.text}`);
    }
  }
  console.error(
    "\nWhy: CORE-017 — runtime CLI handlers return `Result<T, ProjectError[]>`\n" +
      "so the CLI maps outcomes to exit codes deterministically. Replace each\n" +
      "`throw new Error(...)` with `return err([createError('E_CODE', ctx)])`\n" +
      "(see src/runtime/cli-handlers/lifecycle.ts for the pattern). If the\n" +
      "throw genuinely belongs to a typed-error class consumed via instanceof,\n" +
      "move the class to one of the documented KEEP-scope files\n" +
      "(reducer.ts, workflow-graph.ts, brain-event-log.ts, etc.) and let the\n" +
      "handler catch + map it at its boundary.",
  );
  process.exit(1);
}

main();
