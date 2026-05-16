import type { RefactorAdaptation } from "./types.js";
import { REFACTOR_PROFILES } from "./profiles.js";

export function resolveRefactorAdaptation(input: RefactorAdaptation): RefactorAdaptation {
  const base =
    input.profile !== undefined ? REFACTOR_PROFILES[input.profile] : REFACTOR_PROFILES.standard;
  return { ...base, ...input };
}

export function serializeRefactorAdaptation(a: RefactorAdaptation): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.profile !== undefined) out["profile"] = a.profile;
  if (a.kind !== undefined) out["kind"] = a.kind;
  if (a.scope !== undefined) out["scope"] = a.scope;
  if (a.executeMode !== undefined) out["execute_mode"] = a.executeMode;
  if (a.grill !== undefined) out["grill"] = a.grill;
  if (a.interactive !== undefined) out["interactive"] = a.interactive;
  return out;
}
