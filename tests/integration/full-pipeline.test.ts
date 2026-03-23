import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { initHandler } from '../../src/cli/init.js';
import { generateHandler } from '../../src/cli/generate.js';
import { statusHandler } from '../../src/cli/status.js';
import { validateHandler } from '../../src/cli/validate.js';
import { stringify as stringifyYaml } from 'yaml';
import { Logger } from '../../src/core/output/logger.js';
import { clearAdapters } from '../../src/core/generator/adapter-registry.js';
import { resolveFlags } from '../../src/core/flags/flag-resolver.js';
import type { FlagLayer, ResolutionContext } from '../../src/core/flags/flag-resolver.js';
import { FLAG_CATALOG } from '../../src/core/flags/flag-catalog.js';
import { validateFlags } from '../../src/core/flags/flag-validator.js';
import { getDefaultFlags } from '../../src/core/flags/flag-catalog.js';

let tmpDir: string;

beforeEach(async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-int-'));
  // Create a subdirectory with a valid project name (lowercase only)
  tmpDir = path.join(base, 'test-project');
  await fs.mkdir(tmpDir, { recursive: true });
  // Create a package.json so init detects 'node' stack
  await fs.writeFile(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0' }),
    'utf-8',
  );
  // Clear adapter registry to start fresh
  clearAdapters();
  // Initialize logger for test
  Logger.init({ level: 'error', mode: 'human', noColor: true });
});

afterEach(async () => {
  // Remove the parent temp dir (which contains test-project)
  await fs.rm(path.dirname(tmpDir), { recursive: true, force: true });
  clearAdapters();
});

