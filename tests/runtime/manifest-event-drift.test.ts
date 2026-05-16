/**
 * CORE-004b — drift-detection bridge for manifest-event.schema.json.
 *
 * The full Zod canonical port of the 1031-LOC manifest-event schema
 * (43 oneOf variants, per-payload shapes) is deferred — the
 * mechanical translation is genuinely substantial and the marginal
 * ROI over the existing JSON Schema + Ajv runtime validation is
 * low. The REAL risk CORE-004b targets is **drift** between:
 *
 *   1. `src/schemas/runtime/manifest-event.schema.json` (Ajv-validated)
 *   2. `src/runtime/types.ts:EVENT_TYPES` (TypeScript narrow union)
 *   3. `src/runtime/types.ts:COMMITABLE_EVENT_TYPES` (replay filter)
 *
 * Pre-CORE-004b: adding a new event variant required updating both
 * files. Forget one, and the TS union goes stale while the schema
 * still accepts the new payload at runtime — a silent type-safety
 * hole. These tests pin the cross-file invariants so the next
 * variant addition is forced to keep both in sync.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EVENT_TYPES, COMMITABLE_EVENT_TYPES } from "#src/runtime/types.js";

interface ManifestEventSchema {
  oneOf: Array<{
    properties: {
      event_type: { const: string };
      commitable?: { const: boolean };
    };
  }>;
}

function loadSchema(): ManifestEventSchema {
  const schemaPath = resolve(
    process.cwd(),
    "src/schemas/runtime/manifest-event.schema.json",
  );
  const raw = readFileSync(schemaPath, "utf8");
  return JSON.parse(raw) as ManifestEventSchema;
}

describe("manifest-event drift (CORE-004b)", () => {
  it("EVENT_TYPES matches the schema's oneOf event_type consts", () => {
    const schema = loadSchema();
    const schemaTypes = new Set(schema.oneOf.map((v) => v.properties.event_type.const));
    const tsTypes = new Set(EVENT_TYPES as readonly string[]);

    // Bidirectional diff so the failure message lists BOTH sides.
    const onlyInSchema = [...schemaTypes].filter((t) => !tsTypes.has(t));
    const onlyInTs = [...tsTypes].filter((t) => !schemaTypes.has(t));

    expect(
      onlyInSchema,
      `Schema declares event_type values not in EVENT_TYPES (TS union missing entries — update src/runtime/types.ts): ${JSON.stringify(onlyInSchema)}`,
    ).toEqual([]);
    expect(
      onlyInTs,
      `EVENT_TYPES declares values not in the schema (schema variant missing — add a oneOf entry to manifest-event.schema.json): ${JSON.stringify(onlyInTs)}`,
    ).toEqual([]);
  });

  it("COMMITABLE_EVENT_TYPES matches the schema's `commitable: const: true` flags", () => {
    const schema = loadSchema();
    const schemaCommitable = new Set(
      schema.oneOf
        .filter((v) => v.properties.commitable?.const === true)
        .map((v) => v.properties.event_type.const),
    );
    const tsCommitable = new Set(COMMITABLE_EVENT_TYPES);

    const onlyInSchema = [...schemaCommitable].filter((t) => !tsCommitable.has(t as never));
    const onlyInTs = [...tsCommitable].filter((t) => !schemaCommitable.has(t));

    expect(
      onlyInSchema,
      `Schema marks these as commitable but COMMITABLE_EVENT_TYPES omits them: ${JSON.stringify(onlyInSchema)}`,
    ).toEqual([]);
    expect(
      onlyInTs,
      `COMMITABLE_EVENT_TYPES includes types the schema does NOT mark commitable: ${JSON.stringify(onlyInTs)}`,
    ).toEqual([]);
  });

  it("every schema variant carries an explicit commitable flag (no implicit defaults)", () => {
    // Without this assertion an author could add a oneOf variant
    // without `commitable: const: true|false` and the COMMITABLE
    // filter would silently treat it as non-commitable. Forcing the
    // explicit flag keeps the contract obvious.
    const schema = loadSchema();
    const missing = schema.oneOf
      .filter((v) => v.properties.commitable?.const === undefined)
      .map((v) => v.properties.event_type.const);
    expect(
      missing,
      `Schema variants missing explicit commitable flag: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });

  it("EVENT_TYPES has no duplicates", () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
  });

  it("schema oneOf has no duplicate event_type consts", () => {
    const schema = loadSchema();
    const consts = schema.oneOf.map((v) => v.properties.event_type.const);
    expect(new Set(consts).size).toBe(consts.length);
  });
});
