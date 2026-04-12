import { describe, it, expect } from "vitest";
import { CORE_PLATFORM_RULES, CORE_PLATFORM_SKILLS } from "#src/templates/presets/core-platform.js";
import { preset as minimal } from "#src/templates/presets/minimal.js";
import { preset as balanced } from "#src/templates/presets/balanced.js";
import { preset as strict } from "#src/templates/presets/strict.js";
import { preset as fullstack } from "#src/templates/presets/fullstack.js";
import { preset as development } from "#src/templates/presets/development.js";
import { preset as powerUser } from "#src/templates/presets/power-user.js";

const ALL_PRESETS = [minimal, balanced, strict, fullstack, development, powerUser];

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

  it("contains all 6 expected self-improvement skills", () => {
    expect(CORE_PLATFORM_SKILLS).toContain("codi-verification");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-session-recovery");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-skill-feedback-reporter");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-rule-feedback");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-refine-rules");
    expect(CORE_PLATFORM_SKILLS).toContain("codi-compare-preset");
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

// ── Every preset includes core platform artifacts ─────────────────────────

describe("All presets include CORE_PLATFORM_RULES", () => {
  for (const preset of ALL_PRESETS) {
    it(`${preset.name} includes codi-improvement-dev rule`, () => {
      for (const rule of CORE_PLATFORM_RULES) {
        expect(preset.rules).toContain(rule);
      }
    });
  }
});

describe("All presets include CORE_PLATFORM_SKILLS", () => {
  for (const preset of ALL_PRESETS) {
    it(`${preset.name} includes all 6 core platform skills`, () => {
      for (const skill of CORE_PLATFORM_SKILLS) {
        expect(preset.skills).toContain(skill);
      }
    });
  }
});

// ── No preset has duplicate rules or skills ───────────────────────────────

describe("No preset has duplicate rules or skills", () => {
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

// ── Minimal preset has only core artifacts ────────────────────────────────

describe("minimal preset", () => {
  it("has exactly the core rules and no extras", () => {
    expect(minimal.rules).toHaveLength(CORE_PLATFORM_RULES.length);
  });

  it("has exactly the core skills and no extras", () => {
    expect(minimal.skills).toHaveLength(CORE_PLATFORM_SKILLS.length);
  });

  it("has no agents", () => {
    expect(minimal.agents).toHaveLength(0);
  });
});

// ── Development preset does not include command-creator ───────────────────

describe("development preset", () => {
  it("does not reference stale command-creator skill", () => {
    expect(development.skills).not.toContain("codi-command-creator");
  });
});
