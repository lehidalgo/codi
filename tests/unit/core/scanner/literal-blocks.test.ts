import { describe, it, expect } from "vitest";
import { findLiteralBlocks, lineIsLiteral } from "#src/core/scanner/literal-blocks.js";

describe("findLiteralBlocks", () => {
  describe("fenced code blocks", () => {
    it("returns no blocks for plain prose", () => {
      expect(findLiteralBlocks("hello\nworld\n")).toEqual([]);
    });

    it("identifies a triple-backtick fenced block", () => {
      const text = ["before", "```", "literal", "```", "after"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "fence", startLine: 2, endLine: 4 }]);
    });

    it("identifies a triple-tilde fenced block", () => {
      const text = ["before", "~~~", "literal", "~~~", "after"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "fence", startLine: 2, endLine: 4 }]);
    });

    it("accepts language-tagged fences (```ts, ```bash)", () => {
      const text = ["```ts", "const x = 1;", "```"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "fence", startLine: 1, endLine: 3 }]);
    });

    it("accepts up to 3 leading spaces on a fence (CommonMark)", () => {
      const text = ["   ```", "literal", "   ```"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "fence", startLine: 1, endLine: 3 }]);
    });

    it("treats an unclosed fence as literal through end of input", () => {
      const text = ["before", "```", "still inside", "and inside"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "fence", startLine: 2, endLine: 4 }]);
    });

    it("handles multiple fenced blocks in one document", () => {
      const text = [
        "intro",
        "```",
        "block A",
        "```",
        "middle",
        "~~~",
        "block B",
        "~~~",
        "outro",
      ].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({ kind: "fence", startLine: 2, endLine: 4 });
      expect(blocks[1]).toEqual({ kind: "fence", startLine: 6, endLine: 8 });
    });

    it("strips CRLF before fence detection", () => {
      const text = "before\r\n```\r\nliteral\r\n```\r\nafter";
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "fence", startLine: 2, endLine: 4 }]);
    });

    it("respects fences=false to disable fence detection", () => {
      const text = ["```", "literal", "```"].join("\n");
      expect(findLiteralBlocks(text, { fences: false })).toEqual([]);
    });
  });

  describe("example tag regions", () => {
    it("identifies a multi-line <example> region", () => {
      const text = ["intro", "<example>", "demo content", "</example>", "outro"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "tag", tag: "example", startLine: 2, endLine: 4 }]);
    });

    it("matches tags case-insensitively", () => {
      const text = ["<Example>", "x", "</EXAMPLE>"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "tag", tag: "example", startLine: 1, endLine: 3 }]);
    });

    it("collapses single-line <example>...</example> to one literal line", () => {
      const text = ["before", "<example>inline</example>", "after"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "tag", tag: "example", startLine: 2, endLine: 2 }]);
    });

    it("treats an unclosed example tag as literal through end of input", () => {
      const text = ["before", "<example>", "still inside"].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "tag", tag: "example", startLine: 2, endLine: 3 }]);
    });

    it("supports custom example tag list", () => {
      const text = ["<sample>", "x", "</sample>", "<example>", "y", "</example>"].join("\n");
      const blocks = findLiteralBlocks(text, { exampleTags: ["sample"] });
      expect(blocks).toEqual([{ kind: "tag", tag: "sample", startLine: 1, endLine: 3 }]);
    });

    it("disables tag detection when exampleTags is empty", () => {
      const text = ["<example>", "x", "</example>"].join("\n");
      expect(findLiteralBlocks(text, { exampleTags: [] })).toEqual([]);
    });
  });

  describe("interaction between fences and tags", () => {
    it("treats tags inside fences as plain content (fence wins)", () => {
      const text = [
        "```",
        "<example>",
        "this is literal text inside the fence",
        "</example>",
        "```",
      ].join("\n");
      const blocks = findLiteralBlocks(text);
      // Single fence block; the tags inside are not separately recognised.
      expect(blocks).toEqual([{ kind: "fence", startLine: 1, endLine: 5 }]);
    });

    it("does not recognise fences inside an open example tag", () => {
      const text = [
        "<example>",
        "```",
        "this stays inside the example region",
        "```",
        "</example>",
      ].join("\n");
      const blocks = findLiteralBlocks(text);
      expect(blocks).toEqual([{ kind: "tag", tag: "example", startLine: 1, endLine: 5 }]);
    });
  });
});

describe("lineIsLiteral", () => {
  const blocks = findLiteralBlocks(
    ["a", "```", "b", "```", "c", "<example>", "d", "</example>", "e"].join("\n"),
  );
  // blocks: [fence 2..4, tag 6..8]

  it("returns true for lines inside a fence", () => {
    expect(lineIsLiteral(2, blocks)).toBe(true);
    expect(lineIsLiteral(3, blocks)).toBe(true);
    expect(lineIsLiteral(4, blocks)).toBe(true);
  });

  it("returns true for lines inside a tag region", () => {
    expect(lineIsLiteral(6, blocks)).toBe(true);
    expect(lineIsLiteral(7, blocks)).toBe(true);
    expect(lineIsLiteral(8, blocks)).toBe(true);
  });

  it("returns false for lines outside any literal region", () => {
    expect(lineIsLiteral(1, blocks)).toBe(false);
    expect(lineIsLiteral(5, blocks)).toBe(false);
    expect(lineIsLiteral(9, blocks)).toBe(false);
  });

  it("returns false for an empty block list", () => {
    expect(lineIsLiteral(1, [])).toBe(false);
  });
});
