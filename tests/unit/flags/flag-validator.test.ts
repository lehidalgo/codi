import { describe, it, expect } from 'vitest';
import { validateFlags } from '../../../src/core/flags/flag-validator.js';
import type { FlagLayer } from '../../../src/core/flags/flag-resolver.js';
import { FLAG_CATALOG, getDefaultFlags } from '../../../src/core/flags/flag-catalog.js';

function layer(
  level: string,
  flags: FlagLayer['flags'],
  source?: string,
): FlagLayer {
  return { level, source: source ?? `${level}.yaml`, flags };
}

const resolved = getDefaultFlags();

describe('validateFlags', () => {
  // Rule 1: Locked fields cannot be overridden by lower levels
  it('rule 1: locked flag override produces error', () => {
    const layers = [
      layer('repo', {
        security_scan: { mode: 'enforced', value: true, locked: true },
      }),
      layer('user', {
        security_scan: { mode: 'enabled', value: false },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_LOCKED')).toBe(true);
  });

  // Rule 2: enforced mode cannot have conditions
  it('rule 2: enforced with conditions produces error', () => {
    const layers = [
      layer('repo', {
        auto_commit: {
          mode: 'enforced',
          value: true,
          conditions: { lang: ['typescript'] },
        },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_MODE')).toBe(true);
    expect(
      errors.some((e) => e.message.includes('enforced mode cannot have conditions')),
    ).toBe(true);
  });

  // Rule 3: conditional mode requires non-empty conditions
  it('rule 3: conditional without conditions produces error', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'conditional', value: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_MODE')).toBe(true);
    expect(
      errors.some((e) => e.message.includes('conditional mode requires')),
    ).toBe(true);
  });

  it('rule 3: conditional with empty conditions produces error', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'conditional', value: true, conditions: {} },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_MODE')).toBe(true);
  });

  // Rule 4: conditions only accept valid keys
  it('rule 4: invalid condition key produces error', () => {
    const layers = [
      layer('repo', {
        auto_commit: {
          mode: 'conditional',
          value: true,
          conditions: { lang: ['ts'], invalid_key: ['x'] } as Record<string, string[]>,
        },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_CONDITION')).toBe(true);
  });

  // Rule 7: Boolean flags accept only true/false
  it('rule 7: boolean flag with string value produces error', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: 'yes' },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_VALUE')).toBe(true);
  });

  it('rule 7: boolean flag with number value produces error', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: 1 },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_VALUE')).toBe(true);
  });

  it('rule 7: boolean flag with true is valid', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });

  // Rule 8: Number flags must be positive integers > 0
  it('rule 8: number flag with 0 produces error', () => {
    const layers = [
      layer('repo', {
        max_file_lines: { mode: 'enabled', value: 0 },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_VALUE')).toBe(true);
  });

  it('rule 8: number flag with negative produces error', () => {
    const layers = [
      layer('repo', {
        max_file_lines: { mode: 'enabled', value: -5 },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_VALUE')).toBe(true);
  });

  it('rule 8: number flag with float produces error', () => {
    const layers = [
      layer('repo', {
        max_file_lines: { mode: 'enabled', value: 3.5 },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_VALUE')).toBe(true);
  });

  it('rule 8: valid positive integer is accepted', () => {
    const layers = [
      layer('repo', {
        max_file_lines: { mode: 'enabled', value: 500 },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });

  // Rule 9: Enum flags must use defined values
  it('rule 9: enum flag with invalid value produces error', () => {
    const layers = [
      layer('repo', {
        type_checking: { mode: 'enabled', value: 'invalid' },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_VALUE')).toBe(true);
  });

  it('rule 9: valid enum value is accepted', () => {
    const layers = [
      layer('repo', {
        type_checking: { mode: 'enabled', value: 'basic' },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });

  // String array validation
  it('string array flag with non-array produces error', () => {
    const layers = [
      layer('repo', {
        mcp_allowed_servers: { mode: 'enabled', value: 'github' },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_VALUE')).toBe(true);
  });

  it('string array flag with valid array is accepted', () => {
    const layers = [
      layer('repo', {
        mcp_allowed_servers: { mode: 'enabled', value: ['github', 'jira'] },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });

  it('string array flag with non-string elements produces error', () => {
    const layers = [
      layer('repo', {
        mcp_allowed_servers: { mode: 'enabled', value: [1, 2] },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_VALUE')).toBe(true);
  });

  // Rule 11: Only org, team, and repo levels can use locked:true
  it('rule 11: locked at org level is valid', () => {
    const layers = [
      layer('org', {
        security_scan: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });

  it('rule 11: locked at team level is valid', () => {
    const layers = [
      layer('team', {
        security_scan: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });

  it('rule 11: locked at framework level produces error', () => {
    const layers = [
      layer('framework', {
        auto_commit: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_LOCKED_LEVEL')).toBe(true);
  });

  it('rule 11: locked at agent level produces error', () => {
    const layers = [
      layer('agent', {
        auto_commit: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_LOCKED_LEVEL')).toBe(true);
  });

  it('rule 11: locked at user level produces error', () => {
    const layers = [
      layer('user', {
        auto_commit: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_LOCKED_LEVEL')).toBe(true);
  });

  it('rule 11: locked at lang level produces error', () => {
    const layers = [
      layer('lang', {
        auto_commit: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_LOCKED_LEVEL')).toBe(true);
  });

  it('rule 11: locked at repo level is valid', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });

  // Rule 13: enforced flag hook cannot be disabled
  it('rule 13: enforced flag with disabled hook produces error', () => {
    const layers = [
      layer('repo', {
        security_scan: { mode: 'enforced', value: true },
      }),
    ];
    const hooks = { 'secret-detection': false };
    const errors = validateFlags(layers, resolved, FLAG_CATALOG, hooks);
    expect(errors.some((e) => e.code === 'E_FLAG_INVALID_MODE')).toBe(true);
    expect(errors.some((e) => e.message.includes('hook'))).toBe(true);
  });

  it('rule 13: enforced flag with enabled hook is valid', () => {
    const layers = [
      layer('repo', {
        security_scan: { mode: 'enforced', value: true },
      }),
    ];
    const hooks = { 'secret-detection': true };
    const errors = validateFlags(layers, resolved, FLAG_CATALOG, hooks);
    expect(errors).toHaveLength(0);
  });

  // Unknown flag
  it('unknown flag produces error', () => {
    const layers = [
      layer('repo', {
        nonexistent: { mode: 'enabled', value: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_UNKNOWN')).toBe(true);
  });

  // Valid configuration
  it('valid configuration produces no errors', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: false },
        security_scan: { mode: 'enforced', value: true, locked: true },
        max_file_lines: { mode: 'enabled', value: 500 },
        type_checking: { mode: 'enabled', value: 'strict' },
      }),
      layer('user', {
        auto_commit: { mode: 'enabled', value: true },
      }),
    ];
    const errors = validateFlags(layers, resolved, FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });
});
