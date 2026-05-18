/**
 * Shared types for codi's git hook modules (ADR-013 Paso 8).
 *
 * Git hooks have no stdin payload (unlike Claude Code hooks). Each
 * check inspects repo state via `git` subcommands and reports a
 * structured verdict to the dispatcher. The dispatcher prints any
 * messages to stderr and exits with the worst severity:
 *
 *   block   → exit 1 (abort the commit/push)
 *   warn    → exit 0 but with stderr advisory
 *   pass    → silent
 *
 * Checks fail OPEN — exceptions inside a check do NOT abort the
 * commit/push. The check returns severity="warn" with the exception
 * message so the user sees what went wrong but isn't blocked.
 */

export type Severity = "block" | "warn" | "pass";

export interface GitHookVerdict {
  readonly severity: Severity;
  readonly check: string;
  readonly messages: readonly string[];
}

export interface GitHookContext {
  readonly cwd: string;
}

/**
 * Aggregate multiple check verdicts into the final dispatcher exit code.
 * Rule: any `block` → exit 1; otherwise exit 0. Stderr always carries
 * the messages so the user sees passing-but-loud information too.
 */
export function aggregateExitCode(verdicts: readonly GitHookVerdict[]): number {
  return verdicts.some((v) => v.severity === "block") ? 1 : 0;
}

/**
 * Format a verdict for stderr. Prefix marks the severity so a quick
 * grep tells you what blocked.
 */
export function formatVerdictForStderr(v: GitHookVerdict): string {
  const prefix = v.severity === "block" ? "BLOCK" : v.severity === "warn" ? "WARN" : "PASS";
  const lines = v.messages.map((m) => `[codi git-hook][${prefix}][${v.check}] ${m}`);
  return lines.join("\n");
}

/**
 * Helper: turn a thrown exception into a non-blocking warn verdict so a
 * single check's failure never aborts the commit/push.
 */
export function failOpen(check: string, err: unknown): GitHookVerdict {
  const message = err instanceof Error ? err.message : String(err);
  return {
    severity: "warn",
    check,
    messages: [`internal error (fail-open): ${message}`],
  };
}
