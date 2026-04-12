import { describe, it, expect } from "vitest";
import { SKILL_YAML_VALIDATE_TEMPLATE } from "#src/core/hooks/hook-policy-templates.js";

describe("SKILL_YAML_VALIDATE_TEMPLATE — trigger-clause warning", () => {
  it("contains trigger-clause check for user-invocable skills", () => {
    expect(SKILL_YAML_VALIDATE_TEMPLATE).toContain("user-invocable");
    expect(SKILL_YAML_VALIDATE_TEMPLATE).toContain("trigger clause");
  });

  it("checks for 'Use when' as a valid trigger phrase", () => {
    expect(SKILL_YAML_VALIDATE_TEMPLATE).toContain("Use when");
  });

  it("checks for 'Use for' as a valid trigger phrase", () => {
    expect(SKILL_YAML_VALIDATE_TEMPLATE).toContain("Use for");
  });

  it("routes trigger-clause violation through warnings.push() not failed = true", () => {
    // The check must be non-blocking — warnings[], not failed = true
    const warningIdx = SKILL_YAML_VALIDATE_TEMPLATE.indexOf("trigger clause");
    expect(warningIdx).toBeGreaterThan(-1);
    // After the trigger-clause string there must be a warnings.push call
    const warningsPushAfter = SKILL_YAML_VALIDATE_TEMPLATE.indexOf("warnings.push", warningIdx);
    expect(warningsPushAfter).toBeGreaterThan(warningIdx);
  });
});
