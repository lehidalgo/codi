import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildContext, evaluatePostToolCall, type PostToolCall } from "#src/runtime/hook-logic.js";
import {
  runWorkflow,
  proposeTransition,
  approveTransition,
  proposeScopeExpansion,
  approveScopeExpansion,
} from "#src/runtime/cli-handlers.js";
import type { Author } from "#src/runtime/types.js";
import { createIsolatedBrain, type IsolatedBrain } from "./_brain-helper.js";

const human: Author = { type: "human", id: "tester" };
const agent: Author = { type: "agent", id: "claude-code" };

function setupExecute(): { scope: IsolatedBrain; dir: string } {
  const scope = createIsolatedBrain("codi-post-");
  runWorkflow({
    workflowType: "feature",
    task: "Test",
    author: human,
    cwd: scope.dir,
  });
  for (const phase of ["plan", "decompose", "execute"] as const) {
    proposeTransition({ toPhase: phase, author: human, cwd: scope.dir });
    approveTransition({ author: human, cwd: scope.dir });
  }
  return { scope, dir: scope.dir };
}

describe("evaluatePostToolCall", () => {
  let scope: IsolatedBrain;
  let dir: string;

  beforeEach(() => {
    ({ scope, dir } = setupExecute());
  });

  afterEach(() => {
    scope.dispose();
  });

  it("does not record when no active workflow", () => {
    // Empty brain → no active workflow.
    const empty = createIsolatedBrain("codi-no-wf-");
    try {
      const ctx = buildContext(empty.dir);
      const call: PostToolCall = {
        tool_name: "Edit",
        tool_input: { file_path: "src/x.ts" },
      };
      const result = evaluatePostToolCall(call, ctx, "x");
      expect(result.recorded).toBe(false);
    } finally {
      empty.dispose();
    }
  });

  it("does not record for non-edit tools", () => {
    const ctx = buildContext(dir);
    const call: PostToolCall = {
      tool_name: "Bash",
      tool_input: { command: "ls" },
    };
    const result = evaluatePostToolCall(call, ctx, "");
    expect(result.recorded).toBe(false);
  });

  it("does not record for in-scope files", () => {
    proposeScopeExpansion({
      filePath: "src/in.ts",
      reason: "x",
      author: agent,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });

    const ctx = buildContext(dir);
    const call: PostToolCall = {
      tool_name: "Edit",
      tool_input: {
        file_path: "src/in.ts",
        old_string: "x",
        new_string: "y",
      },
    };
    const result = evaluatePostToolCall(call, ctx, "y");
    expect(result.recorded).toBe(false);
  });

  it("records for incidental change to file outside scope", () => {
    const ctx = buildContext(dir);
    const call: PostToolCall = {
      tool_name: "Write",
      tool_input: {
        file_path: "src/utils.ts",
        content: 'import { x } from "./x";',
      },
    };
    const result = evaluatePostToolCall(call, ctx, 'import { x } from "./x";');
    expect(result.recorded).toBe(true);
    expect(result.details?.file_path).toBe("src/utils.ts");
  });

  it("does not record for scope-expansion verdicts (pre-tool-use should have blocked)", () => {
    const ctx = buildContext(dir);
    const call: PostToolCall = {
      tool_name: "Write",
      tool_input: {
        file_path: "src/feature.ts",
        content:
          "export function newFn() { return 1; }\nexport function newOther() { return 2; }\nexport function newThird() {}\nexport function newFourth() {}\nexport function newFifth() {}",
      },
    };
    const result = evaluatePostToolCall(
      call,
      ctx,
      "export function newFn() { return 1; }\nexport function newOther() { return 2; }\nexport function newThird() {}\nexport function newFourth() {}\nexport function newFifth() {}",
    );
    expect(result.recorded).toBe(false);
  });
});
