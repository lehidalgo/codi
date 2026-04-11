#!/usr/bin/env bash
# Start the content factory server and output connection info.
# Usage: start-server.sh [--project-dir <path>] [--name <skill-name>] [--host <host>] [--url-host <host>] [--foreground] [--background]
#
# Workspace layout:
#   <project-dir>/.codi_output/         ← workspace root (WORKSPACE_DIR)
#     <project-name>/                   ← one dir per content project
#       content/                        ← HTML files written by the agent
#       state/                          ← manifest, preset, active, pid files
#       exports/                        ← PDF, PNG, ZIP exports
#     _workspace.json                   ← tracks the active project
#     _server.pid                       ← server PID
#     _server.log                       ← server stdout log
#
# Without --project-dir: workspace goes to /tmp/ and is deleted on stop.
#
# Options:
#   --project-dir <path>  Root of the project; workspace is stored under .codi_output/
#   --name <skill>        Unused (kept for backward compat)
#   --host <bind-host>    Host/interface to bind (default: 127.0.0.1)
#   --url-host <host>     Hostname shown in returned URL JSON
#   --foreground          Run server in the current terminal (no backgrounding)
#   --background          Force background mode (overrides Codex auto-foreground)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse arguments
PROJECT_DIR=""
FOREGROUND="false"
FORCE_BACKGROUND="false"
BIND_HOST="127.0.0.1"
URL_HOST=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)  PROJECT_DIR="$2";  shift 2 ;;
    --name)         shift 2 ;;  # unused, kept for backward compat
    --host)         BIND_HOST="$2";    shift 2 ;;
    --url-host)     URL_HOST="$2";     shift 2 ;;
    --foreground|--no-daemon)  FOREGROUND="true";        shift ;;
    --background|--daemon)     FORCE_BACKGROUND="true";  shift ;;
    *) echo "{\"error\": \"Unknown argument: $1\"}"; exit 1 ;;
  esac
done

if [[ -z "$URL_HOST" ]]; then
  if [[ "$BIND_HOST" == "127.0.0.1" || "$BIND_HOST" == "localhost" ]]; then
    URL_HOST="localhost"
  else
    URL_HOST="$BIND_HOST"
  fi
fi

# Auto-foreground in environments that reap detached processes
if [[ -n "${CODEX_CI:-}" && "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  FOREGROUND="true"
fi
if [[ "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  case "${OSTYPE:-}" in msys*|cygwin*|mingw*) FOREGROUND="true" ;; esac
  if [[ -n "${MSYSTEM:-}" ]]; then FOREGROUND="true"; fi
fi

# Resolve PROJECT_DIR to absolute path
if [[ -n "$PROJECT_DIR" ]]; then
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)" || { echo '{"error": "Invalid --project-dir"}'; exit 1; }
fi

# Workspace dir — one persistent directory, shared across server restarts
if [[ -n "$PROJECT_DIR" ]]; then
  WORKSPACE_DIR="${PROJECT_DIR}/.codi_output"
else
  WORKSPACE_DIR="/tmp/brainstorm-workspace-$$"
fi

PID_FILE="${WORKSPACE_DIR}/_server.pid"
LOG_FILE="${WORKSPACE_DIR}/_server.log"

# Create workspace root (projects are created on demand via POST /api/create-project)
mkdir -p "$WORKSPACE_DIR"

# Kill any existing server for this workspace
if [[ -f "$PID_FILE" ]]; then
  old_pid=$(cat "$PID_FILE")
  kill "$old_pid" 2>/dev/null
  rm -f "$PID_FILE"
fi

cd "$SCRIPT_DIR" || exit

# Resolve the harness PID (grandparent of this script)
OWNER_PID="$(ps -o ppid= -p "$PPID" 2>/dev/null | tr -d ' ')"
if [[ -z "$OWNER_PID" || "$OWNER_PID" == "1" ]]; then
  OWNER_PID="$PPID"
fi

if [[ "$FOREGROUND" == "true" ]]; then
  echo "$$" > "$PID_FILE"
  env BRAINSTORM_WORKSPACE="$WORKSPACE_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs
  exit $?
fi

nohup env BRAINSTORM_WORKSPACE="$WORKSPACE_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null
echo "$SERVER_PID" > "$PID_FILE"

# Wait for server-started message
for _ in {1..50}; do
  if grep -q "server-started" "$LOG_FILE" 2>/dev/null; then
    # Verify server is still alive
    alive="true"
    for _ in {1..20}; do
      if ! kill -0 "$SERVER_PID" 2>/dev/null; then alive="false"; break; fi
      sleep 0.1
    done
    if [[ "$alive" != "true" ]]; then
      echo "{\"error\": \"Server started but was killed. Retry with: $SCRIPT_DIR/start-server.sh${PROJECT_DIR:+ --project-dir $PROJECT_DIR} --host $BIND_HOST --foreground\"}"
      exit 1
    fi
    grep "server-started" "$LOG_FILE" | head -1
    exit 0
  fi
  sleep 0.1
done

echo '{"error": "Server failed to start within 5 seconds"}'
exit 1
