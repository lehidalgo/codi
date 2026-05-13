/**
 * ISSUE-096 — minimal adapter for the `team-consolidation` workflow.
 *
 * Cross-dev brain analysis is fully agent-driven (every phase reads its
 * `phase-*.md` reference from `dev-team-consolidation-workflow` skill)
 * and carries no adaptation metadata. The adapter exposes the canonical
 * phaseOrder so `transitions.advance` can walk forward without
 * special-casing the workflow type.
 */
import type { WorkflowAdapter } from "../types.js";

export interface TeamConsolidationAdaptation {
  // Placeholder. team-consolidation does not adapt yet — every cycle uses
  // the same intent / collect / analyze / consolidate sequence. Future
  // fields (e.g. `mode: 'sequential' | 'parallel'`) land here.
}

export const TEAM_CONSOLIDATION_PHASE_ORDER = [
  "intent",
  "collect",
  "analyze",
  "consolidate",
  "done",
] as const;

export const teamConsolidationAdapter: WorkflowAdapter<TeamConsolidationAdaptation> = {
  id: "team-consolidation",
  phaseOrder: TEAM_CONSOLIDATION_PHASE_ORDER,
  profiles: [],
  resolve: (input) => input as TeamConsolidationAdaptation,
  serialize: () => ({}),
  computeSkipPhases: () => [],
  buildFromCliFlags: () => undefined,
};
