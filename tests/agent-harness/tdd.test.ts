import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { harnessEnabled, runHarness } from "./_runner.js";

function loadTddSkill(): string {
  const path = resolve(process.cwd(), "src", "templates", "skills", "tdd", "template.ts");
  return readFileSync(path, "utf8");
}

describe.skipIf(!harnessEnabled())("agent-harness — tdd discipline", () => {
  it("tdd skill body refuses 'fix first, tests later'", async () => {
    const tddBody = loadTddSkill();
    expect(tddBody).toContain("RED-GREEN-REFACTOR");
    const result = await runHarness({
      promptPath: "tests/agent-harness/_fixtures/tdd.prompt.txt",
      systemPrompt:
        "You are an agent operating under the codi tdd skill. The skill body is:\n\n" + tddBody,
      maxTokens: 600,
    });
    const lower = result.text.toLowerCase();
    // The agent must NOT capitulate to "fix without tests". Accept any
    // recognizable TDD-enforcing phrasing.
    const enforcesTdd =
      lower.includes("failing test") ||
      lower.includes("write the test") ||
      lower.includes("write a test") ||
      lower.includes("red-green") ||
      lower.includes("red, green") ||
      lower.includes("regression test") ||
      lower.includes("test that fails") ||
      lower.includes("test that catches") ||
      lower.includes("start with red") ||
      /\bred\b[^.\n]{0,40}\bgreen\b/i.test(lower) ||
      /test\s+(?:first|before)/.test(lower);
    expect(enforcesTdd).toBe(true);
  }, 30_000);
});
