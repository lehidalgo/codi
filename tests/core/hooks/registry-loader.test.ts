/**
 * CORE-010 — loader contract tests.
 *
 * Pins the boundary behavior of the YAML-backed registry:
 *   - Happy path returns valid GitHookArtifact[] (zod-validated).
 *   - Second call hits the cache (object identity).
 *   - Unknown language throws with the file path embedded.
 *   - `${PROJECT_NAME}` / `${PROJECT_CLI}` placeholders are expanded
 *     post-parse (only `global.yaml` needs them today).
 *   - `listAvailableLanguages()` returns the canonical order, not the
 *     filesystem readdir order.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { isGitHook } from "#src/core/hooks/hook-artifact.js";
import {
  listAvailableLanguages,
  loadGlobalHooks,
  loadLanguageHooks,
  __resetRegistryCacheForTests,
} from "#src/core/hooks/registry/loader.js";
import { PROJECT_NAME } from "#src/constants.js";

describe("registry loader (CORE-010)", () => {
  beforeEach(() => {
    __resetRegistryCacheForTests();
  });

  it("loadLanguageHooks('python') returns a non-empty GitHookArtifact[]", () => {
    const hooks = loadLanguageHooks("python");
    expect(hooks.length).toBeGreaterThan(0);
    for (const h of hooks) {
      expect(isGitHook(h)).toBe(true);
      expect(h.language).toBe("python");
    }
  });

  it("loadLanguageHooks normalizes to lowercase", () => {
    const lower = loadLanguageHooks("python");
    const upper = loadLanguageHooks("PYTHON");
    expect(upper).toBe(lower); // same cached reference
  });

  it("second call returns the same cached array reference", () => {
    const first = loadLanguageHooks("typescript");
    const second = loadLanguageHooks("typescript");
    expect(second).toBe(first);
  });

  it("unknown language throws with the file path embedded", () => {
    expect(() => loadLanguageHooks("klingon")).toThrow(/klingon\.yaml/);
  });

  it("loadGlobalHooks expands ${PROJECT_NAME} placeholders", () => {
    const globals = loadGlobalHooks();
    const doctor = globals.find((h) => h.name === `${PROJECT_NAME}-doctor`);
    expect(doctor).toBeDefined();
    // Confirm the placeholder was actually substituted (the literal
    // string `${PROJECT_NAME}` MUST NOT appear in any field).
    for (const h of globals) {
      expect(JSON.stringify(h)).not.toContain("${PROJECT_NAME}");
      expect(JSON.stringify(h)).not.toContain("${PROJECT_CLI}");
    }
  });

  it("listAvailableLanguages preserves canonical order (not alphabetical)", () => {
    const langs = listAvailableLanguages();
    expect(langs[0]).toBe("typescript");
    expect(langs[1]).toBe("javascript");
    expect(langs[2]).toBe("python");
    // Catches an accidental .sort() — if alphabetical, cpp would come first.
    expect(langs.indexOf("typescript")).toBeLessThan(langs.indexOf("cpp"));
  });

  it("listAvailableLanguages excludes 'global'", () => {
    const langs = listAvailableLanguages();
    expect(langs).not.toContain("global");
  });

  it("every canonical language has a YAML on disk (loader self-check)", () => {
    for (const lang of listAvailableLanguages()) {
      expect(() => loadLanguageHooks(lang)).not.toThrow();
    }
  });
});
