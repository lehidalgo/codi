import { describe, it, expect } from "vitest";
import { isBuiltinPreset, materializeBuiltinPreset } from "#src/core/preset/preset-builtin.js";
import { prefixedName } from "#src/constants.js";

describe("isBuiltinPreset", () => {
  it("recognizes the canonical default preset", () => {
    expect(isBuiltinPreset(prefixedName("default"))).toBe(true);
  });

  it("returns false for retired preset names", () => {
    // ADR-013: minimal/balanced/strict/fullstack/development/power-user retired
    expect(isBuiltinPreset(prefixedName("minimal"))).toBe(false);
    expect(isBuiltinPreset(prefixedName("balanced"))).toBe(false);
    expect(isBuiltinPreset(prefixedName("strict"))).toBe(false);
    expect(isBuiltinPreset(prefixedName("fullstack"))).toBe(false);
    expect(isBuiltinPreset(prefixedName("power-user"))).toBe(false);
  });

  it("returns false for unknown presets", () => {
    expect(isBuiltinPreset("nonexistent-preset")).toBe(false);
    expect(isBuiltinPreset("")).toBe(false);
    expect(isBuiltinPreset("my-custom")).toBe(false);
  });
});

describe("materializeBuiltinPreset", () => {
  it("materializes the default preset with artifacts", () => {
    const result = materializeBuiltinPreset(prefixedName("default"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe(prefixedName("default"));
      expect(result.data.description).toBeTruthy();
      expect(result.data.flags).toBeDefined();
      expect(Object.keys(result.data.flags).length).toBe(27);
    }
  });

  it("returns error for unknown preset", () => {
    const result = materializeBuiltinPreset("does-not-exist");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("default preset has mcp with empty servers", () => {
    const result = materializeBuiltinPreset(prefixedName("default"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mcp).toEqual({ servers: {} });
    }
  });
});
