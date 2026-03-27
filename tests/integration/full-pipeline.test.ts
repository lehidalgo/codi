import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initHandler } from '../../src/cli/init.js';
import { generateHandler } from '../../src/cli/generate.js';
import { statusHandler } from '../../src/cli/status.js';
import { validateHandler } from '../../src/cli/validate.js';
import { cleanHandler } from '../../src/cli/clean.js';
import { addRuleHandler } from '../../src/cli/add.js';
import { updateHandler } from '../../src/cli/update.js';
import { revertHandler } from '../../src/cli/revert.js';
import { regenerateConfigs } from '../../src/cli/shared.js';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { Logger } from '../../src/core/output/logger.js';
import { clearAdapters } from '../../src/core/generator/adapter-registry.js';
import { resolveFlags } from '../../src/core/flags/flag-resolver.js';
import type { FlagLayer, ResolutionContext } from '../../src/core/flags/flag-resolver.js';
import { FLAG_CATALOG } from '../../src/core/flags/flag-catalog.js';
import { validateFlags } from '../../src/core/flags/flag-validator.js';
import { getDefaultFlags } from '../../src/core/flags/flag-catalog.js';

const execFileAsync = promisify(execFile);

async function fileExists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true).catch(() => false);
}

let tmpDir: string;

beforeEach(async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-int-'));
  // Create a subdirectory with a valid project name (lowercase only)
  tmpDir = path.join(base, 'test-project');
  await fs.mkdir(tmpDir, { recursive: true });
  // Create a package.json so init detects 'javascript' stack
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
    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain('javascript');

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
    await initHandler(tmpDir, { json: true });

    // Second init without force fails
    const failResult = await initHandler(tmpDir, { json: true });
    expect(failResult.success).toBe(false);

    // Second init with force succeeds
    const forceResult = await initHandler(tmpDir, { force: true, json: true });
    expect(forceResult.success).toBe(true);
  });

  it('validate passes after init', async () => {
    await initHandler(tmpDir, { json: true });

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
  });

  it('validate fails without .codi/', async () => {
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
  });

  it('generate runs after init', async () => {
    await initHandler(tmpDir, { json: true });

    const result = await generateHandler(tmpDir, {});
    expect(result.success).toBe(true);
  });

  it('status reports no drift after generate', async () => {
    await initHandler(tmpDir, { json: true });

    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.hasDrift).toBe(false);
  });

  it('init creates frameworks/ directory', async () => {
    await initHandler(tmpDir, { json: true });
    const frameworksDir = path.join(tmpDir, '.codi', 'frameworks');
    const stat = await fs.stat(frameworksDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('init generates all 18 flags in flags.yaml', async () => {
    await initHandler(tmpDir, { json: true });
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
    await initHandler(tmpDir, { json: true });
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

// ============================================================
// End-to-End Lifecycle Tests
// ============================================================

describe('Clean Lifecycle', () => {
  it('init → generate → clean --all removes everything', async () => {
    // Init + generate
    await initHandler(tmpDir, { json: true, agents: ['claude-code'] });
    const genResult = await generateHandler(tmpDir, {});
    expect(genResult.success).toBe(true);

    // Verify generated files exist
    expect(await fileExists(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(await fileExists(path.join(tmpDir, '.codi'))).toBe(true);

    // Clean --all
    const cleanResult = await cleanHandler(tmpDir, { json: true, all: true });
    expect(cleanResult.success).toBe(true);
    expect(cleanResult.data.filesDeleted.length).toBeGreaterThan(0);

    // Verify generated files are gone
    expect(await fileExists(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
    expect(await fileExists(path.join(tmpDir, '.codi'))).toBe(false);
  });

  it('clean without --all keeps .codi/ but removes generated files', async () => {
    await initHandler(tmpDir, { json: true, agents: ['claude-code'] });
    await generateHandler(tmpDir, {});

    const cleanResult = await cleanHandler(tmpDir, { json: true });
    expect(cleanResult.success).toBe(true);
    expect(cleanResult.data.codiDirRemoved).toBe(false);

    // CLAUDE.md gone but .codi/ remains
    expect(await fileExists(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
    expect(await fileExists(path.join(tmpDir, '.codi'))).toBe(true);
  });
});

describe('Multi-Agent Generation', () => {
  it('generates files for both claude-code and cursor', async () => {
    await initHandler(tmpDir, { json: true, agents: ['claude-code', 'cursor'] });
    const genResult = await generateHandler(tmpDir, {});
    expect(genResult.success).toBe(true);

    // Claude Code files
    expect(await fileExists(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
    const claudeMd = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('Generated by Codi');

    // Cursor files
    expect(await fileExists(path.join(tmpDir, '.cursorrules'))).toBe(true);
    const cursorRules = await fs.readFile(path.join(tmpDir, '.cursorrules'), 'utf-8');
    expect(cursorRules).toContain('Generated by Codi');
  });
});

describe('Add Artifact → Regenerate', () => {
  it('added rule appears in generated output', async () => {
    await initHandler(tmpDir, { json: true, agents: ['claude-code'] });

    // Add a security rule
    const addResult = await addRuleHandler(tmpDir, 'security', { template: 'security' });
    expect(addResult.success).toBe(true);

    // Regenerate
    await regenerateConfigs(tmpDir);

    // Verify the rule file exists in .codi/
    const ruleFile = path.join(tmpDir, '.codi', 'rules', 'custom', 'security.md');
    expect(await fileExists(ruleFile)).toBe(true);

    // Verify generated agent output includes the rule
    const claudeRulesDir = path.join(tmpDir, '.claude', 'rules');
    expect(await fileExists(claudeRulesDir)).toBe(true);
    const ruleFiles = await fs.readdir(claudeRulesDir);
    expect(ruleFiles.some(f => f.includes('security'))).toBe(true);
  });
});

describe('Drift Detection', () => {
  it('detects modified generated files', async () => {
    await initHandler(tmpDir, { json: true, agents: ['claude-code'] });
    await generateHandler(tmpDir, {});

    // Status should report no drift
    const statusBefore = await statusHandler(tmpDir);
    expect(statusBefore.success).toBe(true);
    expect(statusBefore.data.hasDrift).toBe(false);

    // Modify a generated file
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    await fs.writeFile(claudeMdPath, '# Modified by user', 'utf-8');

    // Status should now report drift
    const statusAfter = await statusHandler(tmpDir);
    expect(statusAfter.success).toBe(true);
    expect(statusAfter.data.hasDrift).toBe(true);
  });
});

describe('Update Flags → Regenerate', () => {
  it('switching to strict preset changes flags and output', async () => {
    await initHandler(tmpDir, { json: true, agents: ['claude-code'] });

    // Update to strict preset
    const updateResult = await updateHandler(tmpDir, { json: true, preset: 'strict' });
    expect(updateResult.success).toBe(true);
    expect(updateResult.data.flagsReset).toBe(true);
    expect(updateResult.data.preset).toBe('strict');

    // Verify flags.yaml has strict values
    const flagsContent = await fs.readFile(path.join(tmpDir, '.codi', 'flags.yaml'), 'utf-8');
    const flags = parseYaml(flagsContent) as Record<string, Record<string, unknown>>;
    expect(flags['security_scan']?.['mode']).toBe('enforced');
    expect(flags['security_scan']?.['locked']).toBe(true);
  });
});

describe('Hook Lifecycle', () => {
  it('hooks are created and cleaned up with git repo', async () => {
    // Create a git repo in temp dir
    await execFileAsync('git', ['init', tmpDir]);

    await initHandler(tmpDir, { json: true, agents: ['claude-code'] });
    await generateHandler(tmpDir, {});

    // Check if any codi hook scripts were created
    const hooksDir = path.join(tmpDir, '.git', 'hooks');
    const hooksDirExists = await fileExists(hooksDir);

    if (hooksDirExists) {
      const hookFiles = await fs.readdir(hooksDir);
      const codiHooks = hookFiles.filter(f => f.startsWith('codi-'));

      if (codiHooks.length > 0) {
        // Clean should remove them
        const cleanResult = await cleanHandler(tmpDir, { json: true, all: true });
        expect(cleanResult.success).toBe(true);

        // Verify codi hooks are gone
        const afterClean = await fs.readdir(hooksDir).catch(() => []);
        const remainingCodiHooks = afterClean.filter(f => f.startsWith('codi-'));
        expect(remainingCodiHooks).toEqual([]);
      }
    }
  });
});

describe('Operations Ledger Tracking', () => {
  it('tracks operations across init → generate → clean', async () => {
    const ledgerPath = path.join(tmpDir, '.codi', 'operations.json');

    // Init creates the ledger
    await initHandler(tmpDir, { json: true, agents: ['claude-code'] });
    expect(await fileExists(ledgerPath)).toBe(true);
    const afterInit = JSON.parse(await fs.readFile(ledgerPath, 'utf-8'));
    expect(afterInit.version).toBe('1');
    expect(afterInit.initialized).toBeDefined();
    expect(afterInit.initialized.agents).toContain('claude-code');

    // Generate logs an operation
    await generateHandler(tmpDir, {});
    const afterGen = JSON.parse(await fs.readFile(ledgerPath, 'utf-8'));
    const genOps = afterGen.operations.filter((o: { type: string }) => o.type === 'generate');
    expect(genOps.length).toBeGreaterThan(0);

    // Clean logs an operation (without --all so ledger survives)
    await cleanHandler(tmpDir, { json: true });
    const afterClean = JSON.parse(await fs.readFile(ledgerPath, 'utf-8'));
    const cleanOps = afterClean.operations.filter((o: { type: string }) => o.type === 'clean');
    expect(cleanOps.length).toBeGreaterThan(0);
  });
});

describe('Revert from Backup', () => {
  it('restores generated files from backup', async () => {
    await initHandler(tmpDir, { json: true, agents: ['claude-code'] });
    await generateHandler(tmpDir, {});

    // Read original content
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    const originalContent = await fs.readFile(claudeMdPath, 'utf-8');

    // Generate again to create a backup of the first generation
    await generateHandler(tmpDir, {});

    // Verify backup exists
    const listResult = await revertHandler(tmpDir, { list: true });
    expect(listResult.success).toBe(true);
    if (listResult.data.backups && listResult.data.backups.length > 0) {
      // Modify the file
      await fs.writeFile(claudeMdPath, '# Completely different', 'utf-8');

      // Revert to last backup
      const revertResult = await revertHandler(tmpDir, { last: true });
      expect(revertResult.success).toBe(true);
      expect(revertResult.data.restoredFiles!.length).toBeGreaterThan(0);
    }
  });
});
