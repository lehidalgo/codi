import type { WorkflowAdapter } from "../types.js";
import type { FeatureAdaptation } from "./types.js";
import { FEATURE_PHASE_ORDER } from "./types.js";
import { VALID_FEATURE_PROFILES } from "./profiles.js";
import { resolveFeatureAdaptation, serializeFeatureAdaptation } from "./resolver.js";
import { computeFeatureSkipPhases } from "./skip-rules.js";
import { buildFeatureAdaptation } from "./cli-flags.js";

export const featureAdapter: WorkflowAdapter<FeatureAdaptation> = {
  id: "feature",
  phaseOrder: FEATURE_PHASE_ORDER,
  profiles: VALID_FEATURE_PROFILES,
  resolve: resolveFeatureAdaptation,
  serialize: serializeFeatureAdaptation,
  computeSkipPhases: computeFeatureSkipPhases,
  buildFromCliFlags: buildFeatureAdaptation,
};

export type {
  FeatureAdaptation,
  FeatureProfile,
  FeatureComplexity,
  FeatureScope,
  FeatureExecuteMode,
} from "./types.js";
export { resolveFeatureAdaptation } from "./resolver.js";
export { computeFeatureSkipPhases, computeFeatureNextPhase } from "./skip-rules.js";
