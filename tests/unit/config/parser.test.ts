import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import {
  parseManifest,
  parseFlags,
  scanRules,
  scanSkills,
  scanProjectDir,
  parseSkillFile,
} from "#src/core/config/parser.js";
import { PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

const FIXTURES = path.resolve(__dirname, "../../fixtures/inheritance");
const BASIC = path.join(FIXTURES, "basic-merge/input/.codi");

describe("parseManifest", () => {
  it("parses a valid manifest file", async () => {
    const result = await parseManifest(BASIC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("test-project");
    expect(result.data.version).toBe("1");
    expect(result.data.agents).toEqual(["claude-code", "cursor"]);
  });

  it("returns error for missing manifest file", async () => {
    const result = await parseManifest("/nonexistent/path");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("E_CONFIG_NOT_FOUND");
  });
});

describe("parseFlags", () => {
  it("parses valid flags.yaml", async () => {
    const result = await parseFlags(BASIC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data["require_tests"]).toBeDefined();
    expect(result.data["require_tests"]!.mode).toBe("enabled");
    expect(result.data["require_tests"]!.value).toBe(false);
    expect(result.data["security_scan"]!.value).toBe(true);
  });

  it("returns empty record when flags.yaml is missing", async () => {
    const result = await parseFlags("/nonexistent/path");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({});
  });
});

describe("scanRules", () => {
  it("scans rules from rules directory", async () => {
    const rulesDir = path.join(BASIC, "rules");
    const result = await scanRules(rulesDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe("security");
    expect(result.data[0]!.priority).toBe("high");
    expect(result.data[0]!.managedBy).toBe(PROJECT_NAME);
    expect(result.data[0]!.content).toBe("Follow security best practices.");
  });

  it("returns empty array when rules dir is missing", async () => {
    const result = await scanRules("/nonexistent/rules");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });
});

describe("scanSkills", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-parser-skills-`));
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("returns empty array when skills dir is missing", async () => {
    const result = await scanSkills("/nonexistent/skills");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it("parses a valid skill file", async () => {
    const skillsDir = path.join(tmpDir, "skills");
    const skillDir = path.join(skillsDir, "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: my-skill
description: A test skill
managed_by: user
---

Skill content here.`,
      "utf-8",
    );

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBe(1);
    expect(result.data[0]!.name).toBe("my-skill");
    expect(result.data[0]!.description).toBe("A test skill");
    expect(result.data[0]!.content).toContain("Skill content here.");
  });

  it("scans multiple skills", async () => {
    const skillsDir = path.join(tmpDir, "skills");
    for (const name of ["alpha", "beta"]) {
      const dir = path.join(skillsDir, name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, "SKILL.md"),
        `---\nname: ${name}\ndescription: Skill ${name}\n---\nContent of ${name}`,
        "utf-8",
      );
    }

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBe(2);
    const names = result.data.map((s) => s.name).sort();
    expect(names).toEqual(["alpha", "beta"]);
  });

  it("returns error for skill with invalid frontmatter", async () => {
    const skillsDir = path.join(tmpDir, "skills");
    const skillDir = path.join(skillsDir, "bad-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
description: Missing name field
---

Content.`,
      "utf-8",
    );

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(false);
  });
});

describe("parseSkillFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-parse-skill-`));
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("parses skill with comma-separated paths", async () => {
    const filePath = path.join(tmpDir, "SKILL.md");
    await fs.writeFile(
      filePath,
      `---
name: path-skill
description: Skill with paths
paths: "src/**,tests/**"
---

Content.`,
      "utf-8",
    );

    const result = await parseSkillFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.paths).toEqual(["src/**", "tests/**"]);
  });

  it("parses skill with array paths", async () => {
    const filePath = path.join(tmpDir, "SKILL.md");
    await fs.writeFile(
      filePath,
      `---
name: array-path-skill
description: Skill with array paths
paths:
  - src/**
  - tests/**
---

Content.`,
      "utf-8",
    );

    const result = await parseSkillFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.paths).toEqual(["src/**", "tests/**"]);
  });

  it("parses skill with optional fields", async () => {
    const filePath = path.join(tmpDir, "SKILL.md");
    await fs.writeFile(
      filePath,
      `---
name: full-skill
description: Full featured skill
managed_by: ${PROJECT_NAME}
user-invocable: true
---

Full content.`,
      "utf-8",
    );

    const result = await parseSkillFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.managedBy).toBe(PROJECT_NAME);
    expect(result.data.userInvocable).toBe(true);
  });
});

