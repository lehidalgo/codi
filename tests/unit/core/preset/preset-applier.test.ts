import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../../helpers/fs.js";
import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";
import { Logger } from "#src/core/output/logger.js";
import type { LoadedPreset } from "#src/core/preset/preset-loader.js";
import type { NormalizedRule, NormalizedAgent } from "#src/types/config.js";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: { step: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import * as p from "@clack/prompts";
import { applyPresetArtifacts } from "#src/core/preset/preset-applier.js";

function makeRule(name: string, content = "Rule content"): NormalizedRule {
  return {
    name,
    description: `${name} description`,
    content,
    priority: "medium",
    alwaysApply: true,
    managedBy: PROJECT_NAME,
  };
}

function makeAgent(name: string, content = "Agent content"): NormalizedAgent {
  return {
    name,
    description: `${name} description`,
    content,
    managedBy: PROJECT_NAME,
  };
}

function makePreset(overrides: Partial<LoadedPreset> = {}): LoadedPreset {
  return {
    name: "test-preset",
    description: "Test preset",
    flags: {},
    rules: [],
    skills: [],
    agents: [],
    commands: [],
    mcp: { servers: {} },
    ...overrides,
  };
}

describe("applyPresetArtifacts", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-applier-`),
    );
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("writes new rule files that do not exist locally", async () => {
    const preset = makePreset({
      rules: [makeRule("new-rule")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {
      force: true,
    });

    expect(result.added).toContain("rules/new-rule");
    const filePath = path.join(configDir, "rules", "new-rule.md");
    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("name: new-rule");
    expect(content).toContain("Rule content");
  });

  it("writes new agent files that do not exist locally", async () => {
    const preset = makePreset({
      agents: [makeAgent("my-agent")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {
      force: true,
    });

    expect(result.added).toContain("agents/my-agent");
    const filePath = path.join(configDir, "agents", "my-agent.md");
    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("name: my-agent");
  });

  it("skips files with identical content", async () => {
    // Pre-create a rule with the same content the preset will produce
    const rule = makeRule("existing-rule");
    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });

    // Write a file matching the reconstructed content
    const expectedContent = [
      "---",
      "name: existing-rule",
      "description: existing-rule description",
      "priority: medium",
      "alwaysApply: true",
      `managed_by: ${PROJECT_NAME}`,
      "---",
      "",
      "Rule content",
      "",
    ].join("\n");
    await fs.writeFile(
      path.join(rulesDir, "existing-rule.md"),
      expectedContent,
      "utf-8",
    );

    const preset = makePreset({ rules: [rule] });
    const result = await applyPresetArtifacts(configDir, preset, {
      force: true,
    });

    // Should not appear in added or overwritten
    expect(result.added).not.toContain("rules/existing-rule");
    expect(result.overwritten).not.toContain("rules/existing-rule");
  });

  it("with force option, overwrites conflicting files without prompting", async () => {
    // Pre-create a rule with different content
    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "conflict-rule.md"),
      "---\nname: conflict-rule\n---\n\nOld content\n",
      "utf-8",
    );

    const preset = makePreset({
      rules: [makeRule("conflict-rule", "New content from preset")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {
      force: true,
    });

    expect(result.overwritten).toContain("rules/conflict-rule");
    expect(p.select).not.toHaveBeenCalled();

    const content = await fs.readFile(
      path.join(rulesDir, "conflict-rule.md"),
      "utf-8",
    );
    expect(content).toContain("New content from preset");
  });

  it("with json option, skips conflicting files without prompting", async () => {
    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "conflict-rule.md"),
      "---\nname: conflict-rule\n---\n\nOld content\n",
      "utf-8",
    );

    const preset = makePreset({
      rules: [makeRule("conflict-rule", "New content")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {
      json: true,
    });

    expect(result.skipped).toContain("rules/conflict-rule");
    expect(result.conflicts).toContain("rules/conflict-rule");
    expect(p.select).not.toHaveBeenCalled();

    // Original content preserved
    const content = await fs.readFile(
      path.join(rulesDir, "conflict-rule.md"),
      "utf-8",
    );
    expect(content).toContain("Old content");
  });

  it("reports correct counts for mixed scenarios", async () => {
    // Create one existing rule with different content
    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "existing.md"),
      "---\nname: existing\n---\n\nOld\n",
      "utf-8",
    );

    const preset = makePreset({
      rules: [makeRule("new-rule"), makeRule("existing", "Different content")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {
      force: true,
    });

    expect(result.added).toHaveLength(1);
    expect(result.added).toContain("rules/new-rule");
    expect(result.overwritten).toHaveLength(1);
    expect(result.overwritten).toContain("rules/existing");
  });

  it("creates skill directories when applying skills", async () => {
    const preset = makePreset({
      skills: [
        {
          name: "my-skill",
          description: "A test skill",
          content: "Do something",
          managedBy: PROJECT_NAME,
        },
      ],
    });

    const result = await applyPresetArtifacts(configDir, preset, {
      force: true,
    });

    expect(result.added).toContain("skills/my-skill");
    const skillPath = path.join(configDir, "skills", "my-skill", "SKILL.md");
    const content = await fs.readFile(skillPath, "utf-8");
    expect(content).toContain("name: my-skill");
    expect(content).toContain("Do something");
  });

  it("handles empty preset with no artifacts", async () => {
    const preset = makePreset();
    const result = await applyPresetArtifacts(configDir, preset, {
      force: true,
    });

    expect(result.added).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.overwritten).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("interactive mode calls select for each conflict", async () => {
    vi.mocked(p.select).mockResolvedValue("accept" as never);

    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "rule-a.md"),
      "---\nname: rule-a\n---\n\nOld A\n",
      "utf-8",
    );

    const preset = makePreset({
      rules: [makeRule("rule-a", "New A from preset")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {});

    expect(p.note).toHaveBeenCalled();
    expect(p.select).toHaveBeenCalled();
    expect(result.overwritten).toContain("rules/rule-a");
  });

  it("interactive skip keeps current file", async () => {
    vi.mocked(p.select).mockResolvedValue("skip" as never);

    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "rule-b.md"),
      "---\nname: rule-b\n---\n\nKeep me\n",
      "utf-8",
    );

    const preset = makePreset({
      rules: [makeRule("rule-b", "Replace me")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {});

    expect(result.skipped).toContain("rules/rule-b");
    const content = await fs.readFile(
      path.join(rulesDir, "rule-b.md"),
      "utf-8",
    );
    expect(content).toContain("Keep me");
  });

  it("interactive accept_all overwrites all remaining conflicts", async () => {
    vi.mocked(p.select).mockResolvedValueOnce("accept_all" as never);

    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "rule-1.md"),
      "---\nname: rule-1\n---\n\nOld 1\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(rulesDir, "rule-2.md"),
      "---\nname: rule-2\n---\n\nOld 2\n",
      "utf-8",
    );

    const preset = makePreset({
      rules: [makeRule("rule-1", "New 1"), makeRule("rule-2", "New 2")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {});

    // First conflict prompts, second is auto-accepted
    expect(p.select).toHaveBeenCalledTimes(1);
    expect(result.overwritten).toContain("rules/rule-1");
    expect(result.overwritten).toContain("rules/rule-2");
  });

  it("interactive skip_all skips all remaining conflicts", async () => {
    vi.mocked(p.select).mockResolvedValueOnce("skip_all" as never);

    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "rule-x.md"),
      "---\nname: rule-x\n---\n\nOld X\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(rulesDir, "rule-y.md"),
      "---\nname: rule-y\n---\n\nOld Y\n",
      "utf-8",
    );

    const preset = makePreset({
      rules: [makeRule("rule-x", "New X"), makeRule("rule-y", "New Y")],
    });

    const result = await applyPresetArtifacts(configDir, preset, {});

    expect(p.select).toHaveBeenCalledTimes(1);
    expect(result.skipped).toContain("rules/rule-x");
    expect(result.skipped).toContain("rules/rule-y");
  });
});
