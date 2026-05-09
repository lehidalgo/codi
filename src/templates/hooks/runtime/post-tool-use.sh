#!/usr/bin/env bash
# codi post-tool-use hook
#
# Invoked after a tool call completes. Always exits 0 — this hook never
# blocks; it records incidental file changes (outside scope.files_in_plan
# but classified as incidental) for audit trail.

set -eu

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
TSX_BIN="$PLUGIN_ROOT/node_modules/.bin/tsx"
HOOK_SCRIPT="$PLUGIN_ROOT/scripts/hook-post-tool-use.ts"

if [ ! -x "$TSX_BIN" ]; then
  exit 0
fi

exec "$TSX_BIN" "$HOOK_SCRIPT"
