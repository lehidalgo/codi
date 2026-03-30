/**
 * Test coverage → Markdown table renderer.
 * Reads coverage-summary.json produced by `vitest run --coverage`
 * and renders a compact table for the README.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types matching Istanbul/v8 coverage-summary.json format
// ---------------------------------------------------------------------------

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface CoverageSummaryEntry {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

interface CoverageSummaryJson {
  total: CoverageSummaryEntry;
  [filePath: string]: CoverageSummaryEntry;
}

// ---------------------------------------------------------------------------
// Thresholds (read from vitest.config.ts structure)
// ---------------------------------------------------------------------------

interface ThresholdConfig {
  global: ThresholdEntry;
  modules: Record<string, ThresholdEntry>;
}

interface ThresholdEntry {
  statements: number;
  branches: number;
  functions: number;
  lines?: number;
}

const THRESHOLDS: ThresholdConfig = {
  global: { statements: 70, branches: 63, functions: 73, lines: 70 },
  modules: {
    "src/adapters": { statements: 93, branches: 90, functions: 100 },
    "src/core/config": { statements: 76, branches: 64, functions: 94 },
    "src/core/flags": { statements: 90, branches: 85, functions: 100 },
    "src/core/verify": { statements: 95, branches: 94, functions: 93 },
    "src/schemas": { statements: 100, branches: 100, functions: 100 },
    "src/utils": { statements: 95, branches: 92, functions: 100 },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusIcon(actual: number, threshold: number): string {
  if (actual >= threshold) return "Pass";
  return "**FAIL**";
}

function pctCell(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

function aggregateModule(
  summary: CoverageSummaryJson,
  modulePrefix: string,
): CoverageSummaryEntry | null {
  // Match paths containing the module prefix (e.g. "src/adapters/" anywhere in path)
  const keys = Object.keys(summary).filter(
    (k) => k !== "total" && k.includes(`${modulePrefix}/`),
  );
  if (keys.length === 0) return null;

  const agg: CoverageSummaryEntry = {
    lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
    statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
    functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
    branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
  };

  for (const k of keys) {
    const entry = summary[k];
    if (!entry) continue;
    for (const metric of [
      "lines",
      "statements",
      "functions",
      "branches",
    ] as const) {
      agg[metric].total += entry[metric].total;
      agg[metric].covered += entry[metric].covered;
    }
  }

  for (const metric of [
    "lines",
    "statements",
    "functions",
    "branches",
  ] as const) {
    agg[metric].pct =
      agg[metric].total > 0
        ? (agg[metric].covered / agg[metric].total) * 100
        : 100;
  }

  return agg;
}

// ---------------------------------------------------------------------------
// Public renderer
// ---------------------------------------------------------------------------

/**
 * Render test coverage table from coverage-summary.json.
 * Returns empty string if coverage file doesn't exist (allows graceful fallback).
 */
export function renderTestCoverage(projectRoot: string): string {
  const coveragePath = join(projectRoot, "coverage", "coverage-summary.json");

  let summary: CoverageSummaryJson;
  try {
    const raw = readFileSync(coveragePath, "utf-8");
    summary = JSON.parse(raw) as CoverageSummaryJson;
  } catch {
    return renderFallbackTable();
  }

  const total = summary.total;
  if (!total) return renderFallbackTable();

  const g = THRESHOLDS.global;

  // Global coverage table
  const rows: string[] = [
    "| Metric | Coverage | Threshold | Status |",
    "|:-------|--------:|--------:|:------:|",
    `| Statements | ${pctCell(total.statements.pct)} | ${g.statements}% | ${statusIcon(total.statements.pct, g.statements)} |`,
    `| Branches | ${pctCell(total.branches.pct)} | ${g.branches}% | ${statusIcon(total.branches.pct, g.branches)} |`,
    `| Functions | ${pctCell(total.functions.pct)} | ${g.functions}% | ${statusIcon(total.functions.pct, g.functions)} |`,
    `| Lines | ${pctCell(total.lines.pct)} | ${g.lines ?? 0}% | ${statusIcon(total.lines.pct, g.lines ?? 0)} |`,
  ];

  // Per-module breakdown
  const moduleRows: string[] = [];
  for (const [mod, thresh] of Object.entries(THRESHOLDS.modules)) {
    const agg = aggregateModule(summary, mod);
    if (!agg) continue;
    const label = mod.replace("src/", "");
    moduleRows.push(
      `| ${label} | ${pctCell(agg.statements.pct)} | ${pctCell(agg.branches.pct)} | ${pctCell(agg.functions.pct)} | ${thresh.statements}% / ${thresh.branches}% / ${thresh.functions}% |`,
    );
  }

  if (moduleRows.length > 0) {
    rows.push(
      "",
      "**Module thresholds:**",
      "",
      "| Module | Stmts | Branch | Funcs | Thresholds (S/B/F) |",
      "|:-------|------:|-------:|------:|:-------------------|",
      ...moduleRows,
    );
  }

  return rows.join("\n");
}

/**
 * Fallback table when no coverage data is available.
 */
function renderFallbackTable(): string {
  const g = THRESHOLDS.global;
  return [
    "| Metric | Threshold |",
    "|:-------|--------:|",
    `| Statements | ${g.statements}% |`,
    `| Branches | ${g.branches}% |`,
    `| Functions | ${g.functions}% |`,
    `| Lines | ${g.lines ?? 0}% |`,
    "",
    `> Run \`npm run test:coverage\` to generate coverage data.`,
  ].join("\n");
}
