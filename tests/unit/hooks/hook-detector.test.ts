import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectHookSetup } from '../../../src/core/hooks/hook-detector.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-hooks-detect-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('detectHookSetup', () => {
  it('returns none when no hook runner found', async () => {
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe('none');
    expect(result.version).toBeUndefined();
    expect(result.configPath).toBeUndefined();
  });

  it('detects husky when .husky/ directory exists', async () => {
    await fs.mkdir(path.join(tmpDir, '.husky'), { recursive: true });
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe('husky');
    expect(result.configPath).toBe(path.join(tmpDir, '.husky'));
  });

  it('detects pre-commit when .pre-commit-config.yaml exists', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.pre-commit-config.yaml'),
      'repos: []\n',
      'utf-8',
    );
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe('pre-commit');
    expect(result.configPath).toBe(path.join(tmpDir, '.pre-commit-config.yaml'));
  });

  it('detects lefthook when .lefthook.yml exists', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.lefthook.yml'),
      'pre-commit:\n  commands: {}\n',
      'utf-8',
    );
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe('lefthook');
    expect(result.configPath).toBe(path.join(tmpDir, '.lefthook.yml'));
  });

  it('detects lefthook with alternate lefthook.yml path', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-commit:\n  commands: {}\n',
      'utf-8',
    );
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe('lefthook');
    expect(result.configPath).toBe(path.join(tmpDir, 'lefthook.yml'));
  });

  it('prefers husky over pre-commit when both exist', async () => {
    await fs.mkdir(path.join(tmpDir, '.husky'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.pre-commit-config.yaml'),
      'repos: []\n',
      'utf-8',
    );
    const result = await detectHookSetup(tmpDir);
    expect(result.runner).toBe('husky');
  });
});
