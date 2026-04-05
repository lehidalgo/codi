import { describe, it, expect } from "vitest";
import {
  parseVersionFromFrontmatter,
  injectFrontmatterVersion,
} from "#src/core/version/artifact-version.js";

describe("parseVersionFromFrontmatter", () => {
  it("extracts version from frontmatter", () => {
    const content = `---
name: my-rule
managed_by: codi
version: 3
---

Body content.`;
    expect(parseVersionFromFrontmatter(content)).toBe(3);
  });

  it("returns 1 when version field is absent", () => {
    const content = `---
name: my-rule
managed_by: codi
---

Body content.`;
    expect(parseVersionFromFrontmatter(content)).toBe(1);
  });

  it("returns 1 for content without frontmatter", () => {
    expect(parseVersionFromFrontmatter("No frontmatter here.")).toBe(1);
  });

  it("handles version: 1", () => {
    const content = `---\nname: x\nversion: 1\n---\n`;
    expect(parseVersionFromFrontmatter(content)).toBe(1);
  });

  it("handles version: 10", () => {
    const content = `---\nname: x\nversion: 10\n---\n`;
    expect(parseVersionFromFrontmatter(content)).toBe(10);
  });
});

describe("injectFrontmatterVersion", () => {
  it("replaces existing version field", () => {
    const content = `---\nname: x\nversion: 1\n---\n`;
    expect(injectFrontmatterVersion(content, 2)).toBe(`---\nname: x\nversion: 2\n---\n`);
  });

  it("appends version field when absent", () => {
    const content = `---\nname: x\nmanaged_by: user\n---\n`;
    expect(injectFrontmatterVersion(content, 1)).toBe(
      `---\nname: x\nmanaged_by: user\nversion: 1\n---\n`,
    );
  });

  it("returns content unchanged when no frontmatter", () => {
    const content = "No frontmatter.";
    expect(injectFrontmatterVersion(content, 1)).toBe("No frontmatter.");
  });
});
