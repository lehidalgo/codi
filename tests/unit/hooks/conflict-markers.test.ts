import { describe, it, expect } from "vitest";
import { findConflictMarkers, hasConflictMarkers } from "#src/core/hooks/conflict-markers.js";

describe("findConflictMarkers", () => {
  it("returns empty array for clean text", () => {
    expect(findConflictMarkers("hello\nworld\n")).toEqual([]);
    expect(findConflictMarkers("")).toEqual([]);
  });

  it("detects standard 2-way merge markers", () => {
    const text = [
      "function foo() {",
      "<<<<<<< HEAD",
      "  return 1;",
      "=======",
      "  return 2;",
      ">>>>>>> branch-x",
      "}",
    ].join("\n");
    const hits = findConflictMarkers(text);
    expect(hits.length).toBe(3);
    expect(hits[0]).toEqual({ line: 2, kind: "ours", text: "<<<<<<< HEAD" });
    expect(hits[1]).toEqual({ line: 4, kind: "sep", text: "=======" });
    expect(hits[2]).toEqual({ line: 6, kind: "theirs", text: ">>>>>>> branch-x" });
  });

  it("detects 3-way diff3-style merge markers including ||||||| ancestor", () => {
    const text = [
      "<<<<<<< HEAD",
      "  ours",
      "||||||| ancestor",
      "  base",
      "=======",
      "  theirs",
      ">>>>>>> branch",
    ].join("\n");
    const hits = findConflictMarkers(text);
    expect(hits.length).toBe(4);
    expect(hits.map((h) => h.kind)).toEqual(["ours", "base", "sep", "theirs"]);
  });

  it("uses 1-based line numbers", () => {
    const text = "line1\nline2\n<<<<<<< HEAD\n";
    const hits = findConflictMarkers(text);
    expect(hits[0]?.line).toBe(3);
  });

  it("handles CRLF line endings", () => {
    const text = "ok\r\n<<<<<<< HEAD\r\n=======\r\n>>>>>>> branch\r\n";
    const hits = findConflictMarkers(text);
    expect(hits.length).toBe(3);
    expect(hits[0]?.kind).toBe("ours");
  });

  it("rejects sigils of wrong length (8 chars or 6 chars)", () => {
    expect(findConflictMarkers("<<<<<<<<  HEAD\n")).toEqual([]);
    expect(findConflictMarkers("<<<<<< HEAD\n")).toEqual([]);
  });

  it("requires a space or end-of-line after the sigil to avoid false positives", () => {
    expect(findConflictMarkers("=======break")).toEqual([]);
    expect(findConflictMarkers("=======\n")).toHaveLength(1);
  });
});

describe("hasConflictMarkers", () => {
  it("returns false for clean text", () => {
    expect(hasConflictMarkers("hello world")).toBe(false);
  });

  it("returns true when any marker is present", () => {
    expect(hasConflictMarkers("<<<<<<< HEAD\nfoo\n")).toBe(true);
  });

  it("is consistent with findConflictMarkers", () => {
    const cases = ["", "no markers here", "<<<<<<< HEAD\n=======\n>>>>>>> x", "||||||| anc\n"];
    for (const c of cases) {
      expect(hasConflictMarkers(c)).toBe(findConflictMarkers(c).length > 0);
    }
  });
});

describe("conflict-markers ignore literal blocks", () => {
  it("skips markers inside fenced code blocks (regression for codi-dev-operations)", () => {
    const text = [
      "Here is the example for manual conflict resolution:",
      "```",
      "<<<<<<< current (your version)",
      "[currentContent]",
      "=======",
      "[incomingContent]",
      ">>>>>>> incoming (new template)",
      "```",
      "End of example.",
    ].join("\n");
    expect(findConflictMarkers(text)).toEqual([]);
    expect(hasConflictMarkers(text)).toBe(false);
  });

  it("skips markers inside <example> regions", () => {
    const text = [
      "<example>",
      "<<<<<<< HEAD",
      "demo content",
      ">>>>>>> branch-x",
      "</example>",
    ].join("\n");
    expect(findConflictMarkers(text)).toEqual([]);
    expect(hasConflictMarkers(text)).toBe(false);
  });

  it("still catches real markers outside literal blocks", () => {
    const text = [
      "Real conflict at the top:",
      "<<<<<<< HEAD",
      "real content",
      ">>>>>>> branch",
      "Then a fenced documentation example:",
      "```",
      "<<<<<<< example marker",
      "```",
    ].join("\n");
    const hits = findConflictMarkers(text);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ line: 2, kind: "ours", text: "<<<<<<< HEAD" });
    expect(hits[1]).toEqual({ line: 4, kind: "theirs", text: ">>>>>>> branch" });
    expect(hasConflictMarkers(text)).toBe(true);
  });

  it("treats an unclosed fence as literal through end of file (no false positive after stray fence)", () => {
    const text = ["intro", "```", "<<<<<<< not a real conflict — fence never closed"].join("\n");
    expect(findConflictMarkers(text)).toEqual([]);
  });
});
