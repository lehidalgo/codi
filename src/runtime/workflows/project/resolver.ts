import type { ProjectAdaptation } from "./types.js";
import { PROJECT_PROFILES } from "./profiles.js";

export function resolveProjectAdaptation(input: ProjectAdaptation): ProjectAdaptation {
  const base =
    input.profile !== undefined ? PROJECT_PROFILES[input.profile] : PROJECT_PROFILES.standard;
  return { ...base, ...input };
}

export function serializeProjectAdaptation(a: ProjectAdaptation): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.profile !== undefined) out["profile"] = a.profile;
  if (a.mode !== undefined) out["mode"] = a.mode;
  if (a.noSheet !== undefined) out["no_sheet"] = a.noSheet;
  if (a.grill !== undefined) out["grill"] = a.grill;
  if (a.interactive !== undefined) out["interactive"] = a.interactive;
  return out;
}
