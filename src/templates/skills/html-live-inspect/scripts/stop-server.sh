#!/usr/bin/env bash
# Stop the html-live-inspect server.
# Usage: stop-server.sh <workspace_dir>

WORKSPACE_DIR="$1"

if [[ -z "$WORKSPACE_DIR" ]]; then
  echo '{"error": "Usage: stop-server.sh <workspace_dir>"}'
  exit 1
fi

PID_FILE="${WORKSPACE_DIR}/_server.pid"

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")

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

  if [[ "$WORKSPACE_DIR" == /tmp/* ]]; then
    rm -rf "$WORKSPACE_DIR"
  fi

  echo '{"status": "stopped"}'
else
  echo '{"status": "not_running"}'
fi
