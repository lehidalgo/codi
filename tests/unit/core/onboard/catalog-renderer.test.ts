import { describe, it, expect } from "vitest";
import { renderOnboardingGuide } from "#src/core/onboard/catalog-renderer.js";
import { AVAILABLE_TEMPLATES } from "#src/core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "#src/core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "#src/core/scaffolder/agent-template-loader.js";
import { getBuiltinPresetNames } from "#src/templates/presets/index.js";

describe("renderOnboardingGuide", () => {
  let guide: string;

  beforeAll(() => {
    guide = renderOnboardingGuide();
  });

  it("returns a non-empty string", () => {
    expect(typeof guide).toBe("string");
    expect(guide.length).toBeGreaterThan(1000);
  });

  it("contains the onboarding header", () => {
    expect(guide).toContain("CODI ONBOARDING GUIDE");
  });

  it("contains the artifact catalog section", () => {
    expect(guide).toContain("## ARTIFACT CATALOG");
  });

  it("contains the rules catalog with correct count", () => {
    expect(guide).toContain(`Rules (${AVAILABLE_TEMPLATES.length} available)`);
  });

  it("contains the skills catalog with correct count", () => {
    expect(guide).toContain(`Skills (${AVAILABLE_SKILL_TEMPLATES.length} available)`);
  });

  it("contains the agents catalog with correct count", () => {
    expect(guide).toContain(`Agents (${AVAILABLE_AGENT_TEMPLATES.length} available)`);
  });

  it("contains all built-in preset names", () => {
    for (const name of getBuiltinPresetNames()) {
      expect(guide).toContain(name);
    }
  });

  it("contains the presets section", () => {
    expect(guide).toContain("## BUILT-IN PRESETS");
  });

  it("contains the agent playbook section", () => {
    expect(guide).toContain("## AGENT PLAYBOOK");
  });

  it("contains all 7 playbook steps", () => {
    for (let i = 1; i <= 7; i++) {
      expect(guide).toContain(`### Step ${i}:`);
    }
  });

  it("contains installation commands", () => {
    expect(guide).toContain("codi init");
    expect(guide).toContain("codi generate");
  });

  it("contains documentation filename pattern", () => {
    expect(guide).toContain("YYYYMMDD_HHMMSS_[PLAN]_codi-init.md");
  });

  it("lists each rule at least once by name", () => {
    // Spot-check a few well-known rule names
    expect(guide).toContain("codi-typescript");
    expect(guide).toContain("codi-security");
    expect(guide).toContain("codi-testing");
  });

  it("lists each skill at least once by name", () => {
    expect(guide).toContain("codi-commit");
    expect(guide).toContain("codi-code-review");
  });

  it("lists each agent at least once by name", () => {
    expect(guide).toContain("codi-code-reviewer");
    expect(guide).toContain("codi-test-generator");
  });

  it("does not contain raw template interpolation tokens", () => {
    // ${PROJECT_NAME} and ${PROJECT_NAME_DISPLAY} should be resolved
    expect(guide).not.toContain("${PROJECT_NAME}");
    expect(guide).not.toContain("${PROJECT_NAME_DISPLAY}");
  });
});
