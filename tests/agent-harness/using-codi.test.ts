import { describe, it, expect } from "vitest";
import { harnessEnabled, loadUsingCodiAnchor, runHarness } from "./_runner.js";

describe.skipIf(!harnessEnabled())("agent-harness — using-codi anchor", () => {
  it("anchor system prompt steers the agent away from ad-hoc edits", async () => {
    const anchor = loadUsingCodiAnchor();
    expect(anchor.length).toBeGreaterThan(200); // anchor loaded
    const result = await runHarness({
      promptPath: "tests/agent-harness/_fixtures/using-codi.prompt.txt",
      systemPrompt: anchor,
      maxTokens: 600,
    });
    // The anchor must STEER the model toward proposing a workflow before
    // diving into code. Accept any of: explicit workflow command, mention
    // of `codi workflow run`, or refusal to start without a workflow.
    const lower = result.text.toLowerCase();
    const proposesWorkflow =
      /codi\s+workflow\s+run/.test(result.text) ||
      lower.includes("workflow run feature") ||
      lower.includes("codi quick") ||
      lower.includes("workflow run quick");
    expect(proposesWorkflow).toBe(true);
  }, 30_000);

  it("anchor does not produce implementation code before establishing a workflow", async () => {
    const anchor = loadUsingCodiAnchor();
    const result = await runHarness({
      promptPath: "tests/agent-harness/_fixtures/using-codi.prompt.txt",
      systemPrompt: anchor,
      maxTokens: 600,
    });
    // A fenced block that CONTAINS the codi command is the workflow proposal —
    // not "code before the workflow". The real violation is an implementation
    // snippet (any non-codi code) shown before the model proposes a workflow.
    const firstWorkflowMention = result.text.toLowerCase().search(/codi\s+(workflow|quick)/);
    const fences = [...result.text.matchAll(/```/g)];
    for (let i = 0; i < fences.length - 1; i += 2) {
      const open = fences[i]?.index;
      const close = fences[i + 1]?.index;
      if (open === undefined || close === undefined) break;
      const blockBody = result.text.slice(open, close + 3).toLowerCase();
      const isCodiBlock = /codi\s+(workflow|quick)/.test(blockBody);
      if (!isCodiBlock) {
        if (firstWorkflowMention !== -1) {
          expect(firstWorkflowMention).toBeLessThan(open);
        }
        break;
      }
    }
  }, 30_000);
});
