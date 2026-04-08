import { execFileAsync } from "./exec.js";

// Strip git hook env vars so these utilities are not affected by the caller's
// git context (e.g., when invoked from a pre-commit hook that sets GIT_DIR).
const cleanGitEnv: NodeJS.ProcessEnv = { ...process.env };
delete cleanGitEnv["GIT_DIR"];
delete cleanGitEnv["GIT_WORK_TREE"];
delete cleanGitEnv["GIT_INDEX_FILE"];

/**
 * Check whether `dir` is inside a git working tree.
 *
 * Git hook environment variables (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`)
 * are stripped so this works correctly when called from within a git hook.
 *
 * @param dir - Directory to test.
 * @returns `true` if `git rev-parse --is-inside-work-tree` succeeds, `false` otherwise.
 */
export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: dir,
      env: cleanGitEnv,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the absolute path of the git repository root for `dir`.
 *
 * @param dir - Any directory inside the repository.
 * @returns The absolute root path, or `null` if `dir` is not inside a git repo.
 */
export async function getGitRoot(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      env: cleanGitEnv,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}
