import type { MigrationAdaptation } from "./types.js";
import { MIGRATION_PHASE_ORDER } from "./types.js";
import { computeNextPhase } from "../phase-walker.js";

/**
 * `data-validation` phase skipped only when risk is low AND rollback was
 * tested — schema-only migrations with verified rollback don't need the
 * post-execute data sanity pass.
 */
export function computeMigrationSkipPhases(adaptation: MigrationAdaptation): readonly string[] {
  const skip: string[] = [];
  if (adaptation.riskLevel === "low" && adaptation.rollbackTested === true) {
    skip.push("data-validation");
  }
  return skip;
}

export function computeMigrationNextPhase(
  currentPhase: string,
  adaptation: MigrationAdaptation,
): string | null {
  return computeNextPhase(
    MIGRATION_PHASE_ORDER,
    computeMigrationSkipPhases(adaptation),
    currentPhase,
  );
}
