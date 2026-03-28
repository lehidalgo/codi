import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parse as parseYaml } from "yaml";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  contributeHandler,
  discoverArtifacts,
  buildPresetPackage,
} from "../../../src/cli/contribute.js";
import type { ArtifactEntry } from "../../../src/cli/contribute.js";
import { extractPresetZip } from "../../../src/core/preset/preset-zip.js";
import { Logger } from "../../../src/core/output/logger.js";
import { EXIT_CODES } from "../../../src/core/output/exit-codes.js";
import {
  PRESET_MANIFEST_FILENAME,
  SKILL_OUTPUT_FILENAME,
} from "../../../src/constants.js";

const execFileAsync = promisify(execFile);

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-contrib-test-"));
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("contributeHandler", () => {
  it("returns error when no artifacts are found", async () => {
    const result = await contributeHandler(tmpDir);

    expect(result.success).toBe(false);
    expect(result.command).toBe("contribute");
    expect(result.data.action).toBe("cancelled");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain("No artifacts found");
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  it("returns error when .codi/ exists but has no artifact files", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(path.join(codiDir, "rules", "custom"), { recursive: true });
    await fs.mkdir(path.join(codiDir, "skills"), { recursive: true });
    await fs.mkdir(path.join(codiDir, "agents"), { recursive: true });
    await fs.mkdir(path.join(codiDir, "commands"), { recursive: true });

    const result = await contributeHandler(tmpDir);

    expect(result.success).toBe(false);
    expect(result.data.action).toBe("cancelled");
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});

describe("discoverArtifacts", () => {
  it("discovers flat .md rules in custom directory", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const rulesDir = path.join(codiDir, "rules", "custom");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "my-rule.md"),
      "---\nname: my-rule\ntype: rule\n---\nRule content",
      "utf8",
    );

    const artifacts = await discoverArtifacts(codiDir);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.name).toBe("my-rule");
    expect(artifacts[0]!.type).toBe("rule");
    expect(artifacts[0]!.path).toBe(path.join(rulesDir, "my-rule.md"));
  });

  it("discovers flat .md rules in generated/common directory", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const rulesDir = path.join(codiDir, "rules", "generated", "common");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "security.md"),
      "---\nname: security\ntype: rule\n---\nSecurity content",
      "utf8",
    );

    const artifacts = await discoverArtifacts(codiDir);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.name).toBe("security");
    expect(artifacts[0]!.type).toBe("rule");
  });

  it("discovers directory-based skills with SKILL.md", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const skillDir = path.join(codiDir, "skills", "code-review");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, SKILL_OUTPUT_FILENAME),
      "---\nname: code-review\ntype: skill\n---\nSkill content",
      "utf8",
    );
    // Add a supporting file
    await fs.writeFile(
      path.join(skillDir, "helper.sh"),
      "#!/bin/sh\necho hello",
      "utf8",
    );

    const artifacts = await discoverArtifacts(codiDir);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.name).toBe("code-review");
    expect(artifacts[0]!.type).toBe("skill");
    // Path should point to the directory, not the file
    expect(artifacts[0]!.path).toBe(skillDir);
  });

  it("discovers flat .md agents", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const agentsDir = path.join(codiDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, "reviewer.md"),
      "---\nname: reviewer\ntype: agent\n---\nAgent content",
      "utf8",
    );

    const artifacts = await discoverArtifacts(codiDir);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.name).toBe("reviewer");
    expect(artifacts[0]!.type).toBe("agent");
  });

  it("discovers flat .md commands", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const commandsDir = path.join(codiDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(
      path.join(commandsDir, "deploy.md"),
      "---\nname: deploy\ntype: command\n---\nDeploy content",
      "utf8",
    );

    const artifacts = await discoverArtifacts(codiDir);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.name).toBe("deploy");
    expect(artifacts[0]!.type).toBe("command");
  });

  it("discovers multiple artifact types in a polyglot project", async () => {
    const codiDir = path.join(tmpDir, ".codi");

    // Rule
    const rulesDir = path.join(codiDir, "rules", "custom");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "style.md"),
      "---\nname: style\ntype: rule\n---\nContent",
      "utf8",
    );

    // Skill (directory-based)
    const skillDir = path.join(codiDir, "skills", "lint");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, SKILL_OUTPUT_FILENAME),
      "---\nname: lint\ntype: skill\n---\nContent",
      "utf8",
    );

    // Agent
    const agentsDir = path.join(codiDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, "bot.md"),
      "---\nname: bot\ntype: agent\n---\nContent",
      "utf8",
    );

    const artifacts = await discoverArtifacts(codiDir);

    expect(artifacts).toHaveLength(3);
    const types = artifacts.map((a) => a.type).sort();
    expect(types).toEqual(["agent", "rule", "skill"]);
  });

  it("skips skills without SKILL.md", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const skillDir = path.join(codiDir, "skills", "broken-skill");
    await fs.mkdir(skillDir, { recursive: true });
    // No SKILL.md inside — should be skipped

    const artifacts = await discoverArtifacts(codiDir);

    expect(artifacts).toHaveLength(0);
  });

  it("returns empty array for nonexistent .codi directory", async () => {
    const artifacts = await discoverArtifacts(
      path.join(tmpDir, ".codi-nonexistent"),
    );
    expect(artifacts).toEqual([]);
  });

  it("uses directory name as fallback when skill has no name in frontmatter", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    const skillDir = path.join(codiDir, "skills", "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, SKILL_OUTPUT_FILENAME),
      "---\ntype: skill\n---\nNo name field",
      "utf8",
    );

    const artifacts = await discoverArtifacts(codiDir);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.name).toBe("my-skill");
  });
});

