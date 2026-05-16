import type {
  MigrationAdaptation,
  MigrationExecuteMode,
  MigrationProfile,
  MigrationRiskLevel,
} from "./types.js";
import { VALID_MIGRATION_PROFILES } from "./profiles.js";
import { resolveMigrationAdaptation } from "./resolver.js";
import type { WorkflowRunFlags } from "../types.js";

const VALID_RISK_LEVELS: ReadonlyArray<MigrationRiskLevel> = ["low", "medium", "high"];
const VALID_EXECUTE_MODES: ReadonlyArray<MigrationExecuteMode> = ["inline", "subagent"];

export function buildMigrationAdaptation(
  opts: WorkflowRunFlags,
): MigrationAdaptation | Error | undefined {
  const supplied =
    opts.profile !== undefined ||
    opts.riskLevel !== undefined ||
    opts.rollbackTested !== undefined ||
    opts.executeMode !== undefined ||
    opts.grill !== undefined ||
    opts.interactive !== undefined;
  if (!supplied) return undefined;

  const partial: MigrationAdaptation = {};
  if (opts.profile !== undefined) {
    if (!(VALID_MIGRATION_PROFILES as readonly string[]).includes(opts.profile)) {
      return new Error(
        `unknown --profile '${opts.profile}' for migration. Valid: ${VALID_MIGRATION_PROFILES.join(", ")}`,
      );
    }
    partial.profile = opts.profile as MigrationProfile;
  }
  if (opts.riskLevel !== undefined) {
    if (!(VALID_RISK_LEVELS as readonly string[]).includes(opts.riskLevel)) {
      return new Error(
        `unknown --risk-level '${opts.riskLevel}'. Valid: ${VALID_RISK_LEVELS.join(", ")}`,
      );
    }
    partial.riskLevel = opts.riskLevel as MigrationRiskLevel;
  }
  if (opts.executeMode !== undefined) {
    if (!(VALID_EXECUTE_MODES as readonly string[]).includes(opts.executeMode)) {
      return new Error(
        `unknown --execute-mode '${opts.executeMode}'. Valid: ${VALID_EXECUTE_MODES.join(", ")}`,
      );
    }
    partial.executeMode = opts.executeMode as MigrationExecuteMode;
  }
  if (opts.rollbackTested !== undefined) partial.rollbackTested = opts.rollbackTested;
  if (opts.grill !== undefined) partial.grill = opts.grill;
  if (opts.interactive !== undefined) partial.interactive = opts.interactive;

  return resolveMigrationAdaptation(partial);
}
