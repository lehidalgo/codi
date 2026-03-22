import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveConfig } from '../../../src/core/config/resolver.js';

const FIXTURES = path.resolve(__dirname, '../../fixtures/inheritance');

describe('resolveConfig', () => {
  it('resolves basic-merge fixture with layer composition', async () => {
    const projectRoot = path.join(FIXTURES, 'basic-merge/input');
    const result = await resolveConfig(projectRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.manifest.name).toBe('test-project');
    expect(result.data.manifest.agents).toEqual(['claude-code', 'cursor']);

    expect(result.data.rules).toHaveLength(1);
    expect(result.data.rules[0]!.name).toBe('security');

    // Lang layer overrides repo flag
    expect(result.data.flags['max_file_lines']!.value).toBe(500);
    // Lang layer adds new flag
    expect(result.data.flags['type_checking']!.value).toBe('strict');
    expect(result.data.flags['type_checking']!.mode).toBe('enforced');
    // Repo flag preserved
    expect(result.data.flags['security_scan']!.value).toBe(true);
  });

  it('returns error for locked-override fixture', async () => {
    const projectRoot = path.join(FIXTURES, 'locked-override/input');
    const result = await resolveConfig(projectRoot);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const lockedError = result.errors.find((e) => e.code === 'E_FLAG_LOCKED');
    expect(lockedError).toBeDefined();
  });

  it('returns error for nonexistent project', async () => {
    const result = await resolveConfig('/nonexistent/project');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe('E_CONFIG_NOT_FOUND');
  });
});
