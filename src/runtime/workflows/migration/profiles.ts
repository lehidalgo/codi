import type { MigrationAdaptation, MigrationProfile } from "./types.js";

export const MIGRATION_PROFILES: Record<MigrationProfile, MigrationAdaptation> = {
  schema: {
    profile: "schema",
    riskLevel: "low",
    rollbackTested: true,
    executeMode: "inline",
    grill: false,
  },
  data: {
    profile: "data",
    riskLevel: "medium",
    rollbackTested: false,
    executeMode: "inline",
    grill: false,
  },
  deep: {
    profile: "deep",
    riskLevel: "high",
    rollbackTested: false,
    executeMode: "subagent",
    grill: true,
  },
};

export const VALID_MIGRATION_PROFILES: ReadonlyArray<MigrationProfile> = ["schema", "data", "deep"];
