/**
 * branch-name-check — pre-push check. Enforces branch naming
 * convention. ADR-013 Paso 8. Refines capellai's check-branch-name.sh.
 *
 * Default convention: feature/*, bugfix/*, chore/*, release/*,
 * hotfix/*. Plus main/master/develop themselves. Plus user/<name>/*
 * for personal branches.
 */

import { execFileSync } from "node:child_process";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const ALLOWED_PATTERNS: readonly RegExp[] = [
  /^main$/,
  /^master$/,
  /^develop$/,
  /^feature\/[a-z0-9._-]+$/i,
  /^bugfix\/[a-z0-9._-]+$/i,
  /^chore\/[a-z0-9._-]+$/i,
  /^release\/[a-z0-9._-]+$/i,
  /^hotfix\/[a-z0-9._-]+$/i,
  /^user\/[a-z0-9._-]+\/[a-z0-9._/-]+$/i,
];

function currentBranch(cwd: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf8" })
      .trim();
  } catch {
    return null;
  }
}

export function checkBranchName(ctx: GitHookContext): GitHookVerdict {
  try {
    const branch = currentBranch(ctx.cwd);
    if (!branch || branch === "HEAD") {
      return {
        severity: "warn",
        check: "branch-name-check",
        messages: ["detached HEAD; skipping branch name validation"],
      };
    }
    const ok = ALLOWED_PATTERNS.some((re) => re.test(branch));
    if (ok) return { severity: "pass", check: "branch-name-check", messages: [] };
    return {
      severity: "block",
      check: "branch-name-check",
      messages: [
        `Branch name "${branch}" does not match the allowed conventions.`,
        "Use one of: feature/<slug>, bugfix/<slug>, chore/<slug>, release/<slug>, hotfix/<slug>, user/<name>/<slug>.",
      ],
    };
  } catch (err) {
    return failOpen("branch-name-check", err);
  }
}
