import type { MigrationAdaptation } from "./types.js";
import { MIGRATION_PROFILES } from "./profiles.js";

export function resolveMigrationAdaptation(input: MigrationAdaptation): MigrationAdaptation {
  const base =
    input.profile !== undefined ? MIGRATION_PROFILES[input.profile] : MIGRATION_PROFILES.data;
  return { ...base, ...input };
}

export function serializeMigrationAdaptation(a: MigrationAdaptation): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.profile !== undefined) out["profile"] = a.profile;
  if (a.riskLevel !== undefined) out["risk_level"] = a.riskLevel;
  if (a.rollbackTested !== undefined) out["rollback_tested"] = a.rollbackTested;
  if (a.executeMode !== undefined) out["execute_mode"] = a.executeMode;
  if (a.grill !== undefined) out["grill"] = a.grill;
  if (a.interactive !== undefined) out["interactive"] = a.interactive;
  return out;
}
