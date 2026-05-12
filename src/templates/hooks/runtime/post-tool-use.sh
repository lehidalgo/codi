#!/usr/bin/env bash
# codi post-tool-use hook — plugin-mode wrapper.
#
# Invoked by Claude Code after every tool call. Captures tool output
# into brain.db for observability.
#
# Invokes the bundled `codi hook post-tool-use` CLI handler. Project-mode users
# call the same handler directly from `.claude/settings.json`; this
# wrapper exists for plugin-mode where Claude Code injects
# $CLAUDE_PLUGIN_ROOT instead of $CLAUDE_PROJECT_DIR.
#
# Always exits 0 when codi is unavailable — hook failures never break
# the user's session.

set -eu

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

if [ -x "$PLUGIN_ROOT/node_modules/.bin/codi" ]; then
  CODI_BIN="$PLUGIN_ROOT/node_modules/.bin/codi"
elif command -v codi >/dev/null 2>&1; then
  CODI_BIN="codi"
else
  exit 0
fi

exec "$CODI_BIN" hook post-tool-use --agent claude-code
