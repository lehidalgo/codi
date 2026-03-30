import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import { PROJECT_DIR } from "#src/constants.js";
import {
  runCli,
  createTempProject,
  fileExists,
  readFile,
} from "./helpers/cli-harness.js";

vi.setConfig({ testTimeout: 30_000 });

let projectDir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const project = await createTempProject();
  projectDir = project.projectDir;
  cleanup = project.cleanup;

  // Init project with claude-code agent
  await runCli(projectDir, ["init", "--agents", "claude-code"]);
});

afterEach(async () => {
  await cleanup();
});

describe("E2E: add artifacts", () => {
  it("adds a rule without template", async () => {
    const result = await runCli(projectDir, ["add", "rule", "my-rule"]);
    expect(result.exitCode).toBe(0);

    const rulePath = path.join(projectDir, PROJECT_DIR, "rules", "my-rule.md");
    expect(await fileExists(rulePath)).toBe(true);

    const content = await readFile(rulePath);
    expect(content).toContain("name: my-rule");
  });

  it("adds a rule with template", async () => {
    const result = await runCli(projectDir, [
      "add",
      "rule",
      "sec-rule",
      "-t",
      "security",
    ]);
    expect(result.exitCode).toBe(0);

    const rulePath = path.join(projectDir, PROJECT_DIR, "rules", "sec-rule.md");
    expect(await fileExists(rulePath)).toBe(true);

    const content = await readFile(rulePath);
    expect(content).toContain("Security");
  });

  it("adds a skill", async () => {
    const result = await runCli(projectDir, ["add", "skill", "my-skill"]);
    expect(result.exitCode).toBe(0);

    const skillDir = path.join(projectDir, PROJECT_DIR, "skills", "my-skill");
    expect(await fileExists(path.join(skillDir, "SKILL.md"))).toBe(true);
    expect(await fileExists(path.join(skillDir, "evals"))).toBe(true);
    expect(await fileExists(path.join(skillDir, "scripts"))).toBe(true);
  });

  it("adds an agent", async () => {
    const result = await runCli(projectDir, ["add", "agent", "my-agent"]);
    expect(result.exitCode).toBe(0);

    const agentPath = path.join(
      projectDir,
      PROJECT_DIR,
      "agents",
      "my-agent.md",
    );
    expect(await fileExists(agentPath)).toBe(true);

    const content = await readFile(agentPath);
    expect(content).toContain("name: my-agent");
  });

  it("adds a command", async () => {
    const result = await runCli(projectDir, ["add", "command", "my-cmd"]);
    expect(result.exitCode).toBe(0);

    const cmdPath = path.join(projectDir, PROJECT_DIR, "commands", "my-cmd.md");
    expect(await fileExists(cmdPath)).toBe(true);
  });

  it("adds an MCP server", async () => {
    const result = await runCli(projectDir, ["add", "mcp-server", "my-server"]);
    expect(result.exitCode).toBe(0);

    const mcpPath = path.join(
      projectDir,
      PROJECT_DIR,
      "mcp-servers",
      "my-server.yaml",
    );
    expect(await fileExists(mcpPath)).toBe(true);
  });

  it("rejects duplicate rule", async () => {
    await runCli(projectDir, ["add", "rule", "dup-rule"]);
    const result = await runCli(projectDir, ["add", "rule", "dup-rule"]);
    expect(result.exitCode).not.toBe(0);
  });

  it("added rule appears in generated output after regenerate", async () => {
    await runCli(projectDir, ["add", "rule", "testing", "-t", "testing"]);
    await runCli(projectDir, ["generate"]);

    // Check the rule is present in claude-code output
    const rulesDir = path.join(projectDir, ".claude", "rules");
    expect(await fileExists(rulesDir)).toBe(true);
  });
});
