/**
 * CORE-008 — DecisionKind module contract.
 *
 * The 8 `decision_recorded.kind` literals previously lived inline 11
 * times across `src/runtime/gate-runner.ts`, with each call site doing
 * a `payload as { kind?: string }` cast. A typo in any of those casts
 * silently broke a gate (the comparison would never match, the gate
 * would always fail with "no marker recorded"). This test pins:
 *
 *   1. The exact set of 8 kinds — adding/removing one is a deliberate
 *      change that has to update this list AND the corresponding gate
 *      checker, not a typo.
 *   2. Helper semantics (find / filter / hasDecisionKind / isDecisionKind)
 *      including the edge cases that motivated CORE-008: missing kind,
 *      non-string kind, stale kind from an old on-disk event log.
 */
import { describe, it, expect } from "vitest";
import {
  DECISION_KINDS,
  isDecisionKind,
  findDecisionByKind,
  filterDecisionsByKind,
  hasDecisionKind,
} from "#src/runtime/decision-kinds.js";
import type { ManifestEvent } from "#src/runtime/types.js";

function makeEvent(overrides: Partial<ManifestEvent>): ManifestEvent {
  return {
    event_id: "evt-1",
    schema_version: "1.0",
    event_type: "decision_recorded",
    timestamp: "2026-01-01T00:00:00Z",
    author: { type: "agent", id: "test" },
    parent_event_id: null,
    commitable: false,
    payload: {},
    ...overrides,
  };
}

describe("DECISION_KINDS (CORE-008)", () => {
  it("contains exactly the 8 canonical kinds in roadmap order", () => {
    // Sentinel test — guards against accidental rename, removal, or
    // ordering shift. The 8 strings are the wire-protocol contract the
    // agent-facing templates emit, so changing this array without also
    // updating the templates breaks downstream gates.
    expect([...DECISION_KINDS]).toEqual([
      "reproducer_built",
      "regression_test_added",
      "baseline_captured",
      "behavior_unchanged",
      "migration_metrics_captured",
      "brains_enumerated",
      "dev_layout_validated",
      "dev_findings",
    ]);
  });

  it("has no duplicate entries", () => {
    expect(new Set(DECISION_KINDS).size).toBe(DECISION_KINDS.length);
  });
});

describe("isDecisionKind (CORE-008)", () => {
  it("returns true for every known kind", () => {
    for (const k of DECISION_KINDS) {
      expect(isDecisionKind(k)).toBe(true);
    }
  });

  it("returns false for an unknown string", () => {
    expect(isDecisionKind("reproducer_buil")).toBe(false); // typo guard
    expect(isDecisionKind("")).toBe(false);
    expect(isDecisionKind("REPRODUCER_BUILT")).toBe(false); // case-mismatch
  });

  it("returns false for non-string values (undefined / number / null)", () => {
    expect(isDecisionKind(undefined)).toBe(false);
    expect(isDecisionKind(null)).toBe(false);
    expect(isDecisionKind(42)).toBe(false);
    expect(isDecisionKind({})).toBe(false);
  });
});

describe("findDecisionByKind (CORE-008)", () => {
  it("returns the first matching event", () => {
    const events = [
      makeEvent({ event_id: "a", payload: { kind: "baseline_captured", v: 1 } }),
      makeEvent({ event_id: "b", payload: { kind: "baseline_captured", v: 2 } }),
    ];
    const result = findDecisionByKind(events, "baseline_captured");
    expect(result?.event_id).toBe("a");
  });

  it("returns undefined when no event matches", () => {
    const events = [
      makeEvent({ event_id: "a", payload: { kind: "reproducer_built" } }),
    ];
    expect(findDecisionByKind(events, "behavior_unchanged")).toBeUndefined();
  });

  it("skips events whose event_type is not decision_recorded", () => {
    const events: ManifestEvent[] = [
      makeEvent({
        event_id: "a",
        event_type: "init",
        payload: { kind: "baseline_captured" }, // wrong event_type
      }),
    ];
    expect(findDecisionByKind(events, "baseline_captured")).toBeUndefined();
  });

  it("skips events whose payload.kind is missing or non-string (fail-closed)", () => {
    const events: ManifestEvent[] = [
      makeEvent({ payload: {} }),
      makeEvent({ payload: { kind: 42 } }),
      makeEvent({ payload: { kind: null } }),
    ];
    expect(findDecisionByKind(events, "baseline_captured")).toBeUndefined();
  });

  it("returns undefined for an empty events array", () => {
    expect(findDecisionByKind([], "reproducer_built")).toBeUndefined();
  });
});

describe("filterDecisionsByKind (CORE-008)", () => {
  it("returns every matching event in order", () => {
    const events = [
      makeEvent({ event_id: "a", payload: { kind: "dev_findings" } }),
      makeEvent({ event_id: "b", payload: { kind: "baseline_captured" } }),
      makeEvent({ event_id: "c", payload: { kind: "dev_findings" } }),
    ];
    const result = filterDecisionsByKind(events, "dev_findings");
    expect(result.map((e) => e.event_id)).toEqual(["a", "c"]);
  });

  it("returns empty array when nothing matches", () => {
    const events = [makeEvent({ payload: { kind: "reproducer_built" } })];
    expect(filterDecisionsByKind(events, "dev_findings")).toEqual([]);
  });
});

describe("hasDecisionKind (CORE-008)", () => {
  it("returns true when at least one event matches", () => {
    const events = [makeEvent({ payload: { kind: "baseline_captured" } })];
    expect(hasDecisionKind(events, "baseline_captured")).toBe(true);
  });

  it("returns false otherwise", () => {
    expect(hasDecisionKind([], "baseline_captured")).toBe(false);
  });
});
