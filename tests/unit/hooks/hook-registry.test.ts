import { describe, it, expect } from "vitest";
import {
  getHooksForLanguage,
  getSupportedLanguages,
  getGlobalHooks,
  getCommitlintHook,
} from "#src/core/hooks/hook-registry.js";

describe("getHooksForLanguage", () => {
  it("returns typescript hooks with npx prefix (eslint, prettier, tsc, biome)", () => {
    const hooks = getHooksForLanguage("typescript");
    expect(hooks).toHaveLength(4);
    expect(hooks.map((h) => h.name)).toEqual(["eslint", "prettier", "tsc", "biome"]);
    expect(hooks[0]!.shell.command).toBe("npx eslint --fix");
    expect(hooks[1]!.shell.command).toBe("npx prettier --write");
    expect(hooks[2]!.shell.command).toBe("npx tsc --noEmit");
    expect(hooks[3]!.preCommit).toMatchObject({
      kind: "upstream",
      repo: "https://github.com/biomejs/pre-commit",
    });
    expect(hooks[0]!.files).toBe("**/*.{ts,tsx,js,jsx}");
  });

  it("returns javascript hooks (eslint, prettier, biome)", () => {
    const hooks = getHooksForLanguage("javascript");
    expect(hooks).toHaveLength(3);
    expect(hooks.map((h) => h.name)).toEqual(["eslint", "prettier", "biome"]);
  });

  it("returns python hooks (ruff + basedpyright + mypy + pyright + bandit)", () => {
    const hooks = getHooksForLanguage("python");
    expect(hooks).toHaveLength(6);
    expect(hooks.map((h) => h.name)).toEqual([
      "ruff-check",
      "ruff-format",
      "basedpyright",
      "mypy",
      "pyright",
      "bandit",
    ]);
    expect(hooks[0]!.shell.command).toBe("ruff check --fix");
    expect(hooks[2]!.shell.command).toBe("basedpyright");
    expect(hooks[5]!.preCommit).toMatchObject({
      kind: "upstream",
      additionalDependencies: ["bandit[toml]"],
    });
  });

  it("returns go hooks", () => {
    const hooks = getHooksForLanguage("go");
    expect(hooks).toHaveLength(3);
    expect(hooks.map((h) => h.name)).toEqual(["golangci-lint", "gofmt", "gosec"]);
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
    expect(hooks).toHaveLength(6);
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
    expect(hooks.length).toBeGreaterThanOrEqual(2);
    const gitleaks = hooks.find((h) => h.name === "gitleaks");
    expect(gitleaks).toBeDefined();
    expect(gitleaks!.category).toBe("security");
    expect(gitleaks!.required).toBe(true);
    expect(gitleaks!.installHint.command).toContain("gitleaks");
  });

  it("includes commitlint with commit-msg stage", () => {
    const cl = getCommitlintHook();
    expect(cl.stages).toContain("commit-msg");
    expect(cl.preCommit).toMatchObject({
      kind: "upstream",
      additionalDependencies: ["@commitlint/config-conventional"],
    });
  });
});

describe("HookSpec data integrity", () => {
  const allLanguages = getSupportedLanguages();

  it("every hook has shell + preCommit emissions and required fields", () => {
    for (const lang of allLanguages) {
      const hooks = getHooksForLanguage(lang);
      for (const h of hooks) {
        expect(h.category, `${lang}/${h.name} missing category`).toBeDefined();
        expect(h.required, `${lang}/${h.name} missing required`).toBeDefined();
        expect(h.shell, `${lang}/${h.name} missing shell`).toBeDefined();
        expect(h.shell.toolBinary, `${lang}/${h.name} missing toolBinary`).toBeTruthy();
        expect(h.shell.command, `${lang}/${h.name} missing shell.command`).toBeTruthy();
        expect(h.preCommit, `${lang}/${h.name} missing preCommit`).toBeDefined();
        expect(h.installHint, `${lang}/${h.name} missing installHint`).toBeDefined();
        expect(h.stages.length, `${lang}/${h.name} stages`).toBeGreaterThan(0);
      }
    }
  });

  it("upstream preCommit emissions pin a non-empty rev with a real repo URL", () => {
    const all = [...allLanguages.flatMap(getHooksForLanguage), ...getGlobalHooks()];
    for (const spec of all) {
      if (spec.preCommit.kind === "upstream") {
        expect(spec.preCommit.rev, `${spec.name} rev`).toMatch(/^v?\d/);
        expect(spec.preCommit.repo, `${spec.name} repo`).toMatch(/^https?:\/\//);
        expect(spec.preCommit.id, `${spec.name} id`).toBeTruthy();
      }
    }
  });

  it("hook ids are unique within a language group", () => {
    for (const lang of allLanguages) {
      const ids = getHooksForLanguage(lang).map((h) => h.name);
      expect(new Set(ids).size, lang).toBe(ids.length);
    }
  });

  it("every language has at least one lint or format hook", () => {
    for (const lang of allLanguages) {
      const hooks = getHooksForLanguage(lang);
      const hasLintOrFormat = hooks.some((h) => h.category === "lint" || h.category === "format");
      expect(hasLintOrFormat, `${lang} has no lint or format hook`).toBe(true);
    }
  });
});
