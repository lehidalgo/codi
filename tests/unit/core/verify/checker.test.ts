import { describe, it, expect } from "vitest";
import { PROJECT_NAME, PROJECT_NAME_DISPLAY } from "#src/constants.js";
import { checkAgentResponse } from "#src/core/verify/checker.js";
import type { VerificationData } from "#src/core/verify/token.js";

const TOKEN_VALUE = `${PROJECT_NAME}-a3f8b2c1d4e5`;

const expected: VerificationData = {
  token: TOKEN_VALUE,
  ruleNames: ["code-quality", "security", "testing-standards"],
  skillNames: [],
  agentNames: [],
  commandNames: [],
  brandNames: [],
  mcpServerNames: [],
  activeFlags: [
    "Keep source code files under 700 lines. Documentation files have no line limit.",
  ],
  timestamp: "2026-03-23T20:00:00.000Z",
};

describe("checkAgentResponse", () => {
  it("matches a valid complete response", () => {
    const response = `
Verification token: ${TOKEN_VALUE}
Rules loaded: code-quality, security, testing-standards
Flags active: Keep source code files under 700 lines. Documentation files have no line limit.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(true);
    expect(result.receivedToken).toBe(TOKEN_VALUE);
    expect(result.rulesFound).toEqual([
      "code-quality",
      "security",
      "testing-standards",
    ]);
    expect(result.rulesMissing).toEqual([]);
    expect(result.flagsFound).toEqual([
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    ]);
    expect(result.flagsMissing).toEqual([]);
  });

  it("detects missing token", () => {
    const response = "Rules loaded: code-quality, security";
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(false);
    expect(result.receivedToken).toBeNull();
  });

  it("detects wrong token", () => {
    const wrongToken = `${PROJECT_NAME}-000000000000`;
    const response = `Verification token: ${wrongToken}`;
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(false);
    expect(result.receivedToken).toBe(wrongToken);
  });

  it("detects missing rules", () => {
    const response = `
Verification token: ${TOKEN_VALUE}
Rules loaded: code-quality
Flags active: Keep source code files under 700 lines. Documentation files have no line limit.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.rulesFound).toEqual(["code-quality"]);
    expect(result.rulesMissing).toEqual(["security", "testing-standards"]);
  });

  it("detects extra rules", () => {
    const response = `
Rules loaded: code-quality, security, testing-standards, unknown-rule
`;
    const result = checkAgentResponse(response, expected);
    expect(result.rulesExtra).toEqual(["unknown-rule"]);
  });

  it("handles bullet-list format", () => {
    const response = `
Verification token: ${TOKEN_VALUE}
Rules loaded:
- code-quality
- security
- testing-standards
Flags active:
- Keep source code files under 700 lines. Documentation files have no line limit.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.rulesFound).toEqual([
      "code-quality",
      "security",
      "testing-standards",
    ]);
    expect(result.flagsFound).toEqual([
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    ]);
  });

  it("handles fuzzy matching with backticks and formatting", () => {
    const response = `
Verification token: \`${TOKEN_VALUE}\`
Rules loaded: \`code-quality\`, \`security\`, \`testing-standards\`
Flags active: "Keep source code files under 700 lines. Documentation files have no line limit."
`;
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(true);
    expect(result.rulesFound).toEqual([
      "code-quality",
      "security",
      "testing-standards",
    ]);
    expect(result.flagsFound).toEqual([
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    ]);
  });

  it("detects missing flags", () => {
    const response = `
Verification token: ${TOKEN_VALUE}
Rules loaded: code-quality, security, testing-standards
Flags active: none
`;
    const result = checkAgentResponse(response, expected);
    expect(result.flagsMissing).toEqual([
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    ]);
  });

  it("handles Claude format with counts: Rules (N):", () => {
    const response = `
Verification token: ${TOKEN_VALUE}
Rules (3): code-quality, security, testing-standards
`;
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(true);
    expect(result.rulesFound).toEqual([
      "code-quality",
      "security",
      "testing-standards",
    ]);
    expect(result.rulesMissing).toEqual([]);
  });

  it("handles Claude format with Flags (N):", () => {
    const response = `
Verification token: ${TOKEN_VALUE}
Rules (3): code-quality, security, testing-standards
Flags (1): Keep source code files under 700 lines. Documentation files have no line limit.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.flagsFound).toEqual([
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    ]);
  });

  it("handles full Claude response format", () => {
    const response = `
Verification token: ${TOKEN_VALUE}
Rules (3): code-quality, security, testing-standards
${PROJECT_NAME_DISPLAY} configuration verified successfully.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(true);
    expect(result.rulesFound).toEqual([
      "code-quality",
      "security",
      "testing-standards",
    ]);
  });

  it("handles - Rules: prefix format", () => {
    const response = `
- Verification token: ${TOKEN_VALUE}
- Rules: code-quality, security, testing-standards
- Flags: Keep source code files under 700 lines. Documentation files have no line limit.
`;
    const result = checkAgentResponse(response, expected);
    expect(result.tokenMatch).toBe(true);
    expect(result.rulesFound).toEqual([
      "code-quality",
      "security",
      "testing-standards",
    ]);
    expect(result.flagsFound).toEqual([
      "Keep source code files under 700 lines. Documentation files have no line limit.",
    ]);
  });
});
