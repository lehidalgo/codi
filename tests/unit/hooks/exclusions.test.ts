import { describe, it, expect } from "vitest";
import {
  VENDORED_DIRS,
  buildVendoredDirsRegex,
  buildVendoredDirsTemplatePatterns,
} from "#src/core/hooks/exclusions.js";

describe("VENDORED_DIRS", () => {
  it("includes the legacy build/output dirs", () => {
    expect(VENDORED_DIRS).toContain("node_modules");
    expect(VENDORED_DIRS).toContain(".venv");
    expect(VENDORED_DIRS).toContain("venv");
    expect(VENDORED_DIRS).toContain("dist");
    expect(VENDORED_DIRS).toContain("build");
    expect(VENDORED_DIRS).toContain("coverage");
    expect(VENDORED_DIRS).toContain(".next");
  });

  it("includes every supported agent directory", () => {
    expect(VENDORED_DIRS).toContain(".codi");
    expect(VENDORED_DIRS).toContain(".agents");
    expect(VENDORED_DIRS).toContain(".claude");
    expect(VENDORED_DIRS).toContain(".codex");
    expect(VENDORED_DIRS).toContain(".cursor");
    expect(VENDORED_DIRS).toContain(".windsurf");
    expect(VENDORED_DIRS).toContain(".cline");
  });

  it("contains exactly 14 entries", () => {
    expect(VENDORED_DIRS.length).toBe(14);
  });

  it("has no duplicates", () => {
    expect(new Set(VENDORED_DIRS).size).toBe(VENDORED_DIRS.length);
  });
});

describe("buildVendoredDirsRegex", () => {
  it("returns an anchored alternation matching every vendored dir", () => {
    const re = buildVendoredDirsRegex();
    expect(re).toBe(
      "^(node_modules|\\.venv|venv|dist|build|coverage|\\.next|\\.codi|\\.agents|\\.claude|\\.codex|\\.cursor|\\.windsurf|\\.cline)/",
    );
  });

  it("compiles to a valid JavaScript RegExp", () => {
    const re = new RegExp(buildVendoredDirsRegex());
    expect(re.test(".codi/skills/foo/SKILL.md")).toBe(true);
    expect(re.test(".cursor/skills/x/template.ts")).toBe(true);
    expect(re.test("node_modules/foo/index.js")).toBe(true);
    expect(re.test("src/index.ts")).toBe(false);
    expect(re.test("docs/guide.md")).toBe(false);
  });

  it("escapes literal dots in dotfile dir names", () => {
    const re = buildVendoredDirsRegex();
    const compiled = new RegExp(re);
    expect(compiled.test("xcodi/file.md")).toBe(false);
  });
});

describe("buildVendoredDirsTemplatePatterns", () => {
  it("emits comma-separated regex literals for substitution into templates", () => {
    const out = buildVendoredDirsTemplatePatterns();
    expect(out).toContain("/^node_modules\\//");
    expect(out).toContain("/^\\.codi\\//");
    expect(out).toContain("/^\\.cursor\\//");
    expect(out).toContain("/^\\.cline\\//");
  });

  it("produces a string that, when injected into JS source, parses to valid regex literals", () => {
    const out = buildVendoredDirsTemplatePatterns();
    const synthetic = `[${out}]`;
    expect(() => new Function(`return ${synthetic}`)()).not.toThrow();
    const arr = new Function(`return ${synthetic}`)() as RegExp[];
    expect(arr.length).toBe(14);
    expect(arr.every((r) => r instanceof RegExp)).toBe(true);
    expect(arr.some((r) => r.test(".codi/foo"))).toBe(true);
    expect(arr.some((r) => r.test(".cursor/foo"))).toBe(true);
  });
});
