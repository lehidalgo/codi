import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "#src/utils/frontmatter.js";

interface TestFrontmatter {
  name: string;
  description?: string;
  priority?: string;
}

describe("parseFrontmatter", () => {
  it("parses YAML frontmatter and returns data + content", () => {
    const raw = `---
name: my-rule
description: A test rule
priority: high
---

# My Rule

Some content here.`;

    const result = parseFrontmatter<TestFrontmatter>(raw);
    expect(result.data.name).toBe("my-rule");
    expect(result.data.description).toBe("A test rule");
    expect(result.data.priority).toBe("high");
    expect(result.content).toContain("# My Rule");
    expect(result.content).toContain("Some content here.");
  });

  it("handles missing frontmatter", () => {
    const raw = "# Just Content\n\nNo frontmatter here.";
    const result = parseFrontmatter<TestFrontmatter>(raw);
    expect(result.data).toEqual({});
    expect(result.content).toContain("# Just Content");
  });

  it("preserves content after frontmatter without frontmatter markers", () => {
    const raw = `---
name: test
---

Line 1
Line 2
Line 3`;

    const result = parseFrontmatter<TestFrontmatter>(raw);
    expect(result.data.name).toBe("test");
    expect(result.content).toContain("Line 1");
    expect(result.content).toContain("Line 3");
    expect(result.content).not.toContain("---");
  });

  it("handles empty content after frontmatter", () => {
    const raw = `---
name: empty
---`;

    const result = parseFrontmatter<TestFrontmatter>(raw);
    expect(result.data.name).toBe("empty");
    expect(result.content).toBe("");
  });

  it("preserves nested objects in YAML frontmatter", () => {
    interface Nested {
      name: string;
      meta: { version: number; tags: string[]; author: { name: string } };
    }
    const raw = `---
name: nested
meta:
  version: 2
  tags:
    - a
    - b
  author:
    name: alice
---

Body.`;
    const result = parseFrontmatter<Nested>(raw);
    expect(result.data.meta.version).toBe(2);
    expect(result.data.meta.tags).toEqual(["a", "b"]);
    expect(result.data.meta.author.name).toBe("alice");
  });

  it("preserves multi-line block scalars (| and >)", () => {
    interface Multi {
      literal: string;
      folded: string;
    }
    const raw = `---
literal: |
  line one
  line two
folded: >
  this is
  one logical line
---

Body.`;
    const result = parseFrontmatter<Multi>(raw);
    expect(result.data.literal).toBe("line one\nline two\n");
    expect(result.data.folded).toBe("this is one logical line\n");
  });

  it("handles BOM at start of file", () => {
    const raw = "﻿---\nname: bom\n---\n\nBody.";
    const result = parseFrontmatter<TestFrontmatter>(raw);
    expect(result.data.name).toBe("bom");
    expect(result.content).toBe("Body.");
  });

  it("handles CRLF line endings", () => {
    const raw = "---\r\nname: crlf\r\n---\r\n\r\nBody.";
    const result = parseFrontmatter<TestFrontmatter>(raw);
    expect(result.data.name).toBe("crlf");
    expect(result.content).toBe("Body.");
  });

  it("throws SyntaxError on malformed YAML", () => {
    const raw = `---
name: : bad-yaml
  invalid: [unclosed
---

Body.`;
    expect(() => parseFrontmatter<TestFrontmatter>(raw)).toThrow(SyntaxError);
  });

  it("returns empty data when frontmatter is null", () => {
    const raw = `---
---

Body.`;
    const result = parseFrontmatter<TestFrontmatter>(raw);
    expect(result.data).toEqual({});
    expect(result.content).toBe("Body.");
  });

  it("does not treat mid-file --- as frontmatter", () => {
    const raw = `Some preamble

---
not: frontmatter
---`;
    const result = parseFrontmatter<TestFrontmatter>(raw);
    expect(result.data).toEqual({});
    expect(result.content).toContain("not: frontmatter");
  });
});
