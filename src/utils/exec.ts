import { execFile, type ExecFileOptions } from "node:child_process";
import { promisify } from "node:util";

/** Promisified `execFile` — runs a command without shell interpretation. */
export const execFileAsync = promisify(execFile);

/**
 * Sensible per-category default timeouts. Callers pass `timeoutMs` to
 * override (e.g. `gh repo fork` needs a longer window on large orgs).
 *
 *  - GIT_LOCAL: read-only local ops (rev-parse, status, log, show)
 *  - GIT_WRITE: index/working-tree mutations (add, commit, write-tree)
 *  - GH_API:    GitHub REST through `gh` — network-bound but typically subsecond
 *  - GH_LONG:   long-running gh ops (repo fork, repo clone via gh)
 */
export const EXEC_TIMEOUTS = {
  GIT_LOCAL: 10_000,
  GIT_WRITE: 20_000,
  GH_API: 30_000,
  GH_LONG: 90_000,
} as const;

/**
 * Async exec wrapper that enforces a wall-clock timeout via
 * `AbortSignal.timeout`. Existing callers can migrate site-by-site;
 * `execFileAsync` still exists for cases that need raw access (tests,
 * one-off pipes).
 *
 * Returns the same `{ stdout, stderr }` shape `execFileAsync` does so
 * callers swap by changing the import.
 */
export async function execFileWithTimeout(
  command: string,
  args: readonly string[],
  opts: ExecFileOptions & { timeoutMs: number },
): Promise<{ stdout: string; stderr: string }> {
  const { timeoutMs, ...rest } = opts;
  const result = await execFileAsync(command, [...args], {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    stdout: typeof result.stdout === "string" ? result.stdout : result.stdout.toString(),
    stderr: typeof result.stderr === "string" ? result.stderr : result.stderr.toString(),
  };
}
