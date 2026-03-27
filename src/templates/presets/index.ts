import { preset as minimal } from './minimal.js';
import { preset as balanced } from './balanced.js';
import { preset as strict } from './strict.js';
import { preset as pythonWeb } from './python-web.js';
import { preset as typescriptFullstack } from './typescript-fullstack.js';
import { preset as securityHardened } from './security-hardened.js';
import { preset as codiDevelopment } from './codi-development.js';
import { preset as powerUser } from './power-user.js';
import { preset as dataMl } from './data-ml.js';
import type { BuiltinPresetDefinition } from './types.js';

export { minimal, balanced, strict, pythonWeb, typescriptFullstack, securityHardened, codiDevelopment, powerUser, dataMl };

export const BUILTIN_PRESETS: Record<string, BuiltinPresetDefinition> = {
  'minimal': minimal,
  'balanced': balanced,
  'strict': strict,
  'python-web': pythonWeb,
  'typescript-fullstack': typescriptFullstack,
  'security-hardened': securityHardened,
  'codi-development': codiDevelopment,
  'power-user': powerUser,
  'data-ml': dataMl,
};

export function getBuiltinPresetDefinition(name: string): BuiltinPresetDefinition | undefined {
  return BUILTIN_PRESETS[name];
}

export function getBuiltinPresetNames(): string[] {
  return Object.keys(BUILTIN_PRESETS);
}

export type { BuiltinPresetDefinition } from './types.js';
