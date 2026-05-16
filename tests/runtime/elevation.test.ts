import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  runWorkflow,
  proposeElevation,
  approveElevation,
  rejectElevation,
  resolveChild,
  getStatus,
} from "#src/runtime/cli-handlers.js";
import type { Author } from "#src/runtime/types.js";
import { createIsolatedBrain, unwrap, type IsolatedBrain } from "./_brain-helper.js";

const human: Author = { type: "human", id: "tester" };
const agent: Author = { type: "agent", id: "claude-code" };

describe("elevation handlers", () => {
  let scope: IsolatedBrain;
  let dir: string;

  beforeEach(() => {
    scope = createIsolatedBrain("codi-elevation-");
    dir = scope.dir;
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Test",
        author: human,
        cwd: dir,
      }),
    );
  });

  afterEach(() => {
    scope.dispose();
  });

  it("proposes an elevation", () => {
    const result = unwrap(
      proposeElevation({
        childWorkflowType: "refactor",
        trigger: "public_interface_change_in_multiple_files",
        reason: "decoupling needed",
        author: agent,
        cwd: dir,
      }),
    );
    expect(result.proposedEventId).toBeTruthy();
  });

  it("rejects empty reason", () => {
    const r = proposeElevation({
      childWorkflowType: "refactor",
      trigger: "x",
      reason: "",
      author: agent,
      cwd: dir,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_REASON_REQUIRED");
  });

  it("approves elevation, pauses parent, creates child reference", () => {
    unwrap(
      proposeElevation({
        childWorkflowType: "refactor",
        trigger: "public_interface_change",
        reason: "decoupling",
        author: agent,
        cwd: dir,
      }),
    );
    const result = unwrap(approveElevation({ author: human, cwd: dir }));
    expect(result.childWorkflowId).toContain("child-refactor");
    expect(result.childBranch).toMatch(/^codi\//);

    const status = getStatus({ cwd: dir });
    expect(status.state?.status).toBe("paused");
    expect(status.state?.paused_for_child_id).toBe(result.childWorkflowId);
    expect(status.state?.child_workflows).toHaveLength(1);
    expect(status.state?.child_workflows[0]?.type).toBe("refactor");
  });

  it("rejects elevation without proposal", () => {
    const r = approveElevation({ author: human, cwd: dir });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_PROPOSAL_NOT_PENDING");
  });

  it("rejected elevation does not pause parent", () => {
    unwrap(
      proposeElevation({
        childWorkflowType: "refactor",
        trigger: "x",
        reason: "x",
        author: agent,
        cwd: dir,
      }),
    );
    unwrap(rejectElevation({ reason: "too risky", author: human, cwd: dir }));

    const status = getStatus({ cwd: dir });
    expect(status.state?.status).toBe("active");
  });

  it("resolveChild forces parent back to phase plan", () => {
    unwrap(
      proposeElevation({
        childWorkflowType: "refactor",
        trigger: "x",
        reason: "x",
        author: agent,
        cwd: dir,
      }),
    );
    const elevated = unwrap(approveElevation({ author: human, cwd: dir }));
    const result = unwrap(
      resolveChild({
        childWorkflowId: elevated.childWorkflowId,
        status: "completed",
        summary: "decoupled",
        author: human,
        cwd: dir,
      }),
    );
    expect(result.resumedInPhase).toBe("plan");

    const status = getStatus({ cwd: dir });
    expect(status.state?.status).toBe("active");
    expect(status.state?.current_phase).toBe("plan");
    expect(status.state?.paused_for_child_id).toBeNull();
    expect(status.state?.child_workflows[0]?.status).toBe("completed");
  });

  it("resolveChild handles abandoned status", () => {
    unwrap(
      proposeElevation({
        childWorkflowType: "refactor",
        trigger: "x",
        reason: "x",
        author: agent,
        cwd: dir,
      }),
    );
    const elevated = unwrap(approveElevation({ author: human, cwd: dir }));
    unwrap(
      resolveChild({
        childWorkflowId: elevated.childWorkflowId,
        status: "abandoned",
        author: human,
        cwd: dir,
      }),
    );
    const status = getStatus({ cwd: dir });
    expect(status.state?.child_workflows[0]?.status).toBe("abandoned");
  });
});
