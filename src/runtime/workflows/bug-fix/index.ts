import type { WorkflowAdapter } from "../types.js";
import type { BugFixAdaptation } from "./types.js";
import { BUGFIX_PHASE_ORDER } from "./types.js";
import { VALID_BUGFIX_PROFILES } from "./profiles.js";
import { resolveBugFixAdaptation, serializeBugFixAdaptation } from "./resolver.js";
import { computeBugFixSkipPhases } from "./skip-rules.js";
import { buildBugFixAdaptation } from "./cli-flags.js";
import { runBugFixInteractiveIntake } from "./interactive.js";

export const bugFixAdapter: WorkflowAdapter<BugFixAdaptation> = {
  id: "bug-fix",
  phaseOrder: BUGFIX_PHASE_ORDER,
  profiles: VALID_BUGFIX_PROFILES,
  resolve: resolveBugFixAdaptation,
  serialize: serializeBugFixAdaptation,
  computeSkipPhases: computeBugFixSkipPhases,
  buildFromCliFlags: buildBugFixAdaptation,
  runInteractive: runBugFixInteractiveIntake,
};

export type {
  BugFixAdaptation,
  BugFixProfile,
  BugFixSeverity,
  BugFixScope,
  BugFixExecuteMode,
} from "./types.js";
export { resolveBugFixAdaptation } from "./resolver.js";
export { computeBugFixSkipPhases, computeBugFixNextPhase } from "./skip-rules.js";
