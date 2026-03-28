import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cursorAdapter } from "../../../src/adapters/cursor.js";
import { createMockConfig } from "./mock-config.js";
import { CONTEXT_TOKENS_SMALL } from "../../../src/constants.js";

describe("cursor adapter", () => {
  const tmpDir = join(tmpdir(), "codi-test-cursor-" + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // --- Identity ---

  it("has correct id and name", () => {
    expect(cursorAdapter.id).toBe("cursor");
    expect(cursorAdapter.name).toBe("Cursor");
  });

  // --- Capabilities ---

  it("has correct capabilities", () => {
    expect(cursorAdapter.capabilities).toEqual({
      rules: true,
      skills: true,
      commands: false,
      mcp: true,
      frontmatter: true,
      progressiveLoading: true,
      agents: false,
      maxContextTokens: CONTEXT_TOKENS_SMALL,
    });
  });

  // --- Paths ---

  it("has correct paths", () => {
    expect(cursorAdapter.paths.configRoot).toBe(".cursor");
    expect(cursorAdapter.paths.rules).toBe(".cursor/rules");
    expect(cursorAdapter.paths.skills).toBeNull();
    expect(cursorAdapter.paths.commands).toBeNull();
    expect(cursorAdapter.paths.agents).toBeNull();
    expect(cursorAdapter.paths.instructionFile).toBe(".cursorrules");
    expect(cursorAdapter.paths.mcpConfig).toBe(".cursor/mcp.json");
  });

  // --- Detection ---

  it("detects when .cursor/ exists", async () => {
    await mkdir(join(tmpDir, ".cursor"), { recursive: true });
    expect(await cursorAdapter.detect(tmpDir)).toBe(true);
  });

  it("detects when .cursorrules exists", async () => {
    await writeFile(join(tmpDir, ".cursorrules"), "# Rules");
    expect(await cursorAdapter.detect(tmpDir)).toBe(true);
  });

  it("detects when both .cursor/ and .cursorrules exist", async () => {
    await mkdir(join(tmpDir, ".cursor"), { recursive: true });
    await writeFile(join(tmpDir, ".cursorrules"), "# Rules");
    expect(await cursorAdapter.detect(tmpDir)).toBe(true);
  });

  it("does not detect in empty directory", async () => {
    expect(await cursorAdapter.detect(tmpDir)).toBe(false);
  });

  // --- generate() with minimal config ---

  it("generates .cursorrules with minimal config (empty rules, skills, agents)", async () => {
    const config = createMockConfig({
      rules: [],
      skills: [],
      agents: [],
      flags: {},
    });
    const files = await cursorAdapter.generate(config, {});

    const mainFile = files.find((f) => f.path === ".cursorrules");
    expect(mainFile).toBeDefined();
    expect(mainFile!.content).toContain("## Workflow");
    expect(mainFile!.hash).toBeTruthy();
    expect(mainFile!.sources).toContain("codi.yaml");

    // No rule files or skill files
    const ruleFiles = files.filter((f) => f.path.startsWith(".cursor/rules/"));
    expect(ruleFiles).toHaveLength(0);
    const skillFiles = files.filter((f) => f.path.includes("/skills/"));
    expect(skillFiles).toHaveLength(0);
  });

  // --- generate() with rules ---

  it("generates .cursorrules with combined content", async () => {
    const config = createMockConfig();
    const files = await cursorAdapter.generate(config, {});

    const mainFile = files.find((f) => f.path === ".cursorrules");
    expect(mainFile).toBeDefined();
    expect(mainFile!.content).toContain("Do NOT execute shell commands.");
    expect(mainFile!.content).toContain("## Workflow");
    expect(mainFile!.content).toContain("## Project Overview");
  });

  it("generates .mdc rule files with YAML frontmatter", async () => {
    const config = createMockConfig();
    const files = await cursorAdapter.generate(config, {});

    const ruleFiles = files.filter((f) => f.path.startsWith(".cursor/rules/"));
    expect(ruleFiles).toHaveLength(2);

    const testingRule = ruleFiles.find((f) => f.path.includes("testing"));
    expect(testingRule).toBeDefined();
    expect(testingRule!.content).toContain("---");
    expect(testingRule!.content).toContain("description: Testing requirements");
    expect(testingRule!.content).toContain("alwaysApply: false");
    expect(testingRule!.content).toContain("globs: **/*.test.ts");
  });

  it("generates .mdc rule with alwaysApply true and no globs when scope is empty", async () => {
    const config = createMockConfig({
      rules: [
        {
          name: "Global Rule",
          description: "A global rule",
          content: "Follow this rule always.",
          priority: "high",
          alwaysApply: true,
          managedBy: "codi",
        },
      ],
    });
    const files = await cursorAdapter.generate(config, {});

    const ruleFile = files.find(
      (f) => f.path === ".cursor/rules/global-rule.mdc",
    );
    expect(ruleFile).toBeDefined();
    expect(ruleFile!.content).toContain("alwaysApply: true");
    expect(ruleFile!.content).not.toContain("globs:");
    expect(ruleFile!.content).toContain("# Global Rule");
    expect(ruleFile!.content).toContain("Follow this rule always.");
  });

  it("normalizes rule names to kebab-case filenames", async () => {
    const config = createMockConfig({
      rules: [
        {
          name: "My Complex   Rule",
          description: "desc",
          content: "content",
          priority: "low",
          alwaysApply: false,
          managedBy: "codi",
        },
      ],
    });
    const files = await cursorAdapter.generate(config, {});

    const ruleFile = files.find((f) => f.path.includes("my-complex"));
    expect(ruleFile).toBeDefined();
    expect(ruleFile!.path).toBe(".cursor/rules/my-complex-rule.mdc");
  });

  // --- generate() with skills ---

  it("generates skill files in .cursor/skills/", async () => {
    const config = createMockConfig({
      skills: [
        {
          name: "deploy",
          description: "Deployment skill",
          content: "Run deploy commands",
        },
        {
          name: "review",
          description: "Code review",
          content: "Review code carefully",
        },
      ],
    });
    const files = await cursorAdapter.generate(config, {});

    const skillMds = files.filter(
      (f) =>
        f.path.startsWith(".cursor/skills/") && f.path.endsWith("SKILL.md"),
    );
    expect(skillMds).toHaveLength(2);
    expect(
      skillMds.find((f) => f.path === ".cursor/skills/deploy/SKILL.md"),
    ).toBeDefined();
    expect(
      skillMds.find((f) => f.path === ".cursor/skills/review/SKILL.md"),
    ).toBeDefined();
  });

  // --- generate() with MCP servers ---

  it("generates .cursor/mcp.json when MCP servers are configured", async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          "my-server": {
            command: "node",
            args: ["server.js"],
            env: { API_KEY: "test-key" },
            enabled: true,
          },
        },
      },
    });
    const files = await cursorAdapter.generate(config, {});

    const mcpFile = files.find((f) => f.path === ".cursor/mcp.json");
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content);
    expect(parsed.servers["my-server"]).toBeDefined();
    expect(parsed.servers["my-server"].command).toBe("node");
    expect(mcpFile!.sources).toContain("mcp.yaml");
  });

  it("does not generate mcp.json when no servers are configured", async () => {
    const config = createMockConfig({ mcp: { servers: {} } });
    const files = await cursorAdapter.generate(config, {});

    const mcpFile = files.find((f) => f.path === ".cursor/mcp.json");
    expect(mcpFile).toBeUndefined();
  });

  it("excludes disabled MCP servers from mcp.json", async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          "enabled-server": { command: "node", args: ["a.js"], enabled: true },
          "disabled-server": {
            command: "node",
            args: ["b.js"],
            enabled: false,
          },
        },
      },
    });
    const files = await cursorAdapter.generate(config, {});

    const mcpFile = files.find((f) => f.path === ".cursor/mcp.json");
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content);
    expect(parsed.servers["enabled-server"]).toBeDefined();
    expect(parsed.servers["disabled-server"]).toBeUndefined();
  });

  // --- generate() produces unique hashes ---

  it("produces different hashes for different configs", async () => {
    const config1 = createMockConfig({
      flags: {
        allow_shell_commands: {
          value: false,
          mode: "enforced",
          source: "codi.yaml",
          locked: false,
        },
      },
    });
    const config2 = createMockConfig({
      flags: {
        allow_shell_commands: {
          value: true,
          mode: "enforced",
          source: "codi.yaml",
          locked: false,
        },
        max_file_lines: {
          value: 1000,
          mode: "enforced",
          source: "codi.yaml",
          locked: false,
        },
      },
    });

    const files1 = await cursorAdapter.generate(config1, {});
    const files2 = await cursorAdapter.generate(config2, {});

    const hash1 = files1.find((f) => f.path === ".cursorrules")!.hash;
    const hash2 = files2.find((f) => f.path === ".cursorrules")!.hash;
    expect(hash1).not.toBe(hash2);
  });

  // --- generate() all files have required fields ---

  it("all generated files have path, content, sources, and hash", async () => {
    const config = createMockConfig({
      skills: [{ name: "sk", description: "desc", content: "c" }],
      mcp: { servers: { s: { command: "x", enabled: true } } },
    });
    const files = await cursorAdapter.generate(config, {});

    for (const file of files) {
      expect(file.path).toBeTruthy();
      if (!file.path.endsWith(".gitkeep")) {
        expect(file.content).toBeTruthy();
      }
      expect(file.sources).toBeDefined();
      expect(file.hash).toBeDefined();
    }
  });
});
