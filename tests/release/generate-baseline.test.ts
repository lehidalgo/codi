/**
 * Writes artifact-version-baseline.json from current template hashes.
 * Run via: pnpm baseline:update
 * Not a real test — produces a side effect (file write) and always passes.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it, expect } from "vitest";
import { buildTemplateHashRegistry } from "#src/core/version/template-hash-registry.js";

it("generates artifact-version-baseline.json", () => {
  const registry = buildTemplateHashRegistry();
  const baseline: Record<string, { version: number; hash: string }> = {};

  for (const [name, fingerprint] of Object.entries(registry.templates)) {
    baseline[name] = {
      version: fingerprint.artifactVersion,
      hash: fingerprint.contentHash,
    };
  }

  const outputPath = resolve(process.cwd(), "src/core/version/artifact-version-baseline.json");

  writeFileSync(outputPath, JSON.stringify(baseline, null, 2) + "\n", "utf-8");

  const count = Object.keys(baseline).length;
  console.log(`✓ Baseline updated: ${count} artifacts written`);
  expect(count).toBeGreaterThan(0);
});
