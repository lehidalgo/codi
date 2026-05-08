import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";

interface SampleEvent {
  event_id: string;
  event_type: string;
  commitable: boolean;
  [k: string]: unknown;
}

const schemasDir = resolve(process.cwd(), "src", "schemas", "runtime");
const schema = JSON.parse(readFileSync(resolve(schemasDir, "manifest-event.schema.json"), "utf-8"));
const samples: SampleEvent[] = JSON.parse(
  readFileSync(resolve(schemasDir, "sample-events.json"), "utf-8"),
);

let validate: ValidateFunction;

beforeAll(() => {
  const ajv = new Ajv2020({ allErrors: true, strict: false, discriminator: true });
  addFormats.default(ajv);
  validate = ajv.compile(schema);
});

describe("manifest-event schema", () => {
  it("declares the closed canonical vocabulary", () => {
    const canonicalTypes = (
      schema.oneOf as Array<{ properties: { event_type: { const: string } } }>
    ).map((v) => v.properties.event_type.const);
    expect(canonicalTypes.length).toBeGreaterThan(0);
    expect(new Set(canonicalTypes).size).toBe(canonicalTypes.length);
  });

  it("has a sample for every canonical event type", () => {
    const canonicalTypes = new Set(
      (schema.oneOf as Array<{ properties: { event_type: { const: string } } }>).map(
        (v) => v.properties.event_type.const,
      ),
    );
    const sampleTypes = new Set(samples.map((s) => s.event_type));
    for (const t of canonicalTypes) {
      expect(sampleTypes.has(t), `Missing sample for ${t}`).toBe(true);
    }
  });

  it("rejects samples that reference unknown event types", () => {
    const canonicalTypes = new Set(
      (schema.oneOf as Array<{ properties: { event_type: { const: string } } }>).map(
        (v) => v.properties.event_type.const,
      ),
    );
    for (const s of samples) {
      expect(canonicalTypes.has(s.event_type), `Unknown type ${s.event_type}`).toBe(true);
    }
  });

  describe("each sample event", () => {
    for (const sample of samples) {
      it(`${sample.event_type} validates`, () => {
        const ok = validate(sample);
        if (!ok) {
          console.error(JSON.stringify(validate.errors, null, 2));
        }
        expect(ok).toBe(true);
      });
    }
  });

  describe("rejects malformed events", () => {
    it("rejects event with unknown event_type", () => {
      const bad = { ...samples[0], event_type: "definitely_not_a_real_event" };
      expect(validate(bad)).toBe(false);
    });

    it("rejects event with missing required field", () => {
      const sample = samples[0];
      if (!sample) throw new Error("samples[0] missing");
      const { event_id, ...rest } = sample;
      void event_id;
      expect(validate(rest)).toBe(false);
    });

    it("rejects event with malformed event_id", () => {
      const bad = { ...samples[0], event_id: "not-a-uuid" };
      expect(validate(bad)).toBe(false);
    });

    it("rejects event with extra payload field", () => {
      const sample = samples[0];
      if (!sample) throw new Error("samples[0] missing");
      const bad = { ...sample, payload: { ...(sample.payload as object), extra: "field" } };
      expect(validate(bad)).toBe(false);
    });

    it("rejects event with wrong commitable value", () => {
      const init = samples.find((s) => s.event_type === "init");
      if (!init) throw new Error("init sample missing");
      const bad = { ...init, commitable: false };
      expect(validate(bad)).toBe(false);
    });
  });
});
