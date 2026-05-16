#!/usr/bin/env node
/**
 * ISSUE-016 architectural guard — agent identity drift prevention.
 *
 * Scans src/ for hardcoded agent-id string literals outside the canonical
 * sources of truth (`src/constants.ts`, `src/adapters/`, fixtures). Every
 * known agent id MUST flow through `SUPPORTED_PLATFORMS` (constants.ts) or
 * `ALL_ADAPTERS` (adapters/index.ts) — duplicating the literals elsewhere
 * is the drift class this guard prevents.
 *
 * The guard inspects each TypeScript file for explicit array/Set literals
 * containing ≥3 known agent ids in close proximity. That pattern signals
 * "someone re-typed the SUPPORTED_PLATFORMS tuple". Two-id matches
 * (e.g., the `claude-code` + `codex` subset in agent-memory.ts) are
 * tolerated because they encode deliberate narrowings.
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one drift-prone literal found
 *   2 — internal error walking the tree
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const ROOT = join(REPO, "src");

// Files allowed to contain the full literal tuple (the canonical sources).
const WHITELIST = new Set([
  "src/constants.ts",
  "src/adapters/index.ts",
  "src/adapters/claude-code.ts",
  "src/adapters/cursor.ts",
  "src/adapters/codex.ts",
  "src/adapters/windsurf.ts",
  "src/adapters/cline.ts",
  "src/adapters/copilot.ts",
  // Preset templates legitimately encode per-preset agent subsets:
  "src/templates/presets/minimal.ts",
  "src/templates/presets/balanced.ts",
  "src/templates/presets/strict.ts",
  "src/templates/presets/fullstack.ts",
  "src/templates/presets/development.ts",
  "src/templates/presets/power-user.ts",
  // Capability matrix uses external plugin-manifest vocabulary (codex-cli,
  // gemini) deliberately — separate concern, tracked in ISSUE-097.
  "src/core/capabilities/matrix.ts",
]);

const KNOWN_IDS = ["claude-code", "cursor", "codex", "windsurf", "cline", "copilot"];

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

function countIdsInWindow(line) {
  let hits = 0;
  for (const id of KNOWN_IDS) {
    if (line.includes(`"${id}"`) || line.includes(`'${id}'`)) hits += 1;
  }
  return hits;
}

function scan(text) {
  const lines = text.split(/\r?\n/);
  const offenders = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Quick reject: no id at all on this line
    if (!KNOWN_IDS.some((id) => line.includes(id))) continue;
    // Look for window of up to 3 consecutive lines containing ≥3 ids combined.
    let total = countIdsInWindow(line);
    if (total >= 3) {
      offenders.push({ line: i + 1, text: line.trim() });
      continue;
    }
    // Multi-line literal: scan the next 4 lines too
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
      total += countIdsInWindow(lines[j]);
      if (total >= 3) {
        offenders.push({ line: i + 1, text: line.trim() });
        break;
      }
    }
  }
  return offenders;
}

async function main() {
  const files = [];
  try {
    await walk(ROOT, files);
  } catch (err) {
    console.error(`[guard-agent-identity] walk failed: ${err.message ?? err}`);
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
      console.error(`[guard-agent-identity] cannot read ${rel}: ${err.message ?? err}`);
      process.exit(2);
    }
    const hits = scan(text);
    if (hits.length > 0) failures.push({ rel, hits });
  }

  if (failures.length === 0) {
    console.log("[guard-agent-identity] no hardcoded agent-id literals found — pass.");
    process.exit(0);
  }

  console.error(
    "[guard-agent-identity] FAIL — hardcoded agent-id literals outside canonical sources:",
  );
  for (const f of failures) {
    console.error(`\n  ${f.rel}`);
    for (const h of f.hits) {
      console.error(`    line ${h.line}: ${h.text}`);
    }
  }
  console.error(
    "\nWhy: agent ids must derive from `SUPPORTED_PLATFORMS` (src/constants.ts)\n" +
      "or `ALL_ADAPTERS` (src/adapters/index.ts) — duplicating the literal tuple\n" +
      "drifts the moment a new agent is added. Replace the literal with an\n" +
      "import. Deliberate subsets are encouraged with the `satisfies\n" +
      "readonly AgentId[]` pattern (see agent-memory.ts for an example).",
  );
  process.exit(1);
}

main();
