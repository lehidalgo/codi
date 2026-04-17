import { describe, it, expect } from "vitest";
import { PROJECT_NAME, PROJECT_NAME_DISPLAY, PROJECT_CLI } from "#src/constants.js";
import { buildVerificationSection } from "#src/core/verify/section-builder.js";
import type { VerificationData } from "#src/core/verify/token.js";

describe("buildVerificationSection", () => {
  const data: VerificationData = {
    token: `${PROJECT_NAME}-abc123def456`,
    ruleNames: ["code-quality", "security"],
    skillNames: ["rule-management"],
    agentNames: ["code-reviewer"],
    commandNames: [],
    mcpServerNames: [],
    activeFlags: [
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    ],
    timestamp: "2026-03-23T20:12:30.000Z",
  };

  it("contains the verification token", () => {
    const section = buildVerificationSection(data);
    expect(section).toContain(`\`${PROJECT_NAME}-abc123def456\``);
  });

  it("contains the verification header", () => {
    const section = buildVerificationSection(data);
    expect(section).toContain(`## ${PROJECT_NAME_DISPLAY} Verification`);
  });

  it("reports installed counts instead of full name lists", () => {
    const section = buildVerificationSection(data);
    expect(section).toContain("- Installed: 2 rules, 1 skills, 1 agents");
    expect(section).not.toContain("code-quality, security");
    expect(section).not.toContain("- Rules:");
    expect(section).not.toContain("- Skills:");
    expect(section).not.toContain("- Agents:");
  });

  it("points to the CLI for the full manifest", () => {
    const section = buildVerificationSection(data);
    expect(section).toContain(`${PROJECT_CLI} list`);
  });

  it("does not embed a regenerated-at timestamp", () => {
    const section = buildVerificationSection(data);
    expect(section).not.toContain("- Generated:");
    expect(section).not.toContain(data.timestamp);
  });

  it("includes instruction prompt for the agent", () => {
    const section = buildVerificationSection(data);
    expect(section).toContain(`verify ${PROJECT_CLI}`);
    expect(section).toContain(`${PROJECT_CLI} verify`);
  });

  it("omits the Installed line entirely when nothing is configured", () => {
    const empty: VerificationData = {
      ...data,
      ruleNames: [],
      skillNames: [],
      agentNames: [],
    };
    const section = buildVerificationSection(empty);
    expect(section).not.toContain("- Installed:");
  });

  it("lists only present artifact counts", () => {
    const rulesOnly: VerificationData = { ...data, skillNames: [], agentNames: [] };
    const section = buildVerificationSection(rulesOnly);
    const installedLine = section.split("\n").find((line) => line.startsWith("- Installed:"));
    expect(installedLine).toBe("- Installed: 2 rules");
  });
});
