import { describe, it, expect } from "vitest";
import {
  collectRuleEntries,
  collectAgentEntries,
  collectPresetEntries,
} from "#src/core/docs/skill-docs-generator.js";

describe("collectRuleEntries", () => {
  it("returns at least 10 rules with required fields", () => {
    const entries = collectRuleEntries();
    expect(entries.length).toBeGreaterThanOrEqual(10);
    for (const e of entries) {
      expect(e.type).toBe("rule");
      expect(e.name).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(e.body).toBeTruthy();
      expect(typeof e.alwaysApply).toBe("boolean");
    }
  });
});

describe("collectAgentEntries", () => {
  it("returns at least 10 agents with required fields", () => {
    const entries = collectAgentEntries();
    expect(entries.length).toBeGreaterThanOrEqual(10);
    for (const e of entries) {
      expect(e.type).toBe("agent");
      expect(e.name).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(e.body).toBeTruthy();
      expect(Array.isArray(e.tools)).toBe(true);
    }
  });
});

describe("collectPresetEntries", () => {
  it("returns all builtin presets with required fields", () => {
    const entries = collectPresetEntries();
    expect(entries.length).toBeGreaterThanOrEqual(4);
    for (const e of entries) {
      expect(e.type).toBe("preset");
      expect(e.name).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(Array.isArray(e.tags)).toBe(true);
      expect(Array.isArray(e.rules)).toBe(true);
      expect(Array.isArray(e.skills)).toBe(true);
    }
  });
});
