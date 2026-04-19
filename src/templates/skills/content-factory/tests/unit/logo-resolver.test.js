import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  resolveLogo,
  bootstrapProjectLogo,
  BUILTIN_DEFAULT_SVG,
} = require("#src/templates/skills/content-factory/scripts/lib/logo-resolver.cjs");

// The fixture brand skill is built in a tmpdir at test-time (see
// brand-discovery.test.js for rationale).
let skillsDir;

beforeAll(() => {
  skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-logo-resolver-"));
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

function tmpProject(withLogo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-proj-"));
  fs.mkdirSync(path.join(dir, "state"), { recursive: true });
  if (withLogo) {
    fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(dir, "assets", "logo.svg"), '<svg id="project"/>');
  }
  return dir;
}

describe("resolveLogo fallback chain", () => {
  it("project logo wins when present", () => {
    const project = tmpProject(true);
    const result = resolveLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "brand-fixture-brand",
    });
    expect(result.source).toBe("project");
    expect(result.svg).toMatch(/id="project"/);
  });

  it("falls back to active brand when project logo missing", () => {
    const project = tmpProject(false);
    const result = resolveLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "brand-fixture-brand",
    });
    expect(result.source).toBe("brand");
    expect(result.svg).toMatch(/<svg/);
  });

  it("falls back to builtin when no project and no brand", () => {
    const project = tmpProject(false);
    const result = resolveLogo({
      projectDir: project,
      skillsDir,
      activeBrand: null,
    });
    expect(result.source).toBe("builtin");
    expect(result.svg).toBe(BUILTIN_DEFAULT_SVG);
  });

  it("falls back to builtin when active brand has no logo file", () => {
    const project = tmpProject(false);
    const result = resolveLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "nonexistent-brand",
    });
    expect(result.source).toBe("builtin");
  });
});

describe("bootstrapProjectLogo", () => {
  it("copies brand logo to <project>/assets/logo.svg", () => {
    const project = tmpProject(false);
    const copied = bootstrapProjectLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "brand-fixture-brand",
    });
    expect(copied).toBe(true);
    const dest = path.join(project, "assets", "logo.svg");
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, "utf-8")).toMatch(/<svg/);
  });

  it("no-ops when project logo already exists", () => {
    const project = tmpProject(true);
    const before = fs.readFileSync(path.join(project, "assets", "logo.svg"), "utf-8");
    const copied = bootstrapProjectLogo({
      projectDir: project,
      skillsDir,
      activeBrand: "brand-fixture-brand",
    });
    expect(copied).toBe(false);
    const after = fs.readFileSync(path.join(project, "assets", "logo.svg"), "utf-8");
    expect(after).toBe(before);
  });

  it("returns false when no brand available", () => {
    const project = tmpProject(false);
    const copied = bootstrapProjectLogo({
      projectDir: project,
      skillsDir,
      activeBrand: null,
    });
    expect(copied).toBe(false);
  });
});
