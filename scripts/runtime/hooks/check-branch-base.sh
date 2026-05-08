#!/usr/bin/env bash
# scripts/hooks/check-branch-base.sh
#
# Pre-push hook — verify the current branch was created from the correct base.
#   feature/* | bugfix/* | chore/* | release/*  ← must descend from develop
#   hotfix/*                                    ← must descend from master / main
#
# Runs after check-branch-name.sh (which already validated the prefix).
# Best-effort: if origin/develop or origin/master is unreachable (offline),
# the check exits clean.

set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")

# Best-effort fetch — never block on network failure
git fetch --quiet origin master develop main 2>/dev/null || true

prod_ref=""
for candidate in origin/master origin/main; do
  if git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
    prod_ref="$candidate"
    break
  fi
done

integ_ref=""
if git rev-parse --verify --quiet origin/develop >/dev/null 2>&1; then
  integ_ref="origin/develop"
fi

case "$branch" in
  feature/*|bugfix/*|chore/*|release/*)
    if [ -z "$integ_ref" ]; then
      exit 0  # offline or no develop yet — skip
    fi
    if ! git merge-base "$integ_ref" HEAD >/dev/null 2>&1; then
      echo "ERROR: $branch does not share history with $integ_ref." >&2
      echo "" >&2
      echo "Feature/bugfix/chore/release branches must be created from develop:" >&2
      echo "  git fetch origin develop" >&2
      echo "  git checkout -b $branch origin/develop" >&2
      exit 1
    fi
    ;;

  hotfix/*)
    if [ -z "$prod_ref" ]; then
      exit 0
    fi
    if ! git merge-base "$prod_ref" HEAD >/dev/null 2>&1; then
      echo "ERROR: $branch does not share history with $prod_ref." >&2
      echo "" >&2
      echo "Hotfix branches must be created from master:" >&2
      echo "  git fetch origin master" >&2
      echo "  git checkout -b $branch origin/master" >&2
      exit 1
    fi
    ;;
esac

exit 0
