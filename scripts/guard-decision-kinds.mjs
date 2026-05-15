#!/usr/bin/env node
/**
 * CORE-008 — bans the `payload as { kind?: string }` cast pattern from
 * `src/runtime/**`. Every `decision_recorded.kind` lookup must route
 * through the type-safe helpers in `src/runtime/decision-kinds.ts`
 * (`findDecisionByKind`, `filterDecisionsByKind`, `hasDecisionKind`).
 *
 * Pre-CORE-008 offender: 8 sites in `src/runtime/gate-runner.ts` each
 * did `const p = e.payload as { kind?: string }; if (p.kind === "...")`.
 * A typo in any of those literals silently broke its gate — the
 * comparison would never match, the gate would always fail, but
 * `tsc` saw no problem because `kind?: string` accepted any string.
 *
 * Scanned root: `src/runtime/`.
 *
 * Excluded:
 *   - `src/runtime/decision-kinds.ts` itself (the helper module is
 *     allowed to inspect payload.kind freely).
 *   - The `refactor_adaptation.kind` cast at gate-runner.ts that
 *     belongs to the `init` event payload, not `decision_recorded`.
 *     This guard matches on the literal text "kind?: string" inside a
 *     cast; the init payload uses a typed object literal that has a
 *     surrounding `refactor_adaptation?: { kind?: string }` shape — we
 *     match the narrower pattern only.
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one banned cast found
 *   2 — internal error walking the tree
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const ROOT = "src/runtime";
const ALLOW_FILES = new Set(["decision-kinds.ts"]);

// Match `as { kind?: string }` ONLY when it's the direct payload cast
// pattern: zero or one extra fields, no nested object types. This
// avoids false positives on `refactor_adaptation?: { kind?: string }`
// (which is `?:`-property syntax, not `as`-cast syntax).
const BANNED = /\bas\s*\{\s*kind\?:\s*string\s*[;,}]/;

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
  const rootDir = join(REPO, ROOT);
  const files = [];
  try {
    await walk(rootDir, files);
  } catch (err) {
    console.error(`[guard-decision-kinds] walk failed for ${ROOT}: ${err.message ?? err}`);
    process.exit(2);
  }
  for (const abs of files) {
    const basename = abs.split("/").pop() ?? "";
    if (ALLOW_FILES.has(basename)) continue;
    let src;
    try {
      src = await readFile(abs, "utf8");
    } catch (err) {
      console.error(
        `[guard-decision-kinds] cannot read ${relative(REPO, abs)}: ${err.message ?? err}`,
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
  return offenders;
}

async function main() {
  const offenders = await findOffenders();
  if (offenders.length === 0) {
    console.log(
      "[guard-decision-kinds] no `as { kind?: string }` casts in src/runtime/** — pass.",
    );
    process.exit(0);
  }

  console.error(
    "[guard-decision-kinds] FAIL — banned `as { kind?: string }` cast(s) found:",
  );
  for (const off of offenders) {
    console.error(`\n  ${off.path}`);
    for (const hit of off.hits) {
      console.error(`    line ${hit.line}: ${hit.text}`);
    }
  }
  console.error(
    "\nWhy: a typo inside `payload.kind === \"...\"` after a `kind?: string`\n" +
      "cast is invisible to tsc — the wrong gate silently always fails.\n" +
      "Use the type-safe helpers in src/runtime/decision-kinds.ts:\n" +
      "  findDecisionByKind(events, kind)   — first match or undefined\n" +
      "  filterDecisionsByKind(events, kind) — every match\n" +
      "  hasDecisionKind(events, kind)       — boolean shortcut\n" +
      "A typo in the `kind` argument is now a compile error against the\n" +
      "DecisionKind union.",
  );
  process.exit(1);
}

main();
