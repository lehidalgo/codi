import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { cleanupTmpDir } from "../helpers/fs.js";
import os from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { resolveConfig } from "#src/core/config/resolver.js";
import {
  scanProjectDir,
  parseManifest,
  parseFlags,
  scanRules,
  scanSkills,
} from "#src/core/config/parser.js";
import { flagsFromDefinitions } from "#src/core/config/composer.js";
import { validateConfig } from "#src/core/config/validator.js";
import { Logger } from "#src/core/output/logger.js";
import { PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-config-lifecycle-`));
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

async function createTestProject(config: {
  manifest?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  rules?: Array<{
    name: string;
    content: string;
    priority?: string;
    managedBy?: string;
  }>;
  skills?: Array<{ name: string; content: string }>;
  agents?: Array<{ name: string; content: string; tools?: string[] }>;
}): Promise<string> {
  const configDir = path.join(tmpDir, PROJECT_DIR);
  await fs.mkdir(configDir, { recursive: true });

  const manifest = config.manifest ?? {
    name: "test-project",
    version: "1",
    agents: ["claude-code"],
  };
  await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), stringifyYaml(manifest), "utf-8");

  if (config.flags) {
    await fs.writeFile(path.join(configDir, "flags.yaml"), stringifyYaml(config.flags), "utf-8");
  }

  if (config.rules) {
    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    for (const rule of config.rules) {
      const frontmatter = [
        "---",
        `name: ${rule.name}`,
        `description: ${rule.name} rule`,
        `priority: ${rule.priority ?? "medium"}`,
        `managed_by: ${rule.managedBy ?? "user"}`,
        "---",
        "",
        rule.content,
      ].join("\n");
      await fs.writeFile(path.join(rulesDir, `${rule.name}.md`), frontmatter, "utf-8");
    }
  }

  if (config.skills) {
    for (const skill of config.skills) {
      const skillDir = path.join(configDir, "skills", skill.name);
      await fs.mkdir(skillDir, { recursive: true });
      const frontmatter = `---\nname: ${skill.name}\ndescription: ${skill.name} skill\n---\n\n${skill.content}`;
      await fs.writeFile(path.join(skillDir, "SKILL.md"), frontmatter, "utf-8");
    }
  }

  if (config.agents) {
    const agentsDir = path.join(configDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    for (const agent of config.agents) {
      const tools = agent.tools ?? ["Read", "Grep"];
      const frontmatter = `---\nname: ${agent.name}\ndescription: ${agent.name} agent\ntools:\n${tools.map((t) => `  - ${t}`).join("\n")}\nmanaged_by: user\n---\n\n${agent.content}`;
      await fs.writeFile(path.join(agentsDir, `${agent.name}.md`), frontmatter, "utf-8");
    }
  }

  return tmpDir;
}

describe("Config Lifecycle: parse → compose → validate → resolve", () => {
  it("resolves minimal project with only manifest", async () => {
    await createTestProject({});
    const result = await resolveConfig(tmpDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.manifest.name).toBe("test-project");
    expect(result.data.rules).toEqual([]);
    expect(result.data.skills).toEqual([]);
    expect(result.data.agents).toEqual([]);
  });

  it("resolves project with rules, skills, and agents", async () => {
    await createTestProject({
      rules: [
        {
          name: "security",
          content: "Follow security practices.",
          priority: "high",
        },
        { name: "testing", content: "Write tests.", priority: "medium" },
      ],
      skills: [{ name: "commit", content: "Commit workflow steps." }],
      agents: [
        {
          name: "reviewer",
          content: "Review code.",
          tools: ["Read", "Grep", "Glob"],
        },
      ],
    });

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.rules).toHaveLength(2);
    expect(result.data.skills).toHaveLength(1);
    expect(result.data.agents).toHaveLength(1);

    expect(result.data.rules.find((r) => r.name === "security")?.priority).toBe("high");
    expect(result.data.agents[0]!.tools).toContain("Read");
  });

  it("flags merge from flags.yaml into resolved config", async () => {
    await createTestProject({
      flags: {
        security_scan: { mode: "enforced", value: true },
        require_tests: { mode: "enabled", value: true },
      },
    });

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.flags["security_scan"]?.value).toBe(true);
    expect(result.data.flags["require_tests"]?.value).toBe(true);
  });

  it("reads flags only from flags.yaml (no layer overrides)", async () => {
    await createTestProject({
      flags: {
        type_checking: { mode: "enabled", value: "basic" },
      },
    });

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.flags["type_checking"]?.value).toBe("basic");
  });
});

describe("Config Lifecycle: individual parse steps", () => {
  it("parseManifest → scanRules → scanSkills all succeed independently", async () => {
    await createTestProject({
      rules: [{ name: "test-rule", content: "Test content." }],
      skills: [{ name: "test-skill", content: "Skill content." }],
    });

    const configDir = path.join(tmpDir, PROJECT_DIR);

    const manifestResult = await parseManifest(configDir);
    expect(manifestResult.ok).toBe(true);

    const rulesResult = await scanRules(path.join(configDir, "rules"));
    expect(rulesResult.ok).toBe(true);
    if (rulesResult.ok) {
      expect(rulesResult.data).toHaveLength(1);
      expect(rulesResult.data[0]!.name).toBe("test-rule");
    }

    const skillsResult = await scanSkills(path.join(configDir, "skills"));
    expect(skillsResult.ok).toBe(true);
    if (skillsResult.ok) {
      expect(skillsResult.data).toHaveLength(1);
      expect(skillsResult.data[0]!.name).toBe("test-skill");
    }
  });

  it("parseFlags returns empty when no flags.yaml", async () => {
    await createTestProject({});
    const configDir = path.join(tmpDir, PROJECT_DIR);

    const result = await parseFlags(configDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({});
    }
  });
});

describe("Config Lifecycle: resolve and validate", () => {
  it("flagsFromDefinitions converts raw flags to resolved flags", () => {
    const defs = {
      type_checking: {
        mode: "enabled" as const,
        value: "strict",
        locked: true,
      },
    };
    const resolved = flagsFromDefinitions(defs, "flags.yaml");
    expect(resolved["type_checking"]!.value).toBe("strict");
    expect(resolved["type_checking"]!.source).toBe("flags.yaml");
    expect(resolved["type_checking"]!.locked).toBe(true);
  });

  it("validateConfig returns no errors for valid config", async () => {
    await createTestProject({
      rules: [{ name: "sec", content: "Security." }],
    });

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const errors = validateConfig(result.data);
    expect(errors).toEqual([]);
  });

  it("validateConfig catches unknown agents in manifest", async () => {
    await createTestProject({
      manifest: {
        name: "test",
        version: "1",
        agents: ["nonexistent-agent-xyz"],
      },
    });

    const scanResult = await scanProjectDir(tmpDir);
    expect(scanResult.ok).toBe(true);
    if (!scanResult.ok) return;

    const errors = validateConfig({
      ...scanResult.data,
      flags: {},
    });
    expect(errors.some((e) => e.code === "E_AGENT_NOT_FOUND")).toBe(true);
  });
});
