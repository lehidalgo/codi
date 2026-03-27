import { preset as minimal } from './minimal.js';
import { preset as balanced } from './balanced.js';
import { preset as strict } from './strict.js';
import { preset as pythonWeb } from './python-web.js';
import { preset as typescriptFullstack } from './typescript-fullstack.js';
import { preset as securityHardened } from './security-hardened.js';
import { preset as codiDevelopment } from './codi-development.js';
import type { BuiltinPresetDefinition } from './types.js';

export { minimal, balanced, strict, pythonWeb, typescriptFullstack, securityHardened, codiDevelopment };

export const BUILTIN_PRESETS: Record<string, BuiltinPresetDefinition> = {
  'minimal': minimal,
  'balanced': balanced,
  'strict': strict,
  'python-web': pythonWeb,
  'typescript-fullstack': typescriptFullstack,
  'security-hardened': securityHardened,
  'codi-development': codiDevelopment,
};

export function getBuiltinPresetDefinition(name: string): BuiltinPresetDefinition | undefined {
  return BUILTIN_PRESETS[name];
}

export function getBuiltinPresetNames(): string[] {
  return Object.keys(BUILTIN_PRESETS);
}

/**
 * Resolves a preset by name, merging parent flags if `extends` is set.
 * Returns the preset with all inherited flags resolved.
 */
export function resolvePreset(name: string): BuiltinPresetDefinition | undefined {
  const def = BUILTIN_PRESETS[name];
  if (!def) return undefined;

  if (!def.extends || !(def.extends in BUILTIN_PRESETS)) return def;

  const parent = resolvePreset(def.extends);
  if (!parent) return def;

  const { extends: _, ...rest } = def;
  return { ...rest, flags: { ...parent.flags, ...def.flags } };
}

export type { BuiltinPresetDefinition } from './types.js';
