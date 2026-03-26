export { preset as pythonWeb } from './python-web.js';
export { preset as typescriptFullstack } from './typescript-fullstack.js';
export { preset as securityHardened } from './security-hardened.js';
export { preset as codiDevelopment } from './codi-development.js';

import { preset as pythonWeb } from './python-web.js';
import { preset as typescriptFullstack } from './typescript-fullstack.js';
import { preset as securityHardened } from './security-hardened.js';
import { preset as codiDevelopment } from './codi-development.js';
import type { BuiltinPresetDefinition } from './types.js';

export const BUILTIN_PRESETS: Record<string, BuiltinPresetDefinition> = {
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

export type { BuiltinPresetDefinition } from './types.js';
