import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContext, evaluatePostToolCall, type PostToolCall } from "#src/runtime/hook-logic.js";
import {
  runWorkflow,
  proposeTransition,
  approveTransition,
  proposeScopeExpansion,
  approveScopeExpansion,
} from "#src/runtime/cli-handlers.js";
import type { Author } from "#src/runtime/types.js";

const human: Author = { type: "human", id: "tester" };
const agent: Author = { type: "agent", id: "claude-code" };

function setupExecute(): string {
  const dir = mkdtempSync(join(tmpdir(), "devloop-post-"));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Context\n", "utf-8");
  runWorkflow({
    workflowType: "feature",
    task: "Test",
    author: human,
    cwd: dir,
  });
  for (const phase of ["plan", "decompose", "execute"] as const) {
    proposeTransition({ toPhase: phase, author: human, cwd: dir });
    approveTransition({ author: human, cwd: dir });
  }
  return dir;
}

describe("evaluatePostToolCall", () => {
  let dir: string;

  beforeEach(() => {
    dir = setupExecute();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not record when no active workflow", () => {
    const noWf = mkdtempSync(join(tmpdir(), "devloop-no-wf-"));
    try {
      const ctx = buildContext(noWf);
      const call: PostToolCall = {
        tool_name: "Edit",
        tool_input: { file_path: "src/x.ts" },
      };
      const result = evaluatePostToolCall(call, ctx, "x");
      expect(result.recorded).toBe(false);
    } finally {
      rmSync(noWf, { recursive: true, force: true });
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
