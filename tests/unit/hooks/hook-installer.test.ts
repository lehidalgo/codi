import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { installHooks } from '../../../src/core/hooks/hook-installer.js';
import type { HookEntry } from '../../../src/core/hooks/hook-registry.js';
import type { ResolvedFlags } from '../../../src/types/flags.js';

let tmpDir: string;
const testHooks: HookEntry[] = [
  { name: 'eslint', command: 'eslint --fix', stagedFilter: '**/*.{ts,tsx,js,jsx}' },
  { name: 'prettier', command: 'prettier --write', stagedFilter: '**/*.{ts,tsx,js,jsx}' },
];

const emptyFlags: ResolvedFlags = {};

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-hooks-install-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('installHooks', () => {
  it('returns ok with no hooks', async () => {
    const result = await installHooks({
      projectRoot: tmpDir,
      runner: 'none',
      hooks: [],
      flags: emptyFlags,
    });
    expect(result.ok).toBe(true);
  });

  it('writes standalone pre-commit script to .git/hooks/', async () => {
    await fs.mkdir(path.join(tmpDir, '.git', 'hooks'), { recursive: true });

    const result = await installHooks({
      projectRoot: tmpDir,
      runner: 'none',
      hooks: testHooks,
      flags: emptyFlags,
    });

    expect(result.ok).toBe(true);
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    const content = await fs.readFile(hookPath, 'utf-8');
    expect(content).toContain('#!/bin/sh');
    expect(content).toContain('eslint --fix');
    expect(content).toContain('prettier --write');

    const stat = await fs.stat(hookPath);
    // Check executable bit
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it('appends to .husky/pre-commit', async () => {
    await fs.mkdir(path.join(tmpDir, '.husky'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.husky', 'pre-commit'),
      '#!/bin/sh\necho "existing"\n',
      'utf-8',
    );

    const result = await installHooks({
      projectRoot: tmpDir,
      runner: 'husky',
      hooks: testHooks,
      flags: emptyFlags,
    });

    expect(result.ok).toBe(true);
    const content = await fs.readFile(
      path.join(tmpDir, '.husky', 'pre-commit'),
      'utf-8',
    );
    expect(content).toContain('existing');
    expect(content).toContain('# Codi hooks');
    expect(content).toContain('eslint --fix');
  });

  it('appends to .pre-commit-config.yaml', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.pre-commit-config.yaml'),
      'repos:\n  - repo: https://github.com/example\n',
      'utf-8',
    );

    const result = await installHooks({
      projectRoot: tmpDir,
      runner: 'pre-commit',
      hooks: testHooks,
      flags: emptyFlags,
    });

    expect(result.ok).toBe(true);
    const content = await fs.readFile(
      path.join(tmpDir, '.pre-commit-config.yaml'),
      'utf-8',
    );
    expect(content).toContain('# Codi hooks');
    expect(content).toContain('repo: local');
    expect(content).toContain('id: eslint');
  });

  it('creates .git/hooks/ if it does not exist (standalone)', async () => {
    const result = await installHooks({
      projectRoot: tmpDir,
      runner: 'none',
      hooks: testHooks,
      flags: emptyFlags,
    });

    expect(result.ok).toBe(true);
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    const content = await fs.readFile(hookPath, 'utf-8');
    expect(content).toContain('eslint --fix');
  });
});
