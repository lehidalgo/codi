#!/usr/bin/env bash
# scaffold-session.sh — Create a content-factory session directory
# Usage: bash scaffold-session.sh <session-name>
# Creates content-factory-output/<session-name>/ with subdirectories and copies
# preview-shell.js + vendor/ from the skill assets for inlining into generated HTML.

set -euo pipefail

SESSION_NAME="${1:?Usage: scaffold-session.sh <session-name>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="content-factory-output/${SESSION_NAME}"

if [ -d "$OUTPUT_DIR" ]; then
  echo "Session directory already exists: $OUTPUT_DIR"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"/{carousel,social/cards,blog}

# Copy preview infrastructure for inlining
if [ -f "$SKILL_DIR/assets/preview-shell.js" ]; then
  cp "$SKILL_DIR/assets/preview-shell.js" "$OUTPUT_DIR/preview-shell.js"
fi

if [ -d "$SKILL_DIR/assets/vendor" ]; then
  mkdir -p "$OUTPUT_DIR/vendor"
  cp -r "$SKILL_DIR/assets/vendor/"* "$OUTPUT_DIR/vendor/"
fi

echo "Session scaffolded: $OUTPUT_DIR"
echo "  carousel/       — carousel slide HTML"
echo "  social/cards/   — social media card HTML"
echo "  blog/           — blog post and export HTML"
echo "  preview-shell.js — inline into generated HTML"
echo "  vendor/         — html2canvas for PNG export"
