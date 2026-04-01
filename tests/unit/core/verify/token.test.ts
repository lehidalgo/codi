import { describe, it, expect } from "vitest";
import { PROJECT_NAME } from "#src/constants.js";
import { buildVerificationData } from "#src/core/verify/token.js";
import { createMockConfig } from "../../adapters/mock-config.js";

describe("buildVerificationData", () => {
  it(`returns token in ${PROJECT_NAME}-XXXXXXXXXXXX format`, () => {
    const config = createMockConfig();
    const data = buildVerificationData(config);
    expect(data.token).toMatch(new RegExp(`^${PROJECT_NAME}-[a-f0-9]{12}$`));
  });

  it("returns deterministic output for same config", () => {
    const config = createMockConfig();
    const a = buildVerificationData(config);
    const b = buildVerificationData(config);
    expect(a.token).toBe(b.token);
    expect(a.ruleNames).toEqual(b.ruleNames);
    expect(a.activeFlags).toEqual(b.activeFlags);
  });

  it("collects rule names from config", () => {
    const config = createMockConfig();
    const data = buildVerificationData(config);
    expect(data.ruleNames).toEqual(["Code Style", "Testing"]);
  });

  it("collects skill names from config", () => {
    const config = createMockConfig({
      skills: [
        {
          name: "rule-management",
          description: "Manage rules",
          content: "Handle rule ops.",
        },
      ],
    });
    const data = buildVerificationData(config);
    expect(data.skillNames).toEqual(["rule-management"]);
  });

  it("collects agent names from config", () => {
    const config = createMockConfig({
      agents: [
        {
          name: "code-reviewer",
          description: "Reviews code",
          content: "Review all PRs.",
        },
      ],
    });
    const data = buildVerificationData(config);
    expect(data.agentNames).toEqual(["code-reviewer"]);
  });

  it("collects active flags from config", () => {
    const config = createMockConfig();
    const data = buildVerificationData(config);
    expect(data.activeFlags).toContain("Do NOT execute shell commands.");
    expect(data.activeFlags).toContain("Do NOT delete files.");
    expect(data.activeFlags).toContain(
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    );
    expect(data.activeFlags).toContain("Write tests for all new code.");
  });

  it("changes token when rules change", () => {
    const config1 = createMockConfig();
    const config2 = createMockConfig({
      rules: [
        {
          name: "Different Rule",
          description: "A different rule",
          content: "Something different.",
          priority: "high",
          alwaysApply: true,
          managedBy: PROJECT_NAME,
        },
      ],
    });
    const t1 = buildVerificationData(config1).token;
    const t2 = buildVerificationData(config2).token;
    expect(t1).not.toBe(t2);
  });

  it("changes token when rule content changes", () => {
    const config1 = createMockConfig();
    const config2 = createMockConfig({
      rules: [
        {
          name: "Code Style",
          description: "Enforce consistent code style",
          content: "Use 4-space indentation and double quotes.",
          priority: "high",
          alwaysApply: true,
          managedBy: PROJECT_NAME,
        },
        {
          name: "Testing",
          description: "Testing requirements",
          content: "Write unit tests for all functions.",
          priority: "medium",
          scope: ["**/*.test.ts"],
          alwaysApply: false,
          managedBy: PROJECT_NAME,
        },
      ],
    });
    const t1 = buildVerificationData(config1).token;
    const t2 = buildVerificationData(config2).token;
    expect(t1).not.toBe(t2);
  });

  it("changes token when agents change", () => {
    const config1 = createMockConfig();
    const config2 = createMockConfig({
      manifest: { name: "test-project", version: "1", agents: ["cursor"] },
    });
    const t1 = buildVerificationData(config1).token;
    const t2 = buildVerificationData(config2).token;
    expect(t1).not.toBe(t2);
  });

  it("returns file-size-check flag even when no flags are active", () => {
    const config = createMockConfig({ flags: {} });
    const data = buildVerificationData(config);
    expect(data.activeFlags).toEqual([
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    ]);
  });

  it("includes a timestamp", () => {
    const config = createMockConfig();
    const data = buildVerificationData(config);
    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).getTime()).not.toBeNaN();
  });
});
