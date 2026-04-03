import { describe, it, expect } from "vitest";
import { validateConfig, validateContentSize } from "#src/core/config/validator.js";
import type { NormalizedConfig } from "#src/types/config.js";
import { MAX_ARTIFACT_CHARS, MAX_TOTAL_ARTIFACT_CHARS } from "#src/constants.js";

function makeConfig(overrides: Partial<NormalizedConfig> = {}): NormalizedConfig {
  return {
    manifest: { name: "test", version: "1", agents: ["claude-code"] },
    rules: [],
    skills: [],
    agents: [],
    flags: {},
    mcp: { servers: {} },
    ...overrides,
  };
}

describe("validateConfig", () => {
  it("passes for valid config", () => {
    const config = makeConfig({
      rules: [
        {
          name: "test",
          description: "desc",
          content: "content",
          priority: "medium",
          alwaysApply: true,
          managedBy: "user",
        },
      ],
    });
    const errors = validateConfig(config);
    expect(errors).toHaveLength(0);
  });

  it("detects duplicate rule names", () => {
    const rule = {
      name: "dup",
      description: "desc",
      content: "content",
      priority: "medium" as const,
      alwaysApply: true,
      managedBy: "user" as const,
    };
    const config = makeConfig({ rules: [rule, rule] });
    const errors = validateConfig(config);
    expect(errors.some((e) => e.message.includes("Duplicate"))).toBe(true);
  });

  it("detects empty rule content", () => {
    const config = makeConfig({
      rules: [
        {
          name: "empty",
          description: "desc",
          content: "  ",
          priority: "medium",
          alwaysApply: true,
          managedBy: "user",
        },
      ],
    });
    const errors = validateConfig(config);
    expect(errors.some((e) => e.message.includes("empty content"))).toBe(true);
  });
});

describe("validateContentSize", () => {
  it("returns no warnings for small content", () => {
    const config = makeConfig({
      rules: [
        {
          name: "small",
          description: "desc",
          content: "short",
          priority: "medium",
          alwaysApply: true,
          managedBy: "user",
        },
      ],
    });
    const warnings = validateContentSize(config);
    expect(warnings).toHaveLength(0);
  });

  it("warns when a single rule exceeds 6000 chars", () => {
    const config = makeConfig({
      rules: [
        {
          name: "big",
          description: "desc",
          content: "x".repeat(MAX_ARTIFACT_CHARS + 1),
          priority: "medium",
          alwaysApply: true,
          managedBy: "user",
        },
      ],
    });
    const warnings = validateContentSize(config);
    expect(warnings.some((w) => w.message.includes('Rule "big"'))).toBe(true);
    expect(warnings[0].severity).toBe("warn");
  });

  it("warns when a single skill exceeds 6000 chars", () => {
    const config = makeConfig({
      skills: [
        {
          name: "big-skill",
          description: "desc",
          content: "x".repeat(MAX_ARTIFACT_CHARS + 1000),
        },
      ],
    });
    const warnings = validateContentSize(config);
    expect(warnings.some((w) => w.message.includes('Skill "big-skill"'))).toBe(true);
  });

  it("warns when a single agent exceeds 6000 chars", () => {
    const config = makeConfig({
      agents: [
        {
          name: "big-agent",
          description: "desc",
          content: "x".repeat(MAX_ARTIFACT_CHARS + 1000),
        },
      ],
    });
    const warnings = validateContentSize(config);
    expect(warnings.some((w) => w.message.includes('Agent "big-agent"'))).toBe(true);
  });

  it("warns when total combined content exceeds MAX_TOTAL_ARTIFACT_CHARS", () => {
    const half = Math.floor(MAX_TOTAL_ARTIFACT_CHARS / 2);
    const config = makeConfig({
      rules: [
        {
          name: "r1",
          description: "desc",
          content: "x".repeat(half),
          priority: "medium",
          alwaysApply: true,
          managedBy: "user",
        },
        {
          name: "r2",
          description: "desc",
          content: "x".repeat(half),
          priority: "medium",
          alwaysApply: true,
          managedBy: "user",
        },
      ],
      skills: [{ name: "s1", description: "desc", content: "x".repeat(half) }],
    });
    const warnings = validateContentSize(config);
    expect(warnings.some((w) => w.message.includes("Total artifact content"))).toBe(true);
  });

  it("does not warn when total is under MAX_TOTAL_ARTIFACT_CHARS", () => {
    const quarter = Math.floor(MAX_TOTAL_ARTIFACT_CHARS / 4);
    const config = makeConfig({
      rules: [
        {
          name: "r1",
          description: "desc",
          content: "x".repeat(quarter),
          priority: "medium",
          alwaysApply: true,
          managedBy: "user",
        },
        {
          name: "r2",
          description: "desc",
          content: "x".repeat(quarter),
          priority: "medium",
          alwaysApply: true,
          managedBy: "user",
        },
      ],
    });
    const warnings = validateContentSize(config);
    expect(warnings).toHaveLength(0);
  });
});
