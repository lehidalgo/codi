export type MigrationProfile = "schema" | "data" | "deep";
export type MigrationRiskLevel = "low" | "medium" | "high";
export type MigrationExecuteMode = "inline" | "subagent";

export interface MigrationAdaptation {
  profile?: MigrationProfile;
  riskLevel?: MigrationRiskLevel;
  rollbackTested?: boolean;
  executeMode?: MigrationExecuteMode;
  grill?: boolean;
  interactive?: boolean;
}

export const MIGRATION_PHASE_ORDER = [
  "intent",
  "plan",
  "execute",
  "data-validation",
  "verify",
  "done",
] as const;
