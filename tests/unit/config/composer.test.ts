import { describe, it, expect } from 'vitest';
import { composeConfig, flagsFromDefinitions } from '../../../src/core/config/composer.js';
import type { ConfigLayer } from '../../../src/core/config/composer.js';

describe('composeConfig', () => {
  it('merges multiple layers with arrays concatenated', () => {
    const layers: ConfigLayer[] = [
      {
        level: 'repo',
        source: 'repo',
        config: {
          manifest: { name: 'test', version: '1' },
          rules: [{ name: 'r1', description: 'd1', content: 'c1', priority: 'high', alwaysApply: true, managedBy: 'codi' }],
          flags: flagsFromDefinitions({ max_lines: { mode: 'enabled', value: 700 } }, 'repo'),
        },
      },
      {
        level: 'lang',
        source: 'lang/ts',
        config: {
          rules: [{ name: 'r2', description: 'd2', content: 'c2', priority: 'medium', alwaysApply: false, managedBy: 'user' }],
          flags: flagsFromDefinitions({ max_lines: { mode: 'enabled', value: 500 } }, 'lang/ts'),
        },
      },
    ];

    const result = composeConfig(layers);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.rules).toHaveLength(2);
    expect(result.data.flags['max_lines']!.value).toBe(500);
    expect(result.data.flags['max_lines']!.source).toBe('lang/ts');
  });

  it('objects merge recursively for manifest', () => {
    const layers: ConfigLayer[] = [
      {
        level: 'repo',
        source: 'repo',
        config: {
          manifest: { name: 'proj', version: '1', description: 'a project' },
        },
      },
      {
        level: 'lang',
        source: 'lang',
        config: {
          manifest: { name: 'proj', version: '1', agents: ['claude-code'] },
        },
      },
    ];

    const result = composeConfig(layers);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.manifest.description).toBe('a project');
    expect(result.data.manifest.agents).toEqual(['claude-code']);
  });

  it('rejects override of locked flag', () => {
    const layers: ConfigLayer[] = [
      {
        level: 'repo',
        source: 'repo/flags.yaml',
        config: {
          flags: {
            security_scan: {
              value: true,
              mode: 'enforced',
              source: 'repo/flags.yaml',
              locked: true,
            },
          },
        },
      },
      {
        level: 'lang',
        source: 'lang/ts.yaml',
        config: {
          flags: {
            security_scan: {
              value: false,
              mode: 'disabled',
              source: 'lang/ts.yaml',
              locked: false,
            },
          },
        },
      },
    ];

    const result = composeConfig(layers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe('E_FLAG_LOCKED');
  });

  it('merges MCP servers from multiple layers', () => {
    const layers: ConfigLayer[] = [
      {
        level: 'repo',
        source: 'repo',
        config: {
          mcp: { servers: { s1: { command: 'cmd1' } } },
        },
      },
      {
        level: 'lang',
        source: 'lang',
        config: {
          mcp: { servers: { s2: { command: 'cmd2' } } },
        },
      },
    ];

    const result = composeConfig(layers);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.data.mcp.servers)).toEqual(['s1', 's2']);
  });
});

describe('flagsFromDefinitions', () => {
  it('converts flag definitions to resolved flags', () => {
    const defs = {
      max_lines: { mode: 'enabled' as const, value: 700, locked: true },
    };
    const resolved = flagsFromDefinitions(defs, 'test-source');
    expect(resolved['max_lines']!.source).toBe('test-source');
    expect(resolved['max_lines']!.locked).toBe(true);
    expect(resolved['max_lines']!.value).toBe(700);
  });
});
