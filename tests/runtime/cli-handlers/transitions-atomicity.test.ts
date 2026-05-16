/**
 * ISSUE-003 regression: approveTransition writes are atomic.
 *
 * The 3 (or 5, in the terminal `done` branch) `log.append` calls that
 * advance the workflow must commit as one SQLite transaction so a crash
 * mid-flow cannot leave `workflow_runs` half-advanced (e.g. phase_completed
 * persisted but phase_transition_approved missing). Gate events written
 * by `runPhaseGates` BEFORE the wrap remain best-effort by design.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflow, proposeTransition, approveTransition } from "#src/runtime/cli-handlers.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import type { Author, ManifestEvent } from "#src/runtime/types.js";
import { unwrap } from "../_brain-helper.js";

const HUMAN: Author = { type: "human", id: "tester" };

function bootstrap(dir: string): void {
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# context\n");
}

describe("ISSUE-003 — approveTransition atomicity", () => {
  let tmpDir: string;
  let prevBrainDb: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-atomic-"));
    bootstrap(tmpDir);
    prevBrainDb = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = join(tmpDir, "brain.db");
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "atomicity regression",
        author: HUMAN,
        cwd: tmpDir,
      }),
    );
    unwrap(proposeTransition({ toPhase: "plan", author: HUMAN, cwd: tmpDir }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = prevBrainDb;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function loadEvents(): readonly ManifestEvent[] {
    const log = BrainEventLog.open();
    try {
      const id = log.getActiveWorkflowId();
      if (!id) throw new Error("no active workflow");
      return log.loadEvents(id);
    } finally {
      log.dispose();
    }
  }

  function readWorkflowRow(): { status: string; current_phase: string } {
    const log = BrainEventLog.open();
    try {
      const id = log.getActiveWorkflowId();
      if (!id) throw new Error("no active workflow");
      return log.privateRaw
        .prepare(`SELECT status, current_phase FROM workflow_runs WHERE workflow_id = ?`)
        .get(id) as { status: string; current_phase: string };
    } finally {
      log.dispose();
    }
  }

  it("writes the full event chain on success (phase_completed + approved + phase_started)", () => {
    unwrap(approveTransition({ author: HUMAN, cwd: tmpDir }));
    const events = loadEvents();
    const types = events.map((e) => e.event_type);
    expect(types).toContain("phase_completed");
    expect(types).toContain("phase_transition_approved");
    expect(types).toContain("phase_started");

    const row = readWorkflowRow();
    expect(row.status).toBe("active");
    expect(row.current_phase).toBe("plan");
  });

  it("rolls back ALL approval writes if any append inside the txn throws", () => {
    // Baseline: snapshot the event log BEFORE the failed approve so we can
    // verify the delta is zero. Some setup events may already include a
    // phase_started for the initial phase — those are pre-approveTransition.
    const eventsBefore = loadEvents();
    const countsBefore = {
      phase_completed: eventsBefore.filter((e) => e.event_type === "phase_completed").length,
      approved: eventsBefore.filter((e) => e.event_type === "phase_transition_approved").length,
      phase_started: eventsBefore.filter((e) => e.event_type === "phase_started").length,
    };

    // Inject a throw on the SECOND append inside the wrap (phase_transition_approved).
    // Before the fix: phase_completed persists in its own txn, this throw kills the
    // rest, and phase_transition_approved + phase_started are missing — corrupt.
    // After the fix: all 3 are wrapped in one outer txn → throw rolls back ALL of them.
    const original = BrainEventLog.prototype.append;
    const spy = vi.spyOn(BrainEventLog.prototype, "append").mockImplementation(function (
      this: BrainEventLog,
      workflowId: string,
      ev: ManifestEvent,
    ) {
      if (ev.event_type === "phase_transition_approved") {
        throw new Error("simulated mid-txn crash");
      }
      return original.call(this, workflowId, ev);
    });

    const r = approveTransition({ author: HUMAN, cwd: tmpDir });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.message).toMatch(/simulated mid-txn crash/);
    spy.mockRestore();

    const eventsAfter = loadEvents();
    const countsAfter = {
      phase_completed: eventsAfter.filter((e) => e.event_type === "phase_completed").length,
      approved: eventsAfter.filter((e) => e.event_type === "phase_transition_approved").length,
      phase_started: eventsAfter.filter((e) => e.event_type === "phase_started").length,
    };
    // Atomic invariant: the delta of every approval-related event type is 0.
    expect(countsAfter.phase_completed).toBe(countsBefore.phase_completed);
    expect(countsAfter.approved).toBe(countsBefore.approved);
    expect(countsAfter.phase_started).toBe(countsBefore.phase_started);

    // Workflow row must remain at pending_approval / intent.
    const row = readWorkflowRow();
    expect(row.status).toBe("pending_approval");
    expect(row.current_phase).toBe("intent");
  });

  it("retry after a mid-txn crash converges to a clean single-chain final state", () => {
    let throwOnce = true;
    const original = BrainEventLog.prototype.append;
    vi.spyOn(BrainEventLog.prototype, "append").mockImplementation(function (
      this: BrainEventLog,
      workflowId: string,
      ev: ManifestEvent,
    ) {
      if (throwOnce && ev.event_type === "phase_transition_approved") {
        throwOnce = false;
        throw new Error("transient crash");
      }
      return original.call(this, workflowId, ev);
    });

    const r = approveTransition({ author: HUMAN, cwd: tmpDir });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.message).toMatch(/transient crash/);
    // Retry — proposal still pending; second call must succeed cleanly.
    unwrap(approveTransition({ author: HUMAN, cwd: tmpDir }));

    const events = loadEvents();
    const completed = events.filter(
      (e) =>
        e.event_type === "phase_completed" && (e.payload as { phase: string }).phase === "intent",
    );
    const approved = events.filter((e) => e.event_type === "phase_transition_approved");
    const started = events.filter(
      (e) => e.event_type === "phase_started" && (e.payload as { phase: string }).phase === "plan",
    );
    expect(completed).toHaveLength(1);
    expect(approved).toHaveLength(1);
    expect(started).toHaveLength(1);
  });
});
