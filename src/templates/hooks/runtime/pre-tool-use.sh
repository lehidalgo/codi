#!/usr/bin/env bash
# devloop pre-tool-use hook
#
# Invoked by Claude Code before every tool call.
# Stdin: JSON { tool_name, tool_input }
# Exit 0 = allow. Exit 2 = block (stderr is delivered to Claude as feedback).
#
# Implementation: a thin wrapper around the TypeScript logic so that the
# decision policy is testable.

set -eu

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
TSX_BIN="$PLUGIN_ROOT/node_modules/.bin/tsx"
HOOK_SCRIPT="$PLUGIN_ROOT/scripts/hook-pre-tool-use.ts"

if [ ! -x "$TSX_BIN" ]; then
  # Plugin dependencies not installed. Fail open (do not block the user's
  # session because of a misconfigured plugin).
  exit 0
fi

exec "$TSX_BIN" "$HOOK_SCRIPT"
