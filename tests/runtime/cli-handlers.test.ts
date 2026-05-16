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
} from "#src/runtime/cli-handlers.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { createEvent } from "#src/runtime/event-factory.js";
import type { Author } from "#src/runtime/types.js";
import { unwrap } from "./_brain-helper.js";

const human: Author = { type: "human", id: "tester" };

function bootstrapKnowledgeBase(dir: string): void {
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Project Context\n", "utf-8");
}

/**
 * Run a callback with an isolated brain.db scoped to the given dir. The
 * cli-handlers internally call BrainEventLog.open() with no path, picking up
 * CODI_BRAIN_DB so each test gets its own DB.
 */
function withBrain<T>(dir: string, cb: (log: BrainEventLog) => T): T {
  const log = BrainEventLog.open({ dbPath: join(dir, "brain.db") });
  try {
    return cb(log);
  } finally {
    log.dispose();
  }
}

describe("codi CLI handlers", () => {
  let tmpDir: string;
  let prevBrainDb: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-cli-test-"));
    bootstrapKnowledgeBase(tmpDir);
    prevBrainDb = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = join(tmpDir, "brain.db");
  });

  afterEach(() => {
    if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = prevBrainDb;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("knowledge base requirement", () => {
    it("blocks runWorkflow when docs/CONTEXT.md is missing", () => {
      const noKbDir = mkdtempSync(join(tmpdir(), "codi-no-kb-"));
      try {
        const r = runWorkflow({
          workflowType: "feature",
          task: "Test task",
          author: human,
          cwd: noKbDir,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors[0]?.code).toBe("E_KNOWLEDGE_BASE_MISSING");
      } finally {
        rmSync(noKbDir, { recursive: true, force: true });
      }
    });

    it("error message instructs invoking init-knowledge-base", () => {
      const noKbDir = mkdtempSync(join(tmpdir(), "codi-no-kb-"));
      try {
        const r = runWorkflow({
          workflowType: "feature",
          task: "Test",
          author: human,
          cwd: noKbDir,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors[0]?.message).toContain("init-knowledge-base");
      } finally {
        rmSync(noKbDir, { recursive: true, force: true });
      }
    });

    it("proceeds when docs/CONTEXT.md exists", () => {
      // tmpDir has CONTEXT.md from beforeEach
      const r = runWorkflow({
        workflowType: "feature",
        task: "Test",
        author: human,
        cwd: tmpDir,
      });
      expect(r.ok).toBe(true);
    });
  });

  describe("runWorkflow", () => {
    it("creates a workflow with init + phase_started", () => {
      const result = unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Add dark mode",
          author: human,
          cwd: tmpDir,
        }),
      );
      expect(result.workflowId).toMatch(/^feat-add-dark-mode-\d{8}$/);

      const status = getStatus({ cwd: tmpDir });
      expect(status.active).toBe(true);
      expect(status.state?.workflow_type).toBe("feature");
      expect(status.state?.current_phase).toBe("intent");
      expect(status.state?.events_count).toBe(2);
    });

    it("disambiguates duplicate IDs on the same day", () => {
      const r1 = unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Same task",
          author: human,
          cwd: tmpDir,
        }),
      );
      // Abandon to free the active slot
      unwrap(abandonWorkflow({ reason: "test", author: human, cwd: tmpDir }));
      const r2 = unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Same task",
          author: human,
          cwd: tmpDir,
        }),
      );
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
      unwrap(
        runWorkflow({
          workflowType: "bug-fix",
          task: "Fix login",
          author: human,
          cwd: tmpDir,
        }),
      );
      const status = getStatus({ cwd: tmpDir });
      expect(status.state?.workflow_type).toBe("bug-fix");
    });
  });

  describe("advanceWorkflow (O1 — single-command transition)", () => {
    it("derives next phase from adapter when no toPhase given", async () => {
      const { advanceWorkflow } = await import("#src/runtime/cli-handlers.js");
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "test advance",
          author: human,
          cwd: tmpDir,
        }),
      );
      const r = unwrap(advanceWorkflow({ author: human, cwd: tmpDir, autoApprove: true }));
      expect(r.fromPhase).toBe("intent");
      expect(r.toPhase).toBe("plan");
      expect(r.derivedFromAdaptation).toBe(false);
      expect(r.approvedEventId).not.toBeNull();
    });

    it("respects adaptation skip rules when computing next phase", async () => {
      const { advanceWorkflow } = await import("#src/runtime/cli-handlers.js");
      const { resolveBugFixAdaptation } = await import("#src/runtime/workflows/index.js");
      unwrap(
        runWorkflow({
          workflowType: "bug-fix",
          task: "skip reproduce",
          author: human,
          cwd: tmpDir,
          bugFixAdaptation: resolveBugFixAdaptation({ profile: "quick" }),
        }),
      );
      const r = unwrap(advanceWorkflow({ author: human, cwd: tmpDir, autoApprove: true }));
      expect(r.derivedFromAdaptation).toBe(true);
      expect(r.skippedPhases).toContain("reproduce");
      expect(r.toPhase).toBe("execute");
    });

    it("propose-only when autoApprove is false", async () => {
      const { advanceWorkflow } = await import("#src/runtime/cli-handlers.js");
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "propose only",
          author: human,
          cwd: tmpDir,
        }),
      );
      const r = unwrap(advanceWorkflow({ author: human, cwd: tmpDir, autoApprove: false }));
      expect(r.proposedEventId).toBeTruthy();
      expect(r.approvedEventId).toBeNull();
    });
  });

  describe("getSlimStatus enriquecido (O3)", () => {
    it("returns adaptation + skipped_phases + next_phase + progress", async () => {
      const { getSlimStatus } = await import("#src/runtime/cli-handlers.js");
      const { resolveFeatureAdaptation } = await import("#src/runtime/workflows/index.js");
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "enriched status",
          author: human,
          cwd: tmpDir,
          featureAdaptation: resolveFeatureAdaptation({ profile: "prototype" }),
        }),
      );
      const slim = getSlimStatus({ cwd: tmpDir });
      expect(slim.active).toBe(true);
      expect(slim.adaptation?.profile).toBe("prototype");
      expect(slim.skipped_phases).toContain("decompose");
      expect(slim.next_phase).toBe("plan");
      expect(slim.progress?.total).toBe(6);
      expect(slim.progress?.current).toBe(1);
    });

    it("returns null adaptation for runs without intake metadata", async () => {
      const { getSlimStatus } = await import("#src/runtime/cli-handlers.js");
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "no adaptation",
          author: human,
          cwd: tmpDir,
        }),
      );
      const slim = getSlimStatus({ cwd: tmpDir });
      expect(slim.adaptation).toBeNull();
      expect(slim.skipped_phases).toEqual([]);
      expect(slim.next_phase).toBe("plan");
    });
  });

  describe("convertWorkflow (O5 — cross-workflow conversion)", () => {
    it("abandons current + starts new with carryover", async () => {
      const { convertWorkflow } = await import("#src/runtime/cli-handlers.js");
      const prior = unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "looks like a feature",
          author: human,
          cwd: tmpDir,
        }),
      );
      const r = unwrap(
        convertWorkflow({
          toType: "bug-fix",
          task: "actually a bug",
          author: human,
          cwd: tmpDir,
          forward: {},
        }),
      );
      expect(r.abandonedWorkflowId).toBe(prior.workflowId);
      expect(r.newWorkflowId).toMatch(/^fix-/);
      expect(r.carryoverFrom).toBe(prior.workflowId);
      withBrain(tmpDir, (log) => {
        const events = log.loadEvents(r.newWorkflowId);
        const init = events.find((e) => e.event_type === "init");
        const payload = init?.payload as { carryover_context?: { type?: string } };
        expect(payload.carryover_context?.type).toBe("feature");
      });
    });
  });

  describe("getPhaseRef (O4 — active-adaptation header)", () => {
    it("returns phase-ref markdown with adaptation header for active workflow", async () => {
      const { getPhaseRef } = await import("#src/runtime/cli-handlers.js");
      const { resolveBugFixAdaptation } = await import("#src/runtime/workflows/index.js");
      unwrap(
        runWorkflow({
          workflowType: "bug-fix",
          task: "phase-ref test",
          author: human,
          cwd: tmpDir,
          bugFixAdaptation: resolveBugFixAdaptation({ profile: "deep" }),
        }),
      );
      // Tests run from the codi repo root, so the fallback to
      // src/templates/skills/<workflow>/references/ resolves cleanly.
      const r = unwrap(getPhaseRef({ cwd: process.cwd(), workflowCwd: tmpDir }));
      expect(r.workflowType).toBe("bug-fix");
      expect(r.phase).toBe("intent");
      expect(r.markdown).toContain("BEGIN active-adaptation");
      expect(r.markdown).toContain("Profile:** `deep`");
      expect(r.markdown).toContain("BEGIN auto-generated chain");
    });

    it("errors when no active workflow", async () => {
      const { getPhaseRef } = await import("#src/runtime/cli-handlers.js");
      const r = getPhaseRef({ cwd: tmpDir });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
    });
  });

  describe("runQuick (Q7 — trivial-edit audit trail)", () => {
    it("rejects an unknown category with a clear error", async () => {
      const { runQuick } = await import("#src/runtime/cli-handlers.js");
      const r = runQuick({
        task: "fix typo",
        category: "INVALID" as never,
        author: human,
        cwd: tmpDir,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_QUICK_CATEGORY_INVALID");
    });

    it("creates a workflow_run with type='quick' and category in init payload", async () => {
      const { runQuick } = await import("#src/runtime/cli-handlers.js");
      const r = unwrap(
        runQuick({
          task: "fix typo in README",
          category: "typo",
          author: human,
          cwd: tmpDir,
        }),
      );
      expect(r.workflowId).toMatch(/^quick-/);
      withBrain(tmpDir, (log) => {
        const events = log.loadEvents(r.workflowId);
        const init = events.find((e) => e.event_type === "init");
        expect(init).toBeTruthy();
        expect((init?.payload as { quick_category?: string }).quick_category).toBe("typo");
        expect((init?.payload as { workflow_type?: string }).workflow_type).toBe("quick");
      });
    });

    it("auto-completes by emitting workflow_completed", async () => {
      const { runQuick } = await import("#src/runtime/cli-handlers.js");
      const r = unwrap(
        runQuick({
          task: "bump dep",
          category: "dep-bump",
          author: human,
          cwd: tmpDir,
        }),
      );
      withBrain(tmpDir, (log) => {
        const events = log.loadEvents(r.workflowId);
        const completed = events.find((e) => e.event_type === "workflow_completed");
        expect(completed).toBeTruthy();
        expect(completed?.event_id).toBe(r.completedEventId);
      });
    });

    it("clears the active-workflow pointer so the next quick run is unblocked", async () => {
      const { runQuick, getSlimStatus } = await import("#src/runtime/cli-handlers.js");
      unwrap(
        runQuick({
          task: "first",
          category: "format",
          author: human,
          cwd: tmpDir,
        }),
      );
      const slim = getSlimStatus({ cwd: tmpDir });
      expect(slim.active).toBe(false);
      const r2 = unwrap(
        runQuick({
          task: "second",
          category: "comment",
          author: human,
          cwd: tmpDir,
        }),
      );
      expect(r2.workflowId).toMatch(/^quick-/);
    });

    it("accepts every category in QUICK_CATEGORIES", async () => {
      const { runQuick } = await import("#src/runtime/cli-handlers.js");
      const { QUICK_CATEGORIES } = await import("#src/runtime/types.js");
      for (const cat of QUICK_CATEGORIES) {
        const r = unwrap(
          runQuick({
            task: `task for ${cat}`,
            category: cat,
            author: human,
            cwd: tmpDir,
          }),
        );
        expect(r.workflowId).toMatch(/^quick-/);
      }
    });
  });

  describe("getSlimStatus (Q14 — agent session-start polling)", () => {
    it("returns all-null shape when no workflow exists", async () => {
      const { getSlimStatus } = await import("#src/runtime/cli-handlers.js");
      const slim = getSlimStatus({ cwd: tmpDir });
      expect(slim).toEqual({
        active: false,
        workflow_id: null,
        workflow_type: null,
        current_phase: null,
        status: null,
        task: null,
        adaptation: null,
        skipped_phases: [],
        next_phase: null,
        progress: null,
      });
    });

    it("returns slim shape with id/type/phase/task when active", async () => {
      const { getSlimStatus } = await import("#src/runtime/cli-handlers.js");
      unwrap(
        runWorkflow({
          workflowType: "bug-fix",
          task: "Fix login",
          author: human,
          cwd: tmpDir,
        }),
      );
      const slim = getSlimStatus({ cwd: tmpDir });
      expect(slim.active).toBe(true);
      expect(slim.workflow_type).toBe("bug-fix");
      expect(slim.current_phase).toBe("intent");
      expect(slim.task).toBe("Fix login");
      expect(slim.workflow_id).toMatch(/^[a-z0-9-]+$/);
      expect(slim.status).toBeTruthy();
    });

    it("slim payload is strictly smaller than full reduced state", async () => {
      const { getSlimStatus } = await import("#src/runtime/cli-handlers.js");
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Add dark mode",
          author: human,
          cwd: tmpDir,
        }),
      );
      const full = getStatus({ cwd: tmpDir });
      const slim = getSlimStatus({ cwd: tmpDir });
      const fullKeyCount = Object.keys(full.state ?? {}).length;
      const slimKeyCount = Object.keys(slim).length;
      expect(slimKeyCount).toBeLessThan(fullKeyCount);
      // O3 — slim shape includes adaptation summary, skipped_phases,
      // next_phase, and progress on top of the original 6 fields.
      expect(slimKeyCount).toBe(10);
    });
  });

  describe("transition lifecycle", () => {
    beforeEach(() => {
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Test feature",
          author: human,
          cwd: tmpDir,
        }),
      );
    });

    it("propose then approve advances phase", () => {
      const proposed = unwrap(proposeTransition({ toPhase: "plan", author: human, cwd: tmpDir }));
      expect(proposed.fromPhase).toBe("intent");
      expect(proposed.toPhase).toBe("plan");

      const approved = unwrap(approveTransition({ author: human, cwd: tmpDir }));
      expect(approved.fromPhase).toBe("intent");
      expect(approved.toPhase).toBe("plan");

      const status = getStatus({ cwd: tmpDir });
      expect(status.state?.current_phase).toBe("plan");
    });

    it("propose then reject keeps current phase", () => {
      unwrap(proposeTransition({ toPhase: "plan", author: human, cwd: tmpDir }));
      const rejected = unwrap(
        rejectTransition({
          reason: "Plan incomplete",
          author: human,
          cwd: tmpDir,
        }),
      );
      expect(rejected.fromPhase).toBe("intent");
      expect(rejected.rejectedToPhase).toBe("plan");

      const status = getStatus({ cwd: tmpDir });
      expect(status.state?.current_phase).toBe("intent");
    });

    it("rejects approve when no proposal pending", () => {
      const r = approveTransition({ author: human, cwd: tmpDir });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_PROPOSAL_NOT_PENDING");
    });

    it("rejects approve when last proposal already resolved", () => {
      unwrap(proposeTransition({ toPhase: "plan", author: human, cwd: tmpDir }));
      unwrap(approveTransition({ author: human, cwd: tmpDir }));
      const r = approveTransition({ author: human, cwd: tmpDir });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_PROPOSAL_NOT_PENDING");
    });

    it("rejects reject without reason", () => {
      unwrap(proposeTransition({ toPhase: "plan", author: human, cwd: tmpDir }));
      const r = rejectTransition({ reason: "", author: human, cwd: tmpDir });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_REASON_REQUIRED");
    });

    it("rejects propose to current phase", () => {
      const r = proposeTransition({ toPhase: "intent", author: human, cwd: tmpDir });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_WORKFLOW_ALREADY_IN_PHASE");
    });

    it("walks through full lifecycle: intent → plan → execute → verify → done", () => {
      const path = ["plan", "execute", "verify", "done"] as const;
      for (const phase of path) {
        unwrap(proposeTransition({ toPhase: phase, author: human, cwd: tmpDir }));
        unwrap(approveTransition({ author: human, cwd: tmpDir }));
      }
      const status = getStatus({ cwd: tmpDir });
      expect(status.state?.current_phase).toBe("done");
      expect(status.state?.phase_history.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("abandon", () => {
    it("marks workflow as abandoned and clears active ID", () => {
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Test",
          author: human,
          cwd: tmpDir,
        }),
      );
      const result = unwrap(
        abandonWorkflow({
          reason: "Out of scope",
          author: human,
          cwd: tmpDir,
        }),
      );
      expect(result.abandonedInPhase).toBe("intent");

      withBrain(tmpDir, (log) => {
        expect(log.getActiveWorkflowId()).toBeNull();
      });
    });

    it("rejects empty reason", () => {
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Test",
          author: human,
          cwd: tmpDir,
        }),
      );
      const r = abandonWorkflow({ reason: "", author: human, cwd: tmpDir });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_REASON_REQUIRED");
    });

    it("rejects when no active workflow", () => {
      const r = abandonWorkflow({ reason: "test", author: human, cwd: tmpDir });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_NO_ACTIVE_WORKFLOW");
    });

    it("rejects abandoning a completed workflow", () => {
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Test",
          author: human,
          cwd: tmpDir,
        }),
      );
      withBrain(tmpDir, (log) => {
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
      });
      const r = abandonWorkflow({ reason: "x", author: human, cwd: tmpDir });
      expect(r.ok).toBe(false);
    });
  });

  describe("recover", () => {
    it("returns no-op when active is already valid", () => {
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Test",
          author: human,
          cwd: tmpDir,
        }),
      );
      const result = unwrap(recoverWorkflow({ cwd: tmpDir }));
      expect(result.recovered).toBe(false);
      expect(result.workflowId).toBeTruthy();
    });

    it("recovers when active ID file is missing but archive has non-terminal workflow", () => {
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Test recover",
          author: human,
          cwd: tmpDir,
        }),
      );
      const wId = withBrain(tmpDir, (log) => {
        const id = log.getActiveWorkflowId();
        log.clearActiveWorkflowId();
        expect(log.getActiveWorkflowId()).toBeNull();
        return id;
      });

      const result = unwrap(recoverWorkflow({ cwd: tmpDir }));
      expect(result.recovered).toBe(true);
      expect(result.workflowId).toBe(wId);
      withBrain(tmpDir, (log) => {
        expect(log.getActiveWorkflowId()).toBe(wId);
      });
    });

    it("does not recover terminal workflows", () => {
      unwrap(
        runWorkflow({
          workflowType: "feature",
          task: "Done",
          author: human,
          cwd: tmpDir,
        }),
      );
      unwrap(abandonWorkflow({ reason: "test", author: human, cwd: tmpDir }));

      const result = unwrap(recoverWorkflow({ cwd: tmpDir }));
      expect(result.recovered).toBe(false);
    });

    it("returns no-op when no archives exist", () => {
      const result = unwrap(recoverWorkflow({ cwd: tmpDir }));
      expect(result.recovered).toBe(false);
      expect(result.workflowId).toBeNull();
    });
  });
});

