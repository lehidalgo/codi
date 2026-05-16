#!/usr/bin/env bash
# verify-branch-name.sh — enforces <github-user>/<type>/<slug> convention.
# Used by pre-commit hook. Grandfathers branches predating the convention.

set -eu

current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")

# Skip detached HEAD
[ "$current_branch" = "HEAD" ] && exit 0

# Skip protected branches (commit-to-main is blocked elsewhere)
case "$current_branch" in
  main|master|develop|staging|production) exit 0 ;;
esac

# Get GH user
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
gh_user=$(git config --get codi.githubUser 2>/dev/null || true)
if [ -z "$gh_user" ]; then
  gh_user=$(bash "$script_dir/github-user.sh" 2>/dev/null || true)
fi
if [ -z "$gh_user" ]; then
  echo "[branch-naming] ERROR: cannot detect GitHub user. Set: git config codi.githubUser <username>" >&2
  exit 1
fi

# Validate against pattern
pattern="^${gh_user}/(feature|bugfix|refactor|migration|chore|hotfix)/[a-z0-9][a-z0-9-]*$"
if echo "$current_branch" | grep -qE "$pattern"; then
  exit 0
fi

# Grandfathering check
adopted_at=$(git config --get codi.branchConvention.adoptedAt 2>/dev/null || echo "0")
if [ "$adopted_at" -gt 0 ]; then
  branch_first_commit=$(git log --format=%ct "$current_branch" -- 2>/dev/null | tail -n 1 || echo "0")
  if [ -n "$branch_first_commit" ] && [ "$branch_first_commit" -lt "$adopted_at" ]; then
    echo "[branch-naming] WARN: branch '$current_branch' predates the convention; rename when convenient" >&2
    exit 0
  fi
fi

# Block
echo "[branch-naming] BLOCKED: branch '$current_branch' does not follow the convention." >&2
echo "  Expected: ${gh_user}/<type>/<slug>" >&2
echo "  Types: feature | bugfix | refactor | migration | chore | hotfix" >&2
echo "  Slug: lowercase, kebab-case, optional <workflow-id> prefix" >&2
echo "  Rename: git branch -m ${gh_user}/feature/<slug>" >&2
exit 1
