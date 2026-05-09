#!/usr/bin/env bash
# codi stop hook
#
# Invoked when the assistant finishes a turn. Reads the agent's last
# response from the transcript, parses |TYPE: "..."| markers, and writes
# captures + closes the in-flight turn in brain.db.
#
# Always exits 0 — capture failures never break the user's session.

set -eu

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
TSX_BIN="$PLUGIN_ROOT/node_modules/.bin/tsx"
HOOK_SCRIPT="$PLUGIN_ROOT/scripts/hook-stop.ts"

if [ ! -x "$TSX_BIN" ]; then
  exit 0
fi

exec "$TSX_BIN" "$HOOK_SCRIPT"
