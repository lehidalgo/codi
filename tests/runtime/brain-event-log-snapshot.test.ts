/**
 * CORE-009 — BrainEventLog snapshot APIs (`loadEventsSince`,
 * `readSnapshot`, `writeSnapshot`, `getReducedState`) + the snapshot
 * trigger inside `append()` every K events.
 *
 * Hits the three core invariants from the design:
 *   - `getReducedState(workflowId)` deep-equals `reduce(loadEvents(workflowId))`
 *     on cold start, warm start (snapshot present, delta empty), and
 *     after appending a delta (snapshot present, delta non-empty).
 *   - Snapshot trigger fires inside `append` exactly when
 *     `sequence % SNAPSHOT_EVERY_K === 0`.
 *   - Stale snapshot (reducer_version mismatch) is silently discarded
 *     and a cold replay regenerates a fresh row.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { reduce, REDUCER_VERSION } from "#src/runtime/reducer.js";
import type { ManifestEvent } from "#src/runtime/types.js";
import { PROJECT_NAME } from "#src/constants.js";

function makeInit(workflowId: string): ManifestEvent {
  return {
    event_id: `${workflowId}-init`,
    schema_version: "1.0",
    event_type: "init",
    timestamp: "2026-01-01T00:00:00Z",
    author: { type: "agent", id: "test" },
    parent_event_id: null,
    commitable: true,
    payload: {
      workflow_id: workflowId,
      workflow_type: "feature",
      task: "snapshot suite",
    },
  };
}

function makePhaseStarted(workflowId: string, n: number, phase: string): ManifestEvent {
  return {
    event_id: `${workflowId}-evt-${n}`,
    schema_version: "1.0",
    event_type: "phase_started",
    timestamp: `2026-01-01T00:01:${String(n).padStart(2, "0")}Z`,
    author: { type: "agent", id: "test" },
    parent_event_id: null,
    commitable: false,
    payload: { phase },
  };
}

describe("BrainEventLog snapshot APIs (CORE-009)", () => {
  let tmpDir: string;
  let dbPath: string;
  let log: BrainEventLog;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), `${PROJECT_NAME}-snap-`));
    dbPath = join(tmpDir, "brain.db");
    log = BrainEventLog.open({ dbPath });
  });

  afterEach(() => {
    log.dispose();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadEventsSince", () => {
    it("returns every event when sinceEventId is null", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      log.append("wf-1", makePhaseStarted("wf-1", 1, "intent"));
      log.append("wf-1", makePhaseStarted("wf-1", 2, "discover"));
      const result = log.loadEventsSince("wf-1", null);
      expect(result.events).toHaveLength(3);
      expect(result.maxEventId).toBeGreaterThan(0);
    });

    it("returns only events with event_id > sinceEventId", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      log.append("wf-1", makePhaseStarted("wf-1", 1, "intent"));
      const afterFirst = log.loadEventsSince("wf-1", null);
      const cutoff = afterFirst.maxEventId;
      log.append("wf-1", makePhaseStarted("wf-1", 2, "discover"));
      const result = log.loadEventsSince("wf-1", cutoff);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.event_type).toBe("phase_started");
    });

    it("returns empty events array when cutoff is at or after max", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      const result = log.loadEventsSince("wf-1", 9999);
      expect(result.events).toEqual([]);
      // maxEventId stays at the cutoff when nothing is found.
      expect(result.maxEventId).toBe(9999);
    });
  });

  describe("read/writeSnapshot roundtrip", () => {
    it("UPSERTs and reads back state + lastEventId", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      const events = log.loadEvents("wf-1");
      const state = reduce(events);
      log.writeSnapshot("wf-1", state, 42, events.length);

      const restored = log.readSnapshot("wf-1");
      expect(restored).not.toBeNull();
      expect(restored!.lastEventId).toBe(42);
      expect(restored!.state.workflow_id).toBe("wf-1");
      expect(JSON.stringify(restored!.state)).toBe(JSON.stringify(state));
    });

    it("returns null when no snapshot row exists", () => {
      expect(log.readSnapshot("nonexistent")).toBeNull();
    });

    it("returns null when reducer_version mismatches (drift detector)", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      const state = reduce(log.loadEvents("wf-1"));
      log.writeSnapshot("wf-1", state, 1, 1);

      // Simulate an older snapshot by editing the row directly.
      log.privateRaw
        .prepare(`UPDATE workflow_snapshots SET reducer_version = ? WHERE workflow_id = ?`)
        .run(REDUCER_VERSION - 1, "wf-1");

      expect(log.readSnapshot("wf-1")).toBeNull();
    });

    it("returns null when reduced_state_json is corrupt", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      const state = reduce(log.loadEvents("wf-1"));
      log.writeSnapshot("wf-1", state, 1, 1);
      log.privateRaw
        .prepare(`UPDATE workflow_snapshots SET reduced_state_json = ? WHERE workflow_id = ?`)
        .run("{ not json", "wf-1");
      expect(log.readSnapshot("wf-1")).toBeNull();
    });
  });

  describe("getReducedState", () => {
    it("cold start: returns reduce(loadEvents()) and writes a snapshot", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      log.append("wf-1", makePhaseStarted("wf-1", 1, "intent"));

      expect(log.readSnapshot("wf-1")).toBeNull();
      const state = log.getReducedState("wf-1");
      const expected = reduce(log.loadEvents("wf-1"));
      expect(JSON.stringify(state)).toBe(JSON.stringify(expected));

      // Cold replay wrote a fresh snapshot.
      const snap = log.readSnapshot("wf-1");
      expect(snap).not.toBeNull();
    });

    it("warm start, empty delta: returns deep-cloned snapshot state", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      const initialState = log.getReducedState("wf-1"); // writes snapshot

      const second = log.getReducedState("wf-1");
      expect(JSON.stringify(second)).toBe(JSON.stringify(initialState));
      // Deep cloned — not the same reference as the cached row.
      expect(second).not.toBe(initialState);
    });

    it("warm start, non-empty delta: reduceIncremental applied to snapshot", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      log.getReducedState("wf-1"); // primes snapshot at events_count = 1

      log.append("wf-1", makePhaseStarted("wf-1", 1, "intent"));
      log.append("wf-1", makePhaseStarted("wf-1", 2, "discover"));

      const state = log.getReducedState("wf-1");
      const expected = reduce(log.loadEvents("wf-1"));
      expect(JSON.stringify(state)).toBe(JSON.stringify(expected));
    });
  });

  describe("snapshot trigger inside append()", () => {
    it("does not snapshot before SNAPSHOT_EVERY_K events", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      // Init is event #1. Append up to event #49 — below the K=50 cutoff.
      for (let n = 1; n < 49; n += 1) {
        log.append("wf-1", makePhaseStarted("wf-1", n, "intent"));
      }
      expect(log.readSnapshot("wf-1")).toBeNull();
    });

    it("writes a snapshot exactly when sequence hits K=50", () => {
      log.initWorkflow("wf-1", makeInit("wf-1"));
      for (let n = 1; n < 50; n += 1) {
        log.append("wf-1", makePhaseStarted("wf-1", n, "intent"));
      }
      // 50th event triggers snapshot — init counts as event 1, so this
      // is the 49th append (49 + init = 50 total rows).
      const snap = log.readSnapshot("wf-1");
      expect(snap).not.toBeNull();
      expect(snap!.state.events_count).toBe(50);
    });
  });
});
