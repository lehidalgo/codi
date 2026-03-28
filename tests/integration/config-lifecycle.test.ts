import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { resolveConfig } from "../../src/core/config/resolver.js";
import {
  scanCodiDir,
  parseManifest,
  parseFlags,
  scanRules,
  scanSkills,
} from "../../src/core/config/parser.js";
import { composeConfig } from "../../src/core/config/composer.js";
import type { ConfigLayer } from "../../src/core/config/composer.js";
import { validateConfig } from "../../src/core/config/validator.js";
import { Logger } from "../../src/core/output/logger.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-config-lifecycle-"));
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function createCodiProject(config: {
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
  commands?: Array<{ name: string; content: string }>;
}): Promise<string> {
  const codiDir = path.join(tmpDir, ".codi");
  await fs.mkdir(codiDir, { recursive: true });

  const manifest = config.manifest ?? {
    name: "test-project",
    version: "1",
    agents: ["claude-code"],
  };
  await fs.writeFile(
    path.join(codiDir, "codi.yaml"),
    stringifyYaml(manifest),
    "utf-8",
  );

  if (config.flags) {
    await fs.writeFile(
      path.join(codiDir, "flags.yaml"),
      stringifyYaml(config.flags),
      "utf-8",
    );
  }

  if (config.rules) {
    const rulesDir = path.join(codiDir, "rules");
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
      await fs.writeFile(
        path.join(rulesDir, `${rule.name}.md`),
        frontmatter,
        "utf-8",
      );
    }
  }

  if (config.skills) {
    for (const skill of config.skills) {
      const skillDir = path.join(codiDir, "skills", skill.name);
      await fs.mkdir(skillDir, { recursive: true });
      const frontmatter = `---\nname: ${skill.name}\ndescription: ${skill.name} skill\n---\n\n${skill.content}`;
      await fs.writeFile(path.join(skillDir, "SKILL.md"), frontmatter, "utf-8");
    }
  }

  if (config.agents) {
    const agentsDir = path.join(codiDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    for (const agent of config.agents) {
      const tools = agent.tools ?? ["Read", "Grep"];
      const frontmatter = `---\nname: ${agent.name}\ndescription: ${agent.name} agent\ntools:\n${tools.map((t) => `  - ${t}`).join("\n")}\nmanaged_by: user\n---\n\n${agent.content}`;
      await fs.writeFile(
        path.join(agentsDir, `${agent.name}.md`),
        frontmatter,
        "utf-8",
      );
    }
  }

  if (config.commands) {
    const commandsDir = path.join(codiDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    for (const cmd of config.commands) {
      const frontmatter = `---\nname: ${cmd.name}\ndescription: ${cmd.name} command\n---\n\n${cmd.content}`;
      await fs.writeFile(
        path.join(commandsDir, `${cmd.name}.md`),
        frontmatter,
        "utf-8",
      );
    }
  }

  return tmpDir;
}

describe("Config Lifecycle: parse → compose → validate → resolve", () => {
  it("resolves minimal project with only manifest", async () => {
    await createCodiProject({});
    const result = await resolveConfig(tmpDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.manifest.name).toBe("test-project");
    expect(result.data.rules).toEqual([]);
    expect(result.data.skills).toEqual([]);
    expect(result.data.agents).toEqual([]);
  });

  it("resolves project with rules, skills, and agents", async () => {
    await createCodiProject({
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
      commands: [{ name: "deploy", content: "Deploy instructions." }],
    });

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.rules).toHaveLength(2);
    expect(result.data.skills).toHaveLength(1);
    expect(result.data.agents).toHaveLength(1);
    expect(result.data.commands).toHaveLength(1);

    expect(result.data.rules.find((r) => r.name === "security")?.priority).toBe(
      "high",
    );
    expect(result.data.agents[0]!.tools).toContain("Read");
  });

  it("flags merge from flags.yaml into resolved config", async () => {
    await createCodiProject({
      flags: {
        security_scan: { mode: "enforced", value: true },
        max_file_lines: { mode: "enabled", value: 500 },
      },
    });

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.flags["security_scan"]?.value).toBe(true);
    expect(result.data.flags["max_file_lines"]?.value).toBe(500);
  });

  it("lang layer overrides repo flags", async () => {
    await createCodiProject({
      flags: {
        max_file_lines: { mode: "enabled", value: 700 },
      },
    });

    // Add lang layer
    const langDir = path.join(tmpDir, ".codi", "lang");
    await fs.mkdir(langDir, { recursive: true });
    await fs.writeFile(
      path.join(langDir, "typescript.yaml"),
      stringifyYaml({
        flags: {
          max_file_lines: { mode: "enabled", value: 400 },
        },
      }),
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Lang layer should override repo value
    expect(result.data.flags["max_file_lines"]?.value).toBe(400);
  });
});

