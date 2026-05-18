import { describe, it, expect } from "vitest";
import { getPreset, getPresetNames, PRESET_DESCRIPTIONS } from "#src/core/flags/flag-presets.js";
import { BUILTIN_PRESETS } from "#src/templates/presets/index.js";
import { FLAG_CATALOG } from "#src/core/flags/flag-catalog.js";
import { prefixedName } from "#src/constants.js";

describe("flag presets", () => {
  it("has the single canonical preset (ADR-013)", () => {
    expect(getPresetNames()).toEqual([prefixedName("default")]);
  });

  it("each preset has all flags defined in the catalog", () => {
    const catalogKeys = Object.keys(FLAG_CATALOG).sort();
    for (const name of getPresetNames()) {
      const preset = getPreset(name);
      expect(Object.keys(preset).sort()).toEqual(catalogKeys);
    }
  });

  it("each preset flag has a valid mode", () => {
    const validModes = [
      "enforced",
      "enabled",
      "disabled",
      "inherited",
      "delegated_to_agent_default",
      "conditional",
    ];
    for (const name of getPresetNames()) {
      const preset = getPreset(name);
      for (const [_flag, def] of Object.entries(preset)) {
        expect(validModes).toContain(def.mode);
      }
    }
  });

  it("default preset has sensible security + type-checking defaults", () => {
    const preset = getPreset(prefixedName("default"));
    expect(preset["security_scan"]!.value).toBe(true);
    expect(preset["test_before_commit"]!.value).toBe(true);
    expect(preset["allow_force_push"]!.value).toBe(false);
    expect(preset["type_checking"]!.value).toBe("strict");
  });

  it("getPreset returns a clone (not a reference)", () => {
    const a = getPreset(prefixedName("default"));
    const b = getPreset(prefixedName("default"));
    a["auto_commit"]!.value = true;
    expect(b["auto_commit"]!.value).toBe(false);
  });

  it("throws on unknown preset name", () => {
    expect(() => getPreset("nonexistent" as never)).toThrow("Unknown preset");
  });

  it("all registered presets have descriptions", () => {
    for (const name of getPresetNames()) {
      expect(PRESET_DESCRIPTIONS[name]).toBeDefined();
      expect(PRESET_DESCRIPTIONS[name].length).toBeGreaterThan(10);
    }
  });
});

describe("all registered builtin presets", () => {
  const catalogKeys = Object.keys(FLAG_CATALOG).sort();
  const validModes = [
    "enforced",
    "enabled",
    "disabled",
    "inherited",
    "delegated_to_agent_default",
    "conditional",
  ];

  for (const [presetName, preset] of Object.entries(BUILTIN_PRESETS)) {
    it(`${presetName} has all catalog flags with valid modes`, () => {
      expect(Object.keys(preset.flags).sort()).toEqual(catalogKeys);
      for (const [_flag, def] of Object.entries(preset.flags)) {
        expect(validModes).toContain(def.mode);
      }
    });
  }
});
