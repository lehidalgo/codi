import { describe, it, expect } from "vitest";
import { DOC_NAMING_CHECK_TEMPLATE } from "#src/core/hooks/hook-templates.js";

describe("DOC_NAMING_CHECK_TEMPLATE", () => {
  it("does not call python3 or scripts/validate-docs.py", () => {
    expect(DOC_NAMING_CHECK_TEMPLATE).not.toContain("python3");
    expect(DOC_NAMING_CHECK_TEMPLATE).not.toContain("validate-docs.py");
  });

  it("contains all allowed categories", () => {
    const categories = [
      "ARCHITECTURE",
      "AUDIT",
      "GUIDE",
      "REPORT",
      "ROADMAP",
      "RESEARCH",
      "SECURITY",
      "TESTING",
      "BUSINESS",
      "TECH",
      "PLAN",
    ];
    for (const cat of categories) {
      expect(DOC_NAMING_CHECK_TEMPLATE).toContain(cat);
    }
  });

  it("contains the YYYYMMDD date-based regex pattern", () => {
    expect(DOC_NAMING_CHECK_TEMPLATE).toMatch(/\\d\{8\}/);
  });

  it("contains skip dir names matching Python script", () => {
    expect(DOC_NAMING_CHECK_TEMPLATE).toContain("project");
    expect(DOC_NAMING_CHECK_TEMPLATE).toContain("codi_docs");
    expect(DOC_NAMING_CHECK_TEMPLATE).toContain("superpowers");
    expect(DOC_NAMING_CHECK_TEMPLATE).toContain("DEPRECATED");
  });
});
