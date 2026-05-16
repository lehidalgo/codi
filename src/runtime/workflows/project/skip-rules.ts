import type { ProjectAdaptation } from "./types.js";
import { PROJECT_PHASE_ORDER } from "./types.js";
import { computeNextPhase } from "../phase-walker.js";

/**
 * `sync` phase skipped when the dev runs without a Google Sheet —
 * project bootstraps locally to `.codi/project.yaml`, sync deferred.
 */
export function computeProjectSkipPhases(adaptation: ProjectAdaptation): readonly string[] {
  const skip: string[] = [];
  if (adaptation.noSheet === true) skip.push("sync");
  return skip;
}

export function computeProjectNextPhase(
  currentPhase: string,
  adaptation: ProjectAdaptation,
): string | null {
  return computeNextPhase(PROJECT_PHASE_ORDER, computeProjectSkipPhases(adaptation), currentPhase);
}
