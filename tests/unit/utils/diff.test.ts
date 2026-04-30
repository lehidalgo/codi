import { describe, it, expect } from "vitest";
import {
  buildUnifiedDiff,
  renderColoredDiff,
  countChanges,
  extractConflictHunks,
} from "#src/utils/diff.js";

describe("buildUnifiedDiff", () => {
  it("returns 'No differences found.' for identical inputs", () => {
    const lines = ["line 1", "line 2", "line 3"];
    const result = buildUnifiedDiff("a", "b", lines, lines);
    expect(result).toBe("No differences found.");
  });

  it("shows additions with + prefix", () => {
    const lines1 = ["line 1", "line 2"];
    const lines2 = ["line 1", "line 2", "line 3"];
    const result = buildUnifiedDiff("old", "new", lines1, lines2);
    expect(result).toContain("+line 3");
    expect(result).toContain("--- old");
    expect(result).toContain("+++ new");
  });

  it("shows removals with - prefix", () => {
    const lines1 = ["line 1", "line 2", "line 3"];
    const lines2 = ["line 1", "line 2"];
    const result = buildUnifiedDiff("old", "new", lines1, lines2);
    expect(result).toContain("-line 3");
  });

  it("shows both additions and removals for modifications", () => {
    const lines1 = ["line 1", "line 2 old", "line 3"];
    const lines2 = ["line 1", "line 2 new", "line 3"];
    const result = buildUnifiedDiff("old", "new", lines1, lines2);
    expect(result).toContain("-line 2 old");
    expect(result).toContain("+line 2 new");
  });

  it("produces @@ hunk headers", () => {
    const lines1 = ["a", "b"];
    const lines2 = ["a", "c"];
    const result = buildUnifiedDiff("old", "new", lines1, lines2);
    expect(result).toMatch(/^@@/m);
  });

  it("produces multiple hunks for distant changes", () => {
    const lines1 = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
    const lines2 = [...lines1];
    lines2[1] = "Line 2 CHANGED";
    lines2[17] = "Line 18 CHANGED";
    const result = buildUnifiedDiff("v1", "v2", lines1, lines2);
    expect(result).toContain("-Line 2");
    expect(result).toContain("+Line 2 CHANGED");
    expect(result).toContain("-Line 18");
    expect(result).toContain("+Line 18 CHANGED");
    const hunkCount = (result.match(/^@@/gm) ?? []).length;
    expect(hunkCount).toBeGreaterThanOrEqual(2);
  });

  it("handles empty arrays", () => {
    const result = buildUnifiedDiff("a", "b", [], []);
    expect(result).toBe("No differences found.");
  });

  it("handles one empty and one non-empty array", () => {
    const result = buildUnifiedDiff("old", "new", [], ["line 1"]);
    expect(result).toContain("+line 1");
  });

  it("handles removal of all lines", () => {
    const result = buildUnifiedDiff("old", "new", ["line 1", "line 2"], []);
    expect(result).toContain("-line 1");
    expect(result).toContain("-line 2");
  });
});

describe("renderColoredDiff", () => {
  it("returns a string with content for different inputs", () => {
    const result = renderColoredDiff("line 1\nline 2", "line 1\nline 3", "test.md");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes diff header markers", () => {
    const result = renderColoredDiff("old content", "new content", "file.md");
    // The raw output includes --- and +++ even if colored
    expect(result).toContain("current");
    expect(result).toContain("incoming");
  });

  it("handles identical strings", () => {
    const result = renderColoredDiff("same", "same", "file.md");
    expect(result).toContain("No differences found.");
  });

  it("includes addition and removal lines", () => {
    const result = renderColoredDiff("line a", "line b", "file.md");
    // Colored output will contain the actual text (picocolors wraps it)
    expect(result).toContain("line a");
    expect(result).toContain("line b");
  });
});

describe("countChanges", () => {
  it("returns zero for identical strings", () => {
    const result = countChanges("same\ncontent", "same\ncontent");
    expect(result.additions).toBe(0);
    expect(result.removals).toBe(0);
  });

  it("counts additions correctly", () => {
    const result = countChanges("line 1\n", "line 1\nline 2\nline 3\n");
    expect(result.additions).toBeGreaterThan(0);
  });

  it("counts removals correctly", () => {
    const result = countChanges("line 1\nline 2\nline 3\n", "line 1\n");
    expect(result.removals).toBeGreaterThan(0);
  });

  it("counts mixed changes correctly", () => {
    const result = countChanges("line 1\nold line", "line 1\nnew line");
    expect(result.additions).toBeGreaterThan(0);
    expect(result.removals).toBeGreaterThan(0);
  });

  it("handles empty strings", () => {
    const result = countChanges("", "");
    expect(result.additions).toBe(0);
    expect(result.removals).toBe(0);
  });

  it("counts all lines as additions from empty", () => {
    const result = countChanges("", "line 1\nline 2");
    expect(result.additions).toBeGreaterThan(0);
  });
});

describe("extractConflictHunks", () => {
  it("returns a single unchanged hunk for identical inputs", () => {
    const hunks = extractConflictHunks("line 1\nline 2\n", "line 1\nline 2\n");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.type).toBe("unchanged");
    expect(hunks[0]?.value).toBe("line 1\nline 2\n");
  });

  it("emits an `added` hunk for pure insertions (added-only path)", () => {
    const hunks = extractConflictHunks("line 1\n", "line 1\nline 2\n");
    // Mix of unchanged + added — order depends on diffLines, both should be present.
    expect(hunks.some((h) => h.type === "added")).toBe(true);
    const addedHunk = hunks.find((h) => h.type === "added");
    expect(addedHunk?.value).toContain("line 2");
  });

  it("emits a `conflict` hunk with both sides for changed lines (removed+added pair)", () => {
    const hunks = extractConflictHunks("line 1\nold\nline 3\n", "line 1\nnew\nline 3\n");
    const conflict = hunks.find((h) => h.type === "conflict");
    expect(conflict).toBeDefined();
    expect(conflict?.currentValue).toContain("old");
    expect(conflict?.incomingValue).toContain("new");
  });

  it("emits a `conflict` hunk with empty incoming when a line is removed without replacement", () => {
    const hunks = extractConflictHunks("line 1\nline 2\nline 3\n", "line 1\nline 3\n");
    const conflict = hunks.find((h) => h.type === "conflict");
    expect(conflict).toBeDefined();
    expect(conflict?.currentValue).toContain("line 2");
    expect(conflict?.incomingValue).toBe("");
  });

  it("preserves order across an unchanged → conflict → unchanged sequence", () => {
    const hunks = extractConflictHunks("alpha\nbeta\ngamma\n", "alpha\nBETA\ngamma\n");
    expect(hunks.length).toBeGreaterThanOrEqual(2);
    // First and last hunks should both be unchanged segments
    expect(hunks[0]?.type).toBe("unchanged");
    expect(hunks.at(-1)?.type).toBe("unchanged");
  });
});
