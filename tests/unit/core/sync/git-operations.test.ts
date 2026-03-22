import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: (fn: unknown) => fn,
}));

import { cloneRepo, createBranch, stageFiles, commit, push } from '../../../../src/core/sync/git-operations.js';
import { execFile } from 'node:child_process';

const mockExecFile = vi.mocked(execFile);

describe('git-operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cloneRepo', () => {
    it('clones with full URL', async () => {
      mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown) => {
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await cloneRepo('https://github.com/org/repo.git', '/tmp/target', 'main');
      expect(result.ok).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--branch', 'main', 'https://github.com/org/repo.git', '/tmp/target'],
        expect.any(Object),
      );
    });

    it('converts short repo to github URL', async () => {
      mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown) => {
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await cloneRepo('org/repo', '/tmp/target', 'main');
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--branch', 'main', 'https://github.com/org/repo.git', '/tmp/target'],
        expect.any(Object),
      );
    });

    it('returns error on failure', async () => {
      mockExecFile.mockImplementation(() => {
        return Promise.reject(new Error('clone failed'));
      });

      const result = await cloneRepo('org/repo', '/tmp/target', 'main');
      expect(result.ok).toBe(false);
    });
  });

  describe('createBranch', () => {
    it('creates a new branch', async () => {
      mockExecFile.mockImplementation(() => {
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await createBranch('/tmp/dir', 'feature/test');
      expect(result.ok).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['checkout', '-b', 'feature/test'],
        { cwd: '/tmp/dir' },
      );
    });
  });

  describe('stageFiles', () => {
    it('stages specified files', async () => {
      mockExecFile.mockImplementation(() => {
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await stageFiles('/tmp/dir', ['file1.md', 'file2.md']);
      expect(result.ok).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['add', 'file1.md', 'file2.md'],
        { cwd: '/tmp/dir' },
      );
    });
  });

  describe('commit', () => {
    it('commits with message', async () => {
      mockExecFile.mockImplementation(() => {
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await commit('/tmp/dir', 'test commit');
      expect(result.ok).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'test commit'],
        { cwd: '/tmp/dir' },
      );
    });
  });

  describe('push', () => {
    it('pushes to origin', async () => {
      mockExecFile.mockImplementation(() => {
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await push('/tmp/dir', 'feature/test');
      expect(result.ok).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['push', '-u', 'origin', 'feature/test'],
        { cwd: '/tmp/dir' },
      );
    });
  });
});
