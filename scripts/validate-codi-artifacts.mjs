#!/usr/bin/env node
/**
 * Q9 — CI validator entry point. Runs the v1 4-check suite against the
 * source-layer artifacts (`src/templates/`) and exits non-zero on any error.
 *
 *   node scripts/validate-codi-artifacts.mjs
 *
 * Exit codes:
 *   0  no errors (warnings allowed)
 *   1  one or more errors — block the PR
 */

import { resolve } from "node:path";
import { readBuiltinDefinitions } from "../src/runtime/brain/seed-workflows.ts";
import { validateArtifacts } from "../src/runtime/brain/validate-artifacts.ts";

const HERE = new URL(".", import.meta.url).pathname;
const REPO_ROOT = resolve(HERE, "..");
const SKILLS_ROOT = resolve(REPO_ROOT, "src", "templates", "skills");

let workflows;
try {
  workflows = readBuiltinDefinitions();
} catch (err) {
  console.error("Workflow yaml schema validation failed (Check #5):");
  console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const report = validateArtifacts({
  skillsRoot: SKILLS_ROOT,
  workflows,
  repoRoot: REPO_ROOT,
});

console.log(`Checks run: ${report.checksRun.join(", ")}`);
console.log(`Errors:     ${report.errors.length}`);
console.log(`Warnings:   ${report.warnings.length}`);

if (report.errors.length > 0) {
  console.error(`\nERRORS:`);
  for (const e of report.errors) {
    console.error(`  [#${e.check}] ${e.message}`);
    if (e.location !== undefined) console.error(`           at ${e.location}`);
  }
}

if (report.warnings.length > 0) {
  console.warn(`\nWARNINGS:`);
  for (const w of report.warnings) {
    console.warn(`  [#${w.check}] ${w.message}`);
    if (w.location !== undefined) console.warn(`           at ${w.location}`);
  }
}

process.exit(report.errors.length > 0 ? 1 : 0);
