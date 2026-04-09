#!/usr/bin/env bash
# scaffold-session.sh — Create a content-factory session directory and start preview server
# Usage: bash scaffold-session.sh <session-name> [--project-dir <path>]

set -euo pipefail

SESSION_NAME="${1:?Usage: scaffold-session.sh <session-name>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse optional --project-dir
PROJECT_DIR=""
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# Copy generator templates into the session content directory so the agent has
# starting-point HTML files. The server will inject preview-shell.js at runtime.
START_ARGS="--name content-factory"
if [[ -n "$PROJECT_DIR" ]]; then
  START_ARGS="$START_ARGS --project-dir $PROJECT_DIR"
fi

# Start server — it creates the session directory structure
SERVER_JSON=$(bash "$SCRIPT_DIR/start-server.sh" $START_ARGS)
echo "$SERVER_JSON"

# Extract screen_dir from server JSON
CONTENT_DIR=$(echo "$SERVER_JSON" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{ try{ console.log(JSON.parse(d).screen_dir||'') }catch(e){} })")

if [[ -z "$CONTENT_DIR" ]]; then
  echo "Warning: could not determine content dir from server JSON" >&2
  exit 0
fi

# Seed content dir with generator templates renamed for this session
cp "$SKILL_DIR/generators/social-base.html"   "$CONTENT_DIR/social.html"
cp "$SKILL_DIR/generators/document-base.html" "$CONTENT_DIR/document.html"
cp "$SKILL_DIR/generators/slides-base.html"   "$CONTENT_DIR/deck.html"

echo "Session seeded:"
echo "  social.html   — social card template"
echo "  document.html — document/blog template"
echo "  deck.html     — slide deck template"
