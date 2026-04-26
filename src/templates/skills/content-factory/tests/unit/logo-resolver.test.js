import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  resolveLogo,
  bootstrapProjectLogo,
  checkBrandConformance,
  discoverLogoCandidates,
  BUILTIN_DEFAULT_SVG,
} = require("#src/templates/skills/content-factory/scripts/lib/logo-resolver.cjs");

let skillsDir;

beforeAll(() => {
  skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-logo-resolver-"));

  // Standard brand: SVG + PNG at the canonical paths.
  const standard = path.join(skillsDir, "standard-brand");
  fs.mkdirSync(path.join(standard, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(standard, "assets", "logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" id="standard-brand"/>',
  );
  fs.writeFileSync(
    path.join(standard, "assets", "logo.png"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  );
  fs.mkdirSync(path.join(standard, "brand"), { recursive: true });
  fs.writeFileSync(path.join(standard, "brand", "tokens.json"), "{}");

  // PNG-only brand.
  const pngOnly = path.join(skillsDir, "png-only-brand");
  fs.mkdirSync(path.join(pngOnly, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(pngOnly, "assets", "logo.png"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]),
  );
  fs.mkdirSync(path.join(pngOnly, "brand"), { recursive: true });
  fs.writeFileSync(path.join(pngOnly, "brand", "tokens.json"), "{}");

  // Legacy brand: no standard logo, a branded-name SVG under assets/.
  const legacy = path.join(skillsDir, "legacy-brand");
  fs.mkdirSync(path.join(legacy, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(legacy, "assets", "LEGACY_RGB.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" id="legacy-mark"/>',
  );
  fs.mkdirSync(path.join(legacy, "brand"), { recursive: true });
  fs.writeFileSync(path.join(legacy, "brand", "tokens.json"), "{}");

  // Empty brand — no assets, no logo anywhere.
  const empty = path.join(skillsDir, "empty-brand");
  fs.mkdirSync(path.join(empty, "brand"), { recursive: true });
  fs.writeFileSync(path.join(empty, "brand", "tokens.json"), "{}");

  // Themed brand — only `logo-light.svg` and `logo-dark.svg` in assets/.
  const themed = path.join(skillsDir, "themed-brand");
  fs.mkdirSync(path.join(themed, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(themed, "assets", "logo-dark.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" id="themed-dark"/>',
  );
  fs.writeFileSync(
    path.join(themed, "assets", "logo-light.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" id="themed-light"/>',
  );
  fs.mkdirSync(path.join(themed, "brand"), { recursive: true });
  fs.writeFileSync(path.join(themed, "brand", "tokens.json"), "{}");

  // Branded-name brand — a single `<brand>-logo.svg` in assets/.
  const branded = path.join(skillsDir, "branded-name-brand");
  fs.mkdirSync(path.join(branded, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(branded, "assets", "acme-logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" id="acme-mark"/>',
  );
  fs.mkdirSync(path.join(branded, "brand"), { recursive: true });
  fs.writeFileSync(path.join(branded, "brand", "tokens.json"), "{}");
});

afterAll(() => {
  if (skillsDir) fs.rmSync(skillsDir, { recursive: true, force: true });
});

function tmpProject({ svg, png } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-proj-"));
  fs.mkdirSync(path.join(dir, "state"), { recursive: true });
  if (svg) {
    fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(dir, "assets", "logo.svg"), svg);
  }
  if (png) {
    fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(dir, "assets", "logo.png"), png);
  }
  return dir;
}

describe("resolveLogo fallback chain", () => {
  it("step 1 — project SVG wins", () => {
    const project = tmpProject({ svg: '<svg id="proj"/>' });
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: "standard-brand" });
    expect(r.source).toBe("project");
    expect(r.svg).toMatch(/id="proj"/);
    expect(r.conforming).toBe(true);
  });

  it("step 2 — project PNG when no SVG", () => {
    const project = tmpProject({ png: Buffer.from([1, 2, 3]) });
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: "standard-brand" });
    expect(r.source).toBe("project");
    expect(r.contentType).toBe("image/png");
    expect(Buffer.isBuffer(r.binary)).toBe(true);
  });

  it("step 3 — brand SVG when project empty", () => {
    const project = tmpProject();
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: "standard-brand" });
    expect(r.source).toBe("brand");
    expect(r.svg).toMatch(/id="standard-brand"/);
    expect(r.conforming).toBe(true);
  });

  it("step 4 — brand PNG when no SVG", () => {
    const project = tmpProject();
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: "png-only-brand" });
    expect(r.source).toBe("brand");
    expect(r.contentType).toBe("image/png");
  });

  it("steps 5-6 — auto-discovery finds branded filename", () => {
    const project = tmpProject();
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: "legacy-brand" });
    expect(r.source).toBe("brand-discovered");
    expect(r.svg).toMatch(/id="legacy-mark"/);
    expect(r.conforming).toBe(false);
    expect(r.score).toBeGreaterThan(50);
  });

  it("step 3 — picks a themed variant (logo-light.svg / logo-dark.svg) as conforming", () => {
    const project = tmpProject();
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: "themed-brand" });
    expect(r.source).toBe("brand");
    expect(r.conforming).toBe(true);
    // SVG tier, alphabetical within `logo-*` → logo-dark.svg comes first.
    expect(r.path).toMatch(/assets\/logo-dark\.svg$/);
    expect(r.svg).toMatch(/id="themed-dark"/);
  });

  it("step 3 — picks a branded-name file (*logo*.svg) as conforming", () => {
    const project = tmpProject();
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: "branded-name-brand" });
    expect(r.source).toBe("brand");
    expect(r.conforming).toBe(true);
    expect(r.path).toMatch(/assets\/acme-logo\.svg$/);
    expect(r.svg).toMatch(/id="acme-mark"/);
  });

  it("step 7 — built-in when brand is empty", () => {
    const project = tmpProject();
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: "empty-brand" });
    expect(r.source).toBe("builtin");
    expect(r.svg).toBe(BUILTIN_DEFAULT_SVG);
  });

  it("step 7 — built-in when no active brand", () => {
    const project = tmpProject();
    const r = resolveLogo({ projectDir: project, skillsDir, activeBrand: null });
    expect(r.source).toBe("builtin");
  });
});

