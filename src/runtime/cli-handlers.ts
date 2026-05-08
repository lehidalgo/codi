/**
 * Barrel re-export for the user-facing CLI handlers.
 *
 * The handlers themselves live in lib/cli-handlers/* — split by concern
 * to keep each module under the 700-LOC cap. Importers should keep
 * pointing at "../lib/cli-handlers.js"; nothing else needs to change.
 *
 * Files:
 *   - workflow.ts   : runWorkflow, getStatus, KnowledgeBaseMissingError
 *   - transitions.ts: proposeTransition, approveTransition, rejectTransition
 *   - lifecycle.ts  : abandonWorkflow, recoverWorkflow
 *   - scope.ts      : propose/approve/reject scope, recordIncidentalChange
 *   - elevation.ts  : propose/approve/reject elevation, resolveChild
 *   - handover.ts   : handover, forceHandover
 *   - stats.ts      : computeWorkflowStats
 */

export { KnowledgeBaseMissingError, runWorkflow, getStatus } from "./cli-handlers/workflow.js";
export type {
  RunOptions,
  RunResult,
  StatusOptions,
  StatusResult,
} from "./cli-handlers/workflow.js";

export {
  proposeTransition,
  approveTransition,
  rejectTransition,
} from "./cli-handlers/transitions.js";
export type {
  ProposeTransitionOptions,
  ProposeTransitionResult,
  ApproveTransitionOptions,
  ApproveTransitionResult,
  RejectTransitionOptions,
  RejectTransitionResult,
} from "./cli-handlers/transitions.js";

export { abandonWorkflow, recoverWorkflow } from "./cli-handlers/lifecycle.js";
export type {
  AbandonOptions,
  AbandonResult,
  RecoverOptions,
  RecoverResult,
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
