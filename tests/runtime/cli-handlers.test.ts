import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runWorkflow,
  getStatus,
  proposeTransition,
  approveTransition,
  rejectTransition,
  abandonWorkflow,
  recoverWorkflow,
  KnowledgeBaseMissingError,
} from "../lib/cli-handlers.js";
import { EventLog } from "../lib/event-log.js";
import { createEvent } from "../lib/event-factory.js";
import type { Author } from "../lib/types.js";

const human: Author = { type: "human", id: "tester" };

function bootstrapKnowledgeBase(dir: string): void {
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Project Context\n", "utf-8");
}

describe("devloop CLI handlers", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "devloop-cli-test-"));
    bootstrapKnowledgeBase(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("knowledge base requirement", () => {
    it("blocks runWorkflow when docs/CONTEXT.md is missing", () => {
      const noKbDir = mkdtempSync(join(tmpdir(), "devloop-no-kb-"));
      try {
        expect(() =>
          runWorkflow({
            workflowType: "feature",
            task: "Test task",
            author: human,
            cwd: noKbDir,
          }),
        ).toThrow(KnowledgeBaseMissingError);
      } finally {
        rmSync(noKbDir, { recursive: true, force: true });
      }
    });

    it("error message instructs invoking init-knowledge-base", () => {
      const noKbDir = mkdtempSync(join(tmpdir(), "devloop-no-kb-"));
      try {
        try {
          runWorkflow({
            workflowType: "feature",
            task: "Test",
            author: human,
            cwd: noKbDir,
          });
        } catch (err) {
          expect((err as Error).message).toContain("init-knowledge-base");
          return;
        }
        throw new Error("expected throw");
      } finally {
        rmSync(noKbDir, { recursive: true, force: true });
      }
    });

    it("proceeds when docs/CONTEXT.md exists", () => {
      // tmpDir has CONTEXT.md from beforeEach
      expect(() =>
        runWorkflow({
          workflowType: "feature",
          task: "Test",
          author: human,
          cwd: tmpDir,
        }),
      ).not.toThrow();
    });
  });

  describe("runWorkflow", () => {
    it("creates a workflow with init + phase_started", () => {
      const result = runWorkflow({
        workflowType: "feature",
        task: "Add dark mode",
        author: human,
        cwd: tmpDir,
      });
      expect(result.workflowId).toMatch(/^feat-add-dark-mode-\d{8}$/);

      const status = getStatus({ cwd: tmpDir });
      expect(status.active).toBe(true);
      expect(status.state?.workflow_type).toBe("feature");
      expect(status.state?.current_phase).toBe("intent");
      expect(status.state?.events_count).toBe(2);
    });

    it("disambiguates duplicate IDs on the same day", () => {
      const r1 = runWorkflow({
        workflowType: "feature",
        task: "Same task",
        author: human,
        cwd: tmpDir,
      });
      // Abandon to free the active slot
      abandonWorkflow({ reason: "test", author: human, cwd: tmpDir });
      const r2 = runWorkflow({
        workflowType: "feature",
        task: "Same task",
        author: human,
        cwd: tmpDir,
      });
      expect(r1.workflowId).not.toBe(r2.workflowId);
      expect(r2.workflowId).toMatch(/-2$/);
    });
  });

  describe("getStatus", () => {
    it("returns inactive when no workflow exists", () => {
      const status = getStatus({ cwd: tmpDir });
      expect(status.active).toBe(false);
      expect(status.state).toBeNull();
    });

    it("returns reduced state when active", () => {
      runWorkflow({
        workflowType: "bug-fix",
        task: "Fix login",
        author: human,
        cwd: tmpDir,
      });
      const status = getStatus({ cwd: tmpDir });
      expect(status.state?.workflow_type).toBe("bug-fix");
    });
  });

  describe("transition lifecycle", () => {
    beforeEach(() => {
      runWorkflow({
        workflowType: "feature",
        task: "Test feature",
        author: human,
        cwd: tmpDir,
      });
    });

    it("propose then approve advances phase", () => {
      const proposed = proposeTransition({ toPhase: "plan", author: human, cwd: tmpDir });
      expect(proposed.fromPhase).toBe("intent");
      expect(proposed.toPhase).toBe("plan");

      const approved = approveTransition({ author: human, cwd: tmpDir });
      expect(approved.fromPhase).toBe("intent");
      expect(approved.toPhase).toBe("plan");

      const status = getStatus({ cwd: tmpDir });
      expect(status.state?.current_phase).toBe("plan");
    });

    it("propose then reject keeps current phase", () => {
      proposeTransition({ toPhase: "plan", author: human, cwd: tmpDir });
      const rejected = rejectTransition({
        reason: "Plan incomplete",
        author: human,
        cwd: tmpDir,
      });
      expect(rejected.fromPhase).toBe("intent");
      expect(rejected.rejectedToPhase).toBe("plan");

      const status = getStatus({ cwd: tmpDir });
      expect(status.state?.current_phase).toBe("intent");
    });

    it("rejects approve when no proposal pending", () => {
      expect(() => approveTransition({ author: human, cwd: tmpDir })).toThrow(
        "No pending transition proposal",
      );
    });

    it("rejects approve when last proposal already resolved", () => {
      proposeTransition({ toPhase: "plan", author: human, cwd: tmpDir });
      approveTransition({ author: human, cwd: tmpDir });
      expect(() => approveTransition({ author: human, cwd: tmpDir })).toThrow(
        "No pending transition proposal",
      );
    });

    it("rejects reject without reason", () => {
      proposeTransition({ toPhase: "plan", author: human, cwd: tmpDir });
      expect(() => rejectTransition({ reason: "", author: human, cwd: tmpDir })).toThrow(
        "Reject requires",
      );
    });

    it("rejects propose to current phase", () => {
      expect(() => proposeTransition({ toPhase: "intent", author: human, cwd: tmpDir })).toThrow(
        "Already in phase",
      );
    });

    it("walks through full lifecycle: intent → plan → execute → verify → done", () => {
      const path = ["plan", "execute", "verify", "done"] as const;
      for (const phase of path) {
        proposeTransition({ toPhase: phase, author: human, cwd: tmpDir });
        approveTransition({ author: human, cwd: tmpDir });
      }
      const status = getStatus({ cwd: tmpDir });
      expect(status.state?.current_phase).toBe("done");
      expect(status.state?.phase_history.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("abandon", () => {
    it("marks workflow as abandoned and clears active ID", () => {
      runWorkflow({
        workflowType: "feature",
        task: "Test",
        author: human,
        cwd: tmpDir,
      });
      const result = abandonWorkflow({
        reason: "Out of scope",
        author: human,
        cwd: tmpDir,
      });
      expect(result.abandonedInPhase).toBe("intent");

      const log = EventLog.fromCwd(tmpDir);
      expect(log.getActiveWorkflowId()).toBeNull();
    });

    it("rejects empty reason", () => {
      runWorkflow({
        workflowType: "feature",
        task: "Test",
        author: human,
        cwd: tmpDir,
      });
      expect(() => abandonWorkflow({ reason: "", author: human, cwd: tmpDir })).toThrow(
        "Abandon requires",
      );
    });

    it("rejects when no active workflow", () => {
      expect(() => abandonWorkflow({ reason: "test", author: human, cwd: tmpDir })).toThrow();
    });

    it("rejects abandoning a completed workflow", () => {
      runWorkflow({
        workflowType: "feature",
        task: "Test",
        author: human,
        cwd: tmpDir,
      });
      const log = EventLog.fromCwd(tmpDir);
      const wId = log.getActiveWorkflowId();
      if (!wId) throw new Error("expected active workflow");
      log.append(
        wId,
        createEvent({
          eventType: "workflow_completed",
          payload: { duration_ms: 1000 },
          author: human,
          parentEventId: null,
        }),
      );
      expect(() => abandonWorkflow({ reason: "x", author: human, cwd: tmpDir })).toThrow();
    });
  });

  describe("recover", () => {
    it("returns no-op when active is already valid", () => {
      runWorkflow({
        workflowType: "feature",
        task: "Test",
        author: human,
        cwd: tmpDir,
      });
      const result = recoverWorkflow({ cwd: tmpDir });
      expect(result.recovered).toBe(false);
      expect(result.workflowId).toBeTruthy();
    });

    it("recovers when active ID file is missing but archive has non-terminal workflow", () => {
      runWorkflow({
        workflowType: "feature",
        task: "Test recover",
        author: human,
        cwd: tmpDir,
      });
      const log = EventLog.fromCwd(tmpDir);
      const wId = log.getActiveWorkflowId();
      log.clearActiveWorkflowId();
      expect(log.getActiveWorkflowId()).toBeNull();

      const result = recoverWorkflow({ cwd: tmpDir });
      expect(result.recovered).toBe(true);
      expect(result.workflowId).toBe(wId);
      expect(log.getActiveWorkflowId()).toBe(wId);
    });

    it("does not recover terminal workflows", () => {
      runWorkflow({
        workflowType: "feature",
        task: "Done",
        author: human,
        cwd: tmpDir,
      });
      abandonWorkflow({ reason: "test", author: human, cwd: tmpDir });

      const result = recoverWorkflow({ cwd: tmpDir });
      expect(result.recovered).toBe(false);
    });

    it("returns no-op when no archives exist", () => {
      const result = recoverWorkflow({ cwd: tmpDir });
      expect(result.recovered).toBe(false);
      expect(result.workflowId).toBeNull();
    });
  });
});

describe("phase done auto-completion", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "devloop-done-test-"));
    bootstrapKnowledgeBase(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits workflow_completed when transitioning to done", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Test done",
      author: human,
      cwd: tmpDir,
    });
    for (const phase of ["plan", "execute", "verify", "done"] as const) {
      proposeTransition({ toPhase: phase, author: human, cwd: tmpDir });
      approveTransition({ author: human, cwd: tmpDir });
    }
    const status = getStatus({ cwd: tmpDir });
    expect(status.state?.current_phase).toBe("done");
    expect(status.state?.status).toBe("completed");
  });

  it("phase_history records done as completed (not in-progress)", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Test done history",
      author: human,
      cwd: tmpDir,
    });
    for (const phase of ["plan", "execute", "verify", "done"] as const) {
      proposeTransition({ toPhase: phase, author: human, cwd: tmpDir });
      approveTransition({ author: human, cwd: tmpDir });
    }
    const status = getStatus({ cwd: tmpDir });
    const doneRecord = status.state?.phase_history.find((p) => p.phase === "done");
    expect(doneRecord?.completed_at).toBeDefined();
  });

  it("phase_history does not duplicate the initial intent entry", () => {
    runWorkflow({
      workflowType: "feature",
      task: "no-dup",
      author: human,
      cwd: tmpDir,
    });
    const status = getStatus({ cwd: tmpDir });
    const intentEntries = status.state?.phase_history.filter((p) => p.phase === "intent");
    expect(intentEntries?.length).toBe(1);
  });
});

