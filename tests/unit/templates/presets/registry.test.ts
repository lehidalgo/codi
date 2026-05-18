import { describe, it, expect } from "vitest";
import {
  BUILTIN_PRESETS,
  getBuiltinPresetDefinition,
  getBuiltinPresetNames,
} from "#src/templates/presets/index.js";
import { FLAG_CATALOG } from "#src/core/flags/flag-catalog.js";
import { prefixedName } from "#src/constants.js";

const ALL_PRESET_NAMES = [prefixedName("default")] as const;

const catalogKeys = Object.keys(FLAG_CATALOG).sort();

describe("unified preset registry", () => {
  it("contains the single canonical preset (ADR-013)", () => {
    expect(getBuiltinPresetNames().sort()).toEqual([...ALL_PRESET_NAMES].sort());
  });

  it("each preset is retrievable by name", () => {
    for (const name of ALL_PRESET_NAMES) {
      const def = getBuiltinPresetDefinition(name);
      expect(def).toBeDefined();
      expect(def!.name).toBe(name);
    }
  });

  it("each preset has a non-empty description", () => {
    for (const name of ALL_PRESET_NAMES) {
      const def = BUILTIN_PRESETS[name]!;
      expect(def.description.length).toBeGreaterThan(10);
    }
  });

  it("returns undefined for unknown preset", () => {
    expect(getBuiltinPresetDefinition("nonexistent")).toBeUndefined();
  });
});

describe("flat preset flags", () => {
  it("each preset has all catalog flags inline", () => {
    for (const name of ALL_PRESET_NAMES) {
      const def = BUILTIN_PRESETS[name]!;
      expect(Object.keys(def.flags).sort()).toEqual(catalogKeys);
    }
  });

  it("no preset has an extends field", () => {
    for (const name of ALL_PRESET_NAMES) {
      const def = BUILTIN_PRESETS[name]!;
      expect("extends" in def).toBe(false);
    }
  });
});
