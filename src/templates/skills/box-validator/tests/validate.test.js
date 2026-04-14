// Integration tests for box-validator.
//
// Uses vitest (root runner). Each test renders a real HTML fixture with
// headless chromium and asserts the validator's verdict. These are slow
// (~1-2s each) because of browser startup, so we keep the fixture count
// tight: one representative per rule.

import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { renderAndExtract } from "../scripts/lib/renderer.mjs";
import { annotate } from "../scripts/lib/tree-walker.mjs";
import { runRules } from "../scripts/lib/rule-engine.mjs";
import { buildReport } from "../scripts/lib/report-builder.mjs";
import { computeContext } from "../scripts/lib/context.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, "..", "assets", "templates");
const FIXTURES = join(HERE, "fixtures");

async function validate(inputPath, width, height) {
  const raw = await renderAndExtract({ inputPath, width, height });
  const provisional = computeContext({ canvasWidth: width, canvasHeight: height, nodeCount: 1 });
  const { root, siblingGroups, nodeCount } = annotate(raw, provisional);
  const context = computeContext({ canvasWidth: width, canvasHeight: height, nodeCount });
  const violations = runRules(root, siblingGroups, context);
  return buildReport({ root, siblingGroups, violations, threshold: 0.85, context });
}

describe("box-validator / starter templates (should PASS)", () => {
  it("instagram-4x5 passes validation", async () => {
    const report = await validate(join(TEMPLATES, "instagram-4x5.html"), 1080, 1350);
    expect(report.summary.errors).toBe(0);
    expect(report.valid).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(0.85);
  }, 30_000);

  it("slide-16x9 passes validation", async () => {
    const report = await validate(join(TEMPLATES, "slide-16x9.html"), 1920, 1080);
    expect(report.summary.errors).toBe(0);
    expect(report.valid).toBe(true);
  }, 30_000);

  it("a4-portrait passes validation", async () => {
    const report = await validate(join(TEMPLATES, "a4-portrait.html"), 794, 1123);
    expect(report.summary.errors).toBe(0);
    expect(report.valid).toBe(true);
  }, 30_000);
});

describe("box-validator / broken fixtures (should FAIL)", () => {
  it("broken-r4-gap: flags padding≠gap as R4 error", async () => {
    const report = await validate(join(FIXTURES, "broken-r4-gap.html"), 800, 800);
    expect(report.valid).toBe(false);
    const r4 = report.violations.filter((v) => v.rule === "R4" && v.severity === "error");
    expect(r4.length).toBeGreaterThan(0);
  }, 30_000);

  it("broken-r4-asym: flags asymmetric padding as R4 warning", async () => {
    const report = await validate(join(FIXTURES, "broken-r4-asym.html"), 800, 800);
    const r4 = report.violations.filter((v) => v.rule === "R4");
    expect(r4.length).toBeGreaterThan(0);
  }, 30_000);

  it("broken-r2-dead-space: flags dead space as R2 error", async () => {
    const report = await validate(join(FIXTURES, "broken-r2-dead-space.html"), 800, 800);
    expect(report.valid).toBe(false);
    const r2 = report.violations.filter((v) => v.rule === "R2" && v.severity === "error");
    expect(r2.length).toBeGreaterThan(0);
  }, 30_000);

  it("broken-r7-empty: flags empty node as R7 error", async () => {
    const report = await validate(join(FIXTURES, "broken-r7-empty.html"), 800, 800);
    expect(report.valid).toBe(false);
    const r7 = report.violations.filter((v) => v.rule === "R7");
    expect(r7.length).toBeGreaterThan(0);
  }, 30_000);

  it("broken-r8-siblings: flags sibling dimension mismatch as R8", async () => {
    const report = await validate(join(FIXTURES, "broken-r8-siblings.html"), 1000, 400);
    const r8 = report.violations.filter((v) => v.rule === "R8");
    expect(r8.length).toBeGreaterThan(0);
  }, 30_000);

  it("broken-r9-icon-text: flags compound leaves, ignores single-atom leaves", async () => {
    const report = await validate(join(FIXTURES, "broken-r9-icon-text.html"), 800, 800);
    const r9 = report.violations.filter((v) => v.rule === "R9");
    // Exactly 3 leaves should flag: "↑ 34.2% vs Q3", "2026-04-14 · 14:20 UTC", "✓ Done".
    // The other 3 (`$12.4M`, `Terms & Conditions`, `Hello world`) must pass.
    expect(r9.length).toBe(3);
    const messages = r9.map((v) => v.message).join(" | ");
    expect(messages).toMatch(/34\.2%/);
    expect(messages).toMatch(/14:20/);
    expect(messages).toMatch(/Done/);
    expect(messages).not.toMatch(/12\.4M/);
    expect(messages).not.toMatch(/Terms/);
    expect(messages).not.toMatch(/Hello world/);
  }, 30_000);

  it("broken-r10-overflow: flags vertical and horizontal content overflow", async () => {
    const report = await validate(join(FIXTURES, "broken-r10-overflow.html"), 800, 400);
    expect(report.valid).toBe(false);
    const r10 = report.violations.filter((v) => v.rule === "R10");
    // The $12.4M leaf overflows vertically, the long identifier overflows
    // horizontally, the "Fits fine" leaf is clean.
    expect(r10.length).toBeGreaterThanOrEqual(2);
    const messages = r10.map((v) => v.message).join(" | ");
    expect(messages).toMatch(/12\.4M/);
    expect(messages).toMatch(/Extraordinarily/);
    expect(messages).not.toMatch(/Fits fine/);
  }, 30_000);
});
