import { describe, it, expect } from "vitest";
import { collectStats } from "#src/core/docs/stats-collector.js";
import { AVAILABLE_TEMPLATES } from "#src/core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "#src/core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "#src/core/scaffolder/agent-template-loader.js";
import { AVAILABLE_COMMAND_TEMPLATES } from "#src/core/scaffolder/command-template-loader.js";
import { FLAG_CATALOG } from "#src/core/flags/flag-catalog.js";
import { ALL_ADAPTERS } from "#src/adapters/index.js";
import { prefixedName } from "#src/constants.js";

describe("collectStats", () => {
  const stats = collectStats();

  it("returns all required fields", () => {
    expect(stats).toHaveProperty("rules");
    expect(stats).toHaveProperty("skills");
    expect(stats).toHaveProperty("agents");
    expect(stats).toHaveProperty("commands");
    expect(stats).toHaveProperty("flags");
    expect(stats).toHaveProperty("presets");
    expect(stats).toHaveProperty("errorCodes");
    expect(stats).toHaveProperty("cliCommands");
    expect(stats).toHaveProperty("adapters");
  });

  it("rules count matches AVAILABLE_TEMPLATES", () => {
    expect(stats.rules.count).toBe(AVAILABLE_TEMPLATES.length);
    expect(stats.rules.names).toEqual(
      expect.arrayContaining([prefixedName("security"), prefixedName("testing")]),
    );
  });

  it("skills count matches AVAILABLE_SKILL_TEMPLATES", () => {
    expect(stats.skills.count).toBe(AVAILABLE_SKILL_TEMPLATES.length);
    expect(stats.skills.names.length).toBeGreaterThan(0);
  });

  it("agents count matches AVAILABLE_AGENT_TEMPLATES", () => {
    expect(stats.agents.count).toBe(AVAILABLE_AGENT_TEMPLATES.length);
    expect(stats.agents.names).toEqual(expect.arrayContaining([prefixedName("code-reviewer")]));
  });

  it("commands count matches AVAILABLE_COMMAND_TEMPLATES", () => {
    expect(stats.commands.count).toBe(AVAILABLE_COMMAND_TEMPLATES.length);
    expect(stats.commands.names).toEqual(expect.arrayContaining([prefixedName("test-run")]));
  });

  it("flags count matches FLAG_CATALOG keys", () => {
    expect(stats.flags.count).toBe(Object.keys(FLAG_CATALOG).length);
    expect(stats.flags.names).toContain("allow_force_push");
  });

  it("adapters count matches ALL_ADAPTERS", () => {
    expect(stats.adapters).toBe(ALL_ADAPTERS.length);
    expect(stats.adapters).toBeGreaterThanOrEqual(5);
  });

  it("presets count is positive", () => {
    expect(stats.presets.count).toBeGreaterThan(0);
    expect(stats.presets.names).toContain(prefixedName("balanced"));
  });

  it("error codes is positive", () => {
    expect(stats.errorCodes).toBeGreaterThan(0);
  });
});
