import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

vi.mock('../../../../src/core/sync/git-operations.js', () => ({
  cloneRepo: vi.fn(),
  createBranch: vi.fn(),
  stageFiles: vi.fn(),
  commit: vi.fn(),
  push: vi.fn(),
}));

vi.mock('../../../../src/core/sync/pr-creator.js', () => ({
  createPullRequest: vi.fn(),
}));

import { syncToTeamRepo } from '../../../../src/core/sync/sync-engine.js';
import { cloneRepo, createBranch, stageFiles, commit, push } from '../../../../src/core/sync/git-operations.js';
import { createPullRequest } from '../../../../src/core/sync/pr-creator.js';

const mockCloneRepo = vi.mocked(cloneRepo);
const mockCreateBranch = vi.mocked(createBranch);
const mockStageFiles = vi.mocked(stageFiles);
const mockCommit = vi.mocked(commit);
const mockPush = vi.mocked(push);
const mockCreatePr = vi.mocked(createPullRequest);

describe('syncToTeamRepo', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-sync-engine-'));

    // Set up local .codi structure
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(path.join(codiDir, 'rules'), { recursive: true });
    await fs.mkdir(path.join(codiDir, 'skills'), { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'rules', 'my-rule.md'),
      'local rule content',
    );
    await fs.writeFile(
      path.join(codiDir, 'skills', 'my-skill.md'),
      'local skill content',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects no changes when repos match', async () => {
    mockCloneRepo.mockImplementation(async (_repo, targetDir) => {
      const clonedCodi = path.join(targetDir, '.codi');
      await fs.mkdir(path.join(clonedCodi, 'rules'), { recursive: true });
      await fs.mkdir(path.join(clonedCodi, 'skills'), { recursive: true });
      await fs.writeFile(
        path.join(clonedCodi, 'rules', 'my-rule.md'),
        'local rule content',
      );
      await fs.writeFile(
        path.join(clonedCodi, 'skills', 'my-skill.md'),
        'local skill content',
      );
      return { ok: true as const, data: '' };
    });

    const result = await syncToTeamRepo({
      projectRoot: tmpDir,
      config: { repo: 'org/config', branch: 'main', paths: ['rules', 'skills'] },
      projectName: 'test-project',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.filesAdded).toHaveLength(0);
    expect(result.data.filesModified).toHaveLength(0);
    expect(result.data.prUrl).toBeNull();
  });

  it('detects added files', async () => {
    mockCloneRepo.mockImplementation(async (_repo, targetDir) => {
      const clonedCodi = path.join(targetDir, '.codi');
      await fs.mkdir(path.join(clonedCodi, 'rules'), { recursive: true });
      await fs.mkdir(path.join(clonedCodi, 'skills'), { recursive: true });
      // No files in cloned repo
      return { ok: true as const, data: '' };
    });

    const result = await syncToTeamRepo({
      projectRoot: tmpDir,
      config: { repo: 'org/config', branch: 'main', paths: ['rules', 'skills'] },
      projectName: 'test-project',
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.filesAdded).toHaveLength(2);
    expect(result.data.prUrl).toBeNull(); // dry run
  });

  it('detects modified files', async () => {
    mockCloneRepo.mockImplementation(async (_repo, targetDir) => {
      const clonedCodi = path.join(targetDir, '.codi');
      await fs.mkdir(path.join(clonedCodi, 'rules'), { recursive: true });
      await fs.mkdir(path.join(clonedCodi, 'skills'), { recursive: true });
      await fs.writeFile(
        path.join(clonedCodi, 'rules', 'my-rule.md'),
        'old content',
      );
      await fs.writeFile(
        path.join(clonedCodi, 'skills', 'my-skill.md'),
        'local skill content',
      );
      return { ok: true as const, data: '' };
    });

    const result = await syncToTeamRepo({
      projectRoot: tmpDir,
      config: { repo: 'org/config', branch: 'main', paths: ['rules', 'skills'] },
      projectName: 'test-project',
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.filesModified).toHaveLength(1);
    expect(result.data.filesModified[0]).toContain('my-rule.md');
  });

  it('creates PR when not dry run and changes exist', async () => {
    mockCloneRepo.mockImplementation(async (_repo, targetDir) => {
      const clonedCodi = path.join(targetDir, '.codi');
      await fs.mkdir(path.join(clonedCodi, 'rules'), { recursive: true });
      await fs.mkdir(path.join(clonedCodi, 'skills'), { recursive: true });
      return { ok: true as const, data: '' };
    });
    mockCreateBranch.mockResolvedValue({ ok: true, data: '' });
    mockStageFiles.mockResolvedValue({ ok: true, data: '' });
    mockCommit.mockResolvedValue({ ok: true, data: '' });
    mockPush.mockResolvedValue({ ok: true, data: '' });
    mockCreatePr.mockResolvedValue({
      ok: true,
      data: 'https://github.com/org/config/pull/1',
    });

    const result = await syncToTeamRepo({
      projectRoot: tmpDir,
      config: { repo: 'org/config', branch: 'main', paths: ['rules', 'skills'] },
      projectName: 'test-project',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.prUrl).toBe('https://github.com/org/config/pull/1');
    expect(mockCreateBranch).toHaveBeenCalled();
    expect(mockCommit).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalled();
  });

  it('returns error when clone fails', async () => {
    mockCloneRepo.mockResolvedValue({
      ok: false,
      errors: [{ code: 'E_HOOK_FAILED', message: 'clone failed', hint: '', severity: 'error', context: {} }],
    });

    const result = await syncToTeamRepo({
      projectRoot: tmpDir,
      config: { repo: 'org/config', branch: 'main', paths: ['rules', 'skills'] },
      projectName: 'test-project',
    });

    expect(result.ok).toBe(false);
  });
});
