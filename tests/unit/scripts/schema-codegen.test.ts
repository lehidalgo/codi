/**
 * CORE-004 — schema codegen contract.
 *
 * Locks the invariant that `src/schemas/runtime/*.schema.json` files
 * are byte-equal to the output of `scripts/generate-json-schemas.mjs`
 * applied to their `.ts` Zod sources. Any drift between Zod source
 * and committed JSON Schema fails this test.
 *
 * Local fix: `npm run schemas:generate`.
 * CI fix: enforced via `npm run schemas:check` in the pipeline.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO = process.cwd();
const GENERATOR = join(REPO, "scripts/generate-json-schemas.mjs");

describe("schema codegen (CORE-004)", () => {
  it("`npm run schemas:check` reports no drift on a clean tree", () => {
    const result = spawnSync(process.execPath, [GENERATOR, "--check"], {
      cwd: REPO,
      encoding: "utf-8",
    });
    if (result.status !== 0) {
      // Surface the generator's diagnostic so the test failure is actionable.
      throw new Error(
        `schemas:check failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }
    expect(result.status).toBe(0);
  });

  it("gate-result.schema.json is canonical (sorted keys, trailing newline)", () => {
    const path = join(REPO, "src/schemas/runtime/gate-result.schema.json");
    const raw = readFileSync(path, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(raw);
    const keys = Object.keys(parsed);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it("gate-result.schema.json preserves $id, $schema, title metadata", () => {
    const path = join(REPO, "src/schemas/runtime/gate-result.schema.json");
    const schema = JSON.parse(readFileSync(path, "utf-8")) as {
      $id?: string;
      $schema?: string;
      title?: string;
    };
    expect(schema.$id).toBe("https://codi.dev/schemas/gate-result/v1.0.0");
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.title).toBe("Gate Result");
  });
});
