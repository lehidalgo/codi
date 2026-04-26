import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  discoverBrands,
} = require("#src/templates/skills/content-factory/scripts/lib/brand-discovery.cjs");

let skillsDir;

beforeAll(() => {
  skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-brand-discovery-"));
  // Conforming brand: logo at assets/logo.svg, tokens at brand/tokens.json.
  const conforming = path.join(skillsDir, "conforming-brand");
  fs.mkdirSync(path.join(conforming, "assets"), { recursive: true });
  fs.mkdirSync(path.join(conforming, "brand"), { recursive: true });
  fs.writeFileSync(
    path.join(conforming, "brand", "tokens.json"),
    '{ "display_name": "Conforming", "version": 2 }',
  );
  fs.writeFileSync(
    path.join(conforming, "assets", "logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>',
  );

  // Legacy brand: no brand/ dir, tokens under scripts/, logo non-standard name.
  const legacy = path.join(skillsDir, "legacy-brand");
  fs.mkdirSync(path.join(legacy, "assets"), { recursive: true });
  fs.mkdirSync(path.join(legacy, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(legacy, "scripts", "brand_tokens.json"),
    '{ "display_name": "Legacy" }',
  );
  fs.writeFileSync(
    path.join(legacy, "assets", "LEGACY_RGB.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
  );

  // Minimal brand: no tokens at all, just a standard logo.png.
  const minimal = path.join(skillsDir, "minimal-brand");
  fs.mkdirSync(path.join(minimal, "assets"), { recursive: true });
  fs.writeFileSync(path.join(minimal, "assets", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  // Themed brand: ships only themed variants (no canonical logo.svg).
  // logo-black.svg, logo-dark.svg, logo-light.svg — all in assets/.
  const themed = path.join(skillsDir, "themed-brand");
  fs.mkdirSync(path.join(themed, "assets"), { recursive: true });
  for (const name of ["logo-black.svg", "logo-dark.svg", "logo-light.svg"]) {
    fs.writeFileSync(
      path.join(themed, "assets", name),
      `<svg xmlns="http://www.w3.org/2000/svg" id="${name}"/>`,
    );
  }

  // Branded-name brand: ships `<brand>-logo.svg` in assets/.
  const branded = path.join(skillsDir, "branded-name-brand");
  fs.mkdirSync(path.join(branded, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(branded, "assets", "acme-logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" id="acme-logo"/>',
  );
});

afterAll(() => {
  if (skillsDir) fs.rmSync(skillsDir, { recursive: true, force: true });
});

describe("discoverBrands", () => {
  it("discovers every directory ending in -brand", () => {
    const names = discoverBrands(skillsDir)
      .map((b) => b.name)
      .sort();
    expect(names).toEqual([
      "branded-name-brand",
      "conforming-brand",
      "legacy-brand",
      "minimal-brand",
      "themed-brand",
    ]);
  });

  it("populates logoPath for conforming brands (assets/logo.svg)", () => {
    const conforming = discoverBrands(skillsDir).find((b) => b.name === "conforming-brand");
    expect(conforming.logoPath).toMatch(/assets\/logo\.svg$/);
    expect(fs.existsSync(conforming.logoPath)).toBe(true);
  });

  it("accepts PNG at the standard path", () => {
    const minimal = discoverBrands(skillsDir).find((b) => b.name === "minimal-brand");
    expect(minimal.logoPath).toMatch(/assets\/logo\.png$/);
  });

  it("reads tokens from brand/tokens.json when present", () => {
    const conforming = discoverBrands(skillsDir).find((b) => b.name === "conforming-brand");
    expect(conforming.display_name).toBe("Conforming");
    expect(conforming.version).toBe(2);
  });

  it("falls back to scripts/brand_tokens.json when brand/tokens.json is absent", () => {
    const legacy = discoverBrands(skillsDir).find((b) => b.name === "legacy-brand");
    expect(legacy.display_name).toBe("Legacy");
  });

  it("leaves logoPath=null for legacy non-conforming brands", () => {
    const legacy = discoverBrands(skillsDir).find((b) => b.name === "legacy-brand");
    expect(legacy.logoPath).toBeNull();
  });

  it("discovers brands even without any tokens file", () => {
    const minimal = discoverBrands(skillsDir).find((b) => b.name === "minimal-brand");
    expect(minimal).toBeTruthy();
    expect(minimal.tokens).toEqual({});
  });

  it("accepts themed variants (logo-light.svg / logo-dark.svg) as conforming", () => {
    const themed = discoverBrands(skillsDir).find((b) => b.name === "themed-brand");
    expect(themed.logoPath).not.toBeNull();
    // SVG over PNG, then alphabetical within `logo-*` tier.
    expect(themed.logoPath).toMatch(/assets\/logo-black\.svg$/);
  });

  it("accepts any filename containing 'logo' in assets/ as conforming", () => {
    const branded = discoverBrands(skillsDir).find((b) => b.name === "branded-name-brand");
    expect(branded.logoPath).not.toBeNull();
    expect(branded.logoPath).toMatch(/assets\/acme-logo\.svg$/);
  });
});
