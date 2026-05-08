#!/usr/bin/env bash
# scripts/hooks/auto-format.sh
#
# Claude Code PostToolUse hook: format the file just edited.
# Idempotent and silent on success — never blocks Claude.

set -uo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("file_path", ""))
except Exception:
    print("")
' 2>/dev/null || echo "")

[ -z "$file_path" ] && exit 0
[ ! -f "$file_path" ] && exit 0

proj="${CLAUDE_PROJECT_DIR:-.}"

case "$file_path" in
  *.py)
    if command -v ruff >/dev/null 2>&1; then
      ruff format "$file_path" >/dev/null 2>&1 || true
      ruff check --fix --quiet "$file_path" >/dev/null 2>&1 || true
    elif command -v uv >/dev/null 2>&1; then
      (cd "$proj" && uv run --no-project --quiet ruff format "$file_path") >/dev/null 2>&1 || true
      (cd "$proj" && uv run --no-project --quiet ruff check --fix --quiet "$file_path") >/dev/null 2>&1 || true
    fi
    ;;

  *.ts | *.tsx | *.js | *.jsx | *.json | *.jsonc | *.css)
    if command -v biome >/dev/null 2>&1; then
      biome format --write "$file_path" >/dev/null 2>&1 || true
    elif [ -f "$proj/package.json" ]; then
      (cd "$proj" && pnpm exec biome format --write --no-errors-on-unmatched "$file_path") >/dev/null 2>&1 || true
    fi
    ;;

  *.tf)
    if command -v terraform >/dev/null 2>&1; then
      terraform fmt "$file_path" >/dev/null 2>&1 || true
    fi
    ;;

  *.sh)
    if command -v shfmt >/dev/null 2>&1; then
      shfmt -w "$file_path" >/dev/null 2>&1 || true
    fi
    ;;

  *.md | *.yaml | *.yml | *.toml)
    # Markdown / YAML / TOML left alone here — pre-commit handles them on stage.
    ;;
esac

exit 0
