/**
 * Resolve the `actor_id` string for an audit-trail row (ISSUE-052).
 *
 * Used by both the corrections writer (`recordCorrectionFromMarker`) and
 * the operations-ledger writer to attribute every audit row to either a
 * human (git config user.email) or an agent (claude-code, codex, …).
 *
 * Format is `"<type>:<id>"` so a single TEXT column / JSON field can
 * disambiguate types without a second column. Examples:
 *   - "human:user@example.com"
 *   - "agent:claude-code"
 *   - "system:codi"
 *   - "unknown:legacy" (fallback when nothing else resolves)
 *
 * Resolution order:
 *   1. Explicit override (caller knows the Author — always wins).
 *   2. `CODI_ACTOR_ID` env var (CI / test isolation).
 *   3. `git config --get user.email` (the per-repo identity).
 *   4. `os.userInfo().username` (last-ditch host-user fallback).
 *
 * The git probe carries a hard 1 s timeout so a stalled `.git` does not
 * block CLI commands.
 */

import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";
import type { Author } from "#src/runtime/types.js";

export interface ResolveActorOptions {
  readonly cwd?: string;
  /** Caller-supplied Author wins over every fallback. */
  readonly override?: Author;
}

export function formatActorId(actor: Author): string {
  return `${actor.type}:${actor.id}`;
}

/**
 * Best-effort actor resolution. Never throws; always returns a non-empty
 * string suitable for the `actor_id` column or `actor` JSON field.
 */
export function resolveActorId(opts: ResolveActorOptions = {}): string {
  if (opts.override) return formatActorId(opts.override);

  const envActor = process.env["CODI_ACTOR_ID"];
  if (typeof envActor === "string" && envActor.length > 0) return envActor;

  const cwd = opts.cwd ?? process.cwd();
  const email = probeGitEmail(cwd);
  if (email !== null) return `human:${email}`;

  try {
    const host = userInfo().username;
    if (host.length > 0) return `human:${host}`;
  } catch {
    // userInfo() can throw in sandboxed environments — fall through.
  }
  return "unknown:legacy";
}

function probeGitEmail(cwd: string): string | null {
  try {
    const out = execFileSync("git", ["config", "--get", "user.email"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      timeout: 1000,
    });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
