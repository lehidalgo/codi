import { describe, it, expect } from "vitest";
import {
  buildProjectOverview,
  buildArchitectureSummary,
  buildCommandsTable,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
  collectMcpEnvVars,
  buildMcpEnvExample,
} from "#src/adapters/section-builder.js";
import { MANIFEST_FILENAME } from "#src/constants.js";
import { createMockConfig } from "./mock-config.js";

describe("buildProjectOverview", () => {
  it("includes project name", () => {
    const config = createMockConfig();
    const result = buildProjectOverview(config);
    expect(result).toContain("test-project");
    expect(result).toContain("## Project Overview");
  });

  it("includes description when present", () => {
    const config = createMockConfig({
      manifest: {
        name: "my-proj",
        version: "1",
        agents: [],
        description: "A cool project",
      },
    });
    const result = buildProjectOverview(config);
    expect(result).toContain("A cool project");
  });
});

describe("buildArchitectureSummary", () => {
  it("lists rules, skills, agents, commands", () => {
    const config = createMockConfig({
      skills: [{ name: "deploy", description: "d", content: "c" }],
      agents: [{ name: "reviewer", description: "r", content: "c" }],
      commands: [{ name: "test", description: "t", content: "c" }],
    });
    const result = buildArchitectureSummary(config);
    expect(result).toContain("**Rules** (2)");
    expect(result).toContain("**Skills** (1)");
    expect(result).toContain("**Agents** (1)");
    expect(result).toContain("**Commands** (1)");
  });

  it("omits empty categories", () => {
    const config = createMockConfig({ skills: [], agents: [], commands: [] });
    const result = buildArchitectureSummary(config);
    expect(result).not.toContain("Skills");
    expect(result).not.toContain("Agents");
    expect(result).not.toContain("Commands");
  });

  it("omits rules section when no rules", () => {
    const config = createMockConfig({
      rules: [],
      skills: [],
      agents: [],
      commands: [],
    });
    const result = buildArchitectureSummary(config);
    expect(result).not.toContain("Rules");
  });
});

describe("buildCommandsTable", () => {
  it("returns null when no commands", () => {
    const config = createMockConfig({ commands: [] });
    expect(buildCommandsTable(config)).toBeNull();
  });

  it("builds markdown table with commands", () => {
    const config = createMockConfig({
      commands: [
        { name: "deploy", description: "Deploy the app", content: "c" },
        { name: "test", description: "Run tests", content: "c" },
      ],
    });
    const result = buildCommandsTable(config)!;
    expect(result).toContain("## Key Commands");
    expect(result).toContain("`/deploy`");
    expect(result).toContain("`/test`");
    expect(result).toContain("Deploy the app");
  });
});

describe("buildAgentsTable", () => {
  it("returns null when no agents", () => {
    const config = createMockConfig({ agents: [] });
    expect(buildAgentsTable(config)).toBeNull();
  });

  it("builds markdown table with agents", () => {
    const config = createMockConfig({
      agents: [{ name: "reviewer", description: "Code review", content: "c" }],
    });
    const result = buildAgentsTable(config)!;
    expect(result).toContain("## Available Agents");
    expect(result).toContain("reviewer");
    expect(result).toContain("Code review");
  });
});

