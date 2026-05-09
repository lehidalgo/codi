import { describe, it, expect } from "vitest";
import { TYPESCRIPT_HOOKS } from "#src/core/hooks/registry/typescript.js";
import { isGitHook } from "#src/core/hooks/hook-artifact.js";

describe("TYPESCRIPT_HOOKS as GitHookArtifact", () => {
  it("each entry has bucket 'git'", () => {
    for (const h of TYPESCRIPT_HOOKS) expect(h.bucket).toBe("git");
  });

  it("each entry passes isGitHook narrowing", () => {
    for (const h of TYPESCRIPT_HOOKS) expect(isGitHook(h)).toBe(true);
  });

  it("contains the four expected names", () => {
    const names = TYPESCRIPT_HOOKS.map((h) => h.name).sort();
    expect(names).toEqual(["biome", "eslint", "prettier", "tsc"]);
  });

  it("tsc is required", () => {
    const tsc = TYPESCRIPT_HOOKS.find((h) => h.name === "tsc");
    expect(tsc?.required).toBe(true);
  });

  it("each entry has description, version, managed_by, default", () => {
    for (const h of TYPESCRIPT_HOOKS) {
      expect(h.description.length).toBeGreaterThan(0);
      expect(h.version).toBe("1");
      expect(h.managed_by).toBe("codi");
      expect(typeof h.default).toBe("boolean");
    }
  });
});
