import type { BugFixAdaptation } from "./types.js";
import { BUGFIX_PROFILES } from "./profiles.js";

/**
 * Resolve a partial adaptation into a full one by layering: profile defaults
 * first, then explicit field overrides on top.
 */
export function resolveBugFixAdaptation(input: BugFixAdaptation): BugFixAdaptation {
  const base =
    input.profile !== undefined ? BUGFIX_PROFILES[input.profile] : BUGFIX_PROFILES.standard;
  return {
    ...base,
    ...input,
  };
}

/** Convert camelCase adaptation → snake_case JSON for the init event payload. */
export function serializeBugFixAdaptation(a: BugFixAdaptation): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.profile !== undefined) out["profile"] = a.profile;
  if (a.severity !== undefined) out["severity"] = a.severity;
  if (a.reproducerExists !== undefined) out["reproducer_exists"] = a.reproducerExists;
  if (a.rootCauseKnown !== undefined) out["root_cause_known"] = a.rootCauseKnown;
  if (a.scope !== undefined) out["scope"] = a.scope;
  if (a.executeMode !== undefined) out["execute_mode"] = a.executeMode;
  if (a.grill !== undefined) out["grill"] = a.grill;
  if (a.interactive !== undefined) out["interactive"] = a.interactive;
  return out;
}
