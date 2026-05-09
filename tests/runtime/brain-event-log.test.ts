/**
 * BrainEventLog parity tests (Item 1+2).
 *
 * Covers the same surface that tests/runtime/event-log.test.ts cover for
 * the legacy EventLog. Both backends should behave identically from the
 * caller's perspective — that's the contract that lets cli-handlers swap
 * one for the other via DI.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  BrainEventLog,
  BrainWorkflowAlreadyActiveError,
  BrainLockHeldError,
} from "#src/runtime/brain-event-log.js";
import type { ManifestEvent } from "#src/runtime/types.js";

let dir: string;
let log: BrainEventLog;

function initEvent(): ManifestEvent {
  return {
    event_id: "ev-1",
    event_type: "init",
    schema_version: 1,
    ts: new Date().toISOString(),
    actor: { type: "human", id: "tester" },
    workflow_id: "wf-1",
    commitable: true,
    payload: { workflow_type: "feature", task: "test task" },
  } as ManifestEvent;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codi-bel-"));
  log = BrainEventLog.open({ dbPath: join(dir, "brain.db") });
});

afterEach(() => {
  log.dispose();
  rmSync(dir, { recursive: true, force: true });
});

describe("active workflow ID", () => {
  it("starts null", () => {
    expect(log.getActiveWorkflowId()).toBeNull();
  });

  it("round-trips set + get + clear", () => {
    log.setActiveWorkflowId("wf-42");
    expect(log.getActiveWorkflowId()).toBe("wf-42");
    log.clearActiveWorkflowId();
    expect(log.getActiveWorkflowId()).toBeNull();
  });
});

describe("lock", () => {
  it("acquire then release works", () => {
    log.acquireLock();
    log.releaseLock();
    log.acquireLock();
    log.releaseLock();
  });

  it("acquireLock throws when already held by a live PID", () => {
    log.acquireLock();
    expect(() => log.acquireLock()).toThrow(BrainLockHeldError);
  });
});

describe("initWorkflow + append + loadEvents", () => {
  it("init persists a single 'init' event", () => {
    log.initWorkflow("wf-1", initEvent());
    const events = log.loadEvents("wf-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.event_type).toBe("init");
  });

  it("rejects init when another workflow is active", () => {
    log.initWorkflow("wf-1", initEvent());
    const second = { ...initEvent(), workflow_id: "wf-2" };
    expect(() => log.initWorkflow("wf-2", second)).toThrow(BrainWorkflowAlreadyActiveError);
  });

  it("rejects init when first event is not 'init'", () => {
    const bad = { ...initEvent(), event_type: "phase_started" } as ManifestEvent;
    expect(() => log.initWorkflow("wf-3", bad)).toThrow(/must be 'init'/);
  });

  it("rejects double-init for the same workflow_id", () => {
    log.initWorkflow("wf-4", { ...initEvent(), workflow_id: "wf-4" });
    log.clearActiveWorkflowId(); // simulate session restart
    expect(() => log.initWorkflow("wf-4", { ...initEvent(), workflow_id: "wf-4" })).toThrow(
      /already has events/,
    );
  });

  it("append() returns the assigned sequence", () => {
    log.initWorkflow("wf-5", { ...initEvent(), workflow_id: "wf-5" });
    const r = log.append("wf-5", {
      event_id: "ev-2",
      event_type: "phase_started",
      schema_version: 1,
      ts: new Date().toISOString(),
      actor: { type: "human", id: "tester" },
      workflow_id: "wf-5",
      commitable: true,
      payload: { phase: "intent" },
    } as ManifestEvent);
    expect(r.sequence).toBeGreaterThan(0);
    expect(r.commitable).toBe(true);
    expect(log.loadEvents("wf-5")).toHaveLength(2);
  });

  it("append() rejects events for an uninitialised workflow", () => {
    expect(() => log.append("wf-missing", { ...initEvent(), workflow_id: "wf-missing" })).toThrow(
      /No workflow_runs row/,
    );
  });

  it("loadArchivedEvents returns only committable events", () => {
    log.initWorkflow("wf-6", { ...initEvent(), workflow_id: "wf-6" });
    log.append("wf-6", {
      event_id: "ev-2",
      event_type: "scope_expansion_proposed",
      schema_version: 1,
      ts: new Date().toISOString(),
      actor: { type: "agent", id: "claude" },
      workflow_id: "wf-6",
      commitable: false,
      payload: {},
    } as ManifestEvent);
    log.append("wf-6", {
      event_id: "ev-3",
      event_type: "phase_completed",
      schema_version: 1,
      ts: new Date().toISOString(),
      actor: { type: "human", id: "tester" },
      workflow_id: "wf-6",
      commitable: true,
      payload: {},
    } as ManifestEvent);
    expect(log.loadEvents("wf-6")).toHaveLength(3);
    expect(log.loadArchivedEvents("wf-6")).toHaveLength(2); // init + completed
  });
});

describe("F3 — current_phase + status updates with each event", () => {
  it("phase_started updates workflow_runs.current_phase + status='active'", () => {
    log.initWorkflow("wf-f3-1", { ...initEvent(), workflow_id: "wf-f3-1" });
    log.append("wf-f3-1", {
      event_id: "ev-2",
      event_type: "phase_started",
      schema_version: 1,
      ts: new Date().toISOString(),
      actor: { type: "human", id: "tester" },
      workflow_id: "wf-f3-1",
      commitable: true,
      payload: { phase: "plan" },
    } as ManifestEvent);

    // Re-open to verify persistence (different handle, same file).
    const log2 = BrainEventLog.open({ dbPath: join(dir, "brain.db") });
    try {
      const row = log2["handle"].raw
        .prepare(`SELECT current_phase, status FROM workflow_runs WHERE workflow_id = ?`)
        .get("wf-f3-1") as { current_phase: string; status: string };
      expect(row.current_phase).toBe("plan");
      expect(row.status).toBe("active");
    } finally {
      log2.dispose();
    }
  });

  it("workflow_completed updates status='completed' + ended_at", () => {
    log.initWorkflow("wf-f3-2", { ...initEvent(), workflow_id: "wf-f3-2" });
    log.append("wf-f3-2", {
      event_id: "ev-2",
      event_type: "workflow_completed",
      schema_version: 1,
      ts: new Date().toISOString(),
      actor: { type: "human", id: "tester" },
      workflow_id: "wf-f3-2",
      commitable: true,
      payload: {},
    } as ManifestEvent);

    const log2 = BrainEventLog.open({ dbPath: join(dir, "brain.db") });
    try {
      const row = log2["handle"].raw
        .prepare(`SELECT status, ended_at FROM workflow_runs WHERE workflow_id = ?`)
        .get("wf-f3-2") as { status: string; ended_at: number | null };
      expect(row.status).toBe("completed");
      expect(row.ended_at).not.toBeNull();
    } finally {
      log2.dispose();
    }
  });

  it("workflow_abandoned updates status='abandoned' + ended_at", () => {
    log.initWorkflow("wf-f3-3", { ...initEvent(), workflow_id: "wf-f3-3" });
    log.append("wf-f3-3", {
      event_id: "ev-2",
      event_type: "workflow_abandoned",
      schema_version: 1,
      ts: new Date().toISOString(),
      actor: { type: "human", id: "tester" },
      workflow_id: "wf-f3-3",
      commitable: true,
      payload: { reason: "test" },
    } as ManifestEvent);
    const row = log["handle"].raw
      .prepare(`SELECT status, ended_at FROM workflow_runs WHERE workflow_id = ?`)
      .get("wf-f3-3") as { status: string; ended_at: number | null };
    expect(row.status).toBe("abandoned");
    expect(row.ended_at).not.toBeNull();
  });

  it("phase_completed alone does NOT advance current_phase (waits for next phase_started)", () => {
    log.initWorkflow("wf-f3-4", { ...initEvent(), workflow_id: "wf-f3-4" });
    log.append("wf-f3-4", {
      event_id: "ev-2",
      event_type: "phase_started",
      schema_version: 1,
      ts: new Date().toISOString(),
      actor: { type: "human", id: "tester" },
      workflow_id: "wf-f3-4",
      commitable: true,
      payload: { phase: "plan" },
    } as ManifestEvent);
    log.append("wf-f3-4", {
      event_id: "ev-3",
      event_type: "phase_completed",
      schema_version: 1,
      ts: new Date().toISOString(),
      actor: { type: "human", id: "tester" },
      workflow_id: "wf-f3-4",
      commitable: true,
      payload: { phase: "plan" },
    } as ManifestEvent);
    const row = log["handle"].raw
      .prepare(`SELECT current_phase FROM workflow_runs WHERE workflow_id = ?`)
      .get("wf-f3-4") as { current_phase: string };
    expect(row.current_phase).toBe("plan"); // not 'init', not 'execute' yet
  });
});

describe("integration with brain-ui /workflows", () => {
  it("writes appear in workflow_runs immediately", () => {
    log.initWorkflow("wf-7", { ...initEvent(), workflow_id: "wf-7" });
    // The handle is private, so re-open in read-only and inspect the row.
    // This validates the brain-ui /workflows endpoint will see the row.
    const log2 = BrainEventLog.open({ dbPath: join(dir, "brain.db") });
    try {
      // BrainEventLog doesn't expose the raw handle; we hit the same dbPath
      // and check the workflow surfaces.
      expect(log2.getActiveWorkflowId()).toBe("wf-7");
      expect(log2.loadEvents("wf-7")).toHaveLength(1);
    } finally {
      log2.dispose();
    }
  });
});
