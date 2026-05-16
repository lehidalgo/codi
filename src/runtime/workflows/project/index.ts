import type { WorkflowAdapter } from "../types.js";
import type { ProjectAdaptation } from "./types.js";
import { PROJECT_PHASE_ORDER } from "./types.js";
import { VALID_PROJECT_PROFILES } from "./profiles.js";
import { resolveProjectAdaptation, serializeProjectAdaptation } from "./resolver.js";
import { computeProjectSkipPhases } from "./skip-rules.js";
import { buildProjectAdaptation } from "./cli-flags.js";

export const projectAdapter: WorkflowAdapter<ProjectAdaptation> = {
  id: "project",
  phaseOrder: PROJECT_PHASE_ORDER,
  profiles: VALID_PROJECT_PROFILES,
  resolve: resolveProjectAdaptation,
  serialize: serializeProjectAdaptation,
  computeSkipPhases: computeProjectSkipPhases,
  buildFromCliFlags: buildProjectAdaptation,
};

export type { ProjectAdaptation, ProjectProfile, ProjectMode } from "./types.js";
export { resolveProjectAdaptation } from "./resolver.js";
export { computeProjectSkipPhases, computeProjectNextPhase } from "./skip-rules.js";
