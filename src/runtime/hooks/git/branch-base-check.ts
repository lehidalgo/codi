/**
 * branch-base-check — pre-push check. Warns when the current branch's
 * base is stale relative to the remote's main/develop. Advisory only:
 * does NOT block. ADR-013 Paso 8.
 *
 * Refines capellai's check-branch-base.sh: counts commits the upstream
 * base has that the local branch is missing. If > threshold, warn.
 */

import { execFileSync } from "node:child_process";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const STALE_COMMIT_THRESHOLD = 25;
const BASE_CANDIDATES = ["origin/main", "origin/master", "origin/develop"];

function git(args: readonly string[], cwd: string): string {
  return execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();
}

function findBase(cwd: string): string | null {
  for (const candidate of BASE_CANDIDATES) {
    try {
      git(["rev-parse", "--verify", candidate], cwd);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function checkBranchBase(ctx: GitHookContext): GitHookVerdict {
  try {
    const base = findBase(ctx.cwd);
    if (!base) {
      return { severity: "pass", check: "branch-base-check", messages: [] };
    }
    const behind = git(["rev-list", "--count", `HEAD..${base}`], ctx.cwd);
    const behindCount = Number.parseInt(behind, 10);
    if (Number.isNaN(behindCount) || behindCount <= STALE_COMMIT_THRESHOLD) {
      return { severity: "pass", check: "branch-base-check", messages: [] };
    }
    return {
      severity: "warn",
      check: "branch-base-check",
      messages: [
        `Branch is ${behindCount} commits behind ${base} (threshold ${STALE_COMMIT_THRESHOLD}).`,
        `Consider rebasing: git fetch origin && git rebase ${base}`,
      ],
    };
  } catch (err) {
    return failOpen("branch-base-check", err);
  }
}
