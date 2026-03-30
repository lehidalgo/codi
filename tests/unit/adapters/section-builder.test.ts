import { describe, it, expect } from "vitest";
import {
  buildProjectOverview,
  buildArchitectureSummary,
  buildCommandsTable,
  buildAgentsTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
} from "../../../src/adapters/section-builder.js";
import { MANIFEST_FILENAME } from "../../../src/constants.js";
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

  it("includes team when present", () => {
    const config = createMockConfig({
      manifest: { name: "my-proj", version: "1", agents: [], team: "Platform" },
    });
    const result = buildProjectOverview(config);
    expect(result).toContain("**Team:** Platform");
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
