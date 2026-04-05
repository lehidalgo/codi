import { describe, it, expect } from "vitest";
import { extractProjectContext, injectProjectContext } from "#src/utils/project-context-preserv.js";
import { PROJECT_CONTEXT_START, PROJECT_CONTEXT_END } from "#src/constants.js";

const SAMPLE_BLOCK = `${PROJECT_CONTEXT_START}
## Project Context

### What This Project Does
A CLI tool for managing AI agent configuration files.

### Tech Stack
- **Language**: TypeScript
${PROJECT_CONTEXT_END}`;

describe("extractProjectContext", () => {
  it("returns null when no markers are present", () => {
    const content = "## Project Overview\n\nSome content here.";
    expect(extractProjectContext(content)).toBeNull();
  });

  it("returns null when only start marker is present", () => {
    const content = `${PROJECT_CONTEXT_START}\nsome content without end`;
    expect(extractProjectContext(content)).toBeNull();
  });

  it("returns null when only end marker is present", () => {
    const content = `some content\n${PROJECT_CONTEXT_END}`;
    expect(extractProjectContext(content)).toBeNull();
  });

  it("returns null when end marker appears before start marker", () => {
    const content = `${PROJECT_CONTEXT_END}\n${PROJECT_CONTEXT_START}`;
    expect(extractProjectContext(content)).toBeNull();
  });

  it("extracts the full block including markers", () => {
    const content = `Some preamble\n\n${SAMPLE_BLOCK}\n\n## Project Overview`;
    const result = extractProjectContext(content);
    expect(result).toBe(SAMPLE_BLOCK);
    expect(result).toContain(PROJECT_CONTEXT_START);
    expect(result).toContain(PROJECT_CONTEXT_END);
  });

  it("extracts block at the start of the file", () => {
    const content = `${SAMPLE_BLOCK}\n\n## Project Overview`;
    const result = extractProjectContext(content);
    expect(result).toBe(SAMPLE_BLOCK);
  });

  it("extracts block at the end of the file", () => {
    const content = `## Project Overview\n\n${SAMPLE_BLOCK}`;
    const result = extractProjectContext(content);
    expect(result).toBe(SAMPLE_BLOCK);
  });
});

describe("injectProjectContext", () => {
  it("inserts before the first ## heading", () => {
    const generated = "## Project Overview\n\nSome content.\n\n## Workflow\n\nMore content.";
    const result = injectProjectContext(generated, SAMPLE_BLOCK);
    expect(result.indexOf(PROJECT_CONTEXT_START)).toBeLessThan(
      result.indexOf("## Project Overview"),
    );
    expect(result).toContain("## Project Overview");
    expect(result).toContain("## Workflow");
  });

  it("prepends when no ## heading exists", () => {
    const generated = "No headings here, just plain text.";
    const result = injectProjectContext(generated, SAMPLE_BLOCK);
    expect(result.startsWith(SAMPLE_BLOCK)).toBe(true);
    expect(result).toContain("No headings here");
  });

  it("produces content that contains both the block and the original content", () => {
    const generated = "## Project Overview\n\nContent.";
    const result = injectProjectContext(generated, SAMPLE_BLOCK);
    expect(result).toContain(PROJECT_CONTEXT_START);
    expect(result).toContain(PROJECT_CONTEXT_END);
    expect(result).toContain("## Project Overview");
    expect(result).toContain("Content.");
  });
});

describe("round-trip: extract then inject", () => {
  it("preserves the block identically after inject + extract", () => {
    const generated = "## Project Overview\n\nSome generated content.\n\n## Workflow\n\nSteps.";
    const injected = injectProjectContext(generated, SAMPLE_BLOCK);
    const extracted = extractProjectContext(injected);
    expect(extracted).toBe(SAMPLE_BLOCK);
  });

  it("injecting into a file that already has a block produces one block, not two", () => {
    const generated = "## Project Overview\n\nContent.";
    // First inject
    const firstPass = injectProjectContext(generated, SAMPLE_BLOCK);
    // The generator re-reads the file, extracts the block, injects into fresh generated content
    const block = extractProjectContext(firstPass);
    expect(block).not.toBeNull();
    const secondPass = injectProjectContext(generated, block!);
    const occurrences = (secondPass.match(new RegExp(PROJECT_CONTEXT_START, "g")) ?? []).length;
    expect(occurrences).toBe(1);
  });
});
