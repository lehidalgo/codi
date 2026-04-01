import { describe, it, expect } from "vitest";
import {
  getPreset,
  getPresetNames,
  PRESET_DESCRIPTIONS,
} from "#src/core/flags/flag-presets.js";
import { FLAG_CATALOG } from "#src/core/flags/flag-catalog.js";
import { prefixedName } from "#src/constants.js";

describe("flag presets", () => {
  it("has 3 preset names", () => {
    expect(getPresetNames()).toEqual([
      prefixedName("minimal"),
      prefixedName("balanced"),
      prefixedName("strict"),
    ]);
  });

  it("each preset has all 16 flags", () => {
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

  it("minimal preset is permissive", () => {
    const preset = getPreset(prefixedName("minimal"));
    expect(preset["security_scan"]!.value).toBe(false);
    expect(preset["test_before_commit"]!.value).toBe(false);
    expect(preset["allow_force_push"]!.value).toBe(true);
    expect(preset["allow_shell_commands"]!.value).toBe(true);
    expect(preset["type_checking"]!.value).toBe("off");
  });

  it("balanced preset has sensible defaults", () => {
    const preset = getPreset(prefixedName("balanced"));
    expect(preset["security_scan"]!.value).toBe(true);
    expect(preset["test_before_commit"]!.value).toBe(true);
    expect(preset["allow_force_push"]!.value).toBe(false);
    expect(preset["type_checking"]!.value).toBe("strict");
  });

  it("strict preset has enforced flags with locks", () => {
    const preset = getPreset(prefixedName("strict"));
    expect(preset["security_scan"]!.mode).toBe("enforced");
    expect(preset["security_scan"]!.locked).toBe(true);
    expect(preset["test_before_commit"]!.mode).toBe("enforced");
    expect(preset["require_tests"]!.mode).toBe("enforced");
    expect(preset["allow_force_push"]!.mode).toBe("enforced");
    expect(preset["allow_force_push"]!.value).toBe(false);
    expect(preset["allow_shell_commands"]!.value).toBe(true);
  });

  it("getPreset returns a clone (not a reference)", () => {
    const a = getPreset(prefixedName("balanced"));
    const b = getPreset(prefixedName("balanced"));
    a["auto_commit"]!.value = true;
    expect(b["auto_commit"]!.value).toBe(false);
  });

  it("throws on unknown preset name", () => {
    expect(() => getPreset("nonexistent" as never)).toThrow("Unknown preset");
  });

  it("all presets have descriptions", () => {
    for (const name of getPresetNames()) {
      expect(PRESET_DESCRIPTIONS[name]).toBeDefined();
      expect(PRESET_DESCRIPTIONS[name].length).toBeGreaterThan(10);
    }
  });
});
