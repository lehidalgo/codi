import { describe, it, expect } from "vitest";
import { isPathSafe, sanitizeNameForPath } from "#src/utils/path-guard.js";

describe("isPathSafe", () => {
  it("accepts paths inside the project root", () => {
    expect(isPathSafe("/project", "src/file.ts")).toBe(true);
    expect(isPathSafe("/project", "./file.ts")).toBe(true);
  });

  it("rejects paths that escape the project root", () => {
    expect(isPathSafe("/project", "../outside")).toBe(false);
    expect(isPathSafe("/project", "../../etc/passwd")).toBe(false);
  });
});

describe("sanitizeNameForPath", () => {
  it("lowercases alphanumeric names and keeps hyphens", () => {
    expect(sanitizeNameForPath("Codi-PDF")).toBe("codi-pdf");
    expect(sanitizeNameForPath("my-skill")).toBe("my-skill");
  });

  it("replaces whitespace with a single hyphen", () => {
    expect(sanitizeNameForPath("My Skill")).toBe("my-skill");
    expect(sanitizeNameForPath("My Complex   Rule")).toBe("my-complex-rule");
  });

  it("replaces special characters with hyphens", () => {
    expect(sanitizeNameForPath("skill@2024")).toBe("skill-2024");
    expect(sanitizeNameForPath("a.b.c")).toBe("a-b-c");
  });

  it("prevents path traversal by stripping slashes and dots", () => {
    expect(sanitizeNameForPath("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeNameForPath("..\\..\\win")).toBe("win");
    expect(sanitizeNameForPath("/absolute/path")).toBe("absolute-path");
  });

  it("collapses consecutive hyphens and trims edges", () => {
    expect(sanitizeNameForPath("a--b")).toBe("a-b");
    expect(sanitizeNameForPath("-leading")).toBe("leading");
    expect(sanitizeNameForPath("trailing-")).toBe("trailing");
    expect(sanitizeNameForPath("---many---")).toBe("many");
  });

  it("preserves underscores (word characters)", () => {
    expect(sanitizeNameForPath("snake_case_name")).toBe("snake_case_name");
  });

  it("returns empty string for inputs that are fully sanitized away", () => {
    expect(sanitizeNameForPath("///")).toBe("");
    expect(sanitizeNameForPath("...")).toBe("");
  });
});
