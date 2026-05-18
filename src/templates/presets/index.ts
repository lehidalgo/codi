import { prefixedName } from "#src/constants.js";
import { preset as defaultPreset } from "./default.js";
import type { BuiltinPresetDefinition } from "./types.js";

export { defaultPreset };

/**
 * Single registered preset after ADR-013.
 *
 * minimal / balanced / strict / fullstack / development / power-user were retired;
 * codi-default is the sole canonical install. The preset abstraction (resolver,
 * flag system, wizard) is retained so adding presets again later is cheap.
 */
export const BUILTIN_PRESETS: Record<string, BuiltinPresetDefinition> = {
  [prefixedName("default")]: defaultPreset,
};

export function getBuiltinPresetDefinition(
  name: string,
): BuiltinPresetDefinition | undefined {
  return BUILTIN_PRESETS[name];
}

export function getBuiltinPresetNames(): string[] {
  return Object.keys(BUILTIN_PRESETS);
}

export type { BuiltinPresetDefinition } from "./types.js";
