import { describe, it, expect } from 'vitest';
import {
  BUILTIN_PRESETS,
  getBuiltinPresetDefinition,
  getBuiltinPresetNames,
} from '../../../../src/templates/presets/index.js';
import { FLAG_CATALOG } from '../../../../src/core/flags/flag-catalog.js';

const ALL_PRESET_NAMES = [
  'minimal', 'balanced', 'strict',
  'python-web', 'typescript-fullstack', 'security-hardened', 'codi-development',
  'power-user', 'data-ml',
];

const catalogKeys = Object.keys(FLAG_CATALOG).sort();

describe('unified preset registry', () => {
  it('contains all 9 presets', () => {
    expect(getBuiltinPresetNames().sort()).toEqual(ALL_PRESET_NAMES.sort());
  });

  it('each preset is retrievable by name', () => {
    for (const name of ALL_PRESET_NAMES) {
      const def = getBuiltinPresetDefinition(name);
      expect(def).toBeDefined();
      expect(def!.name).toBe(name);
    }
  });

  it('each preset has a non-empty description', () => {
    for (const name of ALL_PRESET_NAMES) {
      const def = BUILTIN_PRESETS[name]!;
      expect(def.description.length).toBeGreaterThan(10);
    }
  });

  it('returns undefined for unknown preset', () => {
    expect(getBuiltinPresetDefinition('nonexistent')).toBeUndefined();
  });
});

describe('flat preset flags', () => {
  it('each preset has all 18 flags inline', () => {
    for (const name of ALL_PRESET_NAMES) {
      const def = BUILTIN_PRESETS[name]!;
      expect(Object.keys(def.flags).sort()).toEqual(catalogKeys);
    }
  });

  it('no preset has an extends field', () => {
    for (const name of ALL_PRESET_NAMES) {
      const def = BUILTIN_PRESETS[name]!;
      expect('extends' in def).toBe(false);
    }
  });

  it('python-web has enforced type_checking', () => {
    const def = BUILTIN_PRESETS['python-web']!;
    expect(def.flags['type_checking']!.mode).toBe('enforced');
  });

  it('security-hardened has locked flags', () => {
    const def = BUILTIN_PRESETS['security-hardened']!;
    expect(def.flags['security_scan']!.locked).toBe(true);
    expect(def.flags['allow_shell_commands']!.locked).toBe(true);
    expect(def.flags['allow_file_deletion']!.locked).toBe(true);
  });
});
