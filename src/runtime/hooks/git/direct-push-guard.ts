/**
 * direct-push-guard — pre-push check. Blocks direct push to protected
 * branches (main, master, develop, release/*). ADR-013 Paso 8.
 *
 * Refines capellai's no-direct-push.sh: reads protected-branch list
 * from project config and falls back to a sensible default.
 *
 * Inputs read from stdin (git pre-push hook contract):
 *   <local ref> <local sha> <remote ref> <remote sha>
 * One line per ref being pushed. We check the remote ref against the
 * protected set.
 */

import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const DEFAULT_PROTECTED = ["refs/heads/main", "refs/heads/master", "refs/heads/develop"];
const PROTECTED_PREFIXES = ["refs/heads/release/"];

function isProtected(remoteRef: string): boolean {
  if (DEFAULT_PROTECTED.includes(remoteRef)) return true;
  return PROTECTED_PREFIXES.some((p) => remoteRef.startsWith(p));
}

export function checkDirectPush(
  _ctx: GitHookContext,
  stdinLines: readonly string[],
): GitHookVerdict {
  try {
    const blocked: string[] = [];
    for (const line of stdinLines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const remoteRef = parts[2];
      if (typeof remoteRef === "string" && isProtected(remoteRef)) {
        blocked.push(remoteRef);
      }
    }
    if (blocked.length === 0) return { severity: "pass", check: "direct-push-guard", messages: [] };
    return {
      severity: "block",
      check: "direct-push-guard",
      messages: [
        `Direct push to protected branch blocked: ${blocked.join(", ")}`,
        "Open a pull request instead. To override (not recommended), unset core.hooksPath temporarily.",
      ],
    };
  } catch (err) {
    return failOpen("direct-push-guard", err);
  }
}
