#!/usr/bin/env bash
# scripts/hooks/check-branch-name.sh
#
# Pre-push hook — refuse to push from a branch that doesn't match policy.
#
# Canonical shape:  <prefix>/<git-username>/<slug>
# With ticket ref:  <prefix>/<git-username>/<TICKET-ID>-<slug>
#
# Where:
#   <prefix>        ∈ {feature, bugfix, chore, release, hotfix}
#   <git-username>  derived from `git config user.name`
#                   (lowercased, non-alnum stripped, spaces → dash).
#                   Falls back to local-part of `git config user.email`.
#   <TICKET-ID>     optional, shape <PREFIX>-<NUMBER>  (e.g. RL3-142, CBP-99).
#                   Prefix is one uppercase letter then 1-7 uppercase or
#                   digits — allows RL3, CBP, JIRA, PROD2.
#   <slug>          lowercase kebab.
#
# Examples:
#   feature/lehidalgo/add-csv-export
#   feature/lehidalgo/RL3-142-add-csv-export
#   hotfix/jdoe/CBP-99-fix-payment
#   chore/lehidalgo/bump-deps

set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")

# ── Derive normalised git username ────────────────────────────────────────
gituser=$(git config user.name 2>/dev/null || echo "")
if [ -z "$gituser" ]; then
  email=$(git config user.email 2>/dev/null || echo "")
  gituser="${email%%@*}"
fi
# Lowercase + spaces and dots → dash + drop chars outside [a-z0-9-]
normalized_user=$(printf '%s' "$gituser" \
  | tr '[:upper:]' '[:lower:]' \
  | tr ' .' '--' \
  | tr -cd 'a-z0-9-')

# ── Protected branches: never commit on them directly ─────────────────────
case "$branch" in
  master|main|develop)
    echo "ERROR: you are committing on a protected branch ($branch)." >&2
    echo "" >&2
    echo "Protected branches receive changes ONLY via PR." >&2
    echo "Create a feature branch:" >&2
    echo "  git checkout develop && git pull origin develop" >&2
    if [ -n "$normalized_user" ]; then
      echo "  git checkout -b feature/$normalized_user/<slug>" >&2
    else
      echo "  git checkout -b feature/<your-name>/<slug>" >&2
    fi
    exit 1
    ;;
esac

# ── Validate <prefix>/<user>/<slug> shape ─────────────────────────────────
case "$branch" in
  feature/*|bugfix/*|chore/*|release/*|hotfix/*)
    rest="${branch#*/}"
    if ! echo "$rest" | grep -qE '^[a-z0-9][a-z0-9-]*/.+$'; then
      echo "ERROR: branch '$branch' must be <prefix>/<git-username>/<slug>." >&2
      if [ -n "$normalized_user" ]; then
        echo "  Expected: feature/$normalized_user/<slug>" >&2
      fi
      exit 1
    fi

    user_part="${rest%%/*}"
    slug_part="${rest#*/}"

    if [ -z "$normalized_user" ]; then
      echo "WARN: git config user.name not set; cannot enforce username segment." >&2
      echo "  Set it with: git config --local user.name '<your-name>'" >&2
      # Don't block — local config may be missing on a fresh clone.
      exit 0
    fi

    if [ "$user_part" != "$normalized_user" ]; then
      echo "ERROR: branch user segment '$user_part' does not match your git user." >&2
      echo "  Your git user (normalised): $normalized_user" >&2
      echo "  Expected branch:           ${branch%%/*}/$normalized_user/$slug_part" >&2
      echo "" >&2
      echo "Either rename the branch:" >&2
      echo "  git branch -m ${branch%%/*}/$normalized_user/$slug_part" >&2
      echo "Or update your git user if this is the wrong identity." >&2
      exit 1
    fi

    # Slug validation: <TICKET>-<slug>  OR  plain <slug>
    if echo "$slug_part" | grep -qE '^[A-Z][A-Z0-9]{1,7}-[0-9]+-[a-z0-9-]+$'; then
      exit 0
    fi
    if echo "$slug_part" | grep -qE '^[a-z0-9][a-z0-9.-]*$'; then
      exit 0
    fi

    echo "ERROR: slug '$slug_part' has an invalid shape." >&2
    echo "  Allowed: <slug>  or  <TICKET>-<slug>" >&2
    echo "  Example: feature/$normalized_user/add-csv-export" >&2
    echo "  Example: feature/$normalized_user/RL3-142-add-csv-export" >&2
    exit 1
    ;;

  *)
    echo "ERROR: branch '$branch' does not match a required prefix." >&2
    echo "" >&2
    echo "Use one of: feature/, bugfix/, chore/, release/, hotfix/" >&2
    echo "Format:     <prefix>/<git-username>/<slug>" >&2
    echo "Example:    feature/${normalized_user:-<your-name>}/add-csv-export" >&2
    exit 1
    ;;
esac
