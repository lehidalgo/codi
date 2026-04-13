import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copilotAdapter } from "#src/adapters/copilot.js";
import { createMockConfig } from "./mock-config.js";
import { CONTEXT_TOKENS_LARGE, PROJECT_NAME, MANIFEST_FILENAME } from "#src/constants.js";

describe("copilot adapter", () => {
  const tmpDir = join(tmpdir(), `${PROJECT_NAME}-test-copilot-` + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // --- Identity ---

  it("has correct id and name", () => {
    expect(copilotAdapter.id).toBe("copilot");
    expect(copilotAdapter.name).toBe("GitHub Copilot");
  });

  // --- Capabilities ---

  it("has correct capabilities", () => {
    expect(copilotAdapter.capabilities).toEqual({
      rules: true,
      skills: true,
      mcp: true,
      frontmatter: true,
      progressiveLoading: false,
      agents: true,
      maxContextTokens: CONTEXT_TOKENS_LARGE,
    });
  });

  // --- Paths ---

  it("has correct paths", () => {
    expect(copilotAdapter.paths.configRoot).toBe(".github");
    expect(copilotAdapter.paths.rules).toBe(".github/instructions");
    expect(copilotAdapter.paths.skills).toBe(".github/prompts");
    expect(copilotAdapter.paths.agents).toBe(".github/agents");
    expect(copilotAdapter.paths.instructionFile).toBe(".github/copilot-instructions.md");
    expect(copilotAdapter.paths.mcpConfig).toBe(".vscode/mcp.json");
  });

  // --- Detection ---

  it("detects when .github/copilot-instructions.md exists", async () => {
    await mkdir(join(tmpDir, ".github"), { recursive: true });
    await writeFile(join(tmpDir, ".github/copilot-instructions.md"), "# Instructions");
    expect(await copilotAdapter.detect(tmpDir)).toBe(true);
  });

  it("detects when .github/prompts/ directory exists", async () => {
    await mkdir(join(tmpDir, ".github/prompts"), { recursive: true });
    expect(await copilotAdapter.detect(tmpDir)).toBe(true);
  });

  it("detects when .github/agents/ directory exists", async () => {
    await mkdir(join(tmpDir, ".github/agents"), { recursive: true });
    expect(await copilotAdapter.detect(tmpDir)).toBe(true);
  });

  it("does not detect in empty directory", async () => {
    expect(await copilotAdapter.detect(tmpDir)).toBe(false);
  });

  // --- generate() with minimal config ---

  it("generates .github/copilot-instructions.md with minimal config", async () => {
    const config = createMockConfig({ rules: [], skills: [], flags: {} });
    const files = await copilotAdapter.generate(config, {});

    const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
    expect(mainFile).toBeDefined();
    expect(mainFile!.content).toContain("## Workflow");
    expect(mainFile!.hash).toBeTruthy();
    expect(mainFile!.sources).toContain(MANIFEST_FILENAME);

    // Instruction file + hooks JSON + 2 heartbeat scripts = 4
    expect(files).toHaveLength(4);
  });

  // --- generate() with rules ---

  it("generates instruction file with rules and flag instructions", async () => {
    const config = createMockConfig();
    const files = await copilotAdapter.generate(config, {});

    const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
    expect(mainFile).toBeDefined();
    expect(mainFile!.content).toContain("Do NOT execute shell commands.");
    expect(mainFile!.content).toContain("Write tests for all new code.");
    expect(mainFile!.content).toContain("Code Style");
    expect(mainFile!.hash).toBeTruthy();
  });

  it("inlines global rules as heading sections", async () => {
    const config = createMockConfig({
      rules: [
        {
          name: "Naming",
          description: "Naming conventions",
          content: "Use camelCase for variables.",
          priority: "medium",
          alwaysApply: true,
          managedBy: PROJECT_NAME,
        },
        {
          name: "Error Handling",
          description: "Error handling rules",
          content: "Always catch errors.",
          priority: "high",
          alwaysApply: true,
          managedBy: PROJECT_NAME,
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});

    const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
    expect(mainFile!.content).toContain("# Naming");
    expect(mainFile!.content).toContain("Use camelCase for variables.");
    expect(mainFile!.content).toContain("# Error Handling");
    expect(mainFile!.content).toContain("Always catch errors.");
  });

  it("generates without flag section when flags are empty", async () => {
    const config = createMockConfig({ flags: {} });
    const files = await copilotAdapter.generate(config, {});

    expect(files[0]!.content).not.toContain("Do NOT");
  });

  // --- generate() with scoped rules ---

  it("generates path-specific .instructions.md files for scoped rules", async () => {
    const config = createMockConfig({
      rules: [
        {
          name: "Python Style",
          description: "Python coding standards",
          content: "Follow PEP 8.",
          priority: "high",
          alwaysApply: false,
          managedBy: PROJECT_NAME,
          scope: ["**/*.py"],
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});

    const instrFile = files.find((f) => f.path === ".github/instructions/python-style.instructions.md");
    expect(instrFile).toBeDefined();
    expect(instrFile!.content).toContain("applyTo:");
    expect(instrFile!.content).toContain("**/*.py");
    expect(instrFile!.content).toContain("Follow PEP 8.");

    // Scoped rule should NOT appear in main instruction file
    const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
    expect(mainFile!.content).not.toContain("Follow PEP 8.");
  });

  // --- generate() with skills ---

  it("inlines skills when progressive_loading is off", async () => {
    const config = createMockConfig({
      skills: [
        {
          name: "deploy",
          description: "Deploy skill",
          content: "Run deploy commands",
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});

    const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
    expect(mainFile!.content).toContain("# Skill: deploy");
    expect(mainFile!.content).toContain("Run deploy commands");
  });

  it("generates prompt files in .github/prompts/", async () => {
    const config = createMockConfig({
      skills: [{ name: "review", description: "Code review", content: "Review code" }],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});

    const promptFiles = files.filter(
      (f) => f.path.startsWith(".github/prompts/") && f.path.endsWith(".prompt.md"),
    );
    expect(promptFiles).toHaveLength(1);
    expect(promptFiles[0]!.path).toBe(".github/prompts/review.prompt.md");
    expect(promptFiles[0]!.content).toContain("description:");
    expect(promptFiles[0]!.content).toContain("agent:");
    expect(promptFiles[0]!.content).toContain("Review code");
  });

  it("generates multiple prompt files", async () => {
    const config = createMockConfig({
      skills: [
        { name: "alpha", description: "Alpha", content: "A" },
        { name: "beta", description: "Beta", content: "B" },
        { name: "gamma", description: "Gamma", content: "G" },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});

    const promptFiles = files.filter(
      (f) => f.path.startsWith(".github/prompts/") && f.path.endsWith(".prompt.md"),
    );
    expect(promptFiles).toHaveLength(3);
    expect(promptFiles.find((f) => f.path === ".github/prompts/alpha.prompt.md")).toBeDefined();
    expect(promptFiles.find((f) => f.path === ".github/prompts/beta.prompt.md")).toBeDefined();
    expect(promptFiles.find((f) => f.path === ".github/prompts/gamma.prompt.md")).toBeDefined();
  });

  // --- generate() with progressive_loading metadata ---

  it("shows skill catalog when progressive_loading is metadata", async () => {
    const config = createMockConfig({
      skills: [{ name: "deploy", description: "Deploy skill", content: "Run deploy" }],
      flags: {
        progressive_loading: {
          value: "metadata",
          mode: "enabled",
          source: MANIFEST_FILENAME,
          locked: false,
        },
      },
    });
    const files = await copilotAdapter.generate(config, {});

    const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
    expect(mainFile!.content).toContain("Available Skills");
    expect(mainFile!.content).not.toContain("# Skill: deploy");
  });

  // --- generate() with brand-category skills ---

  it("renders brand-category skills inline, not as prompt files", async () => {
    const config = createMockConfig({
      skills: [
        {
          name: "my-brand",
          description: "Brand identity",
          content: "Brand content here",
          category: "brand",
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});

    const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
    expect(mainFile!.content).toContain("# Brand: my-brand");
    expect(mainFile!.content).toContain("Brand content here");

    // Brand skills should NOT generate prompt files
    const promptFiles = files.filter((f) => f.path.startsWith(".github/prompts/"));
    expect(promptFiles).toHaveLength(0);
  });

  // --- generate() with agents ---

  it("generates agent files in .github/agents/", async () => {
    const config = createMockConfig({
      agents: [
        {
          name: "reviewer",
          description: "Code reviewer",
          content: "You are a code reviewer.",
        },
      ],
    });
    const files = await copilotAdapter.generate(config, {});

    const agentFiles = files.filter((f) => f.path.startsWith(".github/agents/"));
    expect(agentFiles).toHaveLength(1);
    expect(agentFiles[0]!.path).toBe(".github/agents/reviewer.agent.md");
    expect(agentFiles[0]!.content).toContain("name: reviewer");
    expect(agentFiles[0]!.content).toContain("Code reviewer");
    expect(agentFiles[0]!.content).toContain("You are a code reviewer.");
  });

  it("generates multiple agent files", async () => {
    const config = createMockConfig({
      agents: [
        { name: "reviewer", description: "Reviews code", content: "Review" },
        { name: "tester", description: "Writes tests", content: "Test" },
      ],
    });
    const files = await copilotAdapter.generate(config, {});

    const agentFiles = files.filter((f) => f.path.startsWith(".github/agents/"));
    expect(agentFiles).toHaveLength(2);
    expect(agentFiles.find((f) => f.path === ".github/agents/reviewer.agent.md")).toBeDefined();
    expect(agentFiles.find((f) => f.path === ".github/agents/tester.agent.md")).toBeDefined();
  });

  // --- MCP support via .vscode/mcp.json ---

  it("generates .vscode/mcp.json when MCP servers are configured", async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          "my-server": {
            command: "node",
            args: ["server.js"],
            enabled: true,
          },
        },
      },
    });
    const files = await copilotAdapter.generate(config, {});

    const mcpFile = files.find((f) => f.path === ".vscode/mcp.json");
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content);
    expect(parsed.servers["my-server"]).toBeDefined();
    expect(parsed.servers["my-server"].command).toBe("node");
  });

  it("does not generate MCP file when no servers are enabled", async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          "disabled-server": {
            command: "node",
            args: ["server.js"],
            enabled: false,
          },
        },
      },
    });
    const files = await copilotAdapter.generate(config, {});

    const mcpFile = files.find((f) => f.path === ".vscode/mcp.json");
    expect(mcpFile).toBeUndefined();
  });

  // --- Copilot hooks: .github/hooks/codi-hooks.json ---

  it("generates .github/hooks/codi-hooks.json with sessionStart and sessionEnd", async () => {
    const config = createMockConfig({ rules: [], skills: [], flags: {} });
    const files = await copilotAdapter.generate(config, {});

    const hooksFile = files.find((f) => f.path === ".github/hooks/codi-hooks.json");
    expect(hooksFile).toBeDefined();

    const parsed = JSON.parse(hooksFile!.content);
    expect(parsed.version).toBe(1);
    expect(parsed.hooks.sessionStart).toBeDefined();
    expect(parsed.hooks.sessionEnd).toBeDefined();
    expect(parsed.hooks.sessionStart[0].type).toBe("command");
    expect(parsed.hooks.sessionEnd[0].type).toBe("command");
  });

  it("generates heartbeat scripts in .codi/hooks/", async () => {
    const config = createMockConfig({ rules: [], skills: [], flags: {} });
    const files = await copilotAdapter.generate(config, {});

    const tracker = files.find((f) => f.path.includes("codi-skill-tracker"));
    const observer = files.find((f) => f.path.includes("codi-skill-observer"));
    expect(tracker).toBeDefined();
    expect(observer).toBeDefined();
    expect(tracker!.content).toContain("skill-tracker");
    expect(observer!.content).toContain("skill-observer");
  });

  // --- generate() produces unique hashes ---

  it("produces different hashes for different configs", async () => {
    const config1 = createMockConfig({ rules: [], flags: {} });
    const config2 = createMockConfig();

    const files1 = await copilotAdapter.generate(config1, {});
    const files2 = await copilotAdapter.generate(config2, {});

    const hash1 = files1.find((f) => f.path === ".github/copilot-instructions.md")!.hash;
    const hash2 = files2.find((f) => f.path === ".github/copilot-instructions.md")!.hash;
    expect(hash1).not.toBe(hash2);
  });

  // --- generate() all files have required fields ---

  it("all generated files have path, content, sources, and hash", async () => {
    const config = createMockConfig({
      skills: [{ name: "sk", description: "desc", content: "c" }],
      agents: [{ name: "ag", description: "desc", content: "c" }],
    });
    const files = await copilotAdapter.generate(config, {});

    for (const file of files) {
      expect(file.path).toBeTruthy();
      expect(file.content).toBeTruthy();
      expect(file.sources).toBeDefined();
      expect(file.hash).toBeDefined();
    }
  });
});
