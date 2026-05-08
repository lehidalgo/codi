/**
 * Auto-commit policy: when a commitable event is appended to the archive,
 * stage the archive directory and commit it with a structured message.
 *
 * Failures are non-fatal: if git is missing or the repo state prevents a
 * commit, the event still lives on disk, and the next commitable event
 * (or a manual `git add && git commit`) will pick it up.
 */

import { git, isGitRepo } from "./git-utils.js";
import type { ManifestEvent } from "./types.js";

export interface AutoCommitResult {
  attempted: boolean;
  committed: boolean;
  reason: string;
}

export function autoCommitEvent(
  event: ManifestEvent,
  archivePath: string,
  cwd: string,
): AutoCommitResult {
  if (!event.commitable) {
    return { attempted: false, committed: false, reason: "Event is not commitable." };
  }
  if (!isGitRepo(cwd)) {
    return { attempted: false, committed: false, reason: "Not a git repository." };
  }

  const add = git(["add", archivePath], cwd);
  if (!add.ok) {
    return { attempted: true, committed: false, reason: `git add failed: ${add.stderr.trim()}` };
  }

  const status = git(["status", "--porcelain", archivePath], cwd);
  if (status.ok && status.stdout.trim().length === 0) {
    return {
      attempted: true,
      committed: false,
      reason: "Nothing to commit (file may already be tracked clean).",
    };
  }

  const message = `devloop: ${event.event_type} [${event.event_id.slice(0, 8)}]`;
  const commit = git(["commit", "-m", message, "--no-verify", "--", archivePath], cwd);
  if (!commit.ok) {
    return {
      attempted: true,
      committed: false,
      reason: `git commit failed: ${commit.stderr.trim() || commit.stdout.trim()}`,
    };
  }

  return {
    attempted: true,
    committed: true,
    reason: `Committed ${event.event_type} (${event.event_id.slice(0, 8)})`,
  };
}
