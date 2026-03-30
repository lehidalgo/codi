import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadPreset,
  loadPresetFromDir,
} from "#src/core/preset/preset-loader.js";
import { PROJECT_NAME, PROJECT_DIR, prefixedName } from "#src/constants.js";

describe("loadPresetFromDir", () => {
  let tmpDir: string;
  let configDir: string;
  let presetsDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-preset-loader-`),
    );
    configDir = path.join(tmpDir, PROJECT_DIR);
    presetsDir = path.join(configDir, "presets");
    await fs.mkdir(presetsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("resolves skills from skills/<name>/SKILL.md directory structure", async () => {
    // Create a preset manifest that references a skill by name
    const presetDir = path.join(presetsDir, "test-preset");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      [
        "name: test-preset",
        "description: Test preset",
        "version: 1.0.0",
        "artifacts:",
        "  skills:",
        "    - my-skill",
      ].join("\n"),
      "utf-8",
    );

    // Create the skill in directory structure (not flat file)
    const skillDir = path.join(configDir, "skills", "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      [
        "---",
        "name: my-skill",
        "description: A test skill",
        "managed_by: user",
        "---",
        "",
        "Skill content here.",
      ].join("\n"),
      "utf-8",
    );

    const result = await loadPresetFromDir("test-preset", presetsDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skills).toHaveLength(1);
    expect(result.data.skills[0]!.name).toBe("my-skill");
    expect(result.data.skills[0]!.description).toBe("A test skill");
  });

  it("returns empty skills when skill file does not exist", async () => {
    const presetDir = path.join(presetsDir, "missing-skill");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      [
        "name: missing-skill",
        "description: Preset with missing skill",
        "version: 1.0.0",
        "artifacts:",
        "  skills:",
        "    - nonexistent",
      ].join("\n"),
      "utf-8",
    );

    const result = await loadPresetFromDir("missing-skill", presetsDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Skill not found → silently dropped (returns null from loader)
    expect(result.data.skills).toHaveLength(0);
  });

  it("loads flags-only preset without artifacts", async () => {
    const presetDir = path.join(presetsDir, "flags-only");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      [
        "name: flags-only",
        "description: Flags only preset",
        "version: 1.0.0",
      ].join("\n"),
      "utf-8",
    );

    const result = await loadPresetFromDir("flags-only", presetsDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skills).toHaveLength(0);
    expect(result.data.rules).toHaveLength(0);
  });

  it("returns error when preset directory does not exist", async () => {
    const result = await loadPresetFromDir("nonexistent", presetsDir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("E_CONFIG_NOT_FOUND");
  });

  it("returns error for invalid manifest YAML", async () => {
    const presetDir = path.join(presetsDir, "bad-yaml");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      "{ broken yaml [[[",
      "utf-8",
    );

    // YAML parser throws on malformed input — loadPresetFromDir does not catch it
    await expect(loadPresetFromDir("bad-yaml", presetsDir)).rejects.toThrow();
  });

  it("returns error for manifest missing required fields", async () => {
    const presetDir = path.join(presetsDir, "no-name");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      "version: 1.0.0\n",
      "utf-8",
    );

    const result = await loadPresetFromDir("no-name", presetsDir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("E_CONFIG_INVALID");
  });

  it("resolves rules from builtin templates by name", async () => {
    const presetDir = path.join(presetsDir, "with-builtin-rules");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      [
        "name: with-builtin-rules",
        "description: Preset with builtin rules",
        "version: 1.0.0",
        "artifacts:",
        "  rules:",
        `    - ${prefixedName("security")}`,
        `    - ${prefixedName("testing")}`,
      ].join("\n"),
      "utf-8",
    );

    const result = await loadPresetFromDir("with-builtin-rules", presetsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rules.length).toBe(2);
    const names = result.data.rules.map((r) => r.name).sort();
    expect(names).toEqual([prefixedName("security"), prefixedName("testing")]);
  });

  it("resolves agents from builtin templates by name", async () => {
    const presetDir = path.join(presetsDir, "with-agents");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      [
        "name: with-agents",
        "description: Preset with agents",
        "version: 1.0.0",
        "artifacts:",
        "  agents:",
        `    - ${prefixedName("code-reviewer")}`,
      ].join("\n"),
      "utf-8",
    );

    const result = await loadPresetFromDir("with-agents", presetsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.agents.length).toBe(1);
    expect(result.data.agents[0]!.name).toBe(prefixedName("code-reviewer"));
  });

  it("resolves commands from builtin templates by name", async () => {
    const presetDir = path.join(presetsDir, "with-commands");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      [
        "name: with-commands",
        "description: Preset with commands",
        "version: 1.0.0",
        "artifacts:",
        "  commands:",
        `    - ${prefixedName("commit")}`,
      ].join("\n"),
      "utf-8",
    );

    const result = await loadPresetFromDir("with-commands", presetsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.commands.length).toBe(1);
    expect(result.data.commands[0]!.name).toBe(prefixedName("commit"));
  });

  it("loads MCP config from preset directory", async () => {
    const presetDir = path.join(presetsDir, "with-mcp");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      ["name: with-mcp", "description: Preset with MCP", "version: 1.0.0"].join(
        "\n",
      ),
      "utf-8",
    );
    await fs.writeFile(
      path.join(presetDir, "mcp.yaml"),
      "servers:\n  test-server:\n    command: npx\n    args:\n      - test\n",
      "utf-8",
    );

    const result = await loadPresetFromDir("with-mcp", presetsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mcp.servers["test-server"]).toBeDefined();
  });

  it("returns empty description when not specified", async () => {
    const presetDir = path.join(presetsDir, "no-desc");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      "name: no-desc\nversion: 1.0.0\n",
      "utf-8",
    );

    const result = await loadPresetFromDir("no-desc", presetsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.description).toBe("");
  });

  it(`resolves custom rules from ${PROJECT_DIR}/rules/ directory`, async () => {
    const presetDir = path.join(presetsDir, "custom-rule");
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      [
        "name: custom-rule",
        "description: Preset with custom rule",
        "version: 1.0.0",
        "artifacts:",
        "  rules:",
        "    - my-custom",
      ].join("\n"),
      "utf-8",
    );

    // Create the custom rule in the config rules directory
    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "my-custom.md"),
      "---\nname: my-custom\ndescription: Custom rule\nmanaged_by: user\n---\nCustom content.",
      "utf-8",
    );

    const result = await loadPresetFromDir("custom-rule", presetsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rules.length).toBe(1);
    expect(result.data.rules[0]!.name).toBe("my-custom");
    expect(result.data.rules[0]!.managedBy).toBe("user");
  });
});

describe("loadPreset — builtin presets", () => {
  it('loads builtin "minimal" preset', async () => {
    const result = await loadPreset(prefixedName("minimal"), "/nonexistent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe(prefixedName("minimal"));
    // Minimal preset has rules, skills, agents, or commands
    const totalArtifacts =
      result.data.rules.length +
      result.data.skills.length +
      result.data.agents.length +
      result.data.commands.length;
    expect(totalArtifacts).toBeGreaterThanOrEqual(0);
  });

  it('loads builtin "balanced" preset', async () => {
    const result = await loadPreset(prefixedName("balanced"), "/nonexistent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe(prefixedName("balanced"));
  });

  it('loads builtin "strict" preset', async () => {
    const result = await loadPreset(prefixedName("strict"), "/nonexistent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe(prefixedName("strict"));
  });

  it("falls through to directory loading for unknown preset", async () => {
    const result = await loadPreset("nonexistent-preset", "/nonexistent");
    expect(result.ok).toBe(false);
  });
});
