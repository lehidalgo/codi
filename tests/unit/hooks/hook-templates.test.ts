import { describe, it, expect } from "vitest";
import { RUNNER_TEMPLATE } from "#src/core/hooks/hook-templates.js";
import { BRAND_SKILL_VALIDATE_TEMPLATE } from "#src/core/hooks/brand-skill-validate-template.js";

describe("RUNNER_TEMPLATE", () => {
  it("contains ENOENT blocking logic for required tools", () => {
    expect(RUNNER_TEMPLATE).toContain("required");
    expect(RUNNER_TEMPLATE).toContain("BLOCKING");
    expect(RUNNER_TEMPLATE).toContain("installHint");
    expect(RUNNER_TEMPLATE).toContain("exitCode = 1");
  });

  it("contains warning logic for non-required tools", () => {
    expect(RUNNER_TEMPLATE).toContain("WARNING");
  });

  it("is a valid shell script starting with #!/bin/sh", () => {
    expect(RUNNER_TEMPLATE.trimStart()).toMatch(/^#!\/bin\/sh/);
  });
});

describe("BRAND_SKILL_VALIDATE_TEMPLATE", () => {
  it("exports a non-empty string", () => {
    expect(typeof BRAND_SKILL_VALIDATE_TEMPLATE).toBe("string");
    expect(BRAND_SKILL_VALIDATE_TEMPLATE.length).toBeGreaterThan(0);
  });

  it("contains shebang and brand-skill-validate comment", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("#!/usr/bin/env node");
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("brand-skill-validate");
  });

  it("checks for brand/tokens.json", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("brand/tokens.json");
  });

  it("checks for google_fonts_url field", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("google_fonts_url");
  });

  it("checks for references/ directory with .html files", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("references/");
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain(".html");
  });

  it("checks for evals/evals.json", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("evals/evals.json");
  });

  it("checks for LICENSE.txt", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("LICENSE.txt");
  });

  it("checks templates/ for codi:template meta tag", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("codi:template");
  });

  it("checks for -brand parent directory walk-up", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("-brand");
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("findBrandRoot");
  });

  it("outputs Action required (coding agent) section on failure", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain("Action required (coding agent)");
  });

  it("scans both .codi/skills/ user circuit files", () => {
    expect(BRAND_SKILL_VALIDATE_TEMPLATE).toContain(".codi/skills/");
  });
});
