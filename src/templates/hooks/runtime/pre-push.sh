#!/usr/bin/env bash
# shellcheck disable=SC2034
# devloop pre-push hook
#
# Validates that force-push preserves all archive commits. If a force-push
# would drop commits that touch .workflow/archives/, the hook blocks.
# Read-only force-push (rebases that preserve archive commits) is allowed.
#
# Stdin format (from git):
#   <local-ref> <local-sha> <remote-ref> <remote-sha>

set -eu

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

while read -r local_ref local_sha remote_ref remote_sha; do
  # Skip new branch creations (remote_sha is all zeros)
  if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
    continue
  fi

  # Find archive commits reachable from remote_sha but NOT from local_sha
  # If any exist, this push would drop them (force-push detection).
  archive_commits=$(git log --format=%H "$remote_sha" --not "$local_sha" -- .workflow/archives/ 2>/dev/null || true)

  if [ -n "$archive_commits" ]; then
    echo "[devloop pre-push] BLOCKED: force-push would drop archive commits:" >&2
    echo "$archive_commits" | while read -r sha; do
      [ -z "$sha" ] && continue
      msg=$(git log --format=%s -n 1 "$sha" 2>/dev/null || echo "?")
      echo "  $sha  $msg" >&2
    done
    echo "" >&2
    echo "Resolve by either:" >&2
    echo "  - rebasing without dropping archive commits, or" >&2
    echo "  - abandoning the workflow (\`devloop abandon --reason ...\`) before force-push" >&2
    exit 1
  fi
done

exit 0
