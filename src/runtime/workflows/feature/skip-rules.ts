import type { FeatureAdaptation } from "./types.js";
import { FEATURE_PHASE_ORDER } from "./types.js";
import { computeNextPhase } from "../phase-walker.js";

/**
 * Skip rule for feature: `decompose` skipped when complexity is trivial OR
 * scope is single (no point splitting one file across slices).
 */
export function computeFeatureSkipPhases(adaptation: FeatureAdaptation): readonly string[] {
  const skip: string[] = [];
  if (adaptation.complexity === "trivial" || adaptation.scope === "single") {
    skip.push("decompose");
  }
  return skip;
}

export function computeFeatureNextPhase(
  currentPhase: string,
  adaptation: FeatureAdaptation,
): string | null {
  return computeNextPhase(FEATURE_PHASE_ORDER, computeFeatureSkipPhases(adaptation), currentPhase);
}
