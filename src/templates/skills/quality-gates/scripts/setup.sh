#!/usr/bin/env bash
# setup.sh — install missing hooks adaptively. Idempotent.
# Reads existing hooks, merges standard checks, asks before CI changes.

set -eu

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Not a git repo" >&2; exit 1; }
cd "$repo_root"

# Resolve script dir
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "quality-gates setup — $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 1. Detect runner
runner="husky"
if [ -f lefthook.yml ] || [ -f lefthook.yaml ]; then
  runner="lefthook"
elif [ -f .pre-commit-config.yaml ]; then
  runner="pre-commit"
elif [ -f package.json ] && grep -q '"husky"' package.json 2>/dev/null; then
  runner="husky"
elif [ -f pyproject.toml ] && [ ! -f package.json ]; then
  runner="pre-commit"
fi
echo "Runner: $runner"

# 2. Detect GH user
gh_user=$(bash "$script_dir/github-user.sh")
echo "GitHub user: $gh_user"

# 3. Record adoption timestamp (only on first setup)
if ! git config --get devloop.branchConvention.adoptedAt > /dev/null 2>&1; then
  git config devloop.branchConvention.adoptedAt "$(date +%s)"
  echo "Recorded branch-convention adoption timestamp"
fi

# 4. Install pre-commit (husky path — most common)
if [ "$runner" = "husky" ]; then
  if ! command -v husky > /dev/null 2>&1 && [ ! -f node_modules/.bin/husky ]; then
    echo "✗ husky not installed. Install with: pnpm add -D husky lint-staged" >&2
    exit 1
  fi
  mkdir -p .husky
  pre_commit_file=".husky/pre-commit"

  # Read existing if present
  existing_pre=""
  if [ -f "$pre_commit_file" ]; then
    existing_pre=$(cat "$pre_commit_file")
    echo "Existing $pre_commit_file detected — merging"
  fi

  # Generate managed block
  managed_block=$(cat <<'MANAGED'
# >>> devloop:quality-gates managed (do not edit between markers)
script_dir="$(git rev-parse --show-toplevel)/skills/quality-gates/scripts"

# Universal hooks
bash "$script_dir/verify-branch-name.sh" || exit 1

STAGED=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -n "$STAGED" ]; then
  # Conflict markers
  if echo "$STAGED" | xargs -I{} grep -lE '^(<{7}|={7}|>{7})' {} 2>/dev/null; then
    echo "[quality-gates] BLOCKED: conflict markers found in staged files" >&2
    exit 1
  fi
  # gitleaks
  if command -v gitleaks > /dev/null 2>&1; then
    gitleaks protect --staged --no-banner || exit 1
  else
    echo "[quality-gates] WARN: gitleaks not installed (brew install gitleaks)" >&2
  fi
fi
# <<< devloop:quality-gates managed
MANAGED
)

  if echo "$existing_pre" | grep -q "devloop:quality-gates managed"; then
    # Replace managed block in place
    awk -v block="$managed_block" '
      /^# >>> devloop:quality-gates managed/ { print block; skipping=1; next }
      /^# <<< devloop:quality-gates managed/ { skipping=0; next }
      !skipping
    ' "$pre_commit_file" > "$pre_commit_file.tmp"
    mv "$pre_commit_file.tmp" "$pre_commit_file"
  else
    # Prepend managed block
    {
      echo "$managed_block"
      [ -n "$existing_pre" ] && echo "" && echo "$existing_pre"
    } > "$pre_commit_file"
  fi
  chmod +x "$pre_commit_file"
  echo "✓ pre-commit hook updated at $pre_commit_file"
elif [ "$runner" = "pre-commit" ]; then
  echo "(pre-commit framework path not yet implemented — for Python-primary repos)"
  echo "  Install: pip install pre-commit && pre-commit install"
elif [ "$runner" = "lefthook" ]; then
  echo "(lefthook path not yet implemented)"
  echo "  Install: brew install lefthook && lefthook install"
fi

# 5. Install commit-msg
if [ "$runner" = "husky" ]; then
  cat > .husky/commit-msg <<'COMMITMSG'
#!/bin/sh
# devloop commit-msg validator
# >>> devloop:quality-gates managed
msg_file="$1"
[ -z "$msg_file" ] && exit 0

msg=$(head -n 1 "$msg_file" | tr -d '\r')

case "$msg" in
  Merge*|Revert*) exit 0 ;;
esac

types='feat|fix|docs|refactor|test|chore|perf|ci|build|style|revert'

if ! echo "$msg" | grep -qE "^(${types})(\([^)]+\))?!?: .+"; then
  echo "[commit-msg] BLOCKED: invalid commit message format" >&2
  echo "  Expected: type(scope): description" >&2
  echo "  Types: $(echo "$types" | tr '|' ' ')" >&2
  echo "  Example: feat(auth): add OAuth2 login flow" >&2
  echo "  Got: $msg" >&2
  exit 1
fi

if [ "${#msg}" -gt 72 ]; then
  echo "[commit-msg] BLOCKED: first line is ${#msg} chars (max 72)" >&2
  echo "  Message: $msg" >&2
  exit 1
fi

exit 0
# <<< devloop:quality-gates managed
COMMITMSG
  chmod +x .husky/commit-msg
  echo "✓ commit-msg hook installed"
fi

# 6. CI workflow extension — HARD GATE
if [ -d .github/workflows ]; then
  echo ""
  echo "CI workflow editing requires explicit user approval per references/ci-extension.md."
  echo "Diff would be displayed; not auto-applied. Run mode setup with --apply-ci to proceed (not implemented in this script)."
fi

echo ""
echo "Setup complete. Run mode verify to smoke-test:"
echo "  bash $script_dir/verify.sh"
