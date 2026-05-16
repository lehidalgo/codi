/**
 * Smoke test for the CORE-004 Zod canonical of `gate-result.schema.json`.
 *
 * `src/schemas/runtime/gate-result.ts` exports `GateResultSchema` —
 * the source of truth that `npm run schemas:generate` reads to
 * produce the matching `.schema.json`. The runtime still consumes
 * the JSON Schema via Ajv (`runtime/subagent-runner.ts`), so this
 * test exists to keep the canonical module measured by coverage
 * (otherwise the file shows 0% because it has no production import
 * site — only the build script reads it).
 */
import { describe, it, expect } from "vitest";
import { GateResultSchema, type GateResult } from "#src/schemas/runtime/gate-result.js";

describe("GateResultSchema (CORE-004)", () => {
  it("parses a pass verdict with summary", () => {
    const sample: GateResult = {
      verdict: "pass",
      check_id: "task_described",
      summary: "Task field is non-empty.",
    };
    expect(GateResultSchema.parse(sample)).toEqual(sample);
  });

  it("parses a fail verdict with evidence + suggested_action", () => {
    const sample: GateResult = {
      verdict: "fail",
      check_id: "scope_files_listed",
      summary: "Plan scope is empty.",
      evidence: { count: 0 },
      suggested_action: "Add at least one file via `codi workflow scope propose-expansion`.",
    };
    expect(GateResultSchema.parse(sample)).toEqual(sample);
  });

  it("accepts the optional `tokens_consumed` field as a non-negative integer", () => {
    const sample = {
      verdict: "pass" as const,
      check_id: "x",
      tokens_consumed: 1234,
    };
    expect(GateResultSchema.parse(sample).tokens_consumed).toBe(1234);
  });

  it("rejects an unknown verdict value", () => {
    expect(() =>
      GateResultSchema.parse({ verdict: "maybe", check_id: "x" }),
    ).toThrow();
  });

  it("rejects an empty check_id (min length 1)", () => {
    expect(() => GateResultSchema.parse({ verdict: "pass", check_id: "" })).toThrow();
  });

  it("rejects negative tokens_consumed", () => {
    expect(() =>
      GateResultSchema.parse({ verdict: "pass", check_id: "x", tokens_consumed: -1 }),
    ).toThrow();
  });

  it("rejects unknown keys (strict mode)", () => {
    expect(() =>
      GateResultSchema.parse({ verdict: "pass", check_id: "x", bogus: true }),
    ).toThrow();
  });
});
