/**
 * Barrel re-export for the user-facing CLI handlers.
 *
 * The handlers themselves live in lib/cli-handlers/* — split by concern
 * to keep each module under the 700-LOC cap. Importers should keep
 * pointing at "../lib/cli-handlers.js"; nothing else needs to change.
 *
 * Files:
 *   - workflow.ts   : runWorkflow, getStatus, getPhaseRef
 *   - transitions.ts: proposeTransition, approveTransition, rejectTransition
 *   - lifecycle.ts  : abandonWorkflow, recoverWorkflow
 *   - scope.ts      : propose/approve/reject scope, recordIncidentalChange
 *   - elevation.ts  : propose/approve/reject elevation, resolveChild
 *   - handover.ts   : handover, forceHandover
 *   - stats.ts      : computeWorkflowStats
 */

export {
  runWorkflow,
  runQuick,
  getStatus,
  getSlimStatus,
  getPhaseRef,
} from "./cli-handlers/workflow.js";
export type {
  RunOptions,
  RunResult,
  QuickRunOptions,
  QuickRunResult,
  StatusOptions,
  StatusResult,
  SlimStatus,
  SlimAdaptationSummary,
  SlimProgress,
  PhaseRefOptions,
  PhaseRefResult,
} from "./cli-handlers/workflow.js";

export {
  proposeTransition,
  approveTransition,
  rejectTransition,
  advanceWorkflow,
} from "./cli-handlers/transitions.js";
export type {
  ProposeTransitionOptions,
  ProposeTransitionResult,
  ApproveTransitionOptions,
  ApproveTransitionResult,
  RejectTransitionOptions,
  RejectTransitionResult,
  AdvanceOptions,
  AdvanceResult,
} from "./cli-handlers/transitions.js";

export { abandonWorkflow, recoverWorkflow, convertWorkflow } from "./cli-handlers/lifecycle.js";
export type {
  AbandonOptions,
  AbandonResult,
  RecoverOptions,
  RecoverResult,
  ConvertOptions,
  ConvertResult,
} from "./cli-handlers/lifecycle.js";

export {
  proposeScopeExpansion,
  approveScopeExpansion,
  rejectScopeExpansion,
  recordIncidentalChange,
} from "./cli-handlers/scope.js";
export type {
  ProposeScopeExpansionOptions,
  ProposeScopeExpansionResult,
  ApproveScopeExpansionOptions,
  ApproveScopeExpansionResult,
  RejectScopeExpansionOptions,
  RejectScopeExpansionResult,
} from "./cli-handlers/scope.js";

export {
  proposeElevation,
  approveElevation,
  rejectElevation,
  resolveChild,
} from "./cli-handlers/elevation.js";
export type {
  ProposeElevationOptions,
  ProposeElevationResult,
  ApproveElevationOptions,
  ApproveElevationResult,
  RejectElevationOptions,
  ResolveChildOptions,
} from "./cli-handlers/elevation.js";

export { handover, forceHandover } from "./cli-handlers/handover.js";
export type {
  HandoverOptions,
  HandoverResult,
  ForceHandoverOptions,
} from "./cli-handlers/handover.js";

export { computeWorkflowStats } from "./cli-handlers/stats.js";
export type { DurationStats, TokenStats, RetryStats } from "./cli-handlers/stats.js";
