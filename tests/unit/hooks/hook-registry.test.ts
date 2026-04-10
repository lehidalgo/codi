import { describe, it, expect } from "vitest";
import {
  getHooksForLanguage,
  getSupportedLanguages,
  getGlobalHooks,
} from "#src/core/hooks/hook-registry.js";

describe("getHooksForLanguage", () => {
  it("returns typescript hooks with npx prefix", () => {
    const hooks = getHooksForLanguage("typescript");
    expect(hooks).toHaveLength(3);
    expect(hooks.map((h) => h.name)).toEqual(["eslint", "prettier", "tsc"]);
    expect(hooks[0]!.command).toBe("npx eslint --fix");
    expect(hooks[1]!.command).toBe("npx prettier --write");
    expect(hooks[2]!.command).toBe("npx tsc --noEmit");
    expect(hooks[0]!.stagedFilter).toBe("**/*.{ts,tsx,js,jsx}");
  });

  it("returns javascript hooks", () => {
    const hooks = getHooksForLanguage("javascript");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.name)).toEqual(["eslint", "prettier"]);
  });

  it("returns python hooks", () => {
    const hooks = getHooksForLanguage("python");
    expect(hooks).toHaveLength(4);
    expect(hooks.map((h) => h.name)).toEqual([
      "ruff-check",
      "ruff-format",
      "pyright",
      "bandit",
    ]);
    expect(hooks[0]!.command).toBe("ruff check --fix");
    expect(hooks[2]!.command).toBe("npx pyright");
  });

  it("returns go hooks", () => {
    const hooks = getHooksForLanguage("go");
    expect(hooks).toHaveLength(3);
    expect(hooks.map((h) => h.name)).toEqual([
      "golangci-lint",
      "gofmt",
      "gosec",
    ]);
  });

  it("returns rust hooks with cargo-fmt before cargo-clippy", () => {
    const hooks = getHooksForLanguage("rust");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.name)).toEqual(["cargo-fmt", "cargo-clippy"]);
  });

  it("returns empty array for unknown language", () => {
    const hooks = getHooksForLanguage("cobol");
    expect(hooks).toEqual([]);
  });

  it("is case-insensitive", () => {
    const hooks = getHooksForLanguage("Python");
    expect(hooks).toHaveLength(4);
  });
});

describe("getSupportedLanguages", () => {
  it("returns all supported languages", () => {
    const languages = getSupportedLanguages();
    expect(languages).toContain("typescript");
    expect(languages).toContain("javascript");
    expect(languages).toContain("python");
    expect(languages).toContain("go");
    expect(languages).toContain("rust");
  });
});

describe("getGlobalHooks", () => {
  it("returns gitleaks as a global hook", () => {
    const hooks = getGlobalHooks();
    expect(hooks.length).toBeGreaterThanOrEqual(1);
    const gitleaks = hooks.find((h) => h.name === "gitleaks");
    expect(gitleaks).toBeDefined();
    expect(gitleaks!.category).toBe("security");
    expect(gitleaks!.required).toBe(true);
    expect(gitleaks!.installHint).toBeDefined();
    expect(gitleaks!.installHint!.command).toContain("gitleaks");
  });
});

describe("HookEntry contract completeness", () => {
  const allLanguages = getSupportedLanguages();

  it("every hook in every language has category, required, and installHint", () => {
    for (const lang of allLanguages) {
      const hooks = getHooksForLanguage(lang);
      for (const h of hooks) {
        expect(h.category, `${lang}/${h.name} missing category`).toBeDefined();
        expect(h.required, `${lang}/${h.name} missing required`).toBeDefined();
        expect(h.installHint, `${lang}/${h.name} missing installHint`).toBeDefined();
        expect(
          h.installHint!.command,
          `${lang}/${h.name} installHint.command is empty`,
        ).toBeTruthy();
      }
    }
  });

  it("every language has at least one lint or format hook", () => {
    for (const lang of allLanguages) {
      const hooks = getHooksForLanguage(lang);
      const hasLintOrFormat = hooks.some(
        (h) => h.category === "lint" || h.category === "format",
      );
      expect(hasLintOrFormat, `${lang} has no lint or format hook`).toBe(true);
    }
  });
});
