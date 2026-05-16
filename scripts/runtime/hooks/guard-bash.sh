#!/usr/bin/env bash
# scripts/hooks/guard-bash.sh
#
# Claude Code PreToolUse filter for the Bash tool.
# Reads JSON on stdin, decides allow / block.
#
# Exit semantics:
#   0   allow — any stdout/stderr is informational
#   2   block — stderr is shown to Claude as the reason
#
# This script is the single source of truth for which Bash commands the
# agent is allowed to run. The .claude/settings.json deny-list is a coarser
# first pass; this script catches edge cases (refspec parsing, push to
# protected branch via HEAD:master, etc.).

set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("command", ""))
except Exception:
    print("")
' 2>/dev/null || echo "")

if [ -z "$cmd" ]; then
  exit 0
fi

block() {
  echo "BLOCKED by rl3-templates guard-bash: $1" >&2
  echo "" >&2
  echo "Command: $cmd" >&2
  echo "" >&2
  echo "If this rule is wrong, edit scripts/hooks/guard-bash.sh and explain why." >&2
  exit 2
}

# warn() — non-blocking advisory. Returns 0 (Claude proceeds) but prints a
# stderr message so the agent and user see the recommendation. Used for
# recoverable destructive ops where blocking creates more friction than the
# protection is worth.
warn() {
  echo "WARN by rl3-templates guard-bash: $1" >&2
  echo "Command: $cmd" >&2
}

# ── --no-verify variants ───────────────────────────────────────────────────
if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+(commit|push|merge|rebase)([[:space:]]|$).*--no-verify'; then
  block "--no-verify is forbidden for the agent. If a hook is wrong, fix the hook."
fi

if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+commit[[:space:]]+([^|]*[[:space:]])?-n([[:space:]]|$)'; then
  block "git commit -n (alias for --no-verify) is forbidden."
fi

# ── force push ─────────────────────────────────────────────────────────────
if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+push[[:space:]]+.*--force([[:space:]]|$)'; then
  if ! echo "$cmd" | grep -qE '\-\-force-with-lease'; then
    block "git push --force is forbidden. Use --force-with-lease (refuses if remote moved)."
  fi
fi

# Match `-f` either immediately after `push ` or later as a standalone flag.
if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+push[[:space:]]+(-f|.*[[:space:]]-f)([[:space:]]|$)'; then
  block "git push -f is forbidden. Use --force-with-lease."
fi

# ── direct push to protected branches ──────────────────────────────────────
for protected in master main develop; do
  # git push <remote> <protected>
  if echo "$cmd" | grep -qE "(^|[[:space:]])git[[:space:]]+push[[:space:]]+[^[:space:]]+[[:space:]]+${protected}([[:space:]]|$)"; then
    block "Direct push to ${protected} is forbidden. Open a PR instead."
  fi
  # git push <remote> HEAD:<protected> or HEAD:refs/heads/<protected>
  if echo "$cmd" | grep -qE "(^|[[:space:]])git[[:space:]]+push[[:space:]]+[^[:space:]]+[[:space:]]+HEAD:(refs/heads/)?${protected}([[:space:]]|$)"; then
    block "Direct push to ${protected} via HEAD: refspec is forbidden. Open a PR instead."
  fi
  # git push <remote> <branch>:<protected>
  if echo "$cmd" | grep -qE "(^|[[:space:]])git[[:space:]]+push[[:space:]]+[^[:space:]]+[[:space:]]+[^[:space:]]+:${protected}([[:space:]]|$)"; then
    block "Pushing any branch to ${protected} is forbidden."
  fi
  # git push <remote> refs/heads/<protected>
  if echo "$cmd" | grep -qE "(^|[[:space:]])git[[:space:]]+push[[:space:]]+[^[:space:]]+[[:space:]]+refs/heads/${protected}([[:space:]]|$)"; then
    block "Direct push to refs/heads/${protected} is forbidden."
  fi
done

