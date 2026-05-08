#!/usr/bin/env bash
# audit.sh — read-only scan of git-lifecycle quality gates.
# Output: punch list grouped by severity. NO file modifications.

set -eu

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Not a git repo" >&2; exit 1; }
cd "$repo_root"

basename=$(basename "$repo_root")

# Detect runner
runner="none"
[ -f lefthook.yml ] || [ -f lefthook.yaml ] && runner="lefthook"
[ -f .pre-commit-config.yaml ] && runner="pre-commit"
[ -f package.json ] && grep -q '"husky"' package.json 2>/dev/null && runner="husky"

# Detect stack
stacks=()
[ -f package.json ] && stacks+=("TypeScript/JS")
[ -f pyproject.toml ] || [ -f setup.py ] && stacks+=("Python")
[ -f go.mod ] && stacks+=("Go")
[ -f Cargo.toml ] && stacks+=("Rust")
[ -d .husky ] && [ "$(find . -maxdepth 3 -name '*.sh' -not -path './node_modules/*' 2>/dev/null | head -1)" ] && stacks+=("Shell")
stack_str="${stacks[*]:-(unknown)}"

# Findings buckets
declare -a HIGH MEDIUM LOW

# === pre-commit checks ===
if [ ! -f .husky/pre-commit ] && [ ! -f .pre-commit-config.yaml ] && [ ! -f lefthook.yml ]; then
  HIGH+=("No pre-commit hook configured (no gitleaks, no lint, no format)")
else
  # Check for gitleaks
  if ! grep -rqE 'gitleaks' .husky/pre-commit .pre-commit-config.yaml lefthook.yml 2>/dev/null; then
    HIGH+=("Pre-commit hook does not run gitleaks (universal secret scan)")
  fi
  # Check for branch-name validator
  if ! grep -rqE 'verify-branch-name|branch-naming|githubUser' .husky/ .pre-commit-config.yaml lefthook.yml 2>/dev/null; then
    HIGH+=("No branch-name validator (<github-user>/<type>/<slug> convention not enforced)")
  fi
  # Check for conflict-marker check
  if ! grep -rqE 'check-merge-conflict|conflict-marker' .husky/pre-commit .pre-commit-config.yaml 2>/dev/null; then
    LOW+=("No conflict-marker check in pre-commit")
  fi
fi

# === commit-msg ===
if [ ! -f .husky/commit-msg ]; then
  HIGH+=("No commit-msg validator (conventional commit policy unenforced)")
fi

# === pre-push ===
if [ ! -f .husky/pre-push ]; then
  MEDIUM+=("No pre-push hook (failures only caught after push to CI)")
else
  if ! grep -qE '(test|pnpm test|cargo test|pytest|go test)' .husky/pre-push; then
    MEDIUM+=("Pre-push hook does not run tests")
  fi
  if ! grep -qE '(tsc|pyright|mypy|cargo check)' .husky/pre-push; then
    MEDIUM+=("Pre-push hook does not run type-check")
  fi
fi

# === GH user config ===
if ! git config --get devloop.githubUser > /dev/null 2>&1; then
  MEDIUM+=("git config devloop.githubUser is unset; branch-naming convention has not been bootstrapped")
fi

# === CI workflow ===
if [ ! -d .github/workflows ]; then
  MEDIUM+=("No .github/workflows/ — CI not configured")
else
  ci_files=$(find .github/workflows -name '*.yml' -o -name '*.yaml' 2>/dev/null)
  if [ -z "$ci_files" ]; then
    MEDIUM+=("No CI workflow files in .github/workflows/")
  else
    if ! grep -lqE 'gitleaks' .github/workflows/*.yml 2>/dev/null; then
      MEDIUM+=("CI does not run gitleaks (local hook may be bypassed)")
    fi
  fi
fi

# === Output ===
echo "quality-gates audit — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Repository: $basename"
echo "Detected stack: $stack_str"
echo "Detected runner: $runner"
echo ""

[ ${#HIGH[@]} -gt 0 ] && {
  echo "HIGH (${#HIGH[@]}):"
  for f in "${HIGH[@]}"; do echo "  - $f"; done
  echo ""
}

[ ${#MEDIUM[@]} -gt 0 ] && {
  echo "MEDIUM (${#MEDIUM[@]}):"
  for f in "${MEDIUM[@]}"; do echo "  - $f"; done
  echo ""
}

[ ${#LOW[@]} -gt 0 ] && {
  echo "LOW (${#LOW[@]}):"
  for f in "${LOW[@]}"; do echo "  - $f"; done
  echo ""
}

if [ ${#HIGH[@]} -eq 0 ] && [ ${#MEDIUM[@]} -eq 0 ] && [ ${#LOW[@]} -eq 0 ]; then
  echo "✓ All gates configured per contract."
  echo "✓ Universal hooks present."
  echo "No action needed."
  exit 0
fi

if [ ${#HIGH[@]} -gt 0 ] || [ ${#MEDIUM[@]} -gt 0 ]; then
  echo "Run: /devloop:quality-gates  (mode setup) to fix HIGH and MEDIUM. LOW is optional."
fi

# Exit 1 if any HIGH violations (for CI use)
[ ${#HIGH[@]} -gt 0 ] && exit 1
exit 0
