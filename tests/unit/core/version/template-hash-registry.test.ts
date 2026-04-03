import { describe, it, expect, beforeEach } from "vitest";
import {
  buildTemplateHashRegistry,
  getTemplateFingerprint,
  getAllFingerprints,
  getCLIVersion,
  _resetRegistryCache,
} from "#src/core/version/template-hash-registry.js";
import { AVAILABLE_TEMPLATES } from "#src/core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "#src/core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "#src/core/scaffolder/agent-template-loader.js";
import { AVAILABLE_MCP_SERVER_TEMPLATES } from "#src/core/scaffolder/mcp-template-loader.js";

describe("getCLIVersion", () => {
  it("returns a non-empty string", () => {
    const v = getCLIVersion();
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("returns a semver-like value", () => {
    const v = getCLIVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("buildTemplateHashRegistry", () => {
  beforeEach(() => {
    _resetRegistryCache();
  });

  it("returns a registry with cliVersion and generatedAt", () => {
    const registry = buildTemplateHashRegistry();
    expect(typeof registry.cliVersion).toBe("string");
    expect(typeof registry.generatedAt).toBe("string");
    expect(registry.templates).toBeTruthy();
  });

  it("covers all rule templates by name", () => {
    const registry = buildTemplateHashRegistry();
    for (const name of AVAILABLE_TEMPLATES) {
      // Name must exist; type may be overwritten by a later registration with the same name
      expect(registry.templates[name]).toBeDefined();
    }
  });

  it("covers all skill templates by name", () => {
    const registry = buildTemplateHashRegistry();
    for (const name of AVAILABLE_SKILL_TEMPLATES) {
      expect(registry.templates[name]).toBeDefined();
    }
  });

  it("covers all agent templates by name", () => {
    const registry = buildTemplateHashRegistry();
    for (const name of AVAILABLE_AGENT_TEMPLATES) {
      expect(registry.templates[name]).toBeDefined();
    }
  });

  it("covers all MCP server templates by name", () => {
    const registry = buildTemplateHashRegistry();
    for (const name of AVAILABLE_MCP_SERVER_TEMPLATES) {
      expect(registry.templates[name]).toBeDefined();
    }
  });

  it("produces stable hashes across multiple calls", () => {
    const r1 = buildTemplateHashRegistry();
    _resetRegistryCache();
    const r2 = buildTemplateHashRegistry();
    for (const [name, fp] of Object.entries(r1.templates)) {
      expect(r2.templates[name]?.contentHash).toBe(fp.contentHash);
    }
  });

  it("returns same instance from cache", () => {
    const r1 = buildTemplateHashRegistry();
    const r2 = buildTemplateHashRegistry();
    expect(r1).toBe(r2);
  });

  it("returns fresh instance after cache reset", () => {
    const r1 = buildTemplateHashRegistry();
    _resetRegistryCache();
    const r2 = buildTemplateHashRegistry();
    expect(r1).not.toBe(r2);
  });

  it("every fingerprint has a non-empty contentHash", () => {
    const registry = buildTemplateHashRegistry();
    for (const fp of Object.values(registry.templates)) {
      expect(fp.contentHash.length).toBeGreaterThan(0);
    }
  });
});

describe("getTemplateFingerprint", () => {
  beforeEach(() => {
    _resetRegistryCache();
  });

  it("returns fingerprint for a known rule template", () => {
    const name = AVAILABLE_TEMPLATES[0];
    if (!name) return;
    const fp = getTemplateFingerprint(name);
    expect(fp).toBeDefined();
    expect(fp?.name).toBe(name);
    expect(fp?.type).toBe("rule");
  });

  it("returns undefined for an unknown template", () => {
    const fp = getTemplateFingerprint("does-not-exist-template-xyz");
    expect(fp).toBeUndefined();
  });
});

describe("getAllFingerprints", () => {
  beforeEach(() => {
    _resetRegistryCache();
  });

  it("returns an array covering all unique template names", () => {
    const all = getAllFingerprints();
    // Registry uses name as key — duplicate names across arrays produce one entry
    const registry = buildTemplateHashRegistry();
    expect(all.length).toBe(Object.keys(registry.templates).length);
    expect(all.length).toBeGreaterThan(0);
  });

  it("each fingerprint has required fields", () => {
    const all = getAllFingerprints();
    for (const fp of all) {
      expect(fp.name).toBeTruthy();
      expect(fp.contentHash).toBeTruthy();
      expect(fp.artifactVersion).toBeGreaterThan(0);
      expect(["rule", "skill", "agent", "mcp-server"]).toContain(fp.type);
    }
  });
});
