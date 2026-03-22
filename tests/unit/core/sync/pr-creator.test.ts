import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: (fn: unknown) => fn,
}));

import { isGhAvailable, createPullRequest } from '../../../../src/core/sync/pr-creator.js';
import { execFile } from 'node:child_process';

const mockExecFile = vi.mocked(execFile);

describe('pr-creator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isGhAvailable', () => {
    it('returns true when gh is installed', async () => {
      mockExecFile.mockImplementation(() => {
        return Promise.resolve({ stdout: 'gh version 2.0.0', stderr: '' });
      });

      const result = await isGhAvailable();
      expect(result).toBe(true);
    });

    it('returns false when gh is not installed', async () => {
      mockExecFile.mockImplementation(() => {
        return Promise.reject(new Error('not found'));
      });

      const result = await isGhAvailable();
      expect(result).toBe(false);
    });
  });

  describe('createPullRequest', () => {
    it('creates PR and returns URL', async () => {
      mockExecFile.mockImplementation((_cmd: unknown, args: unknown) => {
        const argsArray = args as string[];
        if (argsArray[0] === '--version') {
          return Promise.resolve({ stdout: 'gh version 2.0.0', stderr: '' });
        }
        return Promise.resolve({
          stdout: 'https://github.com/org/repo/pull/42',
          stderr: '',
        });
      });

      const result = await createPullRequest({
        repo: 'org/repo',
        baseBranch: 'main',
        headBranch: 'feature/test',
        title: 'Test PR',
        body: 'Test body',
        cwd: '/tmp/dir',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe('https://github.com/org/repo/pull/42');
    });

    it('fails when gh is not available', async () => {
      mockExecFile.mockImplementation(() => {
        return Promise.reject(new Error('not found'));
      });

      const result = await createPullRequest({
        repo: 'org/repo',
        baseBranch: 'main',
        headBranch: 'feature/test',
        title: 'Test PR',
        body: 'Test body',
        cwd: '/tmp/dir',
      });

      expect(result.ok).toBe(false);
    });
  });
});
