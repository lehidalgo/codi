import type { ManifestEvent } from "./types.js";

/**
 * Canonical kinds of `decision_recorded` events that gate-runner checkers
 * inspect to decide whether a workflow phase has produced the required
 * audit-trail markers. Order matches the gate-runner.ts layout.
 *
 * The `as const` array drives both the {@link DecisionKind} union type
 * (compile-time) and runtime iteration. Adding a 9th kind requires
 * editing this array, the matching gate checker in `gate-runner.ts`,
 * and (when CORE-004b lands) the zod enum on `manifest-event.ts`.
 *
 * By convention, gate `check_id` values that consume a decision marker
 * are named identically to the kind they verify (e.g. the gate
 * `baseline_captured` looks for a `decision_recorded` event with
 * `payload.kind === "baseline_captured"`). The YAML workflows under
 * `src/templates/workflows/{refactor,migration,team-consolidation}.yaml`
 * list those `check_id`s in their `gates:` array — when adding a kind,
 * keep the matching gate registered there.
 *
 * `scripts/guard-decision-kinds.mjs` blocks the regression class
 * `payload as { kind?: string }` in `src/runtime/**` so new gates must
 * route through {@link findDecisionByKind} / {@link hasDecisionKind}.
 */
export const DECISION_KINDS = [
  "reproducer_built",
  "regression_test_added",
  "baseline_captured",
  "behavior_unchanged",
  "migration_metrics_captured",
  "brains_enumerated",
  "dev_layout_validated",
  "dev_findings",
] as const;

export type DecisionKind = (typeof DECISION_KINDS)[number];

/** Runtime type guard — narrows `unknown` to a known DecisionKind. */
export function isDecisionKind(value: unknown): value is DecisionKind {
  return typeof value === "string" && (DECISION_KINDS as readonly string[]).includes(value);
}

/**
 * Return the first `decision_recorded` event whose `payload.kind`
 * matches the requested kind, or `undefined` if none. Replaces the
 * `events.find(e => e.event_type === "decision_recorded" && (e.payload
 * as { kind?: string }).kind === "...")` pattern that was duplicated 8
 * times across `gate-runner.ts` before CORE-008.
 *
 * Events whose `payload.kind` is missing, non-string, or any value
 * outside {@link DECISION_KINDS} are skipped silently (fail-closed) —
 * a stale kind in a `.codi/runtime/` event log will not match any
 * future kind by coincidence.
 */
export function findDecisionByKind(
  events: readonly ManifestEvent[],
  kind: DecisionKind,
): ManifestEvent | undefined {
  return events.find(
    (e) =>
      e.event_type === "decision_recorded" &&
      (e.payload as { kind?: unknown }).kind === kind,
  );
}

/**
 * Return every `decision_recorded` event whose `payload.kind` matches
 * the requested kind. Used by gate checkers that count (e.g. one
 * `dev_findings` per dev brain enumerated).
 */
export function filterDecisionsByKind(
  events: readonly ManifestEvent[],
  kind: DecisionKind,
): ManifestEvent[] {
  return events.filter(
    (e) =>
      e.event_type === "decision_recorded" &&
      (e.payload as { kind?: unknown }).kind === kind,
  );
}

/** Boolean shortcut over {@link findDecisionByKind}. */
export function hasDecisionKind(
  events: readonly ManifestEvent[],
  kind: DecisionKind,
): boolean {
  return findDecisionByKind(events, kind) !== undefined;
}
