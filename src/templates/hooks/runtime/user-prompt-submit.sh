#!/usr/bin/env bash
# devloop user-prompt-submit hook
#
# Invoked each time the user submits a prompt. Stdout is concatenated to
# the prompt before it reaches Claude. We use it to keep the agent aware
# of the active workflow's state without inflating the system prompt.

set -eu

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
TSX_BIN="$PLUGIN_ROOT/node_modules/.bin/tsx"
HOOK_SCRIPT="$PLUGIN_ROOT/scripts/hook-user-prompt-submit.ts"

if [ ! -x "$TSX_BIN" ]; then
  exit 0
fi

exec "$TSX_BIN" "$HOOK_SCRIPT"