# ── checkout / switch onto protected ───────────────────────────────────────
# WARN-only: pre-commit `no-commit-to-branch` blocks any commit on master /
# main / develop, so checkout is harmless on its own. The warning nudges the
# agent to stay on a feature branch.
if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+(checkout|switch)[[:space:]]+(master|main|develop)([[:space:]]|$)'; then
  warn "Checking out master/main/develop. Pre-commit will refuse any commit on these branches. Prefer staying on a feature branch and integrating via 'git fetch + git merge origin/<branch>'."
fi

# ── reset / clean / restore — recoverable destructive forms ────────────────
# All three are recoverable (reflog / stash / git clean -n). WARN instead of
# BLOCK to keep dev experience usable; the agent sees a hint but proceeds.
if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+reset[[:space:]]+--hard([[:space:]]|$)'; then
  warn "git reset --hard discards working-tree + staged changes. Recoverable via 'git reflog' but not via working-tree state. Stash or commit a checkpoint if unsure."
fi

if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+clean[[:space:]]+(-f|-fd|-df|-fdx|-xfd)([[:space:]]|$)'; then
  warn "git clean with -f deletes untracked files (NOT in git history — unrecoverable). Run 'git clean -n' first to dry-run."
fi

if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+(checkout|restore)[[:space:]]+\.([[:space:]]|$)'; then
  warn "git checkout . / git restore . overwrites all uncommitted working-tree changes. 'git stash' first if you want to keep them."
fi

# ── git config global ──────────────────────────────────────────────────────
if echo "$cmd" | grep -qE '(^|[[:space:]])git[[:space:]]+config[[:space:]]+--global'; then
  block "Modifying the user's global git config is forbidden."
fi

# ── package managers ───────────────────────────────────────────────────────
if echo "$cmd" | grep -qE '(^|[[:space:]])pip[[:space:]]+install([[:space:]]|$)'; then
  if ! echo "$cmd" | grep -qE 'uv[[:space:]]+pip[[:space:]]+install'; then
    block "Use 'uv add <pkg>' instead of pip install (lockfile + venv)."
  fi
fi

# `npm install` without a lockfile used to BLOCK here. Removed — npm
# tolerates missing lockfiles fine and creates one on first install.
# Forcing a lockfile commit before any install adds more friction than it
# saves; the lockfile shows up in the next commit and is reviewable in PR.

# ── curl pipe shell ────────────────────────────────────────────────────────
if echo "$cmd" | grep -qE '(curl|wget)[[:space:]]+[^|]*\|[[:space:]]*(sh|bash|zsh)([[:space:]]|$)'; then
  block "curl|sh is a remote-execution pattern. Download to a file, inspect, then execute."
fi

# ── rm -rf at dangerous targets ────────────────────────────────────────────
# Note: the agent passes commands as raw strings (unexpanded), so we match the
# literal '$HOME' substring. shellcheck SC2016 is a false positive here.
# shellcheck disable=SC2016
if echo "$cmd" | grep -qE '(^|[[:space:]])rm[[:space:]]+(-rf|-r[[:space:]]+-f|-fr)[[:space:]]+(/|~|\$HOME)([[:space:]]|$)'; then
  block "rm -rf at root or home is forbidden."
fi

if echo "$cmd" | grep -qE '(^|[[:space:]])rm[[:space:]]+(-rf|-fr)[[:space:]]+\.\.([[:space:]]|/|$)'; then
  block "rm -rf at parent directory is forbidden."
fi

# ── chmod -R / chown -R on broad targets ───────────────────────────────────
# shellcheck disable=SC2016
if echo "$cmd" | grep -qE '(^|[[:space:]])(chmod|chown)[[:space:]]+-R[[:space:]]+[^[:space:]]+[[:space:]]+(/|~|\$HOME)([[:space:]]|$)'; then
  block "Recursive chmod/chown on root or home is forbidden."
fi

# All checks passed
exit 0
