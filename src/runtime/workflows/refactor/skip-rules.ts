import type { RefactorAdaptation } from "./types.js";
import { REFACTOR_PHASE_ORDER } from "./types.js";
import { computeNextPhase } from "../phase-walker.js";

/**
 * Refactor has no `decompose` phase; baseline is the only optional skip
 * (dead-code removal preserves no behaviour, so a baseline capture is moot).
 */
export function computeRefactorSkipPhases(adaptation: RefactorAdaptation): readonly string[] {
  const skip: string[] = [];
  if (adaptation.kind === "deadcode") skip.push("baseline");
  return skip;
}

export function computeRefactorNextPhase(
  currentPhase: string,
  adaptation: RefactorAdaptation,
): string | null {
  return computeNextPhase(
    REFACTOR_PHASE_ORDER,
    computeRefactorSkipPhases(adaptation),
    currentPhase,
  );
}
