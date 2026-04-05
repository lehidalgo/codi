import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import {
  addRuleHandler,
  addSkillHandler,
  addAgentHandler,
  addMcpServerHandler,
  addBrandHandler,
} from "#src/cli/add.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { prefixedName, PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";

describe("add rule command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-add-`));
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates a rule file without template", async () => {
    const result = await addRuleHandler(tmpDir, "my-rule", {});

    expect(result.success).toBe(true);
    expect(result.data.name).toBe("my-rule");
    expect(result.data.path).toContain("my-rule.md");
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("name: my-rule");
    expect(content).toContain("managed_by: user");
  });

  it("creates a rule file with security template", async () => {
    const result = await addRuleHandler(tmpDir, "my-security", {
      template: prefixedName("security"),
    });

    expect(result.success).toBe(true);
    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("name: my-security");
    expect(content).toContain("Security Rules");
    expect(content).toContain("priority: high");
  });

  it("creates a rule file with testing template", async () => {
    const result = await addRuleHandler(tmpDir, "test-rules", {
      template: prefixedName("testing"),
    });

    expect(result.success).toBe(true);
    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("Testing Standards");
  });

  it("fails with invalid rule name", async () => {
    const result = await addRuleHandler(tmpDir, "Invalid_Name", {});
    expect(result.success).toBe(false);
  });

  it("fails with unknown template", async () => {
    const result = await addRuleHandler(tmpDir, "my-rule", {
      template: "nonexistent",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown template");
  });

  it("fails if rule file already exists", async () => {
    await addRuleHandler(tmpDir, "existing-rule", {});
    const result = await addRuleHandler(tmpDir, "existing-rule", {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("already exists");
  });
});

describe("add skill command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-add-skill-`));
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates a skill directory with SKILL.md", async () => {
    const result = await addSkillHandler(tmpDir, "my-skill", {});

    expect(result.success).toBe(true);
    expect(result.data.name).toBe("my-skill");
    expect(result.data.path).toContain("SKILL.md");
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("name: my-skill");
    expect(content).toContain("managed_by: user");
  });

  it("scaffolds skill subdirectories", async () => {
    const result = await addSkillHandler(tmpDir, "test-skill", {});
    expect(result.success).toBe(true);

    const skillDir = path.join(tmpDir, PROJECT_DIR, "skills", "test-skill");
    const dirs = ["evals", "scripts", "references", "assets", "agents"];
    for (const dir of dirs) {
      const stat = await fs.stat(path.join(skillDir, dir));
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it("creates evals.json in evals directory", async () => {
    await addSkillHandler(tmpDir, "eval-skill", {});

    const evalsPath = path.join(tmpDir, PROJECT_DIR, "skills", "eval-skill", "evals", "evals.json");
    const content = JSON.parse(await fs.readFile(evalsPath, "utf-8"));
    expect(content.skillName).toBe("eval-skill");
    expect(content.cases).toEqual([]);
  });

  it("fails with invalid skill name", async () => {
    const result = await addSkillHandler(tmpDir, "Bad_Name", {});
    expect(result.success).toBe(false);
  });

  it("fails with unknown template", async () => {
    const result = await addSkillHandler(tmpDir, "my-skill", {
      template: "nonexistent",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown skill template");
  });

  it("fails if skill already exists", async () => {
    await addSkillHandler(tmpDir, "dup-skill", {});
    const result = await addSkillHandler(tmpDir, "dup-skill", {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("creates a skill with commit template", async () => {
    const result = await addSkillHandler(tmpDir, "my-commit-skill", {
      template: prefixedName("commit"),
    });

    expect(result.success).toBe(true);
    expect(result.data.template).toBe(prefixedName("commit"));
    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("name: my-commit-skill");
  });

  it("returns null template when no template specified", async () => {
    const result = await addSkillHandler(tmpDir, "no-tmpl-skill", {});
    expect(result.success).toBe(true);
    expect(result.data.template).toBeNull();
  });
});

describe("add agent command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-add-agent-`));
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates an agent file without template", async () => {
    const result = await addAgentHandler(tmpDir, "my-agent", {});

    expect(result.success).toBe(true);
    expect(result.data.name).toBe("my-agent");
    expect(result.data.path).toContain("my-agent.md");

    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("name: my-agent");
    expect(content).toContain("managed_by: user");
    expect(content).toContain("tools:");
  });

  it("fails with invalid agent name", async () => {
    const result = await addAgentHandler(tmpDir, "UPPER", {});
    expect(result.success).toBe(false);
  });

  it("fails with unknown template", async () => {
    const result = await addAgentHandler(tmpDir, "my-agent", {
      template: "fake",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown agent template");
  });

  it("fails if agent already exists", async () => {
    await addAgentHandler(tmpDir, "existing-agent", {});
    const result = await addAgentHandler(tmpDir, "existing-agent", {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("creates an agent file with code-reviewer template", async () => {
    const result = await addAgentHandler(tmpDir, "my-reviewer", {
      template: prefixedName("code-reviewer"),
    });

    expect(result.success).toBe(true);
    expect(result.data.template).toBe(prefixedName("code-reviewer"));
    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("name: my-reviewer");
  });

  it("returns null template when no template specified", async () => {
    const result = await addAgentHandler(tmpDir, "plain-agent", {});
    expect(result.success).toBe(true);
    expect(result.data.template).toBeNull();
  });
});

describe("add mcp-server command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-add-mcp-`));
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates an MCP server file without template", async () => {
    const result = await addMcpServerHandler(tmpDir, "my-server", {});

    expect(result.success).toBe(true);
    expect(result.data.name).toBe("my-server");
    expect(result.data.path).toContain("my-server.yaml");
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("name: my-server");
    expect(content).toContain("managed_by: user");
  });

  it("creates an MCP server file with template", async () => {
    const result = await addMcpServerHandler(tmpDir, "gh-server", {
      template: "github",
    });

    expect(result.success).toBe(true);
    expect(result.data.template).toBe("github");
    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain(`managed_by: ${PROJECT_NAME}`);
  });

  it("fails with invalid MCP server name", async () => {
    const result = await addMcpServerHandler(tmpDir, "INVALID", {});
    expect(result.success).toBe(false);
  });

  it("fails with unknown MCP server template", async () => {
    const result = await addMcpServerHandler(tmpDir, "my-server", {
      template: "nonexistent",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown MCP server template");
  });

  it("fails if MCP server already exists", async () => {
    await addMcpServerHandler(tmpDir, "dup-server", {});
    const result = await addMcpServerHandler(tmpDir, "dup-server", {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("returns null template when no template specified", async () => {
    const result = await addMcpServerHandler(tmpDir, "plain-server", {});
    expect(result.success).toBe(true);
    expect(result.data.template).toBeNull();
  });
});

describe("add brand command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-add-brand-`));
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates a brand as a skill with SKILL.md", async () => {
    const result = await addBrandHandler(tmpDir, "my-brand");

    expect(result.success).toBe(true);
    expect(result.data.name).toBe("my-brand");
    expect(result.data.path).toContain("SKILL.md");
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    const content = await fs.readFile(result.data.path, "utf-8");
    expect(content).toContain("name: my-brand");
    expect(content).toContain("category: Brand Identity");
  });

  it("scaffolds skill subdirectories for brand", async () => {
    const result = await addBrandHandler(tmpDir, "test-brand");
    expect(result.success).toBe(true);

    const skillDir = path.join(tmpDir, PROJECT_DIR, "skills", "test-brand");
    for (const sub of ["assets", "references", "scripts", "evals"]) {
      const stat = await fs.stat(path.join(skillDir, sub));
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it("fails with invalid brand name", async () => {
    const result = await addBrandHandler(tmpDir, "UPPER_CASE");
    expect(result.success).toBe(false);
  });

  it("fails if brand skill already exists", async () => {
    await addBrandHandler(tmpDir, "dup-brand");
    const result = await addBrandHandler(tmpDir, "dup-brand");
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("already exists");
  });
});

describe("add handler shared behaviors", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-add-shared-`));
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("all handlers reject names exceeding max length", async () => {
    const longName = "a".repeat(200);

    const ruleResult = await addRuleHandler(tmpDir, longName, {});
    expect(ruleResult.success).toBe(false);

    const skillResult = await addSkillHandler(tmpDir, longName, {});
    expect(skillResult.success).toBe(false);

    const agentResult = await addAgentHandler(tmpDir, longName, {});
    expect(agentResult.success).toBe(false);

    const mcpResult = await addMcpServerHandler(tmpDir, longName, {});
    expect(mcpResult.success).toBe(false);

    const brandResult = await addBrandHandler(tmpDir, longName);
    expect(brandResult.success).toBe(false);
  });

  it("all handlers reject names with special characters", async () => {
    const badName = "has@special!chars";

    const ruleResult = await addRuleHandler(tmpDir, badName, {});
    expect(ruleResult.success).toBe(false);

    const mcpResult = await addMcpServerHandler(tmpDir, badName, {});
    expect(mcpResult.success).toBe(false);

    const brandResult = await addBrandHandler(tmpDir, badName);
    expect(brandResult.success).toBe(false);
  });

  it("all handlers include correct exit codes on success", async () => {
    const ruleResult = await addRuleHandler(tmpDir, "rule-a", {});
    expect(ruleResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    const skillResult = await addSkillHandler(tmpDir, "skill-a", {});
    expect(skillResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    const agentResult = await addAgentHandler(tmpDir, "agent-a", {});
    expect(agentResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    const mcpResult = await addMcpServerHandler(tmpDir, "mcp-a", {});
    expect(mcpResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    const brandResult = await addBrandHandler(tmpDir, "brand-a");
    expect(brandResult.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("all handlers include correct exit codes on failure", async () => {
    const ruleResult = await addRuleHandler(tmpDir, "BAD", {});
    expect(ruleResult.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);

    const mcpResult = await addMcpServerHandler(tmpDir, "BAD", {});
    expect(mcpResult.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);

    const brandResult = await addBrandHandler(tmpDir, "BAD");
    expect(brandResult.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});