describe("phase done auto-completion", () => {
  let tmpDir: string;
  let savedBrain: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-done-test-"));
    bootstrapKnowledgeBase(tmpDir);
    savedBrain = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = join(tmpDir, "brain.db");
  });

  afterEach(() => {
    if (savedBrain === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = savedBrain;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits workflow_completed when transitioning to done", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Test done",
        author: human,
        cwd: tmpDir,
      }),
    );
    for (const phase of ["plan", "execute", "verify", "done"] as const) {
      unwrap(proposeTransition({ toPhase: phase, author: human, cwd: tmpDir }));
      unwrap(approveTransition({ author: human, cwd: tmpDir }));
    }
    const status = getStatus({ cwd: tmpDir });
    expect(status.state?.current_phase).toBe("done");
    expect(status.state?.status).toBe("completed");
  });

  it("phase_history records done as completed (not in-progress)", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Test done history",
        author: human,
        cwd: tmpDir,
      }),
    );
    for (const phase of ["plan", "execute", "verify", "done"] as const) {
      unwrap(proposeTransition({ toPhase: phase, author: human, cwd: tmpDir }));
      unwrap(approveTransition({ author: human, cwd: tmpDir }));
    }
    const status = getStatus({ cwd: tmpDir });
    const doneRecord = status.state?.phase_history.find((p) => p.phase === "done");
    expect(doneRecord?.completed_at).toBeDefined();
  });

  it("phase_history does not duplicate the initial intent entry", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "no-dup",
        author: human,
        cwd: tmpDir,
      }),
    );
    const status = getStatus({ cwd: tmpDir });
    const intentEntries = status.state?.phase_history.filter((p) => p.phase === "intent");
    expect(intentEntries?.length).toBe(1);
  });
});

