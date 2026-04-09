import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateCatalogMarkdownFiles,
  exportCatalogMetaJson,
} from "#src/core/docs/artifact-catalog-generator.js";

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "catalog-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("generateCatalogMarkdownFiles", () => {
  it("writes markdown files for all artifact types", async () => {
    await generateCatalogMarkdownFiles(tmpDir);

    const skillFiles = await readdir(join(tmpDir, "docs/src/content/docs/catalog/skills"));
    const ruleFiles = await readdir(join(tmpDir, "docs/src/content/docs/catalog/rules"));
    const agentFiles = await readdir(join(tmpDir, "docs/src/content/docs/catalog/agents"));
    const presetFiles = await readdir(join(tmpDir, "docs/src/content/docs/catalog/presets"));

    expect(skillFiles.length).toBeGreaterThanOrEqual(40);
    expect(ruleFiles.length).toBeGreaterThanOrEqual(10);
    expect(agentFiles.length).toBeGreaterThanOrEqual(10);
    expect(presetFiles.length).toBeGreaterThanOrEqual(4);
  });

  it("skill markdown contains frontmatter with artifactType", async () => {
    const skillsDir = join(tmpDir, "docs/src/content/docs/catalog/skills");
    const files = await readdir(skillsDir);
    const content = await readFile(join(skillsDir, files[0]!), "utf-8");
    expect(content).toMatch(/^---/);
    expect(content).toMatch(/artifactType: skill/);
    expect(content).toMatch(/description:/);
  });

  it("rule markdown contains correct frontmatter", async () => {
    const rulesDir = join(tmpDir, "docs/src/content/docs/catalog/rules");
    const files = await readdir(rulesDir);
    const content = await readFile(join(rulesDir, files[0]!), "utf-8");
    expect(content).toMatch(/artifactType: rule/);
    expect(content).toMatch(/alwaysApply:/);
  });
});

describe("exportCatalogMetaJson", () => {
  it("returns valid JSON with all artifact types and counts", () => {
    const json = exportCatalogMetaJson();
    const data = JSON.parse(json) as {
      counts: Record<string, number>;
      artifacts: Array<{ type: string; name: string }>;
    };
    expect(data.counts.skills).toBeGreaterThanOrEqual(40);
    expect(data.counts.rules).toBeGreaterThanOrEqual(10);
    expect(data.counts.agents).toBeGreaterThanOrEqual(10);
    expect(data.counts.presets).toBeGreaterThanOrEqual(4);
    expect(data.artifacts.every((a) => a.type && a.name)).toBe(true);
  });

  it("skill artifacts include category and userInvocable", () => {
    const json = exportCatalogMetaJson();
    const data = JSON.parse(json) as {
      artifacts: Array<{ type: string; category?: string; userInvocable?: boolean }>;
    };
    const skills = data.artifacts.filter((a) => a.type === "skill");
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((s) => s.category !== undefined)).toBe(true);
  });
});
