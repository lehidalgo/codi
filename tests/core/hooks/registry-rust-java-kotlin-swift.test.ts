import { describe, it, expect } from "vitest";
import { loadLanguageHooks } from "#src/core/hooks/registry/loader.js";
import { isGitHook } from "#src/core/hooks/hook-artifact.js";

const RUST_HOOKS = loadLanguageHooks("rust");
const JAVA_HOOKS = loadLanguageHooks("java");
const KOTLIN_HOOKS = loadLanguageHooks("kotlin");
const SWIFT_HOOKS = loadLanguageHooks("swift");

const allRegistries = [
  { name: "rust", arr: RUST_HOOKS },
  { name: "java", arr: JAVA_HOOKS },
  { name: "kotlin", arr: KOTLIN_HOOKS },
  { name: "swift", arr: SWIFT_HOOKS },
];

describe("rust / java / kotlin / swift registries shape", () => {
  for (const { name, arr } of allRegistries) {
    it(`${name}: every entry is a valid GitHookArtifact`, () => {
      for (const h of arr) {
        expect(h.bucket).toBe("git");
        expect(isGitHook(h)).toBe(true);
        expect(h.description.length).toBeGreaterThan(0);
        expect(h.version).toBe("1");
        expect(h.managed_by).toBe("codi");
        expect(h.default).toBe(true);
      }
    });
  }

  it("counts match expectations", () => {
    expect(RUST_HOOKS).toHaveLength(2);
    expect(JAVA_HOOKS).toHaveLength(2);
    expect(KOTLIN_HOOKS).toHaveLength(2);
    expect(SWIFT_HOOKS).toHaveLength(2);
  });
});
