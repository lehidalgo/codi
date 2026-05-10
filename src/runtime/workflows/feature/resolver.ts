import type { FeatureAdaptation } from "./types.js";
import { FEATURE_PROFILES } from "./profiles.js";

export function resolveFeatureAdaptation(input: FeatureAdaptation): FeatureAdaptation {
  const base =
    input.profile !== undefined ? FEATURE_PROFILES[input.profile] : FEATURE_PROFILES.standard;
  return { ...base, ...input };
}

export function serializeFeatureAdaptation(a: FeatureAdaptation): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.profile !== undefined) out["profile"] = a.profile;
  if (a.complexity !== undefined) out["complexity"] = a.complexity;
  if (a.designExists !== undefined) out["design_exists"] = a.designExists;
  if (a.scope !== undefined) out["scope"] = a.scope;
  if (a.executeMode !== undefined) out["execute_mode"] = a.executeMode;
  if (a.tddStrict !== undefined) out["tdd_strict"] = a.tddStrict;
  if (a.grill !== undefined) out["grill"] = a.grill;
  if (a.interactive !== undefined) out["interactive"] = a.interactive;
  return out;
}