describe("bootstrapProjectLogo", () => {
  it("copies the resolved SVG into <project>/assets/logo.svg", () => {
    const project = tmpProject();
    const result = bootstrapProjectLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "standard-brand",
    });
    expect(result.copied).toBe(true);
    expect(result.filename).toBe("logo.svg");
    const dest = path.join(project, "assets", "logo.svg");
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, "utf-8")).toMatch(/id="standard-brand"/);
  });

  it("copies a PNG when that is what the brand ships", () => {
    const project = tmpProject();
    const result = bootstrapProjectLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "png-only-brand",
    });
    expect(result.copied).toBe(true);
    expect(result.filename).toBe("logo.png");
    expect(fs.existsSync(path.join(project, "assets", "logo.png"))).toBe(true);
  });

  it("copies auto-discovered candidate to the standard project path", () => {
    const project = tmpProject();
    const result = bootstrapProjectLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "legacy-brand",
    });
    expect(result.copied).toBe(true);
    expect(result.source).toBe("brand-discovered");
    expect(fs.readFileSync(path.join(project, "assets", "logo.svg"), "utf-8")).toMatch(
      /id="legacy-mark"/,
    );
  });

  it("does not copy the built-in default into the project", () => {
    const project = tmpProject();
    const result = bootstrapProjectLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "empty-brand",
    });
    expect(result.copied).toBe(false);
    expect(fs.existsSync(path.join(project, "assets", "logo.svg"))).toBe(false);
  });

  it("no-ops when the project already has a logo", () => {
    const project = tmpProject({ svg: '<svg id="existing"/>' });
    const result = bootstrapProjectLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "standard-brand",
    });
    expect(result.copied).toBe(false);
    expect(fs.readFileSync(path.join(project, "assets", "logo.svg"), "utf-8")).toMatch(
      /id="existing"/,
    );
  });
});

describe("discoverLogoCandidates", () => {
  it("ranks filename signals highest", () => {
    const brandDir = path.join(skillsDir, "legacy-brand");
    const cands = discoverLogoCandidates(brandDir, { brandName: "legacy-brand" });
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0].relpath).toMatch(/LEGACY_RGB\.svg$/);
    expect(cands[0].reasons.length).toBeGreaterThan(0);
  });

  it("returns empty array when nothing matches", () => {
    const brandDir = path.join(skillsDir, "empty-brand");
    const cands = discoverLogoCandidates(brandDir, { brandName: "empty-brand" });
    expect(cands).toEqual([]);
  });
});

describe("checkBrandConformance", () => {
  it("reports conforming=true for standard brand", () => {
    const report = checkBrandConformance({ skillsDir, brandName: "standard-brand" });
    expect(report.conforming).toBe(true);
    expect(report.standardPath).toBe("assets/logo.svg");
    expect(report.advice).toMatch(/conforms/);
  });

  it("reports conforming=false and top candidate for legacy brand", () => {
    const report = checkBrandConformance({ skillsDir, brandName: "legacy-brand" });
    expect(report.conforming).toBe(false);
    expect(report.discovered.length).toBeGreaterThan(0);
    expect(report.advice).toMatch(/LEGACY_RGB\.svg|candidate/);
  });

  it("reports conforming=true for a themed-variant-only brand", () => {
    const report = checkBrandConformance({ skillsDir, brandName: "themed-brand" });
    expect(report.conforming).toBe(true);
    expect(report.logoPath).toMatch(/assets\/logo-dark\.svg$/);
    expect(report.advice).toMatch(/pattern match|conforms/);
  });

  it("reports conforming=true for a branded-name brand (*logo*.svg)", () => {
    const report = checkBrandConformance({ skillsDir, brandName: "branded-name-brand" });
    expect(report.conforming).toBe(true);
    expect(report.logoPath).toMatch(/assets\/acme-logo\.svg$/);
  });

  it("advises asking the user when brand ships no logo", () => {
    const report = checkBrandConformance({ skillsDir, brandName: "empty-brand" });
    expect(report.conforming).toBe(false);
    expect(report.discovered).toEqual([]);
    expect(report.advice).toMatch(/Ask the user|ships no logo/);
  });

  it("reports found=false for unknown brand", () => {
    const report = checkBrandConformance({ skillsDir, brandName: "nonexistent-brand" });
    expect(report.found).toBe(false);
  });
});
