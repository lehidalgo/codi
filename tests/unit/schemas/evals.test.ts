import { describe, it, expect } from "vitest";
import { EvalCaseSchema, EvalsDataSchema } from "#src/schemas/evals.js";

describe("EvalCaseSchema", () => {
  it("accepts valid eval case with all fields", () => {
    const result = EvalCaseSchema.safeParse({
      id: "case-1",
      description: "Check commit message format",
      input: "feat: add login",
      expectedOutput: "valid",
      passed: true,
      lastRunAt: "2026-03-28T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal eval case (id + description only)", () => {
    const result = EvalCaseSchema.safeParse({
      id: "case-2",
      description: "Minimal case",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input).toBeUndefined();
      expect(result.data.expectedOutput).toBeUndefined();
      expect(result.data.passed).toBeUndefined();
      expect(result.data.lastRunAt).toBeUndefined();
    }
  });

  it("rejects missing id", () => {
    const result = EvalCaseSchema.safeParse({
      description: "No id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = EvalCaseSchema.safeParse({
      id: "case-3",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid lastRunAt datetime", () => {
    const result = EvalCaseSchema.safeParse({
      id: "case-4",
      description: "Bad datetime",
      lastRunAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("EvalsDataSchema", () => {
  const validData = {
    skillName: "commit",
    cases: [
      { id: "c1", description: "Test case 1" },
      { id: "c2", description: "Test case 2", passed: true },
    ],
    lastUpdated: "2026-03-28T12:00:00.000Z",
  };

  it("accepts valid evals data", () => {
    const result = EvalsDataSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("defaults cases to empty array", () => {
    const result = EvalsDataSchema.safeParse({ skillName: "review" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cases).toEqual([]);
      expect(result.data.lastUpdated).toBeUndefined();
    }
  });

  it("rejects missing skillName", () => {
    const result = EvalsDataSchema.safeParse({ cases: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid lastUpdated datetime", () => {
    const result = EvalsDataSchema.safeParse({
      skillName: "commit",
      lastUpdated: "yesterday",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid case in cases array", () => {
    const result = EvalsDataSchema.safeParse({
      skillName: "commit",
      cases: [{ id: "c1" }], // missing description
    });
    expect(result.success).toBe(false);
  });
});
