import { describe, it, expect } from "vitest";
import { loadLanguageHooks } from "#src/core/hooks/registry/loader.js";
import { isGitHook } from "#src/core/hooks/hook-artifact.js";

const CSHARP_HOOKS = loadLanguageHooks("csharp");
const CPP_HOOKS = loadLanguageHooks("cpp");
const PHP_HOOKS = loadLanguageHooks("php");
const RUBY_HOOKS = loadLanguageHooks("ruby");

const allRegistries = [
  { name: "csharp", arr: CSHARP_HOOKS },
  { name: "cpp", arr: CPP_HOOKS },
  { name: "php", arr: PHP_HOOKS },
  { name: "ruby", arr: RUBY_HOOKS },
];

describe("csharp / cpp / php / ruby registries shape", () => {
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
    expect(CSHARP_HOOKS).toHaveLength(2);
    expect(CPP_HOOKS).toHaveLength(2);
    expect(PHP_HOOKS).toHaveLength(3);
    expect(RUBY_HOOKS).toHaveLength(2);
  });
});
