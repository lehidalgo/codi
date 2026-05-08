#!/usr/bin/env bash
# Set up a fresh demo project for testing devloop end-to-end.
#
# Usage:
#   ./tests/e2e/setup-demo-project.sh                       # uses /tmp/devloop-test-real
#   ./tests/e2e/setup-demo-project.sh /path/to/test-dir     # custom path

set -euo pipefail

TEST_DIR="${1:-/tmp/devloop-test-real}"

# Wipe and recreate
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Git init
git init -q -b main

# Try to inherit user identity, fall back to test values
USER_EMAIL="$(git config --global user.email 2>/dev/null || echo 'test@e2e.com')"
USER_NAME="$(git config --global user.name 2>/dev/null || echo 'tester')"
git config user.email "$USER_EMAIL"
git config user.name "$USER_NAME"

# Create a minimal Next.js-style demo
mkdir -p src/components src/lib

cat > src/components/Hello.tsx <<'TSX'
export function Hello({ name }: { name: string }) {
  return <h1>Hello {name}</h1>;
}
TSX

cat > src/lib/storage.ts <<'TS'
export function getItem(key: string): string | null {
  return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
}

export function setItem(key: string, value: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(key, value);
}
TS

cat > package.json <<'JSON'
{
  "name": "devloop-test-real",
  "version": "0.0.1",
  "private": true,
  "description": "Fresh demo project to validate devloop plugin end-to-end."
}
JSON

cat > README.md <<'MD'
# devloop-test-real

Fresh demo for testing devloop plugin integration with Claude Code.
Initial state: Hello component + storage helper. No CONTEXT.md yet —
that's the first thing devloop should ask for.
MD

cat > .gitignore <<'GI'
node_modules/
dist/
*.log
.DS_Store

# devloop active workflow (gitignored, archives are committed)
.workflow/active/
.workflow/active/.lock
.workflow/active/staging/
GI

git add .
git commit -q -m "initial demo project"

# Final report
echo ""
echo "=========================================="
echo "  Demo project ready"
echo "=========================================="
echo "  Path:       $TEST_DIR"
echo "  Branch:     $(git branch --show-current)"
echo "  Commit:     $(git log -1 --oneline)"
echo ""
echo "  Files:"
git ls-files | sed 's/^/    /'
echo ""
echo "Next steps:"
echo "  cd $TEST_DIR"
echo "  claude            # open Claude Code in the test dir"
echo "  /plugin install devloop@devloop-marketplace   # inside Claude Code"
echo "=========================================="
