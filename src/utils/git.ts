import { EXEC_TIMEOUTS, execFileWithTimeout } from "./exec.js";

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
    await execFileWithTimeout("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: dir,
      env: cleanGitEnv,
      timeoutMs: EXEC_TIMEOUTS.GIT_LOCAL,
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
    const { stdout } = await execFileWithTimeout("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      env: cleanGitEnv,
      timeoutMs: EXEC_TIMEOUTS.GIT_LOCAL,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Validate a git ref (branch, tag, or short SHA) is safe to pass as
 * `--branch` or similar argv-positioned argument to git (ISSUE-010).
 *
 * Even with `execFile` (no shell), git itself parses any token starting
 * with `-` as a flag — a ref like `--upload-pack=evil` triggers
 * CVE-2017-1000117-class argument injection. Refs starting with `.`
 * enable hidden-file traversal; `..` enables parent-dir escape; `@{`
 * resolves reflog expressions to unexpected commits.
 *
 * Allowlist: alphanumeric first char, then `[a-zA-Z0-9._\-/+]`. Rejects
 * `..`, `@{`, trailing `.` or `/`, and `.lock` suffix per `git
 * check-ref-format` semantics.
 *
 * @throws Error if the ref does not match the allowlist.
 * @returns the same `ref` string (passthrough on success — enables
 *   inline use: `args.push("--branch", validateGitRef(ref))`).
 */
const GIT_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._\-/+]{0,254}$/;
const FORBIDDEN_REF_SUBSTRINGS = ["..", "@{", "//", ".lock"];

export function validateGitRef(ref: string): string {
  if (typeof ref !== "string" || ref.length === 0) {
    throw new Error("Invalid git ref: empty or non-string");
  }
  if (!GIT_REF_PATTERN.test(ref)) {
    throw new Error(
      `Invalid git ref "${ref}": must match [a-zA-Z0-9][a-zA-Z0-9._\\-/+]* (no leading - or .)`,
    );
  }
  for (const bad of FORBIDDEN_REF_SUBSTRINGS) {
    if (ref.includes(bad)) {
      throw new Error(`Invalid git ref "${ref}": forbidden substring "${bad}"`);
    }
  }
  if (ref.endsWith(".") || ref.endsWith("/")) {
    throw new Error(`Invalid git ref "${ref}": trailing "${ref.slice(-1)}"`);
  }
  return ref;
}
