import { execFileAsync } from "./exec.js";

// Strip git hook env vars so these utilities are not affected by the caller's
// git context (e.g., when invoked from a pre-commit hook that sets GIT_DIR).
const cleanGitEnv: NodeJS.ProcessEnv = { ...process.env };
delete cleanGitEnv["GIT_DIR"];
delete cleanGitEnv["GIT_WORK_TREE"];
delete cleanGitEnv["GIT_INDEX_FILE"];

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
