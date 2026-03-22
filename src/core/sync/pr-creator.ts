import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';

const execFileAsync = promisify(execFile);

export interface CreatePrOptions {
  repo: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body: string;
  cwd: string;
}

export async function isGhAvailable(): Promise<boolean> {
  try {
    await execFileAsync('gh', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function createPullRequest(
  options: CreatePrOptions,
): Promise<Result<string>> {
  const ghAvailable = await isGhAvailable();
  if (!ghAvailable) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: 'gh CLI',
    })]);
  }

  try {
    const { stdout } = await execFileAsync(
      'gh',
      [
        'pr', 'create',
        '--repo', options.repo,
        '--base', options.baseBranch,
        '--head', options.headBranch,
        '--title', options.title,
        '--body', options.body,
      ],
      { cwd: options.cwd },
    );
    return ok(stdout.trim());
  } catch (cause) {
    return err([createError('E_HOOK_FAILED', {
      hook: 'gh pr create',
      reason: (cause as Error).message,
    })]);
  }
}
