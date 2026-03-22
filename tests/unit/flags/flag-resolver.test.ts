import { describe, it, expect } from 'vitest';
import { resolveFlags } from '../../../src/core/flags/flag-resolver.js';
import type { FlagLayer, ResolutionContext } from '../../../src/core/flags/flag-resolver.js';
import { FLAG_CATALOG } from '../../../src/core/flags/flag-catalog.js';

const emptyContext: ResolutionContext = {
  languages: [],
  frameworks: [],
  agents: [],
};

const tsContext: ResolutionContext = {
  languages: ['typescript'],
  frameworks: ['react'],
  agents: ['claude'],
};

function layer(
  level: string,
  flags: FlagLayer['flags'],
  source?: string,
): FlagLayer {
  return { level, source: source ?? `${level}.yaml`, flags };
}

describe('resolveFlags', () => {
  it('returns all defaults when no layers', () => {
    const result = resolveFlags([], emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data)).toHaveLength(8);
      expect(result.data['auto_commit']!.value).toBe(false);
      expect(result.data['max_file_lines']!.value).toBe(700);
    }
  });

  it('enforced at repo level sets value', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['auto_commit']!.value).toBe(true);
      expect(result.data['auto_commit']!.locked).toBe(true);
    }
  });

  it('enforced+locked at repo cannot be overridden by user', () => {
    const layers = [
      layer('repo', {
        security_scan: { mode: 'enforced', value: true, locked: true },
      }),
      layer('user', {
        security_scan: { mode: 'enabled', value: false },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E_FLAG_LOCKED');
    }
  });

  it('enabled at repo, disabled at user → user wins', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: true },
      }),
      layer('user', {
        auto_commit: { mode: 'disabled' },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['auto_commit']!.value).toBe(false);
      expect(result.data['auto_commit']!.mode).toBe('disabled');
    }
  });

  it('disabled at repo, enabled at lang → lang wins', () => {
    const layers = [
      layer('repo', {
        require_tests: { mode: 'disabled' },
      }),
      layer('lang', {
        require_tests: { mode: 'enabled', value: true },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['require_tests']!.value).toBe(true);
      expect(result.data['require_tests']!.mode).toBe('enabled');
    }
  });

  it('inherited mode skips (uses parent value)', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: true },
      }),
      layer('lang', {
        auto_commit: { mode: 'inherited' },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['auto_commit']!.value).toBe(true);
      expect(result.data['auto_commit']!.source).toBe('repo.yaml');
    }
  });

  it('delegated_to_agent_default uses catalog default', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: true },
      }),
      layer('agent', {
        auto_commit: { mode: 'delegated_to_agent_default' },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['auto_commit']!.value).toBe(false); // catalog default
      expect(result.data['auto_commit']!.mode).toBe('delegated_to_agent_default');
    }
  });

  it('conditional with matching context applies value', () => {
    const layers = [
      layer('lang', {
        type_checking: {
          mode: 'conditional',
          value: 'strict',
          conditions: { lang: ['typescript'] },
        },
      }),
    ];
    const result = resolveFlags(layers, tsContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['type_checking']!.value).toBe('strict');
      expect(result.data['type_checking']!.mode).toBe('conditional');
    }
  });

  it('conditional with non-matching context skips', () => {
    const layers = [
      layer('lang', {
        type_checking: {
          mode: 'conditional',
          value: 'off',
          conditions: { lang: ['python'] },
        },
      }),
    ];
    const result = resolveFlags(layers, tsContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should keep default
      expect(result.data['type_checking']!.value).toBe('strict');
      expect(result.data['type_checking']!.source).toBe('default');
    }
  });

  it('conditional with multiple conditions (all must match)', () => {
    const layers = [
      layer('lang', {
        require_tests: {
          mode: 'conditional',
          value: true,
          conditions: { lang: ['typescript'], framework: ['react'] },
        },
      }),
    ];
    const result = resolveFlags(layers, tsContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['require_tests']!.value).toBe(true);
    }
  });

  it('conditional with partial mismatch skips', () => {
    const layers = [
      layer('lang', {
        require_tests: {
          mode: 'conditional',
          value: true,
          conditions: { lang: ['typescript'], framework: ['vue'] },
        },
      }),
    ];
    const result = resolveFlags(layers, tsContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['require_tests']!.value).toBe(false); // default
    }
  });

  it('unknown flag name produces error', () => {
    const layers = [
      layer('repo', {
        nonexistent_flag: { mode: 'enabled', value: true },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E_FLAG_UNKNOWN');
    }
  });

  it('multiple flags across multiple levels', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: true },
        security_scan: { mode: 'enforced', value: true, locked: true },
      }),
      layer('user', {
        auto_commit: { mode: 'disabled' },
        max_file_lines: { mode: 'enabled', value: 500 },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['auto_commit']!.value).toBe(false);
      expect(result.data['security_scan']!.value).toBe(true);
      expect(result.data['max_file_lines']!.value).toBe(500);
    }
  });

  it('enabled without explicit value uses catalog default', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled' },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['auto_commit']!.value).toBe(false); // catalog default
    }
  });

  it('disabled mode sets boolean to false', () => {
    const layers = [
      layer('repo', {
        test_before_commit: { mode: 'disabled' },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['test_before_commit']!.value).toBe(false);
    }
  });

  it('later layer overrides earlier non-locked layer', () => {
    const layers = [
      layer('repo', {
        max_file_lines: { mode: 'enabled', value: 500 },
      }),
      layer('lang', {
        max_file_lines: { mode: 'enabled', value: 300 },
      }),
      layer('user', {
        max_file_lines: { mode: 'enabled', value: 1000 },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['max_file_lines']!.value).toBe(1000);
      expect(result.data['max_file_lines']!.source).toBe('user.yaml');
    }
  });

  it('locked without enforced still locks', () => {
    const layers = [
      layer('repo', {
        auto_commit: { mode: 'enabled', value: false, locked: true },
      }),
      layer('user', {
        auto_commit: { mode: 'enabled', value: true },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E_FLAG_LOCKED');
    }
  });

  it('delegated_to_agent_default can be overridden by later layer', () => {
    const layers = [
      layer('agent', {
        auto_commit: { mode: 'delegated_to_agent_default' },
      }),
      layer('user', {
        auto_commit: { mode: 'enabled', value: true },
      }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['auto_commit']!.value).toBe(true);
    }
  });

  it('conditional without conditions does not apply', () => {
    const layers = [
      layer('lang', {
        auto_commit: { mode: 'conditional', value: true },
      }),
    ];
    const result = resolveFlags(layers, tsContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should keep default because no conditions
      expect(result.data['auto_commit']!.value).toBe(false);
    }
  });
});
