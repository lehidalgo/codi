/**
 * Safe git invocation helpers.
 *
 * Uses execFileSync to avoid shell injection. Failures are returned as
 * structured results, not thrown — callers decide whether to bail.
 */

import { execFileSync } from "node:child_process";

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export function git(args: string[], cwd?: string): GitResult {
  try {
    const stdout = execFileSync("git", args, {
      encoding: "utf-8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout, stderr: "" };
  } catch (err) {
    const e = err as { stderr?: Buffer | string; stdout?: Buffer | string };
    return {
      ok: false,
      stdout: typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString() ?? ""),
      stderr: typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? ""),
    };
  }
}

export function isGitRepo(cwd: string): boolean {
  return git(["rev-parse", "--git-dir"], cwd).ok;
}
