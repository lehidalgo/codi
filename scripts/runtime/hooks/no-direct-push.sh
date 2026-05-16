#!/usr/bin/env bash
# scripts/hooks/no-direct-push.sh
#
# Pre-push hook — refuse direct push to master / main / develop.
# Reads pre-push refs on stdin: <local_ref> <local_sha> <remote_ref> <remote_sha>
#
# This is the local mirror of GitHub branch protection. The PR-policy CI
# check (Phase 2) enforces it server-side; this script catches the agent
# (and humans) before the push leaves the machine.

set -euo pipefail

while read -r _local_ref _local_sha remote_ref _remote_sha; do
  case "$remote_ref" in
    refs/heads/master|refs/heads/main|refs/heads/develop)
      branch="${remote_ref#refs/heads/}"
      echo "ERROR: direct push to $branch is forbidden." >&2
      echo "" >&2
      echo "Open a PR from your feature branch instead:" >&2
      echo "  gh pr create --base develop --head \$(git rev-parse --abbrev-ref HEAD)" >&2
      echo "" >&2
      echo "Hotfix? Use:" >&2
      echo "  gh pr create --base master --head hotfix/<TICKET>-<slug>" >&2
      echo "" >&2
      echo "True emergency? A repo admin can override branch protection on GitHub." >&2
      echo "The agent does not have admin privileges." >&2
      exit 1
      ;;
  esac
done

exit 0
