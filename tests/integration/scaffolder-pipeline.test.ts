import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { cleanupTmpDir } from "../helpers/fs.js";
import os from "node:os";
import { createRule } from "#src/core/scaffolder/rule-scaffolder.js";
import { createSkill } from "#src/core/scaffolder/skill-scaffolder.js";
import { createAgent } from "#src/core/scaffolder/agent-scaffolder.js";
import { createCommand } from "#src/core/scaffolder/command-scaffolder.js";
import { createMcpServer } from "#src/core/scaffolder/mcp-scaffolder.js";
import { scanRules, scanSkills } from "#src/core/config/parser.js";
import { Logger } from "#src/core/output/logger.js";
import { parseFrontmatter } from "#src/utils/frontmatter.js";
import { PROJECT_NAME, PROJECT_DIR, prefixedName } from "#src/constants.js";

let tmpDir: string;
let configDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `${PROJECT_NAME}-scaff-pipe-`),
  );
  configDir = path.join(tmpDir, PROJECT_DIR);
  await fs.mkdir(configDir, { recursive: true });
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

describe("Scaffolder Pipeline: create → verify → parse", () => {
  it("scaffolded rule is parseable by scanRules", async () => {
    const result = await createRule({ name: "test-rule", configDir });
    expect(result.ok).toBe(true);

    const rulesDir = path.join(configDir, "rules");
    const scanResult = await scanRules(rulesDir);
    expect(scanResult.ok).toBe(true);
    if (!scanResult.ok) return;

    expect(scanResult.data).toHaveLength(1);
    expect(scanResult.data[0]!.name).toBe("test-rule");
    expect(scanResult.data[0]!.managedBy).toBe("user");
  });

  it("scaffolded template rule is parseable by scanRules", async () => {
    const result = await createRule({
      name: "my-sec",
      configDir,
      template: prefixedName("security"),
    });
    expect(result.ok).toBe(true);

    const rulesDir = path.join(configDir, "rules");
    const scanResult = await scanRules(rulesDir);
    expect(scanResult.ok).toBe(true);
    if (!scanResult.ok) return;

    expect(scanResult.data).toHaveLength(1);
    expect(scanResult.data[0]!.name).toBe("my-sec");
    expect(scanResult.data[0]!.content).toContain("Security");
  });

  it("scaffolded skill is parseable by scanSkills", async () => {
    const result = await createSkill({ name: "test-skill", configDir });
    expect(result.ok).toBe(true);

    const skillsDir = path.join(configDir, "skills");
    const scanResult = await scanSkills(skillsDir);
    expect(scanResult.ok).toBe(true);
    if (!scanResult.ok) return;

    expect(scanResult.data).toHaveLength(1);
    expect(scanResult.data[0]!.name).toBe("test-skill");
  });

  it("scaffolded skill creates all subdirectories", async () => {
    const result = await createSkill({ name: "full-skill", configDir });
    expect(result.ok).toBe(true);

    const skillDir = path.join(configDir, "skills", "full-skill");
    for (const sub of ["evals", "scripts", "references", "assets", "agents"]) {
      const stat = await fs.stat(path.join(skillDir, sub));
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it("scaffolded agent has valid frontmatter", async () => {
    const result = await createAgent({ name: "test-agent", configDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    const { data } = parseFrontmatter<Record<string, unknown>>(content);
    expect(data["name"]).toBe("test-agent");
    expect(data["managed_by"]).toBe("user");
    expect(Array.isArray(data["tools"])).toBe(true);
  });

  it("scaffolded command has valid frontmatter", async () => {
    const result = await createCommand({ name: "test-cmd", configDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    const { data } = parseFrontmatter<Record<string, unknown>>(content);
    expect(data["name"]).toBe("test-cmd");
    expect(data["managed_by"]).toBe("user");
  });

  it("scaffolded MCP server produces valid YAML", async () => {
    const result = await createMcpServer({ name: "test-mcp", configDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: test-mcp");
    expect(content).toContain("managed_by: user");
  });

  it("scaffolded MCP server with template has template content", async () => {
    const result = await createMcpServer({
      name: "gh-mcp",
      configDir,
      template: "github",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain(`managed_by: ${PROJECT_NAME}`);
  });

  it("scaffolded brand skill creates directory structure", async () => {
    const result = await createSkill({
      name: "test-brand",
      configDir,
      template: prefixedName("brand-identity"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: test-brand");
    expect(content).toContain("category: brand");
    expect(content).toContain("Brand Identity");

    const skillDir = path.join(configDir, "skills", "test-brand");
    for (const sub of ["assets", "references", "scripts", "evals"]) {
      const stat = await fs.stat(path.join(skillDir, sub));
      expect(stat.isDirectory()).toBe(true);
    }
  });
});

describe("Scaffolder Pipeline: multiple artifacts", () => {
  it("creates multiple rules and all are parseable", async () => {
    for (const name of ["rule-a", "rule-b", "rule-c"]) {
      const result = await createRule({ name, configDir });
      expect(result.ok).toBe(true);
    }

    const scanResult = await scanRules(path.join(configDir, "rules"));
    expect(scanResult.ok).toBe(true);
    if (!scanResult.ok) return;
    expect(scanResult.data).toHaveLength(3);
    const names = scanResult.data.map((r) => r.name).sort();
    expect(names).toEqual(["rule-a", "rule-b", "rule-c"]);
  });

  it("creates multiple skills and all are parseable", async () => {
    for (const name of ["skill-x", "skill-y"]) {
      const result = await createSkill({ name, configDir });
      expect(result.ok).toBe(true);
    }

    const scanResult = await scanSkills(path.join(configDir, "skills"));
    expect(scanResult.ok).toBe(true);
    if (!scanResult.ok) return;
    expect(scanResult.data).toHaveLength(2);
  });
});

describe("Scaffolder Pipeline: error paths", () => {
  it("rejects duplicate rule", async () => {
    await createRule({ name: "dup", configDir });
    const result = await createRule({ name: "dup", configDir });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate skill", async () => {
    await createSkill({ name: "dup", configDir });
    const result = await createSkill({ name: "dup", configDir });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate agent", async () => {
    await createAgent({ name: "dup", configDir });
    const result = await createAgent({ name: "dup", configDir });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate command", async () => {
    await createCommand({ name: "dup", configDir });
    const result = await createCommand({ name: "dup", configDir });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate MCP server", async () => {
    await createMcpServer({ name: "dup", configDir });
    const result = await createMcpServer({ name: "dup", configDir });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate brand skill", async () => {
    await createSkill({
      name: "dup",
      configDir,
      template: prefixedName("brand-identity"),
    });
    const result = await createSkill({
      name: "dup",
      configDir,
      template: prefixedName("brand-identity"),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid names for all artifact types", async () => {
    const invalidName = "INVALID_NAME!";

    expect((await createRule({ name: invalidName, configDir })).ok).toBe(false);
    expect((await createSkill({ name: invalidName, configDir })).ok).toBe(
      false,
    );
    expect((await createAgent({ name: invalidName, configDir })).ok).toBe(
      false,
    );
    expect((await createCommand({ name: invalidName, configDir })).ok).toBe(
      false,
    );
    expect((await createMcpServer({ name: invalidName, configDir })).ok).toBe(
      false,
    );
  });
});
