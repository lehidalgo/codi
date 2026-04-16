import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import * as cfgLib from "#src/templates/skills/content-factory/scripts/lib/validation-config.cjs";

function makeSession(workspaceDir, name, manifestExtra = {}) {
  const dir = path.join(workspaceDir, name);
  fs.mkdirSync(path.join(dir, "content"), { recursive: true });
  fs.mkdirSync(path.join(dir, "state"), { recursive: true });
  const manifest = {
    name,
    slug: name,
    projectDir: dir,
    created: Date.now(),
    preset: { id: "x", name: "X", type: "slides" },
    files: [],
    status: "draft",
    ...manifestExtra,
  };
  fs.writeFileSync(path.join(dir, "state", "manifest.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

describe("validation-config.deepMerge", () => {
  it("merges shallow objects with patch wins", () => {
    expect(cfgLib.deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({ a: 1, b: 3, c: 4 });
  });
  it("merges nested objects recursively", () => {
    const base = { layers: { badge: true, statusGate: true } };
    const patch = { layers: { badge: false } };
    expect(cfgLib.deepMerge(base, patch)).toEqual({
      layers: { badge: false, statusGate: true },
    });
  });
  it("replaces arrays entirely", () => {
    const out = cfgLib.deepMerge({ blockStatus: ["review", "done"] }, { blockStatus: ["done"] });
    expect(out.blockStatus).toEqual(["done"]);
  });
});

describe("validation-config.getDefaultsFor", () => {
  it("returns strict preset for slides", () => {
    const d = cfgLib.getDefaultsFor("slides");
    expect(d.preset).toBe("strict");
    expect(d.threshold).toBe(0.9);
    expect(d.blockStatus).toEqual(["review", "done"]);
  });
  it("returns strict preset for document", () => {
    expect(cfgLib.getDefaultsFor("document").preset).toBe("strict");
  });
  it("returns lenient preset for social", () => {
    const d = cfgLib.getDefaultsFor("social");
    expect(d.preset).toBe("lenient");
    expect(d.threshold).toBe(0.8);
    expect(d.blockStatus).toEqual(["done"]);
  });
  it("falls back to social for unknown type", () => {
    expect(cfgLib.getDefaultsFor("banana").preset).toBe("lenient");
  });
  it("every type has all 5 layers enabled by default", () => {
    for (const type of ["social", "slides", "document"]) {
      const d = cfgLib.getDefaultsFor(type);
      expect(d.enabled).toBe(true);
      expect(d.layers.endpoint).toBe(true);
      expect(d.layers.badge).toBe(true);
      expect(d.layers.agentDiscipline).toBe(true);
      expect(d.layers.exportPreflight).toBe(true);
      expect(d.layers.statusGate).toBe(true);
    }
  });
});

describe("validation-config resolve cascade", () => {
  let ws;
  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), "cf-valcfg-"));
  });
  afterEach(() => {
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {}
  });

  it("returns type defaults when nothing else is set", () => {
    const proj = makeSession(ws, "a");
    const { config, source } = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj });
    expect(config.preset).toBe("strict"); // slides
    expect(source.preset).toBe("type-default");
  });

  it("user defaults override type defaults", () => {
    const proj = makeSession(ws, "a");
    cfgLib.writeUserDefaults(ws, { threshold: 0.5 });
    const { config, source } = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj });
    expect(config.threshold).toBe(0.5);
    expect(source.threshold).toBe("user");
    // Other fields still come from type defaults
    expect(source.preset).toBe("type-default");
  });

  it("session config overrides user defaults", () => {
    const proj = makeSession(ws, "a");
    cfgLib.writeUserDefaults(ws, { threshold: 0.5 });
    cfgLib.writeSessionConfig(proj, { threshold: 0.7 });
    const { config, source } = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj });
    expect(config.threshold).toBe(0.7);
    expect(source.threshold).toBe("session");
  });

  it("returns null type and social defaults when manifest has no preset", () => {
    const proj = makeSession(ws, "noPreset", { preset: null });
    const r = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj, file: "slides.html" });
    expect(r.type).toBeNull();
    expect(r.config.preset).toBe("lenient");
    expect(r.config.threshold).toBe(0.8);
  });

  it("lazy-migrates type from HTML content when preset is null", () => {
    const proj = makeSession(ws, "migrateme", { preset: null });
    // Write content with slide cards
    fs.writeFileSync(
      path.join(proj, "content", "slides.html"),
      '<article class="slide"><h1>Hello</h1></article>',
    );
    const r = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj });
    expect(r.type).toBe("slides");
    expect(r.config.preset).toBe("strict");
    // Verify persisted to manifest
    const m = JSON.parse(fs.readFileSync(path.join(proj, "state", "manifest.json"), "utf-8"));
    expect(m.preset.type).toBe("slides");
  });

  it("reads type from manifest preset.type", () => {
    const proj = makeSession(ws, "hasPreset"); // default fixture: slides
    const r = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj, file: "social.html" });
    expect(r.type).toBe("slides");
    expect(r.config.preset).toBe("strict");
  });

  it("perFile override wins for a specific file", () => {
    const proj = makeSession(ws, "a");
    cfgLib.writeSessionConfig(proj, {
      threshold: 0.7,
      perFile: { "social.html": { threshold: 0.95 } },
    });
    const r1 = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj, file: "social.html" });
    expect(r1.config.threshold).toBe(0.95);
    expect(r1.source.threshold).toBe("perFile");
    const r2 = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj, file: "other.html" });
    expect(r2.config.threshold).toBe(0.7);
    expect(r2.source.threshold).toBe("session");
  });
});

describe("validation-config.setLayer", () => {
  let ws, proj;
  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), "cf-valcfg-"));
    proj = makeSession(ws, "a");
  });
  afterEach(() => {
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {}
  });

  it("flips a specific layer and persists to manifest", () => {
    const r1 = cfgLib.setLayer({
      workspaceDir: ws,
      projectDir: proj,
      layer: "badge",
      value: false,
    });
    expect(r1.config.layers.badge).toBe(false);
    // Other layers still true
    expect(r1.config.layers.statusGate).toBe(true);
    // Persisted — re-read the session to verify
    const reread = cfgLib.resolveConfig({ workspaceDir: ws, projectDir: proj });
    expect(reread.config.layers.badge).toBe(false);
  });

  it("layer='all' flips the master enabled flag", () => {
    const r = cfgLib.setLayer({ workspaceDir: ws, projectDir: proj, layer: "all", value: false });
    expect(r.config.enabled).toBe(false);
  });
});

describe("validation-config.addIgnoreRule", () => {
  let ws, proj;
  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), "cf-valcfg-"));
    proj = makeSession(ws, "a");
  });
  afterEach(() => {
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {}
  });

  it("appends an ignore entry and dedupes on re-add", () => {
    const r1 = cfgLib.addIgnoreRule({
      workspaceDir: ws,
      projectDir: proj,
      file: "social.html",
      rule: "R4",
      selector: "article > h1",
      cardIndex: 0,
    });
    const entry = r1.config.perFile["social.html"];
    expect(entry.ignoreViolations).toHaveLength(1);
    // Duplicate — should not grow the list
    const r2 = cfgLib.addIgnoreRule({
      workspaceDir: ws,
      projectDir: proj,
      file: "social.html",
      rule: "R4",
      selector: "article > h1",
      cardIndex: 0,
    });
    expect(r2.config.perFile["social.html"].ignoreViolations).toHaveLength(1);
  });
});
