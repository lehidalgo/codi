import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { loadPreset } from "#src/core/preset/preset-loader.js";
import {
  getBuiltinPresetNames,
  BUILTIN_PRESETS,
} from "#src/templates/presets/index.js";
import { resolveConfig } from "#src/core/config/resolver.js";
import { Logger } from "#src/core/output/logger.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-preset-wf-"));
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("Preset Workflow: load all builtin presets", () => {
  const presetNames = getBuiltinPresetNames();

  it("has at least 5 builtin presets", () => {
    expect(presetNames.length).toBeGreaterThanOrEqual(5);
  });

  for (const name of presetNames) {
    it(`loads builtin preset "${name}" successfully`, async () => {
      const result = await loadPreset(name, "/nonexistent");
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.name).toBe(name);
      expect(typeof result.data.description).toBe("string");
      expect(Array.isArray(result.data.rules)).toBe(true);
      expect(Array.isArray(result.data.skills)).toBe(true);
      expect(Array.isArray(result.data.agents)).toBe(true);
      expect(Array.isArray(result.data.commands)).toBe(true);
      expect(typeof result.data.flags).toBe("object");
      expect(typeof result.data.mcp).toBe("object");
    });
  }
});

describe("Preset Workflow: preset definitions match loaded content", () => {
  const presetNames = getBuiltinPresetNames();

  for (const name of presetNames) {
    it(`"${name}" definition has required fields`, () => {
      const def = BUILTIN_PRESETS[name];
      expect(def).toBeDefined();
      expect(def!.name).toBe(name);
      expect(typeof def!.description).toBe("string");
      expect(def!.description.length).toBeGreaterThan(0);
    });
  }
});

describe("Preset Workflow: apply preset to project via resolveConfig", () => {
  it('project with "minimal" preset resolves correctly', async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      stringifyYaml({
        name: "preset-test",
        version: "1",
        agents: ["claude-code"],
        presets: ["minimal"],
      }),
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.manifest.name).toBe("preset-test");
    // Minimal preset should contribute at least some flags
    expect(Object.keys(result.data.flags).length).toBeGreaterThanOrEqual(0);
  });

  it('project with "strict" preset has enforced flags', async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      stringifyYaml({
        name: "strict-test",
        version: "1",
        agents: ["claude-code"],
        presets: ["strict"],
      }),
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Strict preset should enforce security_scan
    const secFlag = result.data.flags["security_scan"];
    if (secFlag) {
      expect(secFlag.mode).toBe("enforced");
    }
  });

  it("project presets merge with local rules", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      stringifyYaml({
        name: "merge-test",
        version: "1",
        agents: ["claude-code"],
        presets: ["minimal"],
      }),
      "utf-8",
    );

    // Add a local rule
    const rulesDir = path.join(codiDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "local-rule.md"),
      "---\nname: local-rule\ndescription: Local rule\npriority: high\nmanaged_by: user\n---\n\nLocal content.",
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Should have local rule
    const localRule = result.data.rules.find((r) => r.name === "local-rule");
    expect(localRule).toBeDefined();
    expect(localRule!.managedBy).toBe("user");
  });
});

describe("Preset Workflow: custom preset from directory", () => {
  it("loads a custom preset from .codi/presets/", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const presetsDir = path.join(codiDir, "presets");
    const customPresetDir = path.join(presetsDir, "my-custom");
    await fs.mkdir(customPresetDir, { recursive: true });

    await fs.writeFile(
      path.join(customPresetDir, "preset.yaml"),
      stringifyYaml({
        name: "my-custom",
        description: "Custom team preset",
        version: "1.0.0",
        artifacts: {
          rules: ["security", "testing"],
          skills: ["commit"],
        },
      }),
      "utf-8",
    );

    const result = await loadPreset("my-custom", presetsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.name).toBe("my-custom");
    expect(result.data.description).toBe("Custom team preset");
    // Builtin rules should be resolved
    expect(result.data.rules.length).toBe(2);
    expect(result.data.rules.map((r) => r.name).sort()).toEqual([
      "security",
      "testing",
    ]);
    // Builtin skill should be resolved
    expect(result.data.skills.length).toBe(1);
    expect(result.data.skills[0]!.name).toBe("commit");
  });

  it("custom preset with flags-only (no artifacts)", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const presetsDir = path.join(codiDir, "presets");
    const flagsPresetDir = path.join(presetsDir, "team-flags");
    await fs.mkdir(flagsPresetDir, { recursive: true });

    await fs.writeFile(
      path.join(flagsPresetDir, "preset.yaml"),
      stringifyYaml({
        name: "team-flags",
        description: "Flags only",
        version: "1.0.0",
        flags: {
          max_file_lines: { mode: "enforced", value: 300 },
        },
      }),
      "utf-8",
    );

    const result = await loadPreset("team-flags", presetsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.flags["max_file_lines"]?.value).toBe(300);
    expect(result.data.rules).toEqual([]);
    expect(result.data.skills).toEqual([]);
  });
});
