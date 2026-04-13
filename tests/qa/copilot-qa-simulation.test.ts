/**
 * QA Simulation: GitHub Copilot Adapter
 *
 * Acts as a QA engineer testing the copilot adapter end-to-end:
 * - Functional tests with realistic configs
 * - Format validation against Copilot spec
 * - Edge cases (special chars, empty configs, multi-agent)
 * - Regression checks against other adapters
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse as yamlParse } from "yaml";
import { copilotAdapter } from "#src/adapters/copilot.js";
import { clineAdapter } from "#src/adapters/cline.js";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { createMockConfig } from "../unit/adapters/mock-config.js";
import { PROJECT_NAME, PROJECT_NAME_DISPLAY, MANIFEST_FILENAME } from "#src/constants.js";
import type { NormalizedConfig } from "#src/types/config.js";

// --- Helper: extract YAML frontmatter from markdown ---
function extractFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return yamlParse(match[1]) as Record<string, unknown>;
}

// --- Realistic full config ---
function createRealisticConfig(): NormalizedConfig {
  return createMockConfig({
    manifest: {
      name: "my-webapp",
      version: "1",
      agents: ["copilot"],
      project_context: "This is a Next.js 15 app with Prisma ORM and Tailwind CSS.",
    },
    rules: [
      {
        name: "TypeScript",
        description: "TS best practices",
        content: "Use strict mode. Prefer interfaces over types.",
        priority: "high",
        alwaysApply: true,
        managedBy: PROJECT_NAME,
      },
      {
        name: "Python Style",
        description: "Python coding standards",
        content: "Follow PEP 8. Use type hints.",
        priority: "medium",
        alwaysApply: false,
        managedBy: PROJECT_NAME,
        scope: ["**/*.py"],
      },
      {
        name: "Testing",
        description: "Testing rules",
        content: "Write unit tests for all functions.",
        priority: "medium",
        alwaysApply: true,
        managedBy: PROJECT_NAME,
      },
    ],
    skills: [
      {
        name: "commit",
        description: "Generate semantic commit messages",
        content: "# Commit Workflow\n\n1. Stage changes\n2. Generate message\n3. Commit",
        allowedTools: ["git", "bash"],
        category: "engineering",
      },
      {
        name: "code-review",
        description: "Perform thorough code reviews",
        content: "# Code Review\n\nCheck for bugs, security, performance.",
        model: "claude-opus-4-5",
        category: "engineering",
      },
      {
        name: "my-brand",
        description: "Brand identity guide",
        content: "Use blue #0066FF as primary color.",
        category: "brand",
      },
    ],
    agents: [
      {
        name: "reviewer",
        description: "Expert code reviewer",
        content: "You are an expert code reviewer. Focus on security and performance.",
        tools: ["read_file", "grep"],
        model: "gpt-4o",
        version: 1,
      },
      {
        name: "tester",
        description: "Test generation specialist",
        content: "Generate comprehensive test suites.",
        version: 1,
      },
    ],
    flags: {
      allow_shell_commands: {
        value: false,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
      require_tests: {
        value: true,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
    },
    mcp: {
      servers: {
        "my-mcp": { command: "node", args: ["server.js"], enabled: true },
      },
    },
  });
}

describe("QA-1: Functional Simulation", () => {
  it("generates all expected file types from a realistic config", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});

    // Expect: 1 main + 1 scoped rule + 2 prompt files + 2 agent files + 1 MCP = 7
    expect(files).toHaveLength(7);
    expect(files.map((f) => f.path).sort()).toEqual([
      ".github/agents/reviewer.agent.md",
      ".github/agents/tester.agent.md",
      ".github/copilot-instructions.md",
      ".github/instructions/python-style.instructions.md",
      ".github/prompts/code-review.prompt.md",
      ".github/prompts/commit.prompt.md",
      ".vscode/mcp.json",
    ]);
  });

  it("main instruction file has all required sections", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const main = files.find((f) => f.path === ".github/copilot-instructions.md")!;

    // Project context from manifest
    expect(main.content).toContain("## Project Context");
    expect(main.content).toContain("Next.js 15");

    // Flag restrictions
    expect(main.content).toContain("Do NOT execute shell commands");

    // Workflow section
    expect(main.content).toContain("## Workflow");

    // Skill routing table
    expect(main.content).toContain("Skill Routing");
    expect(main.content).toContain("commit");
    expect(main.content).toContain("code-review");

    // Agents table
    expect(main.content).toContain("Available Agents");
    expect(main.content).toContain("reviewer");
    expect(main.content).toContain("tester");

    // Global rules inlined
    expect(main.content).toContain("# TypeScript");
    expect(main.content).toContain("Use strict mode");
    expect(main.content).toContain("# Testing");

    // Scoped rule NOT inlined in main
    expect(main.content).not.toContain("Follow PEP 8");

    // Brand skill inlined
    expect(main.content).toContain("# Brand: my-brand");
    expect(main.content).toContain("#0066FF");

    // Non-brand skills inlined (progressive_loading off by default)
    expect(main.content).toContain("# Skill: commit");
    expect(main.content).toContain("# Skill: code-review");

    // Generated footer
    expect(main.content).toContain(`Generated by ${PROJECT_NAME_DISPLAY}`);
  });

  it("generates .vscode/mcp.json when MCP servers are configured", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const mcpFile = files.find((f) => f.path === ".vscode/mcp.json");
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content);
    expect(parsed.servers).toBeDefined();
    expect(parsed.servers["my-mcp"]).toBeDefined();
    expect(parsed.servers["my-mcp"].command).toBe("node");
  });
});

