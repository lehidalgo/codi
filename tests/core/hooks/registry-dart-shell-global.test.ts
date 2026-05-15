import { describe, it, expect } from "vitest";
import { loadGlobalHooks, loadLanguageHooks } from "#src/core/hooks/registry/loader.js";
import { isGitHook } from "#src/core/hooks/hook-artifact.js";

const DART_HOOKS = loadLanguageHooks("dart");
const SHELL_HOOKS = loadLanguageHooks("shell");
const GLOBAL_HOOKS = loadGlobalHooks();

const allRegistries = [
  { name: "dart", arr: DART_HOOKS },
  { name: "shell", arr: SHELL_HOOKS },
  { name: "global", arr: GLOBAL_HOOKS },
];

describe("dart / shell / global registries shape", () => {
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
    expect(DART_HOOKS).toHaveLength(2);
    expect(SHELL_HOOKS).toHaveLength(1);
    expect(GLOBAL_HOOKS).toHaveLength(3);
  });

  it("global registry contains gitleaks, commitlint, codi-doctor", () => {
    const names = GLOBAL_HOOKS.map((h) => h.name).sort();
    expect(names).toContain("gitleaks");
    expect(names).toContain("commitlint");
    expect(names.find((n) => n.endsWith("doctor"))).toBeDefined();
  });
});
