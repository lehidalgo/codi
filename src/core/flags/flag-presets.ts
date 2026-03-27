import type { FlagDefinition } from '../../types/flags.js';
import { BUILTIN_PRESETS, getBuiltinPresetDefinition } from '../../templates/presets/index.js';

/**
 * Thin shim — delegates to the unified preset registry.
 * Preserves the original API for existing consumers.
 */

const BASE_PRESET_NAMES = ['minimal', 'balanced', 'strict'] as const;

export type PresetName = typeof BASE_PRESET_NAMES[number];

export function getPreset(name: PresetName): Record<string, FlagDefinition> {
  const def = getBuiltinPresetDefinition(name);
  if (!def) throw new Error(`Unknown preset: ${name}`);
  return structuredClone(def.flags);
}

export function getPresetNames(): PresetName[] {
  return [...BASE_PRESET_NAMES];
}

export const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  minimal: BUILTIN_PRESETS['minimal']!.description,
  balanced: BUILTIN_PRESETS['balanced']!.description,
  strict: BUILTIN_PRESETS['strict']!.description,
};
