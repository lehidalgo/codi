import type { BugFixAdaptation } from "./types.js";
import { BUGFIX_PHASE_ORDER } from "./types.js";
import { computeNextPhase } from "../phase-walker.js";

/**
 * Skip rules for bug-fix:
 *   - reproduce → skipped when `reproducerExists === true`
 *   - plan      → skipped when `rootCauseKnown === true`
 */
export function computeBugFixSkipPhases(adaptation: BugFixAdaptation): readonly string[] {
  const skip: string[] = [];
  if (adaptation.reproducerExists === true) skip.push("reproduce");
  if (adaptation.rootCauseKnown === true) skip.push("plan");
  return skip;
}

export function computeBugFixNextPhase(
  currentPhase: string,
  adaptation: BugFixAdaptation,
): string | null {
  return computeNextPhase(BUGFIX_PHASE_ORDER, computeBugFixSkipPhases(adaptation), currentPhase);
}