describe("runWorkflow — terminal-status pointer migration (BUG-OPEN-3)", () => {
  let tmpDir: string;
  let savedBrain: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-migrate-test-"));
    bootstrapKnowledgeBase(tmpDir);
    savedBrain = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = join(tmpDir, "brain.db");
  });

  afterEach(() => {
    if (savedBrain === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = savedBrain;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("auto-migrates a completed prior workflow when starting a new one", () => {
    // First workflow → drive to phase done.
    const first = unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "first feature",
        author: human,
        cwd: tmpDir,
      }),
    );
    for (const phase of ["plan", "execute", "verify", "done"] as const) {
      unwrap(proposeTransition({ toPhase: phase, author: human, cwd: tmpDir }));
      unwrap(approveTransition({ author: human, cwd: tmpDir }));
    }
    const firstStatus = getStatus({ cwd: tmpDir });
    expect(firstStatus.state?.status).toBe("completed");

    // Starting a NEW workflow used to throw WorkflowAlreadyActiveError.
    // After the fix, runWorkflow auto-migrates the stale terminal pointer.
    const second = unwrap(
      runWorkflow({
        workflowType: "bug-fix",
        task: "second bug fix",
        author: human,
        cwd: tmpDir,
      }),
    );
    expect(second.workflowId).not.toBe(first.workflowId);

    const secondStatus = getStatus({ cwd: tmpDir });
    expect(secondStatus.state?.workflow_id).toBe(second.workflowId);
    expect(secondStatus.state?.current_phase).toBe("intent");
  });

  it("auto-migrates a stale-pointer abandoned prior workflow", () => {
    // Drive a workflow to abandoned, then re-set the pointer (abandonWorkflow
    // clears it; we simulate a stale pointer that survives a manual mistake
    // or a future code path that skips the clear).
    const abandoned = unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "doomed",
        author: human,
        cwd: tmpDir,
      }),
    );
    unwrap(abandonWorkflow({ reason: "test abandon", author: human, cwd: tmpDir }));

    withBrain(tmpDir, (log) => {
      log.setActiveWorkflowId(abandoned.workflowId); // stale pointer
    });

    const next = unwrap(
      runWorkflow({
        workflowType: "refactor",
        task: "next refactor",
        author: human,
        cwd: tmpDir,
      }),
    );
    expect(next.workflowId).not.toBe(abandoned.workflowId);
    expect(getStatus({ cwd: tmpDir }).state?.current_phase).toBe("intent");
  });

  it("still blocks when prior workflow is active (non-terminal)", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "in-flight",
        author: human,
        cwd: tmpDir,
      }),
    );
    // Don't transition — leave it active in phase intent.
    // The blocker still throws (BrainWorkflowAlreadyActiveError from the
    // brain-event-log layer, KEEP-scope of CORE-017), so runWorkflow
    // catches and surfaces it as E_GENERAL with the original message.
    const r = runWorkflow({
      workflowType: "bug-fix",
      task: "should not start",
      author: human,
      cwd: tmpDir,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.message).toMatch(/already active/);
  });
});
