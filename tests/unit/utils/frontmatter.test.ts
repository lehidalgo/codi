import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../../../src/utils/frontmatter.js";

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
});
