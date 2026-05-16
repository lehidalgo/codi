#!/usr/bin/env node
/**
 * CORE-004 — generate JSON Schema files from their Zod sources.
 *
 * Sources of truth live in `src/schemas/runtime/*.ts`. This script
 * runs `z.toJSONSchema()` (Zod v4 native) on each and writes the
 * result to the sibling `.schema.json` file. The generated files are
 * committed to git so reviewers see the diff in PRs and `npm publish`
 * consumers don't need a build step to read them.
 *
 * Modes:
 *   default   — regenerate every file in place
 *   --check   — fail (exit 1) if any committed file differs from the
 *               regenerated output. Used in CI to enforce single-source.
 *
 * The runtime still loads the .schema.json via Ajv in
 * `src/runtime/{event-factory,subagent-runner}.ts` — unchanged.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(dirname(__filename));

const CHECK_MODE = process.argv.includes("--check");

/**
 * Generators map: ts source → output JSON Schema path.
 * Each entry imports its Zod schema, calls `z.toJSONSchema()`, and
 * applies the codi conventions ($id + $schema overrides, sorted keys).
 */
const GENERATORS = [
  {
    label: "gate-result",
    source: "src/schemas/runtime/gate-result.ts",
    output: "src/schemas/runtime/gate-result.schema.json",
    metadata: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://codi.dev/schemas/gate-result/v1.0.0",
      title: "Gate Result",
      description:
        "Structured verdict produced by a gate check. Returned by both deterministic and agent (subagent) checks.",
    },
    importExport: "GateResultSchema",
  },
];

/**
 * Canonical JSON serializer: sorted keys, 2-space indent, trailing
 * newline. Stable across runs and Node minor versions, so the CI
 * `--check` diff doesn't bounce on insertion order.
 */
function canonicalStringify(obj) {
  const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v !== null && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(obj), null, 2) + "\n";
}

async function runGenerator(spec) {
  const { z } = await import("zod");
  const modulePath = join(REPO, spec.source);
  const mod = await import(modulePath);
  const schema = mod[spec.importExport];
  if (!schema) {
    throw new Error(
      `[generate-json-schemas] ${spec.label}: export "${spec.importExport}" not found in ${spec.source}`,
    );
  }

  // z.toJSONSchema returns a draft-2020-12 schema by default in Zod v4.
  // We merge our codi-specific metadata ($id, title, description) so the
  // public $id URL stays stable across regenerations.
  const generated = z.toJSONSchema(schema, { target: "draft-2020-12" });
  const merged = { ...spec.metadata, ...generated };
  return canonicalStringify(merged);
}

async function main() {
  let driftFound = false;
  for (const spec of GENERATORS) {
    const outputPath = join(REPO, spec.output);
    const expected = await runGenerator(spec);
    let actual = "";
    try {
      actual = await readFile(outputPath, "utf-8");
    } catch {
      // Missing file is drift in --check mode; write on regen.
    }
    if (actual !== expected) {
      if (CHECK_MODE) {
        console.error(
          `[generate-json-schemas] DRIFT: ${relative(REPO, outputPath)} is out of sync with ${spec.source}`,
        );
        console.error(`Run: npm run schemas:generate`);
        driftFound = true;
      } else {
        await writeFile(outputPath, expected, "utf-8");
        console.log(`[generate-json-schemas] wrote ${relative(REPO, outputPath)}`);
      }
    } else {
      if (!CHECK_MODE) {
        console.log(`[generate-json-schemas] unchanged: ${relative(REPO, outputPath)}`);
      }
    }
  }
  if (CHECK_MODE) {
    if (driftFound) {
      process.exit(1);
    }
    console.log("[generate-json-schemas] all generated schemas match — no drift.");
  }
}

main().catch((err) => {
  console.error("[generate-json-schemas] FAIL:", err.message ?? err);
  process.exit(2);
});
