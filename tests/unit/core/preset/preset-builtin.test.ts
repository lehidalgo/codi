import { describe, it, expect } from 'vitest';
import { isBuiltinPreset, materializeBuiltinPreset } from '../../../../src/core/preset/preset-builtin.js';

describe('isBuiltinPreset', () => {
  it('recognizes flag-only presets (minimal, balanced, strict)', () => {
    expect(isBuiltinPreset('minimal')).toBe(true);
    expect(isBuiltinPreset('balanced')).toBe(true);
    expect(isBuiltinPreset('strict')).toBe(true);
  });

  it('recognizes full built-in presets', () => {
    expect(isBuiltinPreset('python-web')).toBe(true);
    expect(isBuiltinPreset('typescript-fullstack')).toBe(true);
    expect(isBuiltinPreset('security-hardened')).toBe(true);
  });

  it('returns false for unknown presets', () => {
    expect(isBuiltinPreset('nonexistent-preset')).toBe(false);
    expect(isBuiltinPreset('')).toBe(false);
    expect(isBuiltinPreset('my-custom')).toBe(false);
  });
});

describe('materializeBuiltinPreset', () => {
  it('materializes a flag-only preset', () => {
    const result = materializeBuiltinPreset('balanced');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('balanced');
      expect(result.data.flags).toBeDefined();
      expect(Object.keys(result.data.flags).length).toBeGreaterThan(0);
      expect(result.data.rules).toEqual([]);
      expect(result.data.skills).toEqual([]);
      expect(result.data.agents).toEqual([]);
      expect(result.data.commands).toEqual([]);
    }
  });

  it('materializes a full built-in preset with artifacts', () => {
    const result = materializeBuiltinPreset('python-web');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('python-web');
      expect(result.data.description).toBeTruthy();
      expect(result.data.flags).toBeDefined();
    }
  });

  it('materializes security-hardened preset', () => {
    const result = materializeBuiltinPreset('security-hardened');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('security-hardened');
    }
  });

  it('returns error for unknown preset', () => {
    const result = materializeBuiltinPreset('does-not-exist');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('flag-only presets have mcp with empty servers', () => {
    const result = materializeBuiltinPreset('strict');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mcp).toEqual({ servers: {} });
    }
  });
});
