import type { ResolvedFlags, FlagDefinition } from "../../types/flags.js";

/**
 * Converts raw flag definitions into resolved flags with source tracking.
 */
export function flagsFromDefinitions(
  defs: Record<string, FlagDefinition>,
  source: string,
): ResolvedFlags {
  const resolved: ResolvedFlags = {};
  for (const [key, def] of Object.entries(defs)) {
    resolved[key] = {
      value: def.value,
      mode: def.mode,
      source,
      locked: def.locked ?? false,
    };
  }
  return resolved;
}
