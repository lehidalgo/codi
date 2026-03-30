import { describe, it, expect } from "vitest";
import { generateMitLicense } from "#src/core/scaffolder/license-generator.js";

describe("license generator", () => {
  it("generates MIT license with holder and year", () => {
    const license = generateMitLicense("my-project", 2026);

    expect(license).toContain("MIT License");
    expect(license).toContain("Copyright (c) 2026 my-project");
    expect(license).toContain("Permission is hereby granted");
    expect(license).toContain("THE SOFTWARE IS PROVIDED");
  });

  it("defaults year to current year", () => {
    const license = generateMitLicense("test-holder");
    const currentYear = new Date().getFullYear();

    expect(license).toContain(`Copyright (c) ${currentYear} test-holder`);
  });

  it("includes all standard MIT license sections", () => {
    const license = generateMitLicense("holder", 2025);

    expect(license).toContain("without restriction");
    expect(license).toContain("copies or substantial portions");
    expect(license).toContain("WITHOUT WARRANTY OF ANY KIND");
  });
});
