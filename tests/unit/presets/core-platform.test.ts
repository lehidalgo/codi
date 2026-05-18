import { describe, it, expect } from "vitest";
import { CORE_PLATFORM_RULES, CORE_PLATFORM_SKILLS } from "#src/templates/presets/core-platform.js";
import { preset as defaultPreset } from "#src/templates/presets/default.js";

const ALL_PRESETS = [defaultPreset];

// ── CORE_PLATFORM_RULES ───────────────────────────────────────────────────

describe("CORE_PLATFORM_RULES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(CORE_PLATFORM_RULES)).toBe(true);
    expect(CORE_PLATFORM_RULES.length).toBeGreaterThan(0);
  });

  it("contains the improvement-dev rule", () => {
    expect(CORE_PLATFORM_RULES).toContain("codi-improvement-dev");
  });

  it("contains only string entries", () => {
    for (const rule of CORE_PLATFORM_RULES) {
      expect(typeof rule).toBe("string");
    }
  });

  it("has no duplicate entries", () => {
    const unique = new Set(CORE_PLATFORM_RULES);
    expect(unique.size).toBe(CORE_PLATFORM_RULES.length);
  });
});

// ── CORE_PLATFORM_SKILLS ──────────────────────────────────────────────────

describe("CORE_PLATFORM_SKILLS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(CORE_PLATFORM_SKILLS)).toBe(true);
    expect(CORE_PLATFORM_SKILLS.length).toBeGreaterThan(0);
  });

  it("contains all 5 expected self-improvement skills", () => {
    expect(CORE_PLATFORM_SKILLS).toContain("codi-verify-evidence");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-dev-session-recovery");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-dev-rule-feedback");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-dev-refine-rules");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-dev-compare-preset");
  });

  it("contains only string entries", () => {
    for (const skill of CORE_PLATFORM_SKILLS) {
      expect(typeof skill).toBe("string");
    }
  });

  it("has no duplicate entries", () => {
    const unique = new Set(CORE_PLATFORM_SKILLS);
    expect(unique.size).toBe(CORE_PLATFORM_SKILLS.length);
  });

  it("does not contain command-creator (removed in heartbeat refactor)", () => {
    expect(CORE_PLATFORM_SKILLS).not.toContain("codi-command-creator");
  });
});

// ── Every registered preset includes core platform artifacts ──────────────

describe("All registered presets include CORE_PLATFORM_RULES", () => {
  for (const preset of ALL_PRESETS) {
    it(`${preset.name} includes codi-improvement-dev rule`, () => {
      for (const rule of CORE_PLATFORM_RULES) {
        expect(preset.rules).toContain(rule);
      }
    });
  }
});

describe("All registered presets include CORE_PLATFORM_SKILLS", () => {
  for (const preset of ALL_PRESETS) {
    it(`${preset.name} includes all 5 core platform skills`, () => {
      for (const skill of CORE_PLATFORM_SKILLS) {
        expect(preset.skills).toContain(skill);
      }
    });
  }
});

// ── No registered preset has duplicate rules or skills ────────────────────

describe("No registered preset has duplicate rules or skills", () => {
  for (const preset of ALL_PRESETS) {
    it(`${preset.name} has no duplicate rules`, () => {
      const unique = new Set(preset.rules);
      expect(unique.size).toBe(preset.rules.length);
    });

    it(`${preset.name} has no duplicate skills`, () => {
      const unique = new Set(preset.skills);
      expect(unique.size).toBe(preset.skills.length);
    });
  }
});
