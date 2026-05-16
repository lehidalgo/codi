/**
 * CORE-009 — equivalence + edge case tests for `reduceIncremental`.
 *
 * The headline invariant (criterion #1): snapshot + delta must produce
 * a state structurally identical to a full replay of every event, for
 * every legal split point K. The matrix below covers boundary K values
 * (1, K-1, K, K+1, 100, N-1) so a regression at the snapshot threshold
 * surfaces as a single failing case rather than hiding in coverage.
 *
 * Edge cases (must not throw quietly):
 *   - `prior == null, newEvents == []` — empty cold input
 *   - `prior != null, newEvents == []` — no-op delta returns deep clone
 *   - Repeated invocation on the same `prior` — proves the function
 *     does not mutate its input snapshot in place
 */
import { describe, it, expect } from "vitest";
import { reduce, reduceIncremental, REDUCER_VERSION, ReducerError } from "#src/runtime/reducer.js";
import type { ManifestEvent, ReducedState } from "#src/runtime/types.js";

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
      task: "snapshot equivalence test",
    },
  };
}

function makePhaseStarted(workflowId: string, n: number, phase: string): ManifestEvent {
  return {
    event_id: `${workflowId}-evt-${n}`,
    schema_version: "1.0",
    event_type: "phase_started",
    timestamp: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
    author: { type: "agent", id: "test" },
    parent_event_id: null,
    commitable: false,
    payload: { phase },
  };
}

function makePhaseCompleted(workflowId: string, n: number, phase: string): ManifestEvent {
  return {
    event_id: `${workflowId}-evt-${n}`,
    schema_version: "1.0",
    event_type: "phase_completed",
    timestamp: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
    author: { type: "agent", id: "test" },
    parent_event_id: null,
    commitable: false,
    payload: { phase, duration_ms: 1000, gate_passed: true },
  };
}

function makeIncidental(workflowId: string, n: number): ManifestEvent {
  return {
    event_id: `${workflowId}-evt-${n}`,
    schema_version: "1.0",
    event_type: "incidental_change_recorded",
    timestamp: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
    author: { type: "agent", id: "test" },
    parent_event_id: null,
    commitable: false,
    payload: { file_path: `src/file-${n}.ts` },
  };
}

function buildEvents(n: number): ManifestEvent[] {
  const events: ManifestEvent[] = [makeInit("wf-1")];
  const phases = ["intent", "discover", "plan", "execute", "verify"];
  for (let i = 1; i < n; i += 1) {
    const phase = phases[i % phases.length]!;
    if (i % 3 === 0) events.push(makeIncidental("wf-1", i));
    else if (i % 2 === 0) events.push(makePhaseCompleted("wf-1", i, phase));
    else events.push(makePhaseStarted("wf-1", i, phase));
  }
  return events;
}

describe("reduceIncremental (CORE-009)", () => {
  describe("equivalence with reduce (criterion #1)", () => {
    const events = buildEvents(200);
    const fullState = reduce(events);

    it.each([1, 49, 50, 51, 100, 199, 200])(
      "K=%i: reduceIncremental(reduce(events[0..K]), events[K..N]) deepEqual reduce(events)",
      (K) => {
        const head = events.slice(0, K);
        const tail = events.slice(K);
        if (head.length === 0) {
          // Trivial cold path
          const cold = reduceIncremental(null, events);
          expect(cold).toEqual(fullState);
          expect(JSON.stringify(cold)).toBe(JSON.stringify(fullState));
          return;
        }
        const snapshot = reduce(head);
        const merged =
          tail.length === 0 ? reduceIncremental(snapshot, []) : reduceIncremental(snapshot, tail);
        expect(merged).toEqual(fullState);
        // Stronger: JSON-key ordering preserved (matters for serialised
        // snapshots that round-trip through `JSON.stringify` in the DB).
        expect(JSON.stringify(merged)).toBe(JSON.stringify(fullState));
      },
    );
  });

  describe("empty / no-op deltas", () => {
    it("reduceIncremental(null, []) throws (matches reduce([]))", () => {
      expect(() => reduceIncremental(null, [])).toThrow(ReducerError);
    });

    it("reduceIncremental(prior, []) returns a structural copy of prior", () => {
      const prior = reduce(buildEvents(10));
      const result = reduceIncremental(prior, []);
      expect(result).toEqual(prior);
      // Deep clone — should not be the same reference.
      expect(result).not.toBe(prior);
    });
  });

  describe("immutability of prior snapshot (criterion: deep-clone)", () => {
    it("does not mutate the prior state on a non-empty delta", () => {
      const events = buildEvents(60);
      const prior = reduce(events.slice(0, 50));
      const priorSnapshot = JSON.stringify(prior);

      reduceIncremental(prior, events.slice(50));

      // Original snapshot object unchanged — the reducer mutates its
      // working copy in place, so without deep-clone the second call
      // would observe corrupted state.
      expect(JSON.stringify(prior)).toBe(priorSnapshot);
    });

    it("is idempotent across repeated calls with identical inputs", () => {
      const events = buildEvents(60);
      const prior = reduce(events.slice(0, 50));
      const tail = events.slice(50);

      const first = reduceIncremental(prior, tail);
      const second = reduceIncremental(prior, tail);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("cold-path delegation (prior === null)", () => {
    it("delegates to reduce() and matches its output exactly", () => {
      const events = buildEvents(75);
      const cold = reduceIncremental(null, events);
      const full = reduce(events);
      expect(cold).toEqual(full);
    });
  });

  describe("REDUCER_VERSION constant", () => {
    it("is a positive integer", () => {
      expect(Number.isInteger(REDUCER_VERSION)).toBe(true);
      expect(REDUCER_VERSION).toBeGreaterThan(0);
    });
    it("is exported for cross-version snapshot invalidation", () => {
      // Pin the current version. Any change to `applyEvent` semantics
      // must bump REDUCER_VERSION in the same commit so existing
      // workflow_snapshots rows are discarded by `readSnapshot`.
      const _check: number = REDUCER_VERSION;
      void _check;
    });
  });

  describe("ReducedState.events_count tracking through incremental", () => {
    it("matches the total event count after merge", () => {
      const events = buildEvents(120);
      const prior = reduce(events.slice(0, 50));
      const merged: ReducedState = reduceIncremental(prior, events.slice(50));
      expect(merged.events_count).toBe(120);
    });
  });
});
