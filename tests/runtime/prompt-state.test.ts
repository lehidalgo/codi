import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildContext, buildPromptStateBlock } from "#src/runtime/hook-logic.js";
import {
  runWorkflow,
  proposeScopeExpansion,
  proposeTransition,
  approveScopeExpansion,
} from "#src/runtime/cli-handlers.js";
import type { Author } from "#src/runtime/types.js";
import { createIsolatedBrain, type IsolatedBrain } from "./_brain-helper.js";

const human: Author = { type: "human", id: "tester" };
const agent: Author = { type: "agent", id: "claude-code" };

describe("buildPromptStateBlock", () => {
  let scope: IsolatedBrain;
  let dir: string;

  beforeEach(() => {
    scope = createIsolatedBrain("codi-prompt-");
    dir = scope.dir;
  });

  afterEach(() => {
    scope.dispose();
  });

  it("returns empty string when no active workflow", () => {
    const ctx = buildContext(dir);
    expect(buildPromptStateBlock(ctx)).toBe("");
  });

  it("emits workflow-state block when active", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Test prompt block",
      author: human,
      cwd: dir,
    });
    const ctx = buildContext(dir);
    const block = buildPromptStateBlock(ctx);
    expect(block).toContain("<workflow-state>");
    expect(block).toContain("</workflow-state>");
    expect(block).toContain("Test prompt block");
    expect(block).toContain("Current phase: intent");
    expect(block).toContain("Files in plan: (none yet)");
  });

  it("notes pending scope expansion proposals", () => {
    runWorkflow({
      workflowType: "feature",
      task: "X",
      author: human,
      cwd: dir,
    });
    proposeScopeExpansion({
      filePath: "src/a.ts",
      reason: "a",
      author: agent,
      cwd: dir,
    });
    proposeScopeExpansion({
      filePath: "src/b.ts",
      reason: "b",
      author: agent,
      cwd: dir,
    });
    const ctx = buildContext(dir);
    const block = buildPromptStateBlock(ctx);
    expect(block).toContain("Pending scope expansion proposals: 2");
  });

  it("notes pending transition awaiting approval", () => {
    runWorkflow({
      workflowType: "feature",
      task: "X",
      author: human,
      cwd: dir,
    });
    proposeTransition({ toPhase: "plan", author: agent, cwd: dir });
    const ctx = buildContext(dir);
    const block = buildPromptStateBlock(ctx);
    expect(block).toContain("Pending transition: intent → plan");
  });

  it("includes files_in_plan after approval", () => {
    runWorkflow({
      workflowType: "feature",
      task: "X",
      author: human,
      cwd: dir,
    });
    proposeScopeExpansion({
      filePath: "src/a.ts",
      reason: "a",
      author: agent,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });
    const ctx = buildContext(dir);
    const block = buildPromptStateBlock(ctx);
    expect(block).toContain("Files in plan: src/a.ts");
  });

  it("instructions block reminds about phase rules and scope hook", () => {
    runWorkflow({
      workflowType: "feature",
      task: "X",
      author: human,
      cwd: dir,
    });
    const ctx = buildContext(dir);
    const block = buildPromptStateBlock(ctx);
    expect(block).toContain("Phase transitions require explicit human approval");
    expect(block).toContain("propose-expansion");
  });
});
