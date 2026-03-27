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
  it('materializes balanced preset with artifacts', () => {
    const result = materializeBuiltinPreset('balanced');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('balanced');
      expect(result.data.description).toBe('Recommended — security on, type-checking strict, no force-push');
      expect(result.data.flags).toBeDefined();
      expect(Object.keys(result.data.flags).length).toBe(18);
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

  it('presets have mcp with empty servers', () => {
    const result = materializeBuiltinPreset('strict');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mcp).toEqual({ servers: {} });
    }
  });
});
