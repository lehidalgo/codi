import { describe, it, expect } from "vitest";
import { findReposInsertionPoint } from "#src/core/hooks/pre-commit-framework.js";

describe("findReposInsertionPoint", () => {
  it("returns null when repos: key is missing", () => {
    const lines = ["default_stages: [pre-commit]"];
    expect(findReposInsertionPoint(lines)).toBeNull();
  });

  it("handles empty repos: list", () => {
    const lines = ["repos:"];
    const result = findReposInsertionPoint(lines);
    expect(result).toEqual({ insertAt: 1, listIndent: "  " });
  });

  it("keeps two-space indent for a single top-level repo with no nested hooks", () => {
    const lines = ["repos:", "  - repo: https://github.com/external/tool", "    rev: v1.0.0"];
    const result = findReposInsertionPoint(lines);
    expect(result).toEqual({ insertAt: 3, listIndent: "  " });
  });

  it("does NOT use nested hook indent when external repo has nested hooks (C1 regression)", () => {
    // The C1 bug: previously this returned listIndent = "      " (6 spaces),
    // which inserted the Codi block INSIDE the external repo's hooks: list.
    const lines = [
      "repos:",
      "  - repo: https://github.com/external/tool",
      "    rev: v1.0.0",
      "    hooks:",
      "      - id: existing-hook-1",
      "      - id: existing-hook-2",
    ];
    const result = findReposInsertionPoint(lines);
    expect(result).not.toBeNull();
    expect(result!.listIndent).toBe("  ");
    expect(result!.insertAt).toBe(6);
  });

  it("preserves first-seen indent across multiple sibling repos at varied indent", () => {
    const lines = [
      "repos:",
      "  - repo: https://github.com/a/a",
      "    rev: v1",
      "    hooks:",
      "      - id: a-hook",
      "  - repo: https://github.com/b/b",
      "    rev: v2",
    ];
    const result = findReposInsertionPoint(lines);
    expect(result!.listIndent).toBe("  ");
    expect(result!.insertAt).toBe(7);
  });

  it("stops scanning at next root-level key", () => {
    const lines = [
      "repos:",
      "  - repo: https://github.com/a/a",
      "    rev: v1",
      "default_stages: [pre-commit]",
    ];
    const result = findReposInsertionPoint(lines);
    expect(result!.insertAt).toBe(3);
  });

  it("skips blank lines and comments inside the block", () => {
    const lines = [
      "repos:",
      "",
      "  # external tool",
      "  - repo: https://github.com/a/a",
      "    rev: v1",
      "",
    ];
    const result = findReposInsertionPoint(lines);
    expect(result!.insertAt).toBe(5);
  });
});
