import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { codexAdapter } from "#src/adapters/codex.js";
import { createMockConfig } from "./mock-config.js";
import { CONTEXT_TOKENS_LARGE, PROJECT_NAME, MANIFEST_FILENAME } from "#src/constants.js";

describe("codex adapter", () => {
  const tmpDir = join(tmpdir(), `${PROJECT_NAME}-test-codex-` + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // --- Identity ---

  it("has correct id and name", () => {
    expect(codexAdapter.id).toBe("codex");
    expect(codexAdapter.name).toBe("Codex");
  });

  // --- Capabilities ---

  it("has correct capabilities", () => {
    expect(codexAdapter.capabilities).toEqual({
      rules: true,
      skills: true,
      mcp: true,
      frontmatter: false,
      progressiveLoading: false,
      agents: true,
      maxContextTokens: CONTEXT_TOKENS_LARGE,
    });
  });

  // --- Paths ---

  it("has correct paths", () => {
    expect(codexAdapter.paths.configRoot).toBe(".codex");
    expect(codexAdapter.paths.rules).toBe(".");
    expect(codexAdapter.paths.skills).toBe(".agents/skills");
    expect(codexAdapter.paths.agents).toBe(".codex/agents");
    expect(codexAdapter.paths.instructionFile).toBe("AGENTS.md");
    expect(codexAdapter.paths.mcpConfig).toBe(".codex/config.toml");
  });

  // --- Detection ---

  it("detects when AGENTS.md exists", async () => {
    await writeFile(join(tmpDir, "AGENTS.md"), "# Agents");
    expect(await codexAdapter.detect(tmpDir)).toBe(true);
  });

  it("detects when .agents/ directory exists", async () => {
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    expect(await codexAdapter.detect(tmpDir)).toBe(true);
  });

  it("detects when both AGENTS.md and .agents/ exist", async () => {
    await writeFile(join(tmpDir, "AGENTS.md"), "# Agents");
    await mkdir(join(tmpDir, ".agents"), { recursive: true });
    expect(await codexAdapter.detect(tmpDir)).toBe(true);
  });

  it("does not detect in empty directory", async () => {
    expect(await codexAdapter.detect(tmpDir)).toBe(false);
  });

  // --- generate() with minimal config ---

  it("generates AGENTS.md with minimal config (empty rules, skills, agents)", async () => {
    const config = createMockConfig({
      rules: [],
      skills: [],
      agents: [],
      flags: {},
    });
    const files = await codexAdapter.generate(config, {});

    const agentsMd = files.find((f) => f.path === "AGENTS.md");
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain("## Workflow");
    expect(agentsMd!.hash).toBeTruthy();

    // No agent, skill, or config.toml files
    const agentFiles = files.filter((f) => f.path.startsWith(".codex/agents/"));
    expect(agentFiles).toHaveLength(0);
    const skillFiles = files.filter((f) => f.path.includes("/skills/"));
    expect(skillFiles).toHaveLength(0);
  });

  // --- generate() with rules ---

  it("generates AGENTS.md with rules and flag instructions", async () => {
    const config = createMockConfig();
    const files = await codexAdapter.generate(config, {});

    const agentsMd = files.find((f) => f.path === "AGENTS.md");
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain("Do NOT execute shell commands.");
    expect(agentsMd!.content).toContain("Keep source code files under 700 lines.");
    expect(agentsMd!.content).toContain("Code Style");
    expect(agentsMd!.content).toContain("Testing");
    expect(agentsMd!.hash).toBeTruthy();
  });

  it("inlines rules as sections in AGENTS.md", async () => {
    const config = createMockConfig({
      rules: [
        {
          name: "Inline Rule",
          description: "desc",
          content: "Follow this rule.",
          priority: "high",
          alwaysApply: true,
          managedBy: PROJECT_NAME,
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});

    const agentsMd = files.find((f) => f.path === "AGENTS.md");
    expect(agentsMd!.content).toContain("## Inline Rule");
    expect(agentsMd!.content).toContain("Follow this rule.");
  });

  // --- generate() with skills ---

  it("generates skill files in .agents/skills/", async () => {
    const config = createMockConfig({
      skills: [
        {
          name: "test-skill",
          description: "A test skill",
          content: "Do something",
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});

    const skillFile = files.find((f) => f.path.includes(".agents/skills/"));
    expect(skillFile).toBeDefined();
    expect(skillFile!.path).toBe(".agents/skills/test-skill/SKILL.md");
    expect(skillFile!.content).toContain("name: test-skill");

    const agentsMd = files.find((f) => f.path === "AGENTS.md");
    // Skill content should not be inlined (routing table may reference the name)
    expect(agentsMd!.content).not.toContain("Test skill content here");
  });

  it("generates multiple skill files", async () => {
    const config = createMockConfig({
      skills: [
        { name: "alpha", description: "Alpha skill", content: "Alpha content" },
        { name: "beta", description: "Beta skill", content: "Beta content" },
      ],
    });
    const files = await codexAdapter.generate(config, {});

    const skillMds = files.filter(
      (f) => f.path.startsWith(".agents/skills/") && f.path.endsWith("SKILL.md"),
    );
    expect(skillMds).toHaveLength(2);
    expect(skillMds.find((f) => f.path === ".agents/skills/alpha/SKILL.md")).toBeDefined();
    expect(skillMds.find((f) => f.path === ".agents/skills/beta/SKILL.md")).toBeDefined();
  });

  // --- generate() with agents ---

  it("generates agent TOML files in .codex/agents/", async () => {
    const config = createMockConfig({
      agents: [
        {
          name: "reviewer",
          description: "Code reviewer agent",
          content: "Review all pull requests carefully.",
          model: "gpt-4",
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});

    const agentFile = files.find((f) => f.path === ".codex/agents/reviewer.toml");
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain('name = "reviewer"');
    expect(agentFile!.content).toContain('description = "Code reviewer agent"');
    expect(agentFile!.content).toContain("Review all pull requests carefully.");
    expect(agentFile!.content).toContain('model = "gpt-4"');
    expect(agentFile!.sources).toContain(MANIFEST_FILENAME);
  });

  it("generates agent TOML without model when not specified", async () => {
    const config = createMockConfig({
      agents: [
        {
          name: "helper",
          description: "A helper agent",
          content: "Help with tasks.",
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});

    const agentFile = files.find((f) => f.path === ".codex/agents/helper.toml");
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).not.toContain("model =");
  });

  it("escapes agent developer instructions for TOML safely", async () => {
    const config = createMockConfig({
      agents: [
        {
          name: "tester",
          description: "desc",
          content: [
            "Run \\`npm test\\` before merging.",
            "",
            "```ts",
            'console.log("hello");',
            "```",
            "",
            "Path: C:\\temp\\agent-output",
          ].join("\n"),
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});

    const agentFile = files.find((f) => f.path === ".codex/agents/tester.toml");
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain('developer_instructions = "');
    expect(agentFile!.content).not.toContain('developer_instructions = """');
    expect(agentFile!.content).toContain("Run \\\\`npm test\\\\`");
    expect(agentFile!.content).toContain("Path: C:\\\\temp\\\\agent-output");
    expect(agentFile!.content).toContain("\\n\\n```ts\\n");
  });

  it("normalizes agent names with spaces to kebab-case filenames", async () => {
    const config = createMockConfig({
      agents: [
        {
          name: "My Agent",
          description: "desc",
          content: "content",
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});

    const agentFile = files.find((f) => f.path === ".codex/agents/my-agent.toml");
    expect(agentFile).toBeDefined();
  });

  it("emits model_reasoning_effort in agent TOML when effort is set", async () => {
    const config = createMockConfig({
      agents: [
        {
          name: "thinker",
          description: "A reasoning agent",
          content: "Think carefully.",
          effort: "medium",
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});
    const agentFile = files.find((f) => f.path === ".codex/agents/thinker.toml");
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain('model_reasoning_effort = "medium"');
  });

  it("clamps effort 'max' to 'high' for Codex model_reasoning_effort", async () => {
    const config = createMockConfig({
      agents: [
        {
          name: "heavy-thinker",
          description: "Max effort agent",
          content: "Think as hard as possible.",
          effort: "max",
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});
    const agentFile = files.find((f) => f.path === ".codex/agents/heavy-thinker.toml");
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain('model_reasoning_effort = "high"');
    expect(agentFile!.content).not.toContain('model_reasoning_effort = "max"');
  });

  it("omits model_reasoning_effort from agent TOML when effort is not set", async () => {
    const config = createMockConfig({
      agents: [
        {
          name: "basic-agent",
          description: "No effort specified",
          content: "Do your best.",
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});
    const agentFile = files.find((f) => f.path === ".codex/agents/basic-agent.toml");
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).not.toContain("model_reasoning_effort");
  });

  // --- generate() with MCP servers ---

  it("generates .codex/config.toml with MCP servers", async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          "my-mcp": {
            command: "npx",
            args: ["-y", "mcp-server"],
            env: { TOKEN: "abc" },
            enabled: true,
          },
        },
      },
    });
    const files = await codexAdapter.generate(config, {});

    const configFile = files.find((f) => f.path === ".codex/config.toml");
    expect(configFile).toBeDefined();
    expect(configFile!.content).toContain("[mcp_servers.my-mcp]");
    expect(configFile!.content).toContain('command = "npx"');
    expect(configFile!.content).toContain('args = ["-y", "mcp-server"]');
    expect(configFile!.content).toContain('env.TOKEN = "abc"');
  });

  it("generates config.toml with HTTP MCP server (url + headers)", async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          "http-mcp": {
            url: "https://mcp.example.com",
            headers: { Authorization: "Bearer token123" },
            enabled: true,
          },
        },
      },
    });
    const files = await codexAdapter.generate(config, {});

    const configFile = files.find((f) => f.path === ".codex/config.toml");
    expect(configFile).toBeDefined();
    expect(configFile!.content).toContain('url = "https://mcp.example.com"');
    expect(configFile!.content).toContain('http_headers.Authorization = "Bearer token123"');
  });

  it("excludes disabled MCP servers from config.toml", async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          active: { command: "node", args: ["a.js"], enabled: true },
          inactive: { command: "node", args: ["b.js"], enabled: false },
        },
      },
    });
    const files = await codexAdapter.generate(config, {});

    const configFile = files.find((f) => f.path === ".codex/config.toml");
    expect(configFile).toBeDefined();
    expect(configFile!.content).toContain("[mcp_servers.active]");
    expect(configFile!.content).not.toContain("[mcp_servers.inactive]");
  });

  it("does not generate config.toml when no MCP and no flag restrictions", async () => {
    const config = createMockConfig({ mcp: { servers: {} }, flags: {} });
    const files = await codexAdapter.generate(config, {});

    const configFile = files.find((f) => f.path === ".codex/config.toml");
    expect(configFile).toBeUndefined();
  });

  // --- generate() — heartbeat hook scripts ---

  describe("generate() — heartbeat hook scripts", () => {
    it("includes the skill-observer script in generated files", async () => {
      const config = createMockConfig({});
      const files = await codexAdapter.generate(config, {});

      const observer = files.find((f) => f.path.endsWith("codi-skill-observer.cjs"));
      expect(observer).toBeDefined();
      expect(observer!.path).toBe(".codi/hooks/codi-skill-observer.cjs");
      expect(observer!.content).toContain("CODI-OBSERVATION");
    });

    it("does NOT include the skill-tracker script (Codex has no InstructionsLoaded hook)", async () => {
      const config = createMockConfig({});
      const files = await codexAdapter.generate(config, {});

      const tracker = files.find((f) => f.path.endsWith("codi-skill-tracker.cjs"));
      expect(tracker).toBeUndefined();
    });

    it("generates .codex/hooks.json with the Stop hook pointing to skill-observer", async () => {
      const config = createMockConfig({});
      const files = await codexAdapter.generate(config, {});

      const hooksFile = files.find((f) => f.path === ".codex/hooks.json");
      expect(hooksFile).toBeDefined();
      const parsed = JSON.parse(hooksFile!.content);
      expect(parsed.Stop).toBeDefined();
      expect(Array.isArray(parsed.Stop)).toBe(true);
      const hook = parsed.Stop[0];
      expect(hook.type).toBe("command");
      expect(hook.command).toContain("codi-skill-observer.cjs");
      expect(hook.timeout).toBeGreaterThan(0);
    });

    it(".codex/hooks.json has non-empty content and a hash", async () => {
      const config = createMockConfig({});
      const files = await codexAdapter.generate(config, {});

      const hooksFile = files.find((f) => f.path === ".codex/hooks.json");
      expect(hooksFile!.content.length).toBeGreaterThan(0);
      expect(hooksFile!.hash).toBeTruthy();
    });
  });

  // --- generate() with flag restrictions in config.toml ---

  it("generates config.toml with developer_instructions from flag restrictions", async () => {
    const config = createMockConfig({
      flags: {
        allow_force_push: {
          value: false,
          mode: "enforced",
          source: MANIFEST_FILENAME,
          locked: false,
        },
        require_pr_review: {
          value: true,
          mode: "enforced",
          source: MANIFEST_FILENAME,
          locked: false,
        },
      },
      mcp: { servers: {} },
    });
    const files = await codexAdapter.generate(config, {});

    const configFile = files.find((f) => f.path === ".codex/config.toml");
    expect(configFile).toBeDefined();
    expect(configFile!.content).toContain("developer_instructions");
    expect(configFile!.content).toContain("force push is disabled");
    expect(configFile!.content).toContain("pull request review");
  });

  // --- generate() produces unique hashes ---

  it("produces different hashes for different configs", async () => {
    const config1 = createMockConfig({ rules: [] });
    const config2 = createMockConfig();

    const files1 = await codexAdapter.generate(config1, {});
    const files2 = await codexAdapter.generate(config2, {});

    const hash1 = files1.find((f) => f.path === "AGENTS.md")!.hash;
    const hash2 = files2.find((f) => f.path === "AGENTS.md")!.hash;
    expect(hash1).not.toBe(hash2);
  });

  // --- generate() with brand-category skills ---

  it("inlines brand-category skills in AGENTS.md", async () => {
    const config = createMockConfig({
      skills: [
        {
          name: "my-brand",
          description: "Brand identity",
          content: "Brand content here",
          category: "brand",
        },
      ],
    });
    const files = await codexAdapter.generate(config, {});

    const agentsMd = files.find((f) => f.path === "AGENTS.md");
    expect(agentsMd!.content).toContain("Brand: my-brand");
    expect(agentsMd!.content).toContain("Brand content here");
  });

  // --- generate() all files have required fields ---

  it("all generated files have path, content, sources, and hash", async () => {
    const config = createMockConfig({
      skills: [{ name: "sk", description: "desc", content: "c" }],
      agents: [{ name: "ag", description: "desc", content: "c" }],
      mcp: { servers: { s: { command: "x", enabled: true } } },
    });
    const files = await codexAdapter.generate(config, {});

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
