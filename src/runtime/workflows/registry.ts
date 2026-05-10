/**
 * Adapter registry. Importers call {@link getAdapter} with a `WorkflowType`
 * and receive the matching adapter, or `undefined` if the workflow type
 * has no adapter yet (e.g. `quick` runs through a dedicated handler).
 *
 * Adding a new workflow:
 *   1. Create `src/runtime/workflows/<id>/index.ts` exporting the adapter.
 *   2. Register it here in `ADAPTERS`.
 *   3. The CLI and runtime pick it up automatically.
 */

import type { WorkflowType } from "../types.js";
import type { WorkflowAdapter } from "./types.js";
import { bugFixAdapter } from "./bug-fix/index.js";
import { featureAdapter } from "./feature/index.js";
import { refactorAdapter } from "./refactor/index.js";
import { migrationAdapter } from "./migration/index.js";
import { projectAdapter } from "./project/index.js";

const ADAPTERS: Partial<Record<WorkflowType, WorkflowAdapter<unknown>>> = {
  "bug-fix": bugFixAdapter as WorkflowAdapter<unknown>,
  feature: featureAdapter as WorkflowAdapter<unknown>,
  refactor: refactorAdapter as WorkflowAdapter<unknown>,
  migration: migrationAdapter as WorkflowAdapter<unknown>,
  project: projectAdapter as WorkflowAdapter<unknown>,
  // `quick` and `team-consolidation` run without an adaptive intake.
};

export function getAdapter(type: WorkflowType): WorkflowAdapter<unknown> | undefined {
  return ADAPTERS[type];
}

/**
 * Init payload key for an adaptation. Convention: `<type with hyphens replaced>_adaptation`.
 * E.g. `bug-fix` → `bug_fix_adaptation`.
 */
export function adaptationPayloadKey(type: WorkflowType): string {
  return `${type.replace(/-/g, "_")}_adaptation`;
}