describe("scanProjectDir", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-scan-dir-`));
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it(`returns error when ${PROJECT_DIR} directory does not exist`, async () => {
    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("E_CONFIG_NOT_FOUND");
  });

  it("returns error when manifest is missing", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });

    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("E_CONFIG_NOT_FOUND");
  });

  it(`parses minimal ${PROJECT_DIR} directory with just manifest`, async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: test\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.manifest.name).toBe("test");
    expect(result.data.rules).toEqual([]);
    expect(result.data.skills).toEqual([]);
    expect(result.data.agents).toEqual([]);
    expect(result.data.flags).toEqual({});
  });

  it(`parses ${PROJECT_DIR} directory with rules and skills`, async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: full\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    // Add a rule
    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "testing.md"),
      `---\nname: testing\ndescription: Testing\npriority: high\nmanaged_by: ${PROJECT_NAME}\n---\nTest rule.`,
      "utf-8",
    );

    // Add a skill
    const skillsDir = path.join(configDir, "skills", "commit");
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(
      path.join(skillsDir, "SKILL.md"),
      "---\nname: commit\ndescription: Commit skill\n---\nCommit content.",
      "utf-8",
    );

    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rules.length).toBe(1);
    expect(result.data.rules[0]!.name).toBe("testing");
    expect(result.data.skills.length).toBe(1);
    expect(result.data.skills[0]!.name).toBe("commit");
  });

  it("parses agents from agents directory", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: agent-test\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    const agentsDir = path.join(configDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, "reviewer.md"),
      `---\nname: reviewer\ndescription: Code reviewer\ntools:\n  - Read\n  - Grep\n---\nReview code carefully.`,
      "utf-8",
    );

    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.agents).toHaveLength(1);
    expect(result.data.agents[0]!.name).toBe("reviewer");
    expect(result.data.agents[0]!.tools).toEqual(["Read", "Grep"]);
    expect(result.data.agents[0]!.content).toContain("Review code carefully.");
  });

  it("parses legacy brands from brands directory", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: brand-test\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    const brandDir = path.join(configDir, "brands", "acme");
    await fs.mkdir(brandDir, { recursive: true });
    await fs.writeFile(
      path.join(brandDir, "BRAND.md"),
      `---\nname: acme\ndescription: Acme Corp brand\nmanaged_by: user\n---\nUse Acme blue (#0066cc).`,
      "utf-8",
    );

    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Legacy brands are merged into skills with category "brand"
    const brandSkill = result.data.skills.find((s) => s.name === "acme");
    expect(brandSkill).toBeDefined();
    expect(brandSkill!.category).toBe("brand");
    expect(brandSkill!.content).toContain("Acme blue");
    expect(brandSkill!.managedBy).toBe("user");
  });

  it("parses MCP config from legacy mcp.yaml file", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: mcp-yaml-test\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );
    await fs.writeFile(
      path.join(configDir, "mcp.yaml"),
      "servers:\n  my-server:\n    command: node\n    args:\n      - server.js\n",
      "utf-8",
    );

    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mcp.servers["my-server"]).toBeDefined();
  });

  it("returns error for invalid manifest YAML", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), "{ broken yaml [[[", "utf-8");

    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(false);
  });

  it("parses MCP servers from individual yaml files", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: mcp-test\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    const mcpDir = path.join(configDir, "mcp-servers");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "github.yaml"),
      'name: github\ncommand: npx\nargs:\n  - "@modelcontextprotocol/server-github"\n',
      "utf-8",
    );

    const result = await scanProjectDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mcp.servers).toBeDefined();
    expect(result.data.mcp.servers["github"]).toBeDefined();
  });
});
