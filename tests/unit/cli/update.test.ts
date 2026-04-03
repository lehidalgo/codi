import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { updateHandler } from "#src/cli/update.js";
import { Logger } from "#src/core/output/logger.js";
import { prefixedName, PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

describe("update command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-update-`));
    Logger.init({ level: "error", mode: "human", noColor: true });

    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      stringifyYaml({ name: "test", version: "1", agents: ["claude-code"] }),
      "utf-8",
    );
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("adds missing flags from catalog", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.flagsAdded.length).toBeGreaterThan(0);
    expect(result.data.flagsAdded).toContain("security_scan");

    const updated = parseYaml(
      await fs.readFile(path.join(configDir, "flags.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(updated["security_scan"]).toBeDefined();
    expect(updated["auto_commit"]).toBeDefined();
  });

  it("resets flags to preset", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: true } }),
      "utf-8",
    );

    const result = await updateHandler(tmpDir, {
      json: true,
      preset: prefixedName("strict"),
    });
    expect(result.success).toBe(true);
    expect(result.data.flagsReset).toBe(true);
    expect(result.data.preset).toBe(prefixedName("strict"));

    const updated = parseYaml(
      await fs.readFile(path.join(configDir, "flags.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    const secScan = updated["security_scan"] as Record<string, unknown>;
    expect(secScan["mode"]).toBe("enforced");
    expect(secScan["locked"]).toBe(true);
  });

  it("dry-run does not write", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    const original = stringifyYaml({
      auto_commit: { mode: "enabled", value: false },
    });
    await fs.writeFile(path.join(configDir, "flags.yaml"), original, "utf-8");

    const result = await updateHandler(tmpDir, {
      json: true,
      preset: prefixedName("strict"),
      dryRun: true,
    });
    expect(result.success).toBe(true);

    const afterContent = await fs.readFile(path.join(configDir, "flags.yaml"), "utf-8");
    expect(afterContent).toBe(original);
  });

  it(`fails if no ${PROJECT_DIR}/ exists`, async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-empty-`));
    const result = await updateHandler(emptyDir, { json: true });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.code).toBe("E_CONFIG_NOT_FOUND");
    await cleanupTmpDir(emptyDir);
  });

  it("rejects invalid preset name", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const result = await updateHandler(tmpDir, {
      json: true,
      preset: "invalid",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.code).toBe("E_CONFIG_INVALID");
  });

  it("refreshes managed rules with --rules", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    // Create a managed rule with a matching template name
    const ruleName = prefixedName("security");
    await fs.writeFile(
      path.join(configDir, "rules", `${ruleName}.md`),
      `---\nname: ${ruleName}\nmanaged_by: ${PROJECT_NAME}\n---\nold content`,
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true, rules: true });
    expect(result.success).toBe(true);
    expect(result.data.rulesUpdated).toContain(ruleName);
  });

  it("skips user-owned rules with --rules", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    await fs.writeFile(
      path.join(configDir, "rules", "my-custom.md"),
      "---\nname: my-custom\nmanaged_by: user\n---\nmy content",
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true, rules: true });
    expect(result.success).toBe(true);
    expect(result.data.rulesSkipped).toContain("my-custom");
    expect(result.data.rulesUpdated).not.toContain("my-custom");
  });

  it("handles missing rules directory gracefully with --rules", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );
    // Remove the custom rules dir
    await cleanupTmpDir(path.join(configDir, "rules"));

    const result = await updateHandler(tmpDir, { json: true, rules: true });
    expect(result.success).toBe(true);
    expect(result.data.rulesUpdated).toEqual([]);
  });

  it("does not update rules/skills/agents when flags not passed", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.rulesUpdated).toEqual([]);
    expect(result.data.skillsUpdated).toEqual([]);
    expect(result.data.agentsUpdated).toEqual([]);
  });

  it("refreshes managed skills with --skills", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const skillsDir = path.join(configDir, "skills");
    await fs.mkdir(skillsDir, { recursive: true });
    const skillName = prefixedName("commit");
    await fs.writeFile(
      path.join(skillsDir, `${skillName}.md`),
      `---\nname: ${skillName}\nmanaged_by: ${PROJECT_NAME}\n---\nold content`,
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true, skills: true });
    expect(result.success).toBe(true);
    expect(result.data.skillsUpdated).toContain(skillName);
  });

  it("skips user-owned skills with --skills", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const skillsDir = path.join(configDir, "skills");
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(
      path.join(skillsDir, "my-skill.md"),
      "---\nname: my-skill\nmanaged_by: user\n---\nuser content",
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true, skills: true });
    expect(result.success).toBe(true);
    expect(result.data.skillsSkipped).toContain("my-skill");
  });

  it("refreshes managed agents with --agents", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const agentsDir = path.join(configDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    const agentName = prefixedName("code-reviewer");
    await fs.writeFile(
      path.join(agentsDir, `${agentName}.md`),
      `---\nname: ${agentName}\nmanaged_by: ${PROJECT_NAME}\n---\nold agent content`,
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true, agents: true });
    expect(result.success).toBe(true);
    expect(result.data.agentsUpdated).toContain(agentName);
  });

  it("refreshes managed MCP servers with --mcp-servers", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const mcpDir = path.join(configDir, "mcp-servers");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "github.yaml"),
      stringifyYaml({
        name: "github",
        managed_by: PROJECT_NAME,
        command: "old-command",
      }),
      "utf-8",
    );

    const result = await updateHandler(tmpDir, {
      json: true,
      mcpServers: true,
    });
    expect(result.success).toBe(true);
    expect(result.data.mcpServersUpdated).toContain("github");
  });

  it("skips user-owned MCP servers with --mcp-servers", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const mcpDir = path.join(configDir, "mcp-servers");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "custom-server.yaml"),
      stringifyYaml({
        name: "custom-server",
        managed_by: "user",
        command: "my-cmd",
      }),
      "utf-8",
    );

    const result = await updateHandler(tmpDir, {
      json: true,
      mcpServers: true,
    });
    expect(result.success).toBe(true);
    expect(result.data.mcpServersSkipped).toContain("custom-server");
  });

  it("dry-run with --rules does not write to files", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const dryRuleName = prefixedName("security");
    const originalContent = `---\nname: ${dryRuleName}\nmanaged_by: ${PROJECT_NAME}\n---\nold content`;
    await fs.writeFile(
      path.join(configDir, "rules", `${dryRuleName}.md`),
      originalContent,
      "utf-8",
    );

    const result = await updateHandler(tmpDir, {
      json: true,
      rules: true,
      dryRun: true,
    });
    expect(result.success).toBe(true);
    expect(result.data.rulesUpdated).toContain(dryRuleName);

    // File should not have changed
    const afterContent = await fs.readFile(
      path.join(configDir, "rules", `${dryRuleName}.md`),
      "utf-8",
    );
    expect(afterContent).toBe(originalContent);
  });

  it("handles missing skills directory gracefully with --skills", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true, skills: true });
    expect(result.success).toBe(true);
    expect(result.data.skillsUpdated).toEqual([]);
  });

  it("handles missing agents directory gracefully with --agents", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({ auto_commit: { mode: "enabled", value: false } }),
      "utf-8",
    );

    const result = await updateHandler(tmpDir, { json: true, agents: true });
    expect(result.success).toBe(true);
    expect(result.data.agentsUpdated).toEqual([]);
  });
});
