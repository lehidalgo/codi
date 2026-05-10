import type { WorkflowAdapter } from "../types.js";
import type { MigrationAdaptation } from "./types.js";
import { MIGRATION_PHASE_ORDER } from "./types.js";
import { VALID_MIGRATION_PROFILES } from "./profiles.js";
import { resolveMigrationAdaptation, serializeMigrationAdaptation } from "./resolver.js";
import { computeMigrationSkipPhases } from "./skip-rules.js";
import { buildMigrationAdaptation } from "./cli-flags.js";

export const migrationAdapter: WorkflowAdapter<MigrationAdaptation> = {
  id: "migration",
  phaseOrder: MIGRATION_PHASE_ORDER,
  profiles: VALID_MIGRATION_PROFILES,
  resolve: resolveMigrationAdaptation,
  serialize: serializeMigrationAdaptation,
  computeSkipPhases: computeMigrationSkipPhases,
  buildFromCliFlags: buildMigrationAdaptation,
};

export type {
  MigrationAdaptation,
  MigrationProfile,
  MigrationRiskLevel,
  MigrationExecuteMode,
} from "./types.js";
export { resolveMigrationAdaptation } from "./resolver.js";
export { computeMigrationSkipPhases, computeMigrationNextPhase } from "./skip-rules.js";
