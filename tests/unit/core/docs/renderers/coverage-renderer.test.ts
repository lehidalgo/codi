import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderTestCoverage } from "../../../../../src/core/docs/renderers/coverage-renderer.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn() };
});

import { readFileSync } from "node:fs";

const mockReadFileSync = vi.mocked(readFileSync);

const MOCK_COVERAGE = {
  total: {
    lines: { total: 1000, covered: 750, skipped: 0, pct: 75.0 },
    statements: { total: 1200, covered: 900, skipped: 0, pct: 75.0 },
    functions: { total: 200, covered: 160, skipped: 0, pct: 80.0 },
    branches: { total: 400, covered: 280, skipped: 0, pct: 70.0 },
  },
  "/project/src/adapters/claude-code.ts": {
    lines: { total: 100, covered: 95, skipped: 0, pct: 95.0 },
    statements: { total: 120, covered: 114, skipped: 0, pct: 95.0 },
    functions: { total: 10, covered: 10, skipped: 0, pct: 100.0 },
    branches: { total: 30, covered: 28, skipped: 0, pct: 93.3 },
  },
  "/project/src/schemas/skill.ts": {
    lines: { total: 50, covered: 50, skipped: 0, pct: 100.0 },
    statements: { total: 60, covered: 60, skipped: 0, pct: 100.0 },
    functions: { total: 5, covered: 5, skipped: 0, pct: 100.0 },
    branches: { total: 10, covered: 10, skipped: 0, pct: 100.0 },
  },
};

describe("renderTestCoverage", () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
  });

  it("renders global coverage table from summary JSON", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(MOCK_COVERAGE));

    const result = renderTestCoverage("/project");

    expect(result).toContain("| Metric | Coverage | Threshold | Status |");
    expect(result).toContain("| Statements | 75.0% | 70% | Pass |");
    expect(result).toContain("| Branches | 70.0% | 63% | Pass |");
    expect(result).toContain("| Functions | 80.0% | 73% | Pass |");
    expect(result).toContain("| Lines | 75.0% | 70% | Pass |");
  });

  it("shows FAIL when below threshold", () => {
    const failing = {
      total: {
        lines: { total: 100, covered: 50, skipped: 0, pct: 50.0 },
        statements: { total: 100, covered: 50, skipped: 0, pct: 50.0 },
        functions: { total: 100, covered: 50, skipped: 0, pct: 50.0 },
        branches: { total: 100, covered: 50, skipped: 0, pct: 50.0 },
      },
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(failing));

    const result = renderTestCoverage("/project");

    expect(result).toContain("**FAIL**");
  });

  it("renders module breakdown when matching files exist", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(MOCK_COVERAGE));

    const result = renderTestCoverage("/project");

    expect(result).toContain("**Module thresholds:**");
    expect(result).toContain("| adapters |");
    expect(result).toContain("| schemas |");
  });

  it("renders fallback table when coverage file is missing", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const result = renderTestCoverage("/project");

    expect(result).toContain("| Metric | Threshold |");
    expect(result).toContain("Run `npm run test:coverage`");
    expect(result).not.toContain("| Status |");
  });

  it("produces valid Markdown table with consistent pipe count", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(MOCK_COVERAGE));

    const result = renderTestCoverage("/project");
    const globalLines = result.split("\n").slice(0, 6);
    const headerPipes = (globalLines[0]!.match(/\|/g) ?? []).length;

    for (const line of globalLines) {
      expect((line.match(/\|/g) ?? []).length).toBe(headerPipes);
    }
  });
});
