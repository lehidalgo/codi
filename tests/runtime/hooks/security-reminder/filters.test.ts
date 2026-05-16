import { describe, it, expect } from "vitest";
import {
  fileExtension,
  isSkippedExtension,
  isAllowedForPattern,
  stripCommentLines,
} from "#src/runtime/hooks/security-reminder/filters.js";

describe("filters", () => {
  it("fileExtension lower-cases and includes dot", () => {
    expect(fileExtension("Foo.TS")).toBe(".ts");
    expect(fileExtension("a/b/c.py")).toBe(".py");
    expect(fileExtension("no-extension")).toBe("");
  });

  it("skips markdown / yaml / lock / etc", () => {
    for (const p of ["a.md", "a.yaml", "a.json", "a.svg", "p.toml", ".gitignore"]) {
      expect(isSkippedExtension(p)).toBe(true);
    }
    expect(isSkippedExtension("a.ts")).toBe(false);
  });

  it("isAllowedForPattern uses allowedExtensions when set", () => {
    expect(isAllowedForPattern("a.py", [".py"])).toBe(true);
    expect(isAllowedForPattern("a.ts", [".py"])).toBe(false);
    expect(isAllowedForPattern("a.ts", undefined)).toBe(true);
    expect(isAllowedForPattern("a.ts", [])).toBe(true);
  });

  it("stripCommentLines drops //, #, /*, *, <!--", () => {
    const src = [
      "const x = 1;",
      "// exec(",
      "  # pickle.loads(",
      "/* eval( */",
      " * eval(",
      "<!-- exec( -->",
      "real eval(",
    ].join("\n");
    const out = stripCommentLines(src);
    expect(out).toContain("real eval(");
    expect(out).not.toContain("// exec(");
    expect(out).not.toContain("# pickle.loads(");
    expect(out).not.toContain("<!--");
  });
});
