#!/usr/bin/env bash
# codi stop hook — plugin-mode wrapper.
#
# Invoked when the assistant finishes a turn. Reads markers from the
# last response and writes captures + closes the in-flight turn in brain.db.
#
# Invokes the bundled `codi hook stop` CLI handler. Project-mode users
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

exec "$CODI_BIN" hook stop --agent claude-code
