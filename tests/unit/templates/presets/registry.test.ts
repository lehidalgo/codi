import { describe, it, expect } from 'vitest';
import {
  BUILTIN_PRESETS,
  getBuiltinPresetDefinition,
  getBuiltinPresetNames,
  resolvePreset,
} from '../../../../src/templates/presets/index.js';
import { FLAG_CATALOG } from '../../../../src/core/flags/flag-catalog.js';

const ALL_PRESET_NAMES = [
  'minimal', 'balanced', 'strict',
  'python-web', 'typescript-fullstack', 'security-hardened', 'codi-development',
];

describe('unified preset registry', () => {
  it('contains all 7 presets', () => {
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
    expect(resolvePreset('nonexistent')).toBeUndefined();
  });
});

describe('resolvePreset', () => {
  const catalogKeys = Object.keys(FLAG_CATALOG).sort();

  it('resolves base presets (no extends) with all 18 flags', () => {
    for (const name of ['minimal', 'balanced', 'strict']) {
      const resolved = resolvePreset(name);
      expect(resolved).toBeDefined();
      expect(Object.keys(resolved!.flags).sort()).toEqual(catalogKeys);
    }
  });

  it('resolves extended presets with all 18 flags after inheritance', () => {
    for (const name of ['python-web', 'typescript-fullstack', 'security-hardened', 'codi-development']) {
      const resolved = resolvePreset(name);
      expect(resolved).toBeDefined();
      expect(Object.keys(resolved!.flags).sort()).toEqual(catalogKeys);
    }
  });

  it('child flag overrides win over parent flags', () => {
    const pythonWeb = resolvePreset('python-web');
    expect(pythonWeb).toBeDefined();
    // python-web extends balanced and overrides type_checking to enforced
    expect(pythonWeb!.flags['type_checking']!.mode).toBe('enforced');
    // balanced has type_checking as enabled
    const balanced = resolvePreset('balanced');
    expect(balanced!.flags['type_checking']!.mode).toBe('enabled');
  });

  it('resolved preset does not contain extends field', () => {
    const resolved = resolvePreset('codi-development');
    expect(resolved).toBeDefined();
    expect('extends' in resolved!).toBe(false);
  });

  it('base presets resolve to themselves', () => {
    const balanced = resolvePreset('balanced');
    const raw = BUILTIN_PRESETS['balanced']!;
    expect(balanced!.flags).toEqual(raw.flags);
  });
});
