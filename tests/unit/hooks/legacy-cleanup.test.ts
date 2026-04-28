import { describe, it, expect } from "vitest";
import { stripLegacyTextMarkers } from "#src/core/hooks/legacy-cleanup.js";
import { PROJECT_NAME_DISPLAY } from "#src/constants.js";

describe("stripLegacyTextMarkers", () => {
  it("removes the BEGIN/END marker block", () => {
    const input = [
      "repos:",
      "  - repo: https://github.com/x/y",
      "    rev: v1",
      "    hooks:",
      "      - id: foo",
      `  # ${PROJECT_NAME_DISPLAY} hooks: BEGIN (auto-generated — do not edit between markers)`,
      "  - repo: local",
      "    hooks:",
      "      - id: codi-junk",
      `  # ${PROJECT_NAME_DISPLAY} hooks: END`,
      "",
    ].join("\n");
    const result = stripLegacyTextMarkers(input);
    expect(result).not.toMatch(/hooks: BEGIN/);
    expect(result).not.toMatch(/hooks: END/);
    expect(result).not.toMatch(/codi-junk/);
    expect(result).toMatch(/x\/y/);
  });

  it("removes the legacy column-zero block", () => {
    const input = [
      "repos:",
      "  - repo: https://github.com/x/y",
      `# ${PROJECT_NAME_DISPLAY} hooks`,
      "- repo: local",
      "  hooks:",
      "    - id: codi-something",
      "",
    ].join("\n");
    const result = stripLegacyTextMarkers(input);
    expect(result).not.toMatch(new RegExp(`# ${PROJECT_NAME_DISPLAY} hooks`));
    expect(result).not.toMatch(/codi-something/);
  });

  it("passes through input with no markers", () => {
    const input = "repos:\n  - repo: https://github.com/x/y\n    rev: v1\n";
    expect(stripLegacyTextMarkers(input)).toContain("https://github.com/x/y");
  });

  it("collapses 3+ blank lines to 2", () => {
    const input = "a\n\n\n\nb\n";
    expect(stripLegacyTextMarkers(input)).toBe("a\n\nb\n");
  });

  it("normalises to single trailing newline", () => {
    const input = "repos:\n  - repo: x\n\n\n";
    const out = stripLegacyTextMarkers(input);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});