describe("runWorkflow — terminal-status pointer migration (BUG-OPEN-3)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "devloop-migrate-test-"));
    bootstrapKnowledgeBase(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("auto-migrates a completed prior workflow when starting a new one", () => {
    // First workflow → drive to phase done.
    const first = runWorkflow({
      workflowType: "feature",
      task: "first feature",
      author: human,
      cwd: tmpDir,
    });
    for (const phase of ["plan", "execute", "verify", "done"] as const) {
      proposeTransition({ toPhase: phase, author: human, cwd: tmpDir });
      approveTransition({ author: human, cwd: tmpDir });
    }
    const firstStatus = getStatus({ cwd: tmpDir });
    expect(firstStatus.state?.status).toBe("completed");

    // Starting a NEW workflow used to throw WorkflowAlreadyActiveError.
    // After the fix, runWorkflow auto-migrates the stale terminal pointer.
    const second = runWorkflow({
      workflowType: "bug-fix",
      task: "second bug fix",
      author: human,
      cwd: tmpDir,
    });
    expect(second.workflowId).not.toBe(first.workflowId);

    const secondStatus = getStatus({ cwd: tmpDir });
    expect(secondStatus.state?.workflow_id).toBe(second.workflowId);
    expect(secondStatus.state?.current_phase).toBe("intent");
  });

  it("auto-migrates a stale-pointer abandoned prior workflow", () => {
    // Drive a workflow to abandoned, then re-set the pointer (abandonWorkflow
    // clears it; we simulate a stale pointer that survives a manual mistake
    // or a future code path that skips the clear).
    const abandoned = runWorkflow({
      workflowType: "feature",
      task: "doomed",
      author: human,
      cwd: tmpDir,
    });
    abandonWorkflow({ reason: "test abandon", author: human, cwd: tmpDir });

    const log = EventLog.fromCwd(tmpDir);
    log.setActiveWorkflowId(abandoned.workflowId); // stale pointer

    const next = runWorkflow({
      workflowType: "refactor",
      task: "next refactor",
      author: human,
      cwd: tmpDir,
    });
    expect(next.workflowId).not.toBe(abandoned.workflowId);
    expect(getStatus({ cwd: tmpDir }).state?.current_phase).toBe("intent");
  });

  it("still blocks when prior workflow is active (non-terminal)", () => {
    runWorkflow({
      workflowType: "feature",
      task: "in-flight",
      author: human,
      cwd: tmpDir,
    });
    // Don't transition — leave it active in phase intent.
    expect(() =>
      runWorkflow({
        workflowType: "bug-fix",
        task: "should not start",
        author: human,
        cwd: tmpDir,
      }),
    ).toThrow(/already active/);
  });
});
