#!/usr/bin/env bash
# Start the brainstorm server and output connection info
# Usage: start-server.sh [--project-dir <path>] [--name <skill-name>] [--host <host>] [--url-host <host>] [--foreground] [--background]
#
# Session directory layout (when --project-dir is given):
#   <project-dir>/.codi_output/YYYYMMDD_HHMM_<name>/
#     content/    — HTML files written by the agent (screen_dir)
#     state/      — server state, PID, log
#     exports/    — PDF, PPTX, DOCX output files
#
# Without --project-dir: session goes to /tmp/ and is deleted on stop.
#
# Options:
#   --project-dir <path>  Root of the project; session is stored under .codi_output/
#   --name <skill>        Skill name used in the session directory name (default: session)
#   --host <bind-host>    Host/interface to bind (default: 127.0.0.1)
#   --url-host <host>     Hostname shown in returned URL JSON
#   --foreground          Run server in the current terminal (no backgrounding)
#   --background          Force background mode (overrides Codex auto-foreground)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse arguments
PROJECT_DIR=""
SESSION_NAME="session"
FOREGROUND="false"
FORCE_BACKGROUND="false"
BIND_HOST="127.0.0.1"
URL_HOST=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --name)
      SESSION_NAME="$2"
      shift 2
      ;;
    --host)
      BIND_HOST="$2"
      shift 2
      ;;
    --url-host)
      URL_HOST="$2"
      shift 2
      ;;
    --foreground|--no-daemon)
      FOREGROUND="true"
      shift
      ;;
    --background|--daemon)
      FORCE_BACKGROUND="true"
      shift
      ;;
    *)
      echo "{\"error\": \"Unknown argument: $1\"}"
      exit 1
      ;;
  esac
done

if [[ -z "$URL_HOST" ]]; then
  if [[ "$BIND_HOST" == "127.0.0.1" || "$BIND_HOST" == "localhost" ]]; then
    URL_HOST="localhost"
  else
    URL_HOST="$BIND_HOST"
  fi
fi

# Some environments reap detached/background processes. Auto-foreground when detected.
if [[ -n "${CODEX_CI:-}" && "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  FOREGROUND="true"
fi

# Windows/Git Bash reaps nohup background processes. Auto-foreground when detected.
if [[ "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  case "${OSTYPE:-}" in
    msys*|cygwin*|mingw*) FOREGROUND="true" ;;
  esac
  if [[ -n "${MSYSTEM:-}" ]]; then
    FOREGROUND="true"
  fi
fi

# Resolve PROJECT_DIR to absolute path before cd changes the working directory
if [[ -n "$PROJECT_DIR" ]]; then
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)" || { echo '{"error": "Invalid --project-dir"}'; exit 1; }
fi

# Build session directory path
TIMESTAMP="$(date +%Y%m%d_%H%M)"

if [[ -n "$PROJECT_DIR" ]]; then
  SESSION_DIR="${PROJECT_DIR}/.codi_output/${TIMESTAMP}_${SESSION_NAME}"
else
  SESSION_DIR="/tmp/brainstorm-$$-$(date +%s)"
fi

CONTENT_DIR="${SESSION_DIR}/content"
STATE_DIR="${SESSION_DIR}/state"
EXPORTS_DIR="${SESSION_DIR}/exports"
PID_FILE="${STATE_DIR}/server.pid"
LOG_FILE="${STATE_DIR}/server.log"

# Create session directories
mkdir -p "$CONTENT_DIR" "$STATE_DIR" "$EXPORTS_DIR"

# Kill any existing server for this session
if [[ -f "$PID_FILE" ]]; then
  old_pid=$(cat "$PID_FILE")
  kill "$old_pid" 2>/dev/null
  rm -f "$PID_FILE"
fi

cd "$SCRIPT_DIR" || exit

# Resolve the harness PID (grandparent of this script).
OWNER_PID="$(ps -o ppid= -p "$PPID" 2>/dev/null | tr -d ' ')"
if [[ -z "$OWNER_PID" || "$OWNER_PID" == "1" ]]; then
  OWNER_PID="$PPID"
fi

if [[ "$FOREGROUND" == "true" ]]; then
  echo "$$" > "$PID_FILE"
  env BRAINSTORM_DIR="$SESSION_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs
  exit $?
fi

nohup env BRAINSTORM_DIR="$SESSION_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null
echo "$SERVER_PID" > "$PID_FILE"

# Wait for server-started message
for _ in {1..50}; do
  if grep -q "server-started" "$LOG_FILE" 2>/dev/null; then
    # Verify server is still alive after a short window
    alive="true"
    for _ in {1..20}; do
      if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        alive="false"
        break
      fi
      sleep 0.1
    done
    if [[ "$alive" != "true" ]]; then
      echo "{\"error\": \"Server started but was killed. Retry with: $SCRIPT_DIR/start-server.sh${PROJECT_DIR:+ --project-dir $PROJECT_DIR} --name $SESSION_NAME --host $BIND_HOST --foreground\"}"
      exit 1
    fi
    # Inject exports_dir into the server-started JSON
    SERVER_JSON="$(grep "server-started" "$LOG_FILE" | head -1)"
    # Append exports_dir before closing brace
    echo "${SERVER_JSON%\}}, \"exports_dir\": \"${EXPORTS_DIR}\"}"
    exit 0
  fi
  sleep 0.1
done

echo '{"error": "Server failed to start within 5 seconds"}'
exit 1
