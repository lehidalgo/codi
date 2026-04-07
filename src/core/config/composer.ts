import type { ResolvedFlags, FlagDefinition } from "#src/types/flags.js";

/**
 * Converts raw flag definitions (as stored in `flags.yaml`) into resolved flags
 * with source tracking.
 *
 * Each resolved flag records the path of the `flags.yaml` file it came from,
 * enabling drift detection and audit logging.
 *
 * @param defs - Raw flag definitions keyed by flag name
 * @param source - Absolute path to the `flags.yaml` file these definitions were read from
 * @returns A `ResolvedFlags` map ready for use in `NormalizedConfig`
 *
 * @example
 * ```ts
 * const resolved = flagsFromDefinitions(
 *   { 'max-file-lines': { mode: 'enforced', value: 700, locked: false } },
 *   '/path/to/.codi/flags.yaml'
 * );
 * ```
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
