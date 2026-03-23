import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import { cleanHandler } from '../../../src/cli/clean.js';
import { Logger } from '../../../src/core/output/logger.js';

describe('clean command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-clean-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function setupProject(): Promise<void> {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(path.join(codiDir, 'codi.yaml'), 'name: test\nversion: "1"\n', 'utf-8');
    await fs.writeFile(path.join(codiDir, 'state.json'), JSON.stringify({
      version: '1',
      lastGenerated: new Date().toISOString(),
      agents: {
        'claude-code': [{ path: 'CLAUDE.md', sourceHash: 'a', generatedHash: 'b', sources: [], timestamp: '' }],
        'cursor': [{ path: '.cursorrules', sourceHash: 'a', generatedHash: 'b', sources: [], timestamp: '' }],
      },
    }), 'utf-8');

    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Generated', 'utf-8');
    await fs.writeFile(path.join(tmpDir, '.cursorrules'), '# Generated', 'utf-8');
    await fs.mkdir(path.join(tmpDir, '.claude', 'rules'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.claude', 'rules', 'test.md'), 'rule', 'utf-8');
  }

  it('removes generated files from state', async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.filesDeleted).toContain('CLAUDE.md');
    expect(result.data.filesDeleted).toContain('.cursorrules');

    await expect(fs.access(path.join(tmpDir, 'CLAUDE.md'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, '.cursorrules'))).rejects.toThrow();
  });

  it('removes agent rule directories', async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.data.dirsDeleted).toContain('.claude/rules');
    await expect(fs.access(path.join(tmpDir, '.claude', 'rules'))).rejects.toThrow();
  });

  it('--all removes .codi/ directory', async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true, all: true });
    expect(result.success).toBe(true);
    expect(result.data.codiDirRemoved).toBe(true);
    await expect(fs.access(path.join(tmpDir, '.codi'))).rejects.toThrow();
  });

  it('without --all keeps .codi/', async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.data.codiDirRemoved).toBe(false);
    const stat = await fs.stat(path.join(tmpDir, '.codi'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('dry-run does not delete files', async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.filesDeleted.length).toBeGreaterThan(0);

    const stat = await fs.stat(path.join(tmpDir, 'CLAUDE.md'));
    expect(stat.isFile()).toBe(true);
  });

  it('handles missing state gracefully', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Generated', 'utf-8');

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.filesDeleted).toContain('CLAUDE.md');
  });
});