describe("buildPresetPackage", () => {
  it("creates preset.yaml with artifact names", async () => {
    const artifacts: ArtifactEntry[] = [
      {
        name: "my-rule",
        type: "rule",
        managedBy: "user",
        path: path.join(tmpDir, "my-rule.md"),
      },
    ];
    // Create the source file
    await fs.writeFile(
      artifacts[0]!.path,
      "---\nname: my-rule\n---\nContent",
      "utf8",
    );

    const stagingDir = path.join(tmpDir, "staging");
    await fs.mkdir(stagingDir, { recursive: true });

    await buildPresetPackage(artifacts, "test-preset", stagingDir);

    const manifestPath = path.join(
      stagingDir,
      "test-preset",
      PRESET_MANIFEST_FILENAME,
    );
    const raw = await fs.readFile(manifestPath, "utf8");
    const manifest = parseYaml(raw) as Record<string, unknown>;

    expect(manifest.name).toBe("test-preset");
    expect(manifest.version).toBe("1.0.0");
    const arts = manifest.artifacts as Record<string, string[]>;
    expect(arts.rules).toEqual(["my-rule"]);
  });

  it("copies flat artifact files to correct type directories", async () => {
    const rulePath = path.join(tmpDir, "my-rule.md");
    const agentPath = path.join(tmpDir, "my-agent.md");
    await fs.writeFile(rulePath, "---\nname: my-rule\n---\nRule", "utf8");
    await fs.writeFile(agentPath, "---\nname: my-agent\n---\nAgent", "utf8");

    const artifacts: ArtifactEntry[] = [
      { name: "my-rule", type: "rule", managedBy: "user", path: rulePath },
      { name: "my-agent", type: "agent", managedBy: "user", path: agentPath },
    ];

    const stagingDir = path.join(tmpDir, "staging");
    await fs.mkdir(stagingDir, { recursive: true });
    await buildPresetPackage(artifacts, "pkg", stagingDir);

    // Check rule file exists
    const ruleContent = await fs.readFile(
      path.join(stagingDir, "pkg", "rules", "my-rule.md"),
      "utf8",
    );
    expect(ruleContent).toContain("Rule");

    // Check agent file exists
    const agentContent = await fs.readFile(
      path.join(stagingDir, "pkg", "agents", "my-agent.md"),
      "utf8",
    );
    expect(agentContent).toContain("Agent");
  });

  it("copies skill directories recursively", async () => {
    const skillDir = path.join(tmpDir, "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, SKILL_OUTPUT_FILENAME),
      "---\nname: my-skill\n---\nSkill",
      "utf8",
    );
    await fs.writeFile(path.join(skillDir, "helper.sh"), "#!/bin/sh", "utf8");
    await fs.mkdir(path.join(skillDir, "scripts"), { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "scripts", "run.sh"),
      "echo run",
      "utf8",
    );

    const artifacts: ArtifactEntry[] = [
      { name: "my-skill", type: "skill", managedBy: "user", path: skillDir },
    ];

    const stagingDir = path.join(tmpDir, "staging");
    await fs.mkdir(stagingDir, { recursive: true });
    await buildPresetPackage(artifacts, "pkg", stagingDir);

    // Check skill directory was copied recursively
    const destSkillDir = path.join(stagingDir, "pkg", "skills", "my-skill");
    const skillMd = await fs.readFile(
      path.join(destSkillDir, SKILL_OUTPUT_FILENAME),
      "utf8",
    );
    expect(skillMd).toContain("Skill");

    const helper = await fs.readFile(
      path.join(destSkillDir, "helper.sh"),
      "utf8",
    );
    expect(helper).toBe("#!/bin/sh");

    const script = await fs.readFile(
      path.join(destSkillDir, "scripts", "run.sh"),
      "utf8",
    );
    expect(script).toBe("echo run");
  });

  it("produces valid manifest with partial selection", async () => {
    // Only rules selected — no skills, agents, commands
    const rulePath = path.join(tmpDir, "only-rule.md");
    await fs.writeFile(rulePath, "---\nname: only-rule\n---\nRule", "utf8");

    const artifacts: ArtifactEntry[] = [
      { name: "only-rule", type: "rule", managedBy: "user", path: rulePath },
    ];

    const stagingDir = path.join(tmpDir, "staging");
    await fs.mkdir(stagingDir, { recursive: true });
    await buildPresetPackage(artifacts, "partial", stagingDir);

    const raw = await fs.readFile(
      path.join(stagingDir, "partial", PRESET_MANIFEST_FILENAME),
      "utf8",
    );
    const manifest = parseYaml(raw) as Record<string, unknown>;
    const arts = manifest.artifacts as Record<string, string[]>;

    // Only rules should be present
    expect(arts.rules).toEqual(["only-rule"]);
    expect(arts.skills).toBeUndefined();
    expect(arts.agents).toBeUndefined();
    expect(arts.commands).toBeUndefined();
  });

  it("handles multiple artifacts of the same type", async () => {
    const rule1 = path.join(tmpDir, "rule-a.md");
    const rule2 = path.join(tmpDir, "rule-b.md");
    await fs.writeFile(rule1, "---\nname: rule-a\n---\nA", "utf8");
    await fs.writeFile(rule2, "---\nname: rule-b\n---\nB", "utf8");

    const artifacts: ArtifactEntry[] = [
      { name: "rule-a", type: "rule", managedBy: "user", path: rule1 },
      { name: "rule-b", type: "rule", managedBy: "user", path: rule2 },
    ];

    const stagingDir = path.join(tmpDir, "staging");
    await fs.mkdir(stagingDir, { recursive: true });
    await buildPresetPackage(artifacts, "multi", stagingDir);

    const raw = await fs.readFile(
      path.join(stagingDir, "multi", PRESET_MANIFEST_FILENAME),
      "utf8",
    );
    const manifest = parseYaml(raw) as Record<string, unknown>;
    const arts = manifest.artifacts as Record<string, string[]>;

    expect(arts.rules).toEqual(["rule-a", "rule-b"]);
  });
});