describe("QA-2: Format Validation against Copilot Spec", () => {
  it("prompt files have valid YAML frontmatter", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const prompts = files.filter((f) => f.path.endsWith(".prompt.md"));

    for (const prompt of prompts) {
      const fm = extractFrontmatter(prompt.content);
      expect(fm).not.toBeNull();
      expect(fm!.description).toBeTruthy();
      expect(fm!.agent).toBe("agent");
    }
  });

  it("prompt file tools field is valid YAML array", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const commitPrompt = files.find((f) => f.path === ".github/prompts/commit.prompt.md")!;
    const fm = extractFrontmatter(commitPrompt.content)!;

    expect(fm.tools).toBeDefined();
    expect(Array.isArray(fm.tools)).toBe(true);
    expect(fm.tools).toContain("git");
    expect(fm.tools).toContain("bash");
  });

  it("prompt file model field is correctly set", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const reviewPrompt = files.find((f) => f.path === ".github/prompts/code-review.prompt.md")!;
    const fm = extractFrontmatter(reviewPrompt.content)!;

    expect(fm.model).toBe("claude-opus-4-5");
  });

  it("instructions.md files have valid applyTo frontmatter", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const instrFiles = files.filter((f) => f.path.endsWith(".instructions.md"));

    for (const instr of instrFiles) {
      const fm = extractFrontmatter(instr.content);
      expect(fm).not.toBeNull();
      expect(fm!.applyTo).toBeTruthy();
      expect(typeof fm!.applyTo).toBe("string");
    }
  });

  it("agent files have valid YAML frontmatter with required fields", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const agentFiles = files.filter((f) => f.path.startsWith(".github/agents/"));

    for (const af of agentFiles) {
      const fm = extractFrontmatter(af.content);
      expect(fm).not.toBeNull();
      expect(fm!.name).toBeTruthy();
      expect(fm!.description).toBeTruthy();
    }
  });

  it("agent file with tools has valid YAML tools array", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const reviewerAgent = files.find((f) => f.path === ".github/agents/reviewer.agent.md")!;
    const fm = extractFrontmatter(reviewerAgent.content)!;

    expect(fm.tools).toBeDefined();
    expect(Array.isArray(fm.tools)).toBe(true);
    expect(fm.tools).toContain("read_file");
    expect(fm.tools).toContain("grep");
    expect(fm.model).toBe("gpt-4o");
  });

  it("agent file without tools/model omits those fields", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    const testerAgent = files.find((f) => f.path === ".github/agents/tester.agent.md")!;
    const fm = extractFrontmatter(testerAgent.content)!;

    expect(fm.tools).toBeUndefined();
    expect(fm.model).toBeUndefined();
  });

  it("all generated files end with the Codi footer", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    for (const f of files) {
      expect(f.content).toContain(`Generated by ${PROJECT_NAME_DISPLAY}`);
    }
  });

  it("all generated files have SHA-256 hashes", async () => {
    const config = createRealisticConfig();
    const files = await copilotAdapter.generate(config, {});
    for (const f of files) {
      expect(f.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

describe("QA-3: Edge Cases", () => {
  it("handles skills with quotes in descriptions", async () => {
    const config = createMockConfig({
      skills: [
        {
          name: "test-skill",
          description: 'Handle "edge cases" and \'special\' chars',
          content: "Test content",
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});
    const prompt = files.find((f) => f.path === ".github/prompts/test-skill.prompt.md")!;
    const fm = extractFrontmatter(prompt.content);
    expect(fm).not.toBeNull();
    // Frontmatter should be parseable even with escaped quotes
    expect(fm!.description).toContain("edge cases");
  });

  it("handles empty skills, rules, and agents gracefully", async () => {
    const config = createMockConfig({ rules: [], skills: [], agents: [], flags: {} });
    const files = await copilotAdapter.generate(config, {});
    // Only the main instruction file
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe(".github/copilot-instructions.md");
    expect(files[0]!.content.length).toBeGreaterThan(0);
  });

  it("handles rules with multiple scope globs", async () => {
    const config = createMockConfig({
      rules: [
        {
          name: "Web Rules",
          description: "Web file rules",
          content: "Follow web standards.",
          priority: "high",
          alwaysApply: false,
          managedBy: PROJECT_NAME,
          scope: ["**/*.tsx", "**/*.jsx", "**/*.css"],
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});
    const instr = files.find((f) => f.path.endsWith(".instructions.md"))!;
    expect(instr.content).toContain("**/*.tsx");
    expect(instr.content).toContain("**/*.css");
  });

  it("handles skills with argumentHint", async () => {
    const config = createMockConfig({
      skills: [
        {
          name: "deploy",
          description: "Deploy app",
          content: "Deploy steps",
          argumentHint: "environment name (prod, staging)",
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});
    const prompt = files.find((f) => f.path === ".github/prompts/deploy.prompt.md")!;
    const fm = extractFrontmatter(prompt.content)!;
    expect(fm["argument-hint"]).toContain("environment name");
  });

  it("handles skills with ${CLAUDE_SKILL_DIR} references", async () => {
    const config = createMockConfig({
      skills: [
        {
          name: "templated",
          description: "Skill with refs",
          content: "Read [[ /scripts/run.sh ]] and use ${CLAUDE_SKILL_DIR}/data.json",
        },
      ],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});
    const prompt = files.find((f) => f.path === ".github/prompts/templated.prompt.md")!;
    // [[]] markers should be stripped
    expect(prompt.content).not.toContain("[[");
    expect(prompt.content).not.toContain("]]");
    // ${CLAUDE_SKILL_DIR} should be stripped
    expect(prompt.content).not.toContain("CLAUDE_SKILL_DIR");
    // Paths should remain
    expect(prompt.content).toContain("/scripts/run.sh");
    expect(prompt.content).toContain("/data.json");
  });

  it("progressive_loading shows catalog instead of inline skills", async () => {
    const config = createMockConfig({
      skills: [
        { name: "alpha", description: "Alpha skill", content: "Alpha content" },
        { name: "beta", description: "Beta skill", content: "Beta content" },
      ],
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
    const main = files.find((f) => f.path === ".github/copilot-instructions.md")!;

    // Should show catalog table, not inline skills
    expect(main.content).toContain("Available Skills");
    expect(main.content).not.toContain("# Skill: alpha");
    expect(main.content).not.toContain("# Skill: beta");

    // Prompt files should still be generated
    expect(files.find((f) => f.path === ".github/prompts/alpha.prompt.md")).toBeDefined();
    expect(files.find((f) => f.path === ".github/prompts/beta.prompt.md")).toBeDefined();
  });

  it("self-dev warning appears when project name is 'codi'", async () => {
    const config = createMockConfig({
      manifest: { name: "codi", version: "1", agents: ["copilot"] },
      rules: [],
      skills: [],
      flags: {},
    });
    const files = await copilotAdapter.generate(config, {});
    const main = files.find((f) => f.path === ".github/copilot-instructions.md")!;
    expect(main.content).toContain("Self-Development Mode");
  });
});

describe("QA-4: Regression — Existing Adapters Unaffected", () => {
  const baseConfig = createMockConfig({
    skills: [{ name: "review", description: "Code review", content: "Review code" }],
  });

  it("cline adapter still generates .clinerules unchanged", async () => {
    const files = await clineAdapter.generate(baseConfig, {});
    const main = files.find((f) => f.path === ".clinerules")!;
    expect(main).toBeDefined();
    expect(main.content).toContain("Code Style");
    expect(main.content).toContain(`Generated by ${PROJECT_NAME_DISPLAY}`);
  });

  it("claude-code adapter still generates CLAUDE.md unchanged", async () => {
    const files = await claudeCodeAdapter.generate(baseConfig, {});
    const main = files.find((f) => f.path === "CLAUDE.md")!;
    expect(main).toBeDefined();
    expect(main.content).toContain(`Generated by ${PROJECT_NAME_DISPLAY}`);
    // Claude Code puts rules in .claude/rules/ files, not inline in CLAUDE.md
    const ruleFile = files.find((f) => f.path.includes(".claude/rules/"));
    expect(ruleFile).toBeDefined();
  });

  it("copilot output is independent — different hash from cline for same config", async () => {
    const copilotFiles = await copilotAdapter.generate(baseConfig, {});
    const clineFiles = await clineAdapter.generate(baseConfig, {});

    const copilotHash = copilotFiles.find((f) =>
      f.path === ".github/copilot-instructions.md",
    )!.hash;
    const clineHash = clineFiles.find((f) => f.path === ".clinerules")!.hash;

    // Same config but different adapters should produce different content
    expect(copilotHash).not.toBe(clineHash);
  });
});
