import type { FlagDefinition } from "../../types/flags.js";
import { prefixedName } from "../../constants.js";
import {
  BUILTIN_PRESETS,
  getBuiltinPresetDefinition,
} from "../../templates/presets/index.js";

/**
 * Thin shim — delegates to the unified preset registry.
 * Preserves the original API for existing consumers.
 */

const BASE_PRESET_NAMES = [
  prefixedName("minimal"),
  prefixedName("balanced"),
  prefixedName("strict"),
] as const;

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
  [prefixedName("minimal")]:
    BUILTIN_PRESETS[prefixedName("minimal")]!.description,
  [prefixedName("balanced")]:
    BUILTIN_PRESETS[prefixedName("balanced")]!.description,
  [prefixedName("strict")]:
    BUILTIN_PRESETS[prefixedName("strict")]!.description,
};
