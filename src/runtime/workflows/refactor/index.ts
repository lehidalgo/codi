import type { WorkflowAdapter } from "../types.js";
import type { RefactorAdaptation } from "./types.js";
import { REFACTOR_PHASE_ORDER } from "./types.js";
import { VALID_REFACTOR_PROFILES } from "./profiles.js";
import { resolveRefactorAdaptation, serializeRefactorAdaptation } from "./resolver.js";
import { computeRefactorSkipPhases } from "./skip-rules.js";
import { buildRefactorAdaptation } from "./cli-flags.js";

export const refactorAdapter: WorkflowAdapter<RefactorAdaptation> = {
  id: "refactor",
  phaseOrder: REFACTOR_PHASE_ORDER,
  profiles: VALID_REFACTOR_PROFILES,
  resolve: resolveRefactorAdaptation,
  serialize: serializeRefactorAdaptation,
  computeSkipPhases: computeRefactorSkipPhases,
  buildFromCliFlags: buildRefactorAdaptation,
};

export type {
  RefactorAdaptation,
  RefactorProfile,
  RefactorKind,
  RefactorScope,
  RefactorExecuteMode,
} from "./types.js";
export { resolveRefactorAdaptation } from "./resolver.js";
export { computeRefactorSkipPhases, computeRefactorNextPhase } from "./skip-rules.js";
