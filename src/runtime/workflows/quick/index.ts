/**
 * ISSUE-096 — minimal adapter for the `quick` workflow.
 *
 * Quick workflows do not carry an adaptation (they are 1-phase chores:
 * typo, comment, dep-bump, format, doc-tweak). The adapter still exists
 * so callers can rely on `getAdapter(type)` returning a value and walk
 * `phaseOrder` without branching on the workflow type.
 */
import type { WorkflowAdapter } from "../types.js";

export interface QuickAdaptation {
  // Placeholder: quick workflows do not adapt. Future fields land here
  // (e.g. category) without changing the call-site shape.
}

export const QUICK_PHASE_ORDER = ["intent", "execute", "done"] as const;

export const quickAdapter: WorkflowAdapter<QuickAdaptation> = {
  id: "quick",
  phaseOrder: QUICK_PHASE_ORDER,
  profiles: [],
  resolve: (input) => input as QuickAdaptation,
  serialize: () => ({}),
  computeSkipPhases: () => [],
  buildFromCliFlags: () => undefined,
};
