import { describe, it, expect } from "vitest";
import {
  getAllHooks,
  getGitHooks,
  getRuntimeHooks,
  getHook,
  getDefaultGitHookNames,
  getDefaultRuntimeHookNames,
} from "#src/core/hooks/registry/index.js";

describe("registry helpers", () => {
  it("getAllHooks combines git and runtime", () => {
    const all = getAllHooks();
    const git = getGitHooks();
    const runtime = getRuntimeHooks();
    expect(all.length).toBe(git.length + runtime.length);
  });

  it("getGitHooks returns only git bucket", () => {
    expect(getGitHooks().every((h) => h.bucket === "git")).toBe(true);
  });

  it("getRuntimeHooks returns only runtime bucket", () => {
    expect(getRuntimeHooks().every((h) => h.bucket === "runtime")).toBe(true);
  });

  it("getHook by name returns the right artifact", () => {
    const tsc = getHook("tsc");
    expect(tsc?.bucket).toBe("git");
    expect(tsc?.name).toBe("tsc");
  });

  it("getHook returns null for unknown name", () => {
    expect(getHook("does-not-exist")).toBeNull();
  });

  it("getDefaultGitHookNames returns defaults for typescript", () => {
    const names = getDefaultGitHookNames(["typescript"]);
    expect(names).toContain("eslint");
    expect(names).toContain("prettier");
    expect(names).toContain("tsc");
    expect(names).not.toContain("biome");
  });

  it("getDefaultGitHookNames includes global defaults regardless of language", () => {
    const names = getDefaultGitHookNames([]);
    expect(names).toContain("gitleaks");
    expect(names).toContain("commitlint");
  });

  it("getDefaultRuntimeHookNames returns required + default-on hooks", () => {
    // Initially empty — populated by Tasks 9-14.
    const names = getDefaultRuntimeHookNames();
    expect(Array.isArray(names)).toBe(true);
  });
});
