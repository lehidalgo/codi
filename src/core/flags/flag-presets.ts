import type { FlagDefinition } from "#src/types/flags.js";
import { prefixedName } from "#src/constants.js";
import { BUILTIN_PRESETS, getBuiltinPresetDefinition } from "#src/templates/presets/index.js";

/**
 * Thin shim — delegates to the unified preset registry.
 * Preserves the original API for existing consumers.
 *
 * After ADR-013 there is a single registered preset (`codi-default`); the
 * shim keeps returning a list so callers that iterate keep working.
 */

const BASE_PRESET_NAMES = [prefixedName("default")] as const;

export type PresetName = (typeof BASE_PRESET_NAMES)[number];

export function getPreset(name: PresetName): Record<string, FlagDefinition> {
  const def = getBuiltinPresetDefinition(name);
  if (!def) throw new Error(`Unknown preset: ${name}`);
  return structuredClone(def.flags);
}

export function getPresetNames(): PresetName[] {
  return [...BASE_PRESET_NAMES];
}

export const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  [prefixedName("default")]: BUILTIN_PRESETS[prefixedName("default")]!.description,
};
