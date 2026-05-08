import { describe, it, expect } from "vitest";
import { buildPreflightReport } from "#src/runtime/sync/index.js";

// preflightExistingSheet itself wraps googleapis (not unit-testable here without
// network mocking). buildPreflightReport is the pure logic core — these tests
// pin its semantics so the wrapper's behavior is predictable.

describe("bootstrap preflight / buildPreflightReport", () => {
  it("reports is_empty=true when every entity tab has 0 data rows", () => {
    const r = buildPreflightReport({
      BusinessGoal: 0,
      Requirement: 0,
      UserStory: 0,
      Release: 0,
    });
    expect(r.is_empty).toBe(true);
    expect(r.total_data_rows).toBe(0);
    expect(r.summary).toMatch(/Sheet is empty/);
  });

  it("reports is_empty=true when no canonical tabs were scanned (fresh user Sheet with only Sheet1)", () => {
    const r = buildPreflightReport({});
    expect(r.is_empty).toBe(true);
    expect(r.total_data_rows).toBe(0);
  });

  it("reports is_empty=false when any entity has rows", () => {
    const r = buildPreflightReport({
      BusinessGoal: 3,
      Requirement: 0,
      UserStory: 0,
      Release: 0,
    });
    expect(r.is_empty).toBe(false);
    expect(r.total_data_rows).toBe(3);
    expect(r.summary).toMatch(/3 data rows/);
    expect(r.summary).toContain("BusinessGoal=3");
  });

  it("summary lists ONLY non-zero entities (skips empty tabs)", () => {
    const r = buildPreflightReport({
      BusinessGoal: 3,
      Requirement: 0,
      UserStory: 12,
      Release: 0,
    });
    expect(r.summary).toContain("BusinessGoal=3");
    expect(r.summary).toContain("UserStory=12");
    expect(r.summary).not.toContain("Requirement");
    expect(r.summary).not.toContain("Release");
  });

  it("total_data_rows aggregates across all tabs", () => {
    const r = buildPreflightReport({
      BusinessGoal: 3,
      Requirement: 10,
      UserStory: 13,
      Release: 1,
    });
    expect(r.total_data_rows).toBe(27);
  });
});

describe("bootstrap preflight / regression — D1 from T4.6 audit", () => {
  it("reproduces the exact reused-Sheet scenario: 3 BG + 10 REQ + 13 US flags as non-empty", () => {
    // From the T4.6 walkthrough: agent silently bound to a Sheet that already
    // had data from a previous run (acme-social-auth). With B3 in place,
    // this preflight should refuse without --force.
    const r = buildPreflightReport({
      BusinessGoal: 3,
      Requirement: 10,
      UserStory: 13,
      Release: 0,
    });
    expect(r.is_empty).toBe(false);
    expect(r.summary).toMatch(/26 data rows/);
    expect(r.summary).toContain("BusinessGoal=3");
    expect(r.summary).toContain("Requirement=10");
    expect(r.summary).toContain("UserStory=13");
  });
});