describe("Config Lifecycle: individual parse steps", () => {
  it("parseManifest → scanRules → scanSkills all succeed independently", async () => {
    await createCodiProject({
      rules: [{ name: "test-rule", content: "Test content." }],
      skills: [{ name: "test-skill", content: "Skill content." }],
    });

    const codiDir = path.join(tmpDir, ".codi");

    const manifestResult = await parseManifest(codiDir);
    expect(manifestResult.ok).toBe(true);

    const rulesResult = await scanRules(path.join(codiDir, "rules"));
    expect(rulesResult.ok).toBe(true);
    if (rulesResult.ok) {
      expect(rulesResult.data).toHaveLength(1);
      expect(rulesResult.data[0]!.name).toBe("test-rule");
    }

    const skillsResult = await scanSkills(path.join(codiDir, "skills"));
    expect(skillsResult.ok).toBe(true);
    if (skillsResult.ok) {
      expect(skillsResult.data).toHaveLength(1);
      expect(skillsResult.data[0]!.name).toBe("test-skill");
    }
  });

  it("parseFlags returns empty when no flags.yaml", async () => {
    await createCodiProject({});
    const codiDir = path.join(tmpDir, ".codi");

    const result = await parseFlags(codiDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({});
    }
  });
});

describe("Config Lifecycle: compose and validate", () => {
  it("composeConfig merges multiple layers correctly", () => {
    const layers: ConfigLayer[] = [
      {
        level: "repo",
        source: "repo",
        config: {
          manifest: { name: "test", version: "1" },
          rules: [
            {
              name: "r1",
              description: "",
              content: "Rule one.",
              managedBy: "codi",
            },
          ],
          flags: {},
          mcp: { servers: {} },
        },
      },
      {
        level: "lang",
        source: "lang.yaml",
        config: {
          flags: {
            max_file_lines: {
              value: 500,
              mode: "enabled",
              source: "lang.yaml",
            },
          },
        },
      },
    ];

    const result = composeConfig(layers);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.manifest.name).toBe("test");
    expect(result.data.rules).toHaveLength(1);
    expect(result.data.flags["max_file_lines"]?.value).toBe(500);
  });

  it("validateConfig returns no errors for valid config", async () => {
    await createCodiProject({
      rules: [{ name: "sec", content: "Security." }],
    });

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const errors = validateConfig(result.data);
    expect(errors).toEqual([]);
  });

  it("validateConfig catches unknown agents in manifest", async () => {
    await createCodiProject({
      manifest: {
        name: "test",
        version: "1",
        agents: ["nonexistent-agent-xyz"],
      },
    });

    const scanResult = await scanCodiDir(tmpDir);
    expect(scanResult.ok).toBe(true);
    if (!scanResult.ok) return;

    const errors = validateConfig({
      ...scanResult.data,
      flags: {},
    });
    expect(errors.some((e) => e.code === "E_AGENT_NOT_FOUND")).toBe(true);
  });
});
