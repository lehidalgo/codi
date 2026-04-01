import { describe, it, expect } from "vitest";
import { flagsFromDefinitions } from "#src/core/config/composer.js";

describe("flagsFromDefinitions", () => {
  it("converts flag definitions to resolved flags", () => {
    const defs = {
      max_lines: { mode: "enabled" as const, value: 700, locked: true },
    };
    const resolved = flagsFromDefinitions(defs, "test-source");
    expect(resolved["max_lines"]!.source).toBe("test-source");
    expect(resolved["max_lines"]!.locked).toBe(true);
    expect(resolved["max_lines"]!.value).toBe(700);
  });

  it("defaults locked to false when not specified", () => {
    const defs = {
      security_scan: { mode: "enabled" as const, value: true },
    };
    const resolved = flagsFromDefinitions(defs, "flags.yaml");
    expect(resolved["security_scan"]!.locked).toBe(false);
  });

  it("handles empty definitions", () => {
    const resolved = flagsFromDefinitions({}, "empty");
    expect(Object.keys(resolved)).toHaveLength(0);
  });

  it("preserves all flag modes", () => {
    const defs = {
      a: { mode: "enforced" as const, value: true, locked: true },
      b: { mode: "disabled" as const, value: false },
      c: { mode: "inherited" as const },
    };
    const resolved = flagsFromDefinitions(defs, "src");
    expect(resolved["a"]!.mode).toBe("enforced");
    expect(resolved["b"]!.mode).toBe("disabled");
    expect(resolved["c"]!.mode).toBe("inherited");
  });
});
