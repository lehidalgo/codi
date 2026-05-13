/**
 * Safe git invocation helpers.
 *
 * Uses execFileSync to avoid shell injection. Failures are returned as
 * structured results, not thrown — callers decide whether to bail.
 *
 * Every invocation carries a wall-clock timeout so a hung git process
 * (filesystem stall, dead network on `fetch`, prompt-on-stdin) cannot
 * block the parent CLI indefinitely. Node's native `execFileSync({
 * timeout })` kills the child with `killSignal` when exceeded. The
 * default (`DEFAULT_GIT_TIMEOUT_MS`) suits the read-heavy local ops
 * `git()` is typically used for (rev-parse, status, config, diff,
 * show); callers that need longer (fetch, push) pass `timeoutMs`.
 */

import { execFileSync } from "node:child_process";

/** Default timeout for `git()` invocations: 15s — covers local diff/show on large repos. */
export const DEFAULT_GIT_TIMEOUT_MS = 15_000;

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  /** Set when the child was killed because it exceeded `timeoutMs`. */
  timedOut?: boolean;
}

export interface GitOptions {
  /** Per-call override; falls back to DEFAULT_GIT_TIMEOUT_MS. */
  readonly timeoutMs?: number;
}

export function git(args: string[], cwd?: string, opts: GitOptions = {}): GitResult {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS;
  try {
    const stdout = execFileSync("git", args, {
      encoding: "utf-8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });
    return { ok: true, stdout, stderr: "" };
  } catch (err) {
    const e = err as {
      stderr?: Buffer | string;
      stdout?: Buffer | string;
      signal?: string;
      code?: string | number;
    };
    // Node sets signal='SIGTERM' (or killSignal) when {timeout} fires.
    const timedOut = e.signal === "SIGTERM" || e.code === "ETIMEDOUT";
    return {
      ok: false,
      stdout: typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString() ?? ""),
      stderr: typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? ""),
      ...(timedOut ? { timedOut: true } : {}),
    };
  }
}

export function isGitRepo(cwd: string): boolean {
  return git(["rev-parse", "--git-dir"], cwd).ok;
}
