import { describe, it, expect } from "vitest";
import { JAVASCRIPT_HOOKS } from "#src/core/hooks/registry/javascript.js";
import { PYTHON_HOOKS } from "#src/core/hooks/registry/python.js";
import { GO_HOOKS } from "#src/core/hooks/registry/go.js";
import { isGitHook } from "#src/core/hooks/hook-artifact.js";

const allRegistries = [
  { name: "javascript", arr: JAVASCRIPT_HOOKS },
  { name: "python", arr: PYTHON_HOOKS },
  { name: "go", arr: GO_HOOKS },
];

describe("js / py / go registries shape", () => {
  for (const { name, arr } of allRegistries) {
    it(`${name}: every entry has bucket "git" and required new fields`, () => {
      for (const h of arr) {
        expect(h.bucket).toBe("git");
        expect(isGitHook(h)).toBe(true);
        expect(h.description.length).toBeGreaterThan(0);
        expect(h.version).toBe("1");
        expect(h.managed_by).toBe("codi");
        expect(typeof h.default).toBe("boolean");
      }
    });
  }

  it("javascript count and biome opt-in", () => {
    expect(JAVASCRIPT_HOOKS).toHaveLength(3);
    expect(JAVASCRIPT_HOOKS.find((h) => h.name === "biome")?.default).toBe(false);
  });

  it("python count and mypy/pyright are non-default", () => {
    expect(PYTHON_HOOKS).toHaveLength(6);
    expect(PYTHON_HOOKS.find((h) => h.name === "mypy")?.default).toBe(false);
    expect(PYTHON_HOOKS.find((h) => h.name === "pyright")?.default).toBe(false);
    expect(PYTHON_HOOKS.find((h) => h.name === "ruff-check")?.default).toBe(true);
  });

  it("go count and all defaults true", () => {
    expect(GO_HOOKS).toHaveLength(3);
    for (const h of GO_HOOKS) expect(h.default).toBe(true);
  });
});
