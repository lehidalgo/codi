/**
 * Public surface of the workflow adapter system.
 *
 * Importers should pull adapter-related primitives from this module rather
 * than reaching into individual workflow directories.
 */

export type { WorkflowAdapter, WorkflowRunFlags, InteractiveResult } from "./types.js";
export { computeNextPhase } from "./phase-walker.js";
export { getAdapter, adaptationPayloadKey } from "./registry.js";

// Per-workflow public APIs (types + runtime helpers used elsewhere)
export {
  bugFixAdapter,
  resolveBugFixAdaptation,
  computeBugFixSkipPhases,
  computeBugFixNextPhase,
  type BugFixAdaptation,
  type BugFixProfile,
  type BugFixSeverity,
  type BugFixScope,
  type BugFixExecuteMode,
} from "./bug-fix/index.js";
export {
  featureAdapter,
  resolveFeatureAdaptation,
  computeFeatureSkipPhases,
  computeFeatureNextPhase,
  type FeatureAdaptation,
  type FeatureProfile,
  type FeatureComplexity,
  type FeatureScope,
  type FeatureExecuteMode,
} from "./feature/index.js";
export {
  refactorAdapter,
  resolveRefactorAdaptation,
  computeRefactorSkipPhases,
  computeRefactorNextPhase,
  type RefactorAdaptation,
  type RefactorProfile,
  type RefactorKind,
  type RefactorScope,
  type RefactorExecuteMode,
} from "./refactor/index.js";
export {
  migrationAdapter,
  resolveMigrationAdaptation,
  computeMigrationSkipPhases,
  computeMigrationNextPhase,
  type MigrationAdaptation,
  type MigrationProfile,
  type MigrationRiskLevel,
  type MigrationExecuteMode,
} from "./migration/index.js";
export {
  projectAdapter,
  resolveProjectAdaptation,
  computeProjectSkipPhases,
  computeProjectNextPhase,
  type ProjectAdaptation,
  type ProjectProfile,
  type ProjectMode,
} from "./project/index.js";
export { runBugFixInteractiveIntake } from "./bug-fix/interactive.js";