describe('Full Pipeline Integration', () => {
  it('init creates .codi/ structure', async () => {
    const result = await initHandler(tmpDir, {});
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain('node');

    // Verify .codi/ directory exists
    const codiDir = path.join(tmpDir, '.codi');
    const stat = await fs.stat(codiDir);
    expect(stat.isDirectory()).toBe(true);

    // Verify codi.yaml exists
    const manifestExists = await fs.access(path.join(codiDir, 'codi.yaml')).then(() => true).catch(() => false);
    expect(manifestExists).toBe(true);

    // Verify flags.yaml exists
    const flagsExists = await fs.access(path.join(codiDir, 'flags.yaml')).then(() => true).catch(() => false);
    expect(flagsExists).toBe(true);

    // Verify rules directories
    const rulesGenExists = await fs.access(path.join(codiDir, 'rules', 'generated', 'common')).then(() => true).catch(() => false);
    expect(rulesGenExists).toBe(true);

    const rulesCustomExists = await fs.access(path.join(codiDir, 'rules', 'custom')).then(() => true).catch(() => false);
    expect(rulesCustomExists).toBe(true);
  });

  it('init with --force reinitializes', async () => {
    // First init
    await initHandler(tmpDir, {});

    // Second init without force fails
    const failResult = await initHandler(tmpDir, {});
    expect(failResult.success).toBe(false);

    // Second init with force succeeds
    const forceResult = await initHandler(tmpDir, { force: true });
    expect(forceResult.success).toBe(true);
  });

  it('validate passes after init', async () => {
    await initHandler(tmpDir, {});

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
  });

  it('validate fails without .codi/', async () => {
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
  });

  it('generate runs after init', async () => {
    await initHandler(tmpDir, {});

    const result = await generateHandler(tmpDir, {});
    expect(result.success).toBe(true);
  });

  it('status reports no drift after generate', async () => {
    await initHandler(tmpDir, {});

    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.hasDrift).toBe(false);
  });

  it('init creates frameworks/ directory', async () => {
    await initHandler(tmpDir, {});
    const frameworksDir = path.join(tmpDir, '.codi', 'frameworks');
    const stat = await fs.stat(frameworksDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('init generates all 18 flags in flags.yaml', async () => {
    await initHandler(tmpDir, {});
    const flagsContent = await fs.readFile(
      path.join(tmpDir, '.codi', 'flags.yaml'),
      'utf-8',
    );
    // All 18 flags should be present
    expect(flagsContent).toContain('auto_commit');
    expect(flagsContent).toContain('lint_on_save');
    expect(flagsContent).toContain('allow_force_push');
    expect(flagsContent).toContain('mcp_allowed_servers');
    expect(flagsContent).toContain('progressive_loading');
    expect(flagsContent).toContain('drift_detection');
    expect(flagsContent).toContain('auto_generate_on_change');
  });
});

describe('7-Layer Governance Integration', () => {
  const emptyContext: ResolutionContext = { languages: [], frameworks: [], agents: [] };
  const tsContext: ResolutionContext = { languages: ['typescript'], frameworks: ['nextjs'], agents: ['claude'] };

  function layer(level: string, flags: FlagLayer['flags'], source?: string): FlagLayer {
    return { level, source: source ?? `${level}.yaml`, flags };
  }

  it('org enforced+locked prevents all lower overrides', () => {
    const layers = [
      layer('org', { security_scan: { mode: 'enforced', value: true, locked: true } }),
      layer('team', { security_scan: { mode: 'enabled', value: false } }),
      layer('repo', { security_scan: { mode: 'disabled' } }),
      layer('user', { security_scan: { mode: 'enabled', value: false } }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.every((e) => e.code === 'E_FLAG_LOCKED')).toBe(true);
      expect(result.errors).toHaveLength(3);
    }
  });

  it('team conditional flag with framework match', () => {
    const layers = [
      layer('org', { max_file_lines: { mode: 'enabled', value: 700 } }),
      layer('team', {
        require_tests: {
          mode: 'conditional',
          value: true,
          conditions: { framework: ['nextjs', 'react'] },
        },
      }),
      layer('repo', {}),
    ];
    const result = resolveFlags(layers, tsContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['require_tests']!.value).toBe(true);
      expect(result.data['max_file_lines']!.value).toBe(700);
    }
  });

  it('all 18 flags have defaults when no layers provided', () => {
    const result = resolveFlags([], emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data)).toHaveLength(18);
      expect(result.data['lint_on_save']!.value).toBe(true);
      expect(result.data['allow_force_push']!.value).toBe(false);
      expect(result.data['mcp_allowed_servers']!.value).toEqual([]);
      expect(result.data['allowed_languages']!.value).toEqual(['*']);
      expect(result.data['progressive_loading']!.value).toBe('metadata');
      expect(result.data['drift_detection']!.value).toBe('warn');
    }
  });

  it('string array flags override correctly across layers', () => {
    const layers = [
      layer('org', { mcp_allowed_servers: { mode: 'enabled', value: ['github'] } }),
      layer('team', { mcp_allowed_servers: { mode: 'enabled', value: ['github', 'jira'] } }),
    ];
    const result = resolveFlags(layers, emptyContext, FLAG_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data['mcp_allowed_servers']!.value).toEqual(['github', 'jira']);
      expect(result.data['mcp_allowed_servers']!.source).toBe('team.yaml');
    }
  });

  it('backward compatibility: project without org/team/framework works', async () => {
    await initHandler(tmpDir, {});
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(true);
  });

  it('validation rejects locked at framework level', () => {
    const layers = [
      layer('framework', {
        auto_commit: { mode: 'enforced', value: true, locked: true },
      }),
    ];
    const errors = validateFlags(layers, getDefaultFlags(), FLAG_CATALOG);
    expect(errors.some((e) => e.code === 'E_FLAG_LOCKED_LEVEL')).toBe(true);
  });

  it('validation accepts locked at org and team levels', () => {
    const layers = [
      layer('org', { security_scan: { mode: 'enforced', value: true, locked: true } }),
      layer('team', { allow_force_push: { mode: 'enforced', value: false, locked: true } }),
    ];
    const errors = validateFlags(layers, getDefaultFlags(), FLAG_CATALOG);
    expect(errors).toHaveLength(0);
  });
});