describe("ZIP round-trip", () => {
  it("exported preset ZIP can be re-imported via extractPresetZip", async () => {
    // 1. Create source artifacts
    const codiDir = path.join(tmpDir, ".codi");
    const rulesDir = path.join(codiDir, "rules", "custom");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "my-rule.md"),
      "---\nname: my-rule\ntype: rule\n---\nRule content here",
      "utf8",
    );

    const skillDir = path.join(codiDir, "skills", "my-skill");
    await fs.mkdir(path.join(skillDir, "scripts"), { recursive: true });
    await fs.writeFile(
      path.join(skillDir, SKILL_OUTPUT_FILENAME),
      "---\nname: my-skill\ntype: skill\ndescription: test\n---\nSkill content",
      "utf8",
    );
    await fs.writeFile(
      path.join(skillDir, "scripts", "run.sh"),
      "#!/bin/sh\necho hello",
      "utf8",
    );

    // 2. Discover artifacts
    const artifacts = await discoverArtifacts(codiDir);
    expect(artifacts).toHaveLength(2);

    // 3. Build preset package
    const stagingDir = path.join(tmpDir, "staging");
    await fs.mkdir(stagingDir, { recursive: true });
    await buildPresetPackage(artifacts, "roundtrip-test", stagingDir);

    // 4. Create ZIP
    const zipPath = path.join(tmpDir, "roundtrip-test.zip");
    await execFileAsync("zip", ["-r", zipPath, "roundtrip-test"], {
      cwd: stagingDir,
    });
    const stat = await fs.stat(zipPath);
    expect(stat.size).toBeGreaterThan(0);

    // 5. Import the ZIP via extractPresetZip
    const extractResult = await extractPresetZip(zipPath);
    expect(extractResult.ok).toBe(true);
    if (!extractResult.ok) return;

    expect(extractResult.data.presetName).toBe("roundtrip-test");

    // 6. Verify extracted files
    const extractedDir = extractResult.data.extractedDir;

    // Rule survived
    const ruleContent = await fs.readFile(
      path.join(extractedDir, "rules", "my-rule.md"),
      "utf8",
    );
    expect(ruleContent).toContain("Rule content here");

    // Skill directory survived with SKILL.md
    const skillContent = await fs.readFile(
      path.join(extractedDir, "skills", "my-skill", SKILL_OUTPUT_FILENAME),
      "utf8",
    );
    expect(skillContent).toContain("Skill content");

    // Supporting file survived the round-trip
    const scriptContent = await fs.readFile(
      path.join(extractedDir, "skills", "my-skill", "scripts", "run.sh"),
      "utf8",
    );
    expect(scriptContent).toContain("echo hello");

    // Cleanup extracted temp dir
    await fs.rm(path.dirname(extractedDir), {
      recursive: true,
      force: true,
    });
  });
});
