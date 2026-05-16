#!/usr/bin/env bash
# scripts/hooks/scan-agent-configs.sh
#
# Scan agent / MCP configuration files for hardcoded secrets — even when
# gitignored. Mitigates Sandworm Mode (Feb 2026) where MCP config files
# leaked credentials that pre-commit's secret scanners never saw.
#
# Run from pre-commit (always_run: true) or manually:
#   bash scripts/hooks/scan-agent-configs.sh [project-dir]

set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${1:-$(pwd)}}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0

# Targets — scanned even if gitignored
targets=(
  ".claude/settings.json"
  ".claude/settings.local.json"
  ".claude/.mcp.json"
  ".cursor/mcp.json"
  ".cursor/settings.json"
  ".codi/mcp-servers"
  ".codi/codi.yaml"
  ".mcp.json"
  ".windsurf/settings.json"
  ".cline/settings.json"
  ".codex/config.json"
)

# Patterns — conservative (literal grep -E regex)
patterns=(
  '"(api_?key|apikey|secret|token|password|access_?key|private_?key|client_?secret)"[[:space:]]*:[[:space:]]*"[^"$\{][^"]{12,}"'
  'sk-[a-zA-Z0-9]{20,}'
  'sk-proj-[a-zA-Z0-9_\-]{20,}'
  'sk-ant-[a-zA-Z0-9_\-]{20,}'
  'ghp_[a-zA-Z0-9]{30,}'
  'github_pat_[a-zA-Z0-9_]{30,}'
  'gho_[a-zA-Z0-9]{30,}'
  'AKIA[0-9A-Z]{16}'
  'AIza[0-9A-Za-z_\-]{35}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'BEGIN [A-Z]+ PRIVATE KEY'
)

found=0
for target in "${targets[@]}"; do
  files=()
  if [ -f "$target" ]; then
    files+=("$target")
  fi
  if [ -d "$target" ]; then
    while IFS= read -r f; do
      files+=("$f")
    done < <(find "$target" -type f -size -100k 2>/dev/null)
  fi

  # Guard against `set -u` + empty array expansion (bash quirk).
  [ "${#files[@]}" -eq 0 ] && continue

  for f in "${files[@]}"; do
    for pat in "${patterns[@]}"; do
      if grep -EHn "$pat" "$f" 2>/dev/null; then
        found=1
      fi
    done
  done
done

if [ "$found" -eq 1 ]; then
  echo "" >&2
  echo "WARN: agent / MCP config files appear to contain hardcoded secrets." >&2
  echo "Move them to environment variables and reference via \${VAR_NAME}." >&2
  echo "These files are scanned by rl3-templates even when gitignored" >&2
  echo "(Sandworm-mode mitigation, Feb 2026)." >&2
  exit 1
fi

exit 0
