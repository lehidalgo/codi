import { describe, it, expect } from "vitest";
import {
  getHooksForLanguage,
  getSupportedLanguages,
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

  it("returns rust hooks", () => {
    const hooks = getHooksForLanguage("rust");
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => h.name)).toEqual(["cargo-clippy", "cargo-fmt"]);
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
