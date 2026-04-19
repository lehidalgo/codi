import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  discoverBrands,
} = require("#src/templates/skills/content-factory/scripts/lib/brand-discovery.cjs");

// The fixture is built in a tmpdir so the repo never checks in a `-brand`
// directory (which the brand-skill-validate pre-commit hook would flag as
// a real, incomplete brand skill).
let skillsDir;

beforeAll(() => {
  skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-brand-discovery-"));
  const brandDir = path.join(skillsDir, "brand-fixture-brand");
  const assetsDir = path.join(brandDir, "brand", "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(brandDir, "brand", "tokens.json"),
    '{ "display_name": "Brand Fixture", "version": 1 }',
  );
  fs.writeFileSync(
    path.join(assetsDir, "logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#0066cc"/></svg>',
  );
});

afterAll(() => {
  if (skillsDir) fs.rmSync(skillsDir, { recursive: true, force: true });
});

describe("discoverBrands logoPath", () => {
  it("exposes logoPath when brand/assets/logo.svg exists", () => {
    const brands = discoverBrands(skillsDir);
    const fixture = brands.find((b) => b.name === "brand-fixture-brand");
    expect(fixture).toBeTruthy();
    expect(fixture.logoPath).toBeTruthy();
    expect(fs.existsSync(fixture.logoPath)).toBe(true);
    expect(fixture.logoPath.endsWith(path.join("brand", "assets", "logo.svg"))).toBe(true);
  });

  it("returns logoPath as string or null on every record", () => {
    const brands = discoverBrands(skillsDir);
    for (const b of brands) {
      expect(b.logoPath === null || typeof b.logoPath === "string").toBe(true);
    }
  });

  it("returns logoPath=null when brand has no logo asset", () => {
    const extraSkills = fs.mkdtempSync(path.join(os.tmpdir(), "cf-brand-nologo-"));
    try {
      const brandDir = path.join(extraSkills, "nologo-brand");
      fs.mkdirSync(path.join(brandDir, "brand"), { recursive: true });
      fs.writeFileSync(
        path.join(brandDir, "brand", "tokens.json"),
        '{ "display_name": "No Logo", "version": 1 }',
      );
      const brands = discoverBrands(extraSkills);
      const brand = brands.find((b) => b.name === "nologo-brand");
      expect(brand).toBeTruthy();
      expect(brand.logoPath).toBeNull();
    } finally {
      fs.rmSync(extraSkills, { recursive: true, force: true });
    }
  });
});
