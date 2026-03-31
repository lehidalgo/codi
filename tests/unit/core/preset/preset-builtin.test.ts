import { describe, it, expect } from "vitest";
import {
  isBuiltinPreset,
  materializeBuiltinPreset,
} from "#src/core/preset/preset-builtin.js";
import { prefixedName } from "#src/constants.js";

describe("isBuiltinPreset", () => {
  it("recognizes flag-only presets (minimal, balanced, strict)", () => {
    expect(isBuiltinPreset(prefixedName("minimal"))).toBe(true);
    expect(isBuiltinPreset(prefixedName("balanced"))).toBe(true);
    expect(isBuiltinPreset(prefixedName("strict"))).toBe(true);
  });

  it("recognizes full built-in presets", () => {
    expect(isBuiltinPreset(prefixedName("fullstack"))).toBe(true);
    expect(isBuiltinPreset(prefixedName("power-user"))).toBe(true);
  });

  it("returns false for unknown presets", () => {
    expect(isBuiltinPreset("nonexistent-preset")).toBe(false);
    expect(isBuiltinPreset("")).toBe(false);
    expect(isBuiltinPreset("my-custom")).toBe(false);
  });
});

describe("materializeBuiltinPreset", () => {
  it("materializes balanced preset with artifacts", () => {
    const result = materializeBuiltinPreset(prefixedName("balanced"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe(prefixedName("balanced"));
      expect(result.data.description).toBe(
        "Recommended — security on, type-checking strict, no force-push",
      );
      expect(result.data.flags).toBeDefined();
      expect(Object.keys(result.data.flags).length).toBe(16);
    }
  });

  it("materializes fullstack preset with 8 rules", () => {
    const result = materializeBuiltinPreset(prefixedName("fullstack"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe(prefixedName("fullstack"));
      expect(result.data.description).toBeTruthy();
      expect(result.data.flags).toBeDefined();
      expect(Object.keys(result.data.flags).length).toBe(16);
      expect(result.data.rules.length).toBe(8);
    }
  });

  it("returns error for unknown preset", () => {
    const result = materializeBuiltinPreset("does-not-exist");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("presets have mcp with empty servers", () => {
    const result = materializeBuiltinPreset(prefixedName("strict"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mcp).toEqual({ servers: {} });
    }
  });
});
