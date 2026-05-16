import { describe, it, expect } from "vitest";
import { readBuiltinDefinitions } from "#src/runtime/brain/seed-workflows.js";
import { unwrap } from "./_brain-helper.js";

describe("team-consolidation workflow YAML", () => {
  it("loads with id team-consolidation and 6 phases (intent/collect/analyze/consolidate/done/abandoned)", () => {
    const defs = unwrap(readBuiltinDefinitions());
    const tc = defs.find((d) => d.id === "team-consolidation");
    expect(tc).toBeDefined();
    expect(tc!.version).toBe(2);
    expect(Object.keys(tc!.phases).sort()).toEqual([
      "abandoned",
      "analyze",
      "collect",
      "consolidate",
      "done",
      "intent",
    ]);
  });

  it("intent phase transitions to collect", () => {
    const defs = unwrap(readBuiltinDefinitions());
    const tc = defs.find((d) => d.id === "team-consolidation")!;
    expect(tc.phases["intent"]!.next).toContain("collect");
  });

  it("consolidate phase transitions to done", () => {
    const defs = unwrap(readBuiltinDefinitions());
    const tc = defs.find((d) => d.id === "team-consolidation")!;
    expect(tc.phases["consolidate"]!.next).toContain("done");
  });

  it("flags include agent_driven and produces_document", () => {
    const defs = unwrap(readBuiltinDefinitions());
    const tc = defs.find((d) => d.id === "team-consolidation")!;
    expect(tc.flags).toBeDefined();
    expect(tc.flags!["agent_driven"]).toBe(true);
    expect(tc.flags!["produces_document"]).toBe(true);
  });
});
