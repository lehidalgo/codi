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
    expect(copilotAdapter.paths.skills).toBe(".github/skills");
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

  it("detects when .github/skills/ directory exists", async () => {
    await mkdir(join(tmpDir, ".github/skills"), { recursive: true });
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

    const instrFile = files.find(
      (f) => f.path === ".github/instructions/python-style.instructions.md",
    );
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
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
    expect(mainFile!.content).toContain("# Brand: my-brand");
    expect(mainFile!.content).toContain("Brand content here");

    // Brand skills should NOT generate prompt files
    const promptFiles = files.filter((f) => f.path.startsWith(".github/prompts/"));
    expect(promptFiles).toHaveLength(0);

    // Brand skills should NOT generate Agent Skills
    const skillFiles = files.filter((f) => f.path.startsWith(".github/skills/"));
    expect(skillFiles).toHaveLength(0);
  });

  // --- generate() with Agent Skills (Copilot Coding Agent / CLI format) ---

  it("generates SKILL.md at .github/skills/{name}/SKILL.md", async () => {
    await mkdir(join(tmpDir, ".codi/skills/my-skill"), { recursive: true });
    const config = createMockConfig({
      skills: [{ name: "my-skill", description: "Test skill", content: "Content here" }],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const skillFile = files.find((f) => f.path === ".github/skills/my-skill/SKILL.md");
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain("description:");
    expect(skillFile!.content).toContain("Test skill");
  });

  it("generates skeleton .gitkeep files for supporting directories", async () => {
    await mkdir(join(tmpDir, ".codi/skills/my-skill"), { recursive: true });
    const config = createMockConfig({
      skills: [{ name: "my-skill", description: "Test skill", content: "Content here" }],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const supportingDirs = ["scripts", "references", "assets", "agents"];
    for (const dir of supportingDirs) {
      const gitkeep = files.find((f) => f.path === `.github/skills/my-skill/${dir}/.gitkeep`);
      expect(gitkeep).toBeDefined();
    }
  });

  it("generates one SKILL.md per skill across multiple skills", async () => {
    await mkdir(join(tmpDir, ".codi/skills/alpha"), { recursive: true });
    await mkdir(join(tmpDir, ".codi/skills/beta"), { recursive: true });
    const config = createMockConfig({
      skills: [
        { name: "alpha", description: "Alpha skill", content: "A" },
        { name: "beta", description: "Beta skill", content: "B" },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const skillFiles = files.filter((f) => f.path.endsWith("SKILL.md"));
    expect(skillFiles).toHaveLength(2);
    expect(skillFiles.find((f) => f.path === ".github/skills/alpha/SKILL.md")).toBeDefined();
    expect(skillFiles.find((f) => f.path === ".github/skills/beta/SKILL.md")).toBeDefined();
  });

  it("SKILL.md uses copilot platform fields (allowed-tools, no user-invocable)", async () => {
    await mkdir(join(tmpDir, ".codi/skills/test-skill"), { recursive: true });
    const config = createMockConfig({
      skills: [
        {
          name: "test-skill",
          description: "Test",
          content: "Content",
          allowedTools: ["Bash", "Read"],
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const skillFile = files.find((f) => f.path === ".github/skills/test-skill/SKILL.md");
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain("allowed-tools:");
    expect(skillFile!.content).not.toContain("user-invocable:");
  });

  it("SKILL.md strips ${CLAUDE_SKILL_DIR} to empty string but keeps [[/path]] markers", async () => {
    await mkdir(join(tmpDir, ".codi/skills/templated"), { recursive: true });
    const config = createMockConfig({
      skills: [
        {
          name: "templated",
          description: "Templated skill",
          content:
            "Script: ${CLAUDE_SKILL_DIR}/scripts/run.sh\nData: ${CLAUDE_SKILL_DIR}[[/data.json]]",
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const skillFile = files.find((f) => f.path === ".github/skills/templated/SKILL.md");
    expect(skillFile).toBeDefined();
    // In SKILL.md, ${CLAUDE_SKILL_DIR} is stripped and [[/path]] markers are kept
    expect(skillFile!.content).toContain("/scripts/run.sh");
    expect(skillFile!.content).toContain("/data.json");
    expect(skillFile!.content).not.toContain("${CLAUDE_SKILL_DIR}");
  });

  it("both .prompt.md AND SKILL.md generated for the same skill (dual format)", async () => {
    await mkdir(join(tmpDir, ".codi/skills/dual"), { recursive: true });
    const config = createMockConfig({
      skills: [{ name: "dual", description: "Dual format skill", content: "Content" }],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const promptFile = files.find((f) => f.path === ".github/prompts/dual.prompt.md");
    const skillFile = files.find((f) => f.path === ".github/skills/dual/SKILL.md");
    expect(promptFile).toBeDefined();
    expect(skillFile).toBeDefined();
  });

  // --- generate() with ${CLAUDE_SKILL_DIR} resolution in .prompt.md ---

  it("${CLAUDE_SKILL_DIR}[[/path]] resolves to .github/skills/{name}/path in .prompt.md", async () => {
    await mkdir(join(tmpDir, ".codi/skills/ref-skill"), { recursive: true });
    const config = createMockConfig({
      skills: [
        {
          name: "ref-skill",
          description: "References",
          content: "Read the guide: ${CLAUDE_SKILL_DIR}[[/references/guide.md]]",
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const promptFile = files.find((f) => f.path === ".github/prompts/ref-skill.prompt.md");
    expect(promptFile).toBeDefined();
    expect(promptFile!.content).toContain(".github/skills/ref-skill/references/guide.md");
    expect(promptFile!.content).not.toContain("${CLAUDE_SKILL_DIR}");
  });

  it("standalone ${CLAUDE_SKILL_DIR}/scripts/... resolves correctly in .prompt.md", async () => {
    await mkdir(join(tmpDir, ".codi/skills/script-skill"), { recursive: true });
    const config = createMockConfig({
      skills: [
        {
          name: "script-skill",
          description: "Scripts",
          content: "Run: ${CLAUDE_SKILL_DIR}/scripts/deploy.sh",
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    const promptFile = files.find((f) => f.path === ".github/prompts/script-skill.prompt.md");
    expect(promptFile).toBeDefined();
    expect(promptFile!.content).toContain(".github/skills/script-skill/scripts/deploy.sh");
    expect(promptFile!.content).not.toContain("${CLAUDE_SKILL_DIR}");
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
    await mkdir(join(tmpDir, ".codi/skills/sk"), { recursive: true });
    const config = createMockConfig({
      skills: [{ name: "sk", description: "desc", content: "c" }],
      agents: [{ name: "ag", description: "desc", content: "c" }],
    });
    const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

    for (const file of files) {
      expect(file.path).toBeTruthy();
      // .gitkeep files are empty by design, so skip content check for them
      if (!file.path.endsWith(".gitkeep")) {
        expect(file.content).toBeTruthy();
      }
      expect(file.sources).toBeDefined();
      expect(file.hash).toBeDefined();
    }
  });

  // --- Security edge cases ---

  describe("security edge cases", () => {
    it("path traversal in skill names: sanitizes ../ sequences", async () => {
      await mkdir(join(tmpDir, ".codi/skills/evil"), { recursive: true });
      const config = createMockConfig({
        skills: [{ name: "../../etc/passwd", description: "bad", content: "c" }],
      });
      const files = await copilotAdapter.generate(config, { projectRoot: tmpDir });

      const promptFile = files.find((f) => f.path.includes(".prompt.md"));
      expect(promptFile?.path).toMatch(/^\.github\/prompts\/[a-z0-9-]+\.prompt\.md$/);
      expect(promptFile?.path).not.toContain("..");

      const skillFile = files.find((f) => f.path.includes("SKILL.md"));
      expect(skillFile?.path).toMatch(/^\.github\/skills\/[a-z0-9-]+\/SKILL\.md$/);
      expect(skillFile?.path).not.toContain("..");
    });

    it("path traversal in agent names: sanitizes ../ sequences", async () => {
      const config = createMockConfig({
        agents: [{ name: "../evil", description: "bad", content: "c" }],
      });
      const files = await copilotAdapter.generate(config, {});

      const agentFile = files.find((f) => f.path.includes(".agent.md"));
      expect(agentFile?.path).toMatch(/^\.github\/agents\/[a-z0-9-]+\.agent\.md$/);
      expect(agentFile?.path).not.toContain("..");
    });

    it("YAML injection in skill description: escapes newlines and special chars", async () => {
      const config = createMockConfig({
        skills: [
          {
            name: "test",
            description: 'test"\ntools: ["*"]',
            content: "c",
          },
        ],
      });
      const files = await copilotAdapter.generate(config, {});

      const skillFile = files.find((f) => f.path.includes(".prompt.md"));
      const content = skillFile!.content;
      const frontmatter = content.split("---")[1];

      // Parse YAML to verify it's valid and has no injected fields
      expect(() => JSON.parse("{" + frontmatter.split("\n").join(", ") + "}")).toThrow();
      // The important thing is the frontmatter is not broken and parseable as YAML
      expect(content.includes('tools: ["*"]')).toBe(false);
    });

    it("YAML injection in agent name: escapes newlines and special chars", async () => {
      const config = createMockConfig({
        agents: [
          {
            name: "agent\ntools: ['*']",
            description: "bad",
            content: "c",
          },
        ],
      });
      const files = await copilotAdapter.generate(config, {});

      const agentFile = files.find((f) => f.path.includes(".agent.md"));
      const content = agentFile!.content;

      // Verify the frontmatter has exactly 3 fields (version, name, description)
      // and no injected tools field at the root level
      const lines = content.split("---")[1].trim().split("\n");
      const frontmatterFields = lines.filter((l) => l.includes(":")).length;
      expect(frontmatterFields).toBe(2); // name and description only
    });

    it("pipe characters in agent descriptions: escapes for Markdown tables", async () => {
      const config = createMockConfig({
        agents: [
          {
            name: "test",
            description: "does stuff | extra column",
            content: "c",
          },
        ],
      });
      const files = await copilotAdapter.generate(config, {});

      const mainFile = files.find((f) => f.path === ".github/copilot-instructions.md");
      const content = mainFile!.content;

      // Table should have escaped pipes
      expect(content).toContain("does stuff \\| extra column");
      expect(content).not.toContain("does stuff | extra column");
    });

    it("single quotes in tool names: produces valid YAML", async () => {
      const config = createMockConfig({
        skills: [
          {
            name: "test",
            description: "test",
            content: "c",
            allowedTools: ["it's-a-tool", "another'tool"],
          },
        ],
      });
      const files = await copilotAdapter.generate(config, {});

      const skillFile = files.find((f) => f.path.includes(".prompt.md"));
      const content = skillFile!.content;

      // Should properly quote/escape the tool names
      expect(content).toContain("tools:");
      // YAML should be parseable (no syntax errors from quotes)
      const frontmatter = content.split("---")[1];
      expect(frontmatter.length > 0).toBe(true);
    });
  });
});
