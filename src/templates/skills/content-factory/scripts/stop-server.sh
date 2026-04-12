#!/usr/bin/env bash
# Stop the content factory server.
# Usage: stop-server.sh <workspace_dir>
#
# Kills the server process identified by <workspace_dir>/_server.pid.
# The workspace directory is preserved so projects can be reviewed later.
# Only ephemeral /tmp workspaces are deleted on stop.

WORKSPACE_DIR="$1"

if [[ -z "$WORKSPACE_DIR" ]]; then
  echo '{"error": "Usage: stop-server.sh <workspace_dir>"}'
  exit 1
fi

PID_FILE="${WORKSPACE_DIR}/_server.pid"

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")

  # Graceful stop, escalate to SIGKILL if needed
  kill "$pid" 2>/dev/null || true
  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then break; fi
    sleep 0.1
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.1
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo '{"status": "failed", "error": "process still running"}'
    exit 1
  fi

  rm -f "$PID_FILE"

  # Only delete ephemeral /tmp workspaces
  if [[ "$WORKSPACE_DIR" == /tmp/* ]]; then
    rm -rf "$WORKSPACE_DIR"
  fi

  echo '{"status": "stopped"}'
else
  echo '{"status": "not_running"}'
fi
