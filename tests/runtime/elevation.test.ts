import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runWorkflow,
  proposeElevation,
  approveElevation,
  rejectElevation,
  resolveChild,
  getStatus,
} from "../lib/cli-handlers.js";
import type { Author } from "../lib/types.js";

const human: Author = { type: "human", id: "tester" };
const agent: Author = { type: "agent", id: "claude-code" };

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), "devloop-elevation-"));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Context\n", "utf-8");
  runWorkflow({
    workflowType: "feature",
    task: "Test",
    author: human,
    cwd: dir,
  });
  return dir;
}

describe("elevation handlers", () => {
  let dir: string;

  beforeEach(() => {
    dir = setup();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("proposes an elevation", () => {
    const result = proposeElevation({
      childWorkflowType: "refactor",
      trigger: "public_interface_change_in_multiple_files",
      reason: "decoupling needed",
      author: agent,
      cwd: dir,
    });
    expect(result.proposedEventId).toBeTruthy();
  });

  it("rejects empty reason", () => {
    expect(() =>
      proposeElevation({
        childWorkflowType: "refactor",
        trigger: "x",
        reason: "",
        author: agent,
        cwd: dir,
      }),
    ).toThrow("requires --reason");
  });

  it("approves elevation, pauses parent, creates child reference", () => {
    proposeElevation({
      childWorkflowType: "refactor",
      trigger: "public_interface_change",
      reason: "decoupling",
      author: agent,
      cwd: dir,
    });
    const result = approveElevation({ author: human, cwd: dir });
    expect(result.childWorkflowId).toContain("child-refactor");
    expect(result.childBranch).toMatch(/^devloop\//);

    const status = getStatus({ cwd: dir });
    expect(status.state?.status).toBe("paused");
    expect(status.state?.paused_for_child_id).toBe(result.childWorkflowId);
    expect(status.state?.child_workflows).toHaveLength(1);
    expect(status.state?.child_workflows[0]?.type).toBe("refactor");
  });

  it("rejects elevation without proposal", () => {
    expect(() => approveElevation({ author: human, cwd: dir })).toThrow(
      "No pending elevation proposal",
    );
  });

  it("rejected elevation does not pause parent", () => {
    proposeElevation({
      childWorkflowType: "refactor",
      trigger: "x",
      reason: "x",
      author: agent,
      cwd: dir,
    });
    rejectElevation({ reason: "too risky", author: human, cwd: dir });

    const status = getStatus({ cwd: dir });
    expect(status.state?.status).toBe("active");
  });

  it("resolveChild forces parent back to phase plan", () => {
    proposeElevation({
      childWorkflowType: "refactor",
      trigger: "x",
      reason: "x",
      author: agent,
      cwd: dir,
    });
    const elevated = approveElevation({ author: human, cwd: dir });
    const result = resolveChild({
      childWorkflowId: elevated.childWorkflowId,
      status: "completed",
      summary: "decoupled",
      author: human,
      cwd: dir,
    });
    expect(result.resumedInPhase).toBe("plan");

    const status = getStatus({ cwd: dir });
    expect(status.state?.status).toBe("active");
    expect(status.state?.current_phase).toBe("plan");
    expect(status.state?.paused_for_child_id).toBeNull();
    expect(status.state?.child_workflows[0]?.status).toBe("completed");
  });

  it("resolveChild handles abandoned status", () => {
    proposeElevation({
      childWorkflowType: "refactor",
      trigger: "x",
      reason: "x",
      author: agent,
      cwd: dir,
    });
    const elevated = approveElevation({ author: human, cwd: dir });
    resolveChild({
      childWorkflowId: elevated.childWorkflowId,
      status: "abandoned",
      author: human,
      cwd: dir,
    });
    const status = getStatus({ cwd: dir });
    expect(status.state?.child_workflows[0]?.status).toBe("abandoned");
  });
});
