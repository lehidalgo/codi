import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';

const execFileAsync = promisify(execFile);

async function runGit(
  args: string[],
  cwd: string,
): Promise<Result<string>> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return ok(stdout.trim());
  } catch (cause) {
    return err([createError('E_HOOK_FAILED', {
      hook: 'git',
      reason: (cause as Error).message,
    })]);
  }
}

export async function cloneRepo(
  repo: string,
  targetDir: string,
  branch: string,
): Promise<Result<string>> {
  const repoUrl = repo.includes('://')
    ? repo
    : `https://github.com/${repo}.git`;
  return runGit(
    ['clone', '--depth', '1', '--branch', branch, repoUrl, targetDir],
    process.cwd(),
  );
}

export async function createBranch(
  dir: string,
  branchName: string,
): Promise<Result<string>> {
  return runGit(['checkout', '-b', branchName], dir);
}

export async function stageFiles(
  dir: string,
  files: string[],
): Promise<Result<string>> {
  return runGit(['add', ...files], dir);
}

export async function commit(
  dir: string,
  message: string,
): Promise<Result<string>> {
  return runGit(['commit', '-m', message], dir);
}

export async function push(
  dir: string,
  branch: string,
): Promise<Result<string>> {
  return runGit(['push', '-u', 'origin', branch], dir);
}

export async function configUser(
  dir: string,
  name: string,
  email: string,
): Promise<Result<string>> {
  const nameResult = await runGit(['config', 'user.name', name], dir);
  if (!nameResult.ok) return nameResult;
  return runGit(['config', 'user.email', email], dir);
}
