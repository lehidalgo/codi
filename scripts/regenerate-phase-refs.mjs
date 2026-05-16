#!/usr/bin/env node
/**
 * Regenerate the auto-generated chain section in every phase-*.md from the
 * source workflow yamls (Q3 + Q6 + Q12).
 *
 *   node scripts/regenerate-phase-refs.mjs           # check-only (build-error on drift)
 *   node scripts/regenerate-phase-refs.mjs --force   # rewrite blocks unconditionally
 *
 * Exit codes:
 *   0  no work needed (all blocks match yaml) OR --force succeeded
 *   1  drift detected without --force (Q6: build-error)
 *   2  missing markers / .md files (operational error)
 */

import { resolve } from "node:path";
import { readBuiltinDefinitions } from "../src/runtime/brain/seed-workflows.ts";
import { regeneratePhaseRefs } from "../src/runtime/brain/render-chains.ts";

const HERE = new URL(".", import.meta.url).pathname;
const SKILLS_ROOT = resolve(HERE, "..", "src", "templates", "skills");

const force = process.argv.includes("--force");

const workflows = readBuiltinDefinitions();
const result = regeneratePhaseRefs(workflows, { skillsRoot: SKILLS_ROOT, force });

if (result.skippedOptOut.length > 0) {
  console.log(`opt-out (auto_generate_phase_refs=false): ${result.skippedOptOut.join(", ")}`);
}
if (result.skippedNoChange.length > 0) {
  console.log(`up-to-date: ${result.skippedNoChange.length} phase(s)`);
}
if (result.missingMd.length > 0) {
  console.log(`missing .md files (yaml has phase, file does not exist):`);
  for (const m of result.missingMd) console.log(`  - ${m}`);
}
if (result.missingMarkers.length > 0) {
  console.log(`missing BEGIN/END markers (run with --force to insert):`);
  for (const m of result.missingMarkers) console.log(`  - ${m}`);
}
if (result.written.length > 0) {
  console.log(`rewrote: ${result.written.length} phase(s)`);
  for (const w of result.written) console.log(`  - ${w}`);
}

if (result.drift.length > 0) {
  console.error(`\nDRIFT detected inside auto-generated block(s) — manual edits found:`);
  for (const d of result.drift) {
    console.error(`  - ${d.path}`);
    console.error(`      expected hash: ${d.expectedHash}`);
    console.error(`      found hash:    ${d.foundHash}`);
  }
  console.error(`\nFix: either restore the block or run with --force to regenerate.`);
  process.exit(1);
}

if (result.missingMd.length > 0 || result.missingMarkers.length > 0) {
  process.exit(2);
}

process.exit(0);
