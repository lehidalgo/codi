#!/usr/bin/env bash
# Start the html-live-inspect server and output connection info.
# Usage: start-server.sh --site-dir <path> [--host <host>] [--port <port>]
#                       [--workspace <dir>] [--no-eval] [--idle-timeout <ms>]
#                       [--foreground] [--background]
#
# Workspace layout:
#   <workspace>/_server.pid   server PID
#   <workspace>/_server.log   server stdout log
#   <workspace>/_state.json   latest selection snapshot
#
# Default workspace: /tmp/html-live-inspect-workspace-<pid> (deleted on stop).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

SITE_DIR=""
BIND_HOST="127.0.0.1"
PORT=""
WORKSPACE_DIR=""
ALLOW_EVAL="1"
IDLE_TIMEOUT_MS="1800000"
FOREGROUND="false"
FORCE_BACKGROUND="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site-dir)        SITE_DIR="$2";         shift 2 ;;
    --host)            BIND_HOST="$2";        shift 2 ;;
    --port)            PORT="$2";             shift 2 ;;
    --workspace)       WORKSPACE_DIR="$2";    shift 2 ;;
    --no-eval)         ALLOW_EVAL="0";        shift ;;
    --idle-timeout)    IDLE_TIMEOUT_MS="$2";  shift 2 ;;
    --foreground)      FOREGROUND="true";     shift ;;
    --background)      FORCE_BACKGROUND="true"; shift ;;
    *) echo "{\"error\": \"Unknown argument: $1\"}"; exit 1 ;;
  esac
done

if [[ -z "$SITE_DIR" ]]; then
  echo '{"error": "--site-dir is required"}'
  exit 1
fi

if [[ ! -e "$SITE_DIR" ]]; then
  echo "{\"error\": \"--site-dir does not exist: $SITE_DIR\"}"
  exit 1
fi

SITE_DIR="$(cd "$(dirname "$SITE_DIR")" && pwd)/$(basename "$SITE_DIR")"

if [[ -z "$WORKSPACE_DIR" ]]; then
  WORKSPACE_DIR="/tmp/html-live-inspect-workspace-$$"
fi
mkdir -p "$WORKSPACE_DIR"

PID_FILE="${WORKSPACE_DIR}/_server.pid"
LOG_FILE="${WORKSPACE_DIR}/_server.log"

if [[ -f "$PID_FILE" ]]; then
  old_pid=$(cat "$PID_FILE")
  kill "$old_pid" 2>/dev/null
  rm -f "$PID_FILE"
fi

# Auto-foreground in environments that reap detached processes
if [[ ( -n "${CODEX_CI:-}" || -n "${CODEX_SANDBOX:-}" ) && "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  # Codex Seatbelt sandbox reaps detached descendants when the bash tool
  # returns; CODEX_SANDBOX is always set in interactive Codex CLI sessions.
  FOREGROUND="true"
fi
if [[ "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  case "${OSTYPE:-}" in msys*|cygwin*|mingw*) FOREGROUND="true" ;; esac
  if [[ -n "${MSYSTEM:-}" ]]; then FOREGROUND="true"; fi
fi

cd "$SCRIPT_DIR" || exit

OWNER_PID="$(ps -o ppid= -p "$PPID" 2>/dev/null | tr -d ' ')"
if [[ -z "$OWNER_PID" || "$OWNER_PID" == "1" ]]; then
  OWNER_PID="$PPID"
fi

ENV_VARS=(
  "HLI_SITE_DIR=$SITE_DIR"
  "HLI_HOST=$BIND_HOST"
  "HLI_WORKSPACE=$WORKSPACE_DIR"
  "HLI_ALLOW_EVAL=$ALLOW_EVAL"
  "HLI_IDLE_TIMEOUT_MS=$IDLE_TIMEOUT_MS"
  "HLI_OWNER_PID=$OWNER_PID"
)
if [[ -n "$PORT" ]]; then
  ENV_VARS+=("HLI_PORT=$PORT")
fi

if [[ "$FOREGROUND" == "true" ]]; then
  echo "$$" > "$PID_FILE"
  env "${ENV_VARS[@]}" node server.cjs
  exit $?
fi

nohup env "${ENV_VARS[@]}" node server.cjs > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null
echo "$SERVER_PID" > "$PID_FILE"

for _ in {1..50}; do
  if grep -q "server-started" "$LOG_FILE" 2>/dev/null; then
    alive="true"
    for _ in {1..20}; do
      if ! kill -0 "$SERVER_PID" 2>/dev/null; then alive="false"; break; fi
      sleep 0.1
    done
    if [[ "$alive" != "true" ]]; then
      echo "{\"error\": \"Server started but was killed. Retry with --foreground\"}"
      exit 1
    fi
    grep "server-started" "$LOG_FILE" | head -1
    exit 0
  fi
  sleep 0.1
done

echo '{"error": "Server failed to start within 5 seconds"}'
exit 1