describe("buildDevelopmentNotes", () => {
  it("returns empty string when no relevant flags", () => {
    const config = createMockConfig({ flags: {} });
    expect(buildDevelopmentNotes(config)).toBe("");
  });

  it("includes notes for enabled flags", () => {
    const config = createMockConfig({
      flags: {
        test_before_commit: {
          value: true,
          mode: "enforced",
          source: MANIFEST_FILENAME,
          locked: false,
        },
        security_scan: {
          value: true,
          mode: "enforced",
          source: MANIFEST_FILENAME,
          locked: false,
        },
        type_checking: {
          value: "strict",
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
        allow_force_push: {
          value: false,
          mode: "enforced",
          source: MANIFEST_FILENAME,
          locked: false,
        },
        lint_on_save: {
          value: true,
          mode: "enforced",
          source: MANIFEST_FILENAME,
          locked: false,
        },
      },
    });
    const result = buildDevelopmentNotes(config);
    expect(result).toContain("Run tests before committing");
    expect(result).toContain("Security scanning is enabled");
    expect(result).toContain("Strict type checking enforced");
    expect(result).toContain("All changes require PR review");
    expect(result).toContain("Force push is not allowed");
    expect(result).toContain("Lint on save is enabled");
  });
});

describe("buildWorkflowSection", () => {
  it("returns workflow guidelines", () => {
    const result = buildWorkflowSection();
    expect(result).toContain("## Workflow");
    expect(result).toContain("Before Writing Code");
    expect(result).toContain("Self-Evaluation Checklist");
  });
});

describe("getEnabledMcpServers", () => {
  it("returns only enabled servers", () => {
    const result = getEnabledMcpServers({
      servers: {
        "server-a": { command: "a", enabled: true },
        "server-b": { command: "b", enabled: false },
        "server-c": { command: "c" },
      },
    });
    expect(Object.keys(result.servers)).toEqual(["server-a", "server-c"]);
  });

  it("strips the enabled field from output", () => {
    const result = getEnabledMcpServers({
      servers: { s: { command: "x", enabled: true } },
    });
    expect(result.servers["s"]).not.toHaveProperty("enabled");
    expect(result.servers["s"]!.command).toBe("x");
  });

  it("returns empty servers when all disabled", () => {
    const result = getEnabledMcpServers({
      servers: { s: { command: "x", enabled: false } },
    });
    expect(Object.keys(result.servers)).toHaveLength(0);
  });

  it("returns empty servers when input is empty", () => {
    const result = getEnabledMcpServers({ servers: {} });
    expect(Object.keys(result.servers)).toHaveLength(0);
  });
});

describe("collectMcpEnvVars", () => {
  it("extracts env var names from env fields", () => {
    const result = collectMcpEnvVars({
      github: { command: "npx", env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" } },
    });
    expect(result).toEqual(["GITHUB_TOKEN"]);
  });

  it("extracts env var names from headers fields", () => {
    const result = collectMcpEnvVars({
      neon: {
        type: "http",
        url: "https://mcp.neon.tech/mcp",
        headers: { Authorization: "Bearer ${NEON_API_KEY}" },
      },
    });
    expect(result).toEqual(["NEON_API_KEY"]);
  });

  it("deduplicates and sorts var names across servers", () => {
    const result = collectMcpEnvVars({
      slack: {
        command: "npx",
        env: { SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}", SLACK_TEAM_ID: "${SLACK_TEAM_ID}" },
      },
      github: { command: "npx", env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" } },
    });
    expect(result).toEqual(["GITHUB_TOKEN", "SLACK_BOT_TOKEN", "SLACK_TEAM_ID"]);
  });

  it("returns empty array when no env vars", () => {
    const result = collectMcpEnvVars({
      memory: { command: "npx" },
    });
    expect(result).toEqual([]);
  });
});

describe("buildMcpEnvExample", () => {
  it("returns null when no env vars required", () => {
    const result = buildMcpEnvExample({ memory: { command: "npx" } });
    expect(result).toBeNull();
  });

  it("generates .env.example content with server attribution", () => {
    const result = buildMcpEnvExample({
      github: { command: "npx", env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" } },
    });
    expect(result).toContain("GITHUB_TOKEN=");
    expect(result).toContain("Required by: github");
  });

  it("lists multiple servers for a shared var", () => {
    const result = buildMcpEnvExample({
      "neon-a": { command: "npx", env: { NEON_API_KEY: "${NEON_API_KEY}" } },
      "neon-b": {
        type: "http",
        url: "https://x",
        headers: { Authorization: "Bearer ${NEON_API_KEY}" },
      },
    });
    expect(result).toContain("neon-a");
    expect(result).toContain("neon-b");
    expect(result).toContain("NEON_API_KEY=");
  });
});

describe("buildSkillRoutingTable", () => {
  it("returns null when no skills", () => {
    const config = createMockConfig({ skills: [] });
    expect(buildSkillRoutingTable(config)).toBeNull();
  });

  it("uses intentHints when provided", () => {
    const config = createMockConfig({
      skills: [
        {
          name: "codi-code-review",
          description: "Review code",
          content: "c",
          intentHints: {
            taskType: "Code Review",
            examples: ["Review my PR", "Check code quality"],
          },
        },
      ],
    });
    const result = buildSkillRoutingTable(config)!;
    expect(result).toContain("## Skill Routing");
    expect(result).toContain("Code Review");
    expect(result).toContain('"Review my PR"');
    expect(result).toContain("codi-code-review");
  });

  it("falls back to name-derived row when no intentHints", () => {
    const config = createMockConfig({
      skills: [
        {
          name: "codi-security-scan",
          description: "Security analysis workflow. Use to audit for vulnerabilities.",
          content: "c",
        },
      ],
    });
    const result = buildSkillRoutingTable(config)!;
    expect(result).toContain("Security Scan");
    expect(result).toContain("codi-security-scan");
    expect(result).toContain("*Security analysis workflow*");
  });

  it("truncates long descriptions to 80 chars with ellipsis", () => {
    const longDesc =
      "This is an extremely long description that exceeds eighty characters and should be truncated with an ellipsis appended at the end";
    const config = createMockConfig({
      skills: [{ name: "codi-long-desc", description: longDesc, content: "c" }],
    });
    const result = buildSkillRoutingTable(config)!;
    expect(result).toContain("...");
    expect(result).not.toContain(longDesc);
  });

  it("excludes brand-category skills", () => {
    const config = createMockConfig({
      skills: [
        { name: "codi-commit", description: "Commit", content: "c" },
        {
          name: "my-brand",
          description: "Brand",
          content: "c",
          category: "brand",
        },
      ],
    });
    const result = buildSkillRoutingTable(config)!;
    expect(result).toContain("codi-commit");
    expect(result).not.toContain("my-brand");
  });

  it("returns null when only brand skills exist", () => {
    const config = createMockConfig({
      skills: [
        {
          name: "my-brand",
          description: "Brand",
          content: "c",
          category: "brand",
        },
      ],
    });
    expect(buildSkillRoutingTable(config)).toBeNull();
  });
});
