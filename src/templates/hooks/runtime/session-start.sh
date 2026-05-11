#!/usr/bin/env bash
# codi SessionStart hook.
#
# Runs once per Claude Code session. Two responsibilities:
#   1. Verify plugin dependencies are installed (block-warn if not).
#   2. Inject the team-developer charter + active project/workflow state +
#      workflow menu into agent context, so every team member's session
#      begins identically (Iron Laws preloaded).
#
# Never blocks (exit 0 always). Output goes to stdout via JSON to be
# delivered as additionalContext per the hooks spec.

set -eu

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
TSX_BIN="$PLUGIN_ROOT/node_modules/.bin/tsx"
CWD="$(pwd)"

emit_context() {
  local message="$1"
  # Encode to single-line JSON-safe string. python3 is universally available
  # on macOS / Linux dev machines and gives correct escaping for free.
  python3 -c '
import json
import sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": sys.stdin.read()}}))
' <<< "$message"
}

# ─── Dependency check ────────────────────────────────────────────────────────

if [ ! -x "$TSX_BIN" ]; then
  emit_context "codi plugin loaded but dependencies are missing at $PLUGIN_ROOT.

Before invoking any codi command, instruct the user to run:
  cd $PLUGIN_ROOT && pnpm install

Without this, all codi CLI calls will fail."
  exit 0
fi

# ─── State probe ─────────────────────────────────────────────────────────────

PROJECT_NAME="none"
SHEET_ID=""
AUTH_MODE=""
WORKFLOW_ID="none active"
OUTPUT_MODE="caveman"

if [ -f "$CWD/.codi/project.json" ]; then
  # Project metadata read via stdin heredoc + argv[1] so $CWD never enters
  # the Python source. Quoted delimiter (<<'PY') prevents shell expansion
  # inside the body — required to avoid arbitrary-code execution if the
  # project path contains a single quote.
  PROJECT_NAME="$(python3 - "$CWD/.codi/project.json" <<'PY'
import json, sys
try:
    print(json.load(open(sys.argv[1])).get('project_name', 'unknown'))
except Exception:
    print('unknown')
PY
)"
  SHEET_ID="$(python3 - "$CWD/.codi/project.json" <<'PY'
import json, sys
try:
    print(json.load(open(sys.argv[1])).get('sheet_id', ''))
except Exception:
    print('')
PY
)"
  AUTH_MODE="$(python3 - "$CWD/.codi/project.json" <<'PY'
import json, sys
try:
    print(json.load(open(sys.argv[1])).get('auth_mode', 'service_account'))
except Exception:
    print('')
PY
)"
fi

if [ -f "$CWD/.workflow/active/workflow-id.txt" ]; then
  WORKFLOW_ID="$(cat "$CWD/.workflow/active/workflow-id.txt" 2>/dev/null || echo "unknown")"
fi

if [ -f "$CWD/.codi/preferences.yaml" ]; then
  # Prefer YAML when available — grep is portable and works without yq.
  OUTPUT_MODE="$(grep -E '^output_mode:' "$CWD/.codi/preferences.yaml" 2>/dev/null | sed -E 's/^output_mode:[[:space:]]*//; s/[[:space:]]*$//; s/^"(.*)"$/\1/' || echo 'caveman')"
  if [ -z "$OUTPUT_MODE" ]; then OUTPUT_MODE="caveman"; fi
elif [ -f "$CWD/.codi/preferences.json" ]; then
  OUTPUT_MODE="$(python3 - "$CWD/.codi/preferences.json" <<'PY'
import json, sys
try:
    print(json.load(open(sys.argv[1])).get('output_mode', 'caveman'))
except Exception:
    print('caveman')
PY
)"
fi

# ─── Charter injection ───────────────────────────────────────────────────────

# Compose the message. Heredoc preserves the formatting; we trust the
# emit_context helper to JSON-escape the whole blob.
# ─── using-codi anchor (1% rule + workflow discipline) ──────────────────────
# Read the using-codi skill content from the installed location and embed it
# in the SessionStart context. Falls back to a minimal one-liner if the skill
# was not generated (e.g. before first `codi generate`).
USING_CODI_PATH=""
for candidate in \
  "$CWD/.claude/skills/codi-using-codi/SKILL.md" \
  "$CWD/.codi/skills/codi-using-codi/SKILL.md" \
  "$PLUGIN_ROOT/dist/templates/skills/using-codi/SKILL.md" \
  "$PLUGIN_ROOT/src/templates/skills/using-codi/SKILL.md"; do
  if [ -f "$candidate" ]; then
    USING_CODI_PATH="$candidate"
    break
  fi
done

if [ -n "$USING_CODI_PATH" ]; then
  USING_CODI_CONTENT="$(cat "$USING_CODI_PATH")"
else
  USING_CODI_CONTENT="(using-codi skill not yet generated — run 'codi generate' to load the anchor)"
fi

MESSAGE="<EXTREMELY_IMPORTANT>
You have codi.

Below is the full content of your 'using-codi' anchor skill — your introduction to using codi skills and workflows. For all other skills, use the \`Skill\` tool.

${USING_CODI_CONTENT}
</EXTREMELY_IMPORTANT>

You are codi-augmented Claude Code — a peer team developer, not the user's tool.

═══ DEFAULT MODE: ACT ═══
Your default is action, not interrogation. User directives ('start', 'fix this', 'let's go', 'do X') ARE authorization — execute the recommended path. Ask ONLY when:
  • HARD GATE — phase transition requires explicit 'ok' (case-insensitive: 'ok' / 'OK' / 'Ok' all pass; 'okay' / 'looks good' / 'sure' do NOT)
  • Credentials / OAuth click-through — input only the human can supply
  • Ambiguous business decision — answer would CHANGE the path, no signal to default it
  • Irreversible action — git commit / git push / large destructive Sheet write
Otherwise: do. Frame asks as 'I need X from you because I cannot do Y myself' — never 'Do you want me to <thing I can already do>?'.

═══ Iron Laws (full reference: skills/team-charter/references/iron-laws.md) ═══
1. RECOMMEND AND EXECUTE          Default = action. Ask only at HARD GATE / credential / ambiguous-business / irreversible. When asking, carry 'Recommend X because Y'.
2. ONE QUESTION PER TURN          Atomic elicitation; never bundle.
3. SHEET IS THE CANVAS            Strategic info lives in the Sheet via draft+sync, not chat.
4. HARD GATES NEED 'ok'           'ok' / 'OK' / 'Ok' (case-insensitive, exactly two chars) pass a phase gate. 'okay' / 'looks good' / 'sure' / 'yeah' do NOT.
5. PULL BEFORE PATCH              Re-runs start with 'codi sheets pull-all'.
6. ATOMIC + ROLLBACK              sync-draft auto-snapshots; restore --latest is the undo.
7. NEVER COMMIT WITHOUT APPROVAL  git commit / PR / branch delete are user-gated.
8. HONOR OUTPUT MODE              Default caveman: bullets, ≤3-col tables, ONE summary line.

═══ Session state ═══
  project:    $PROJECT_NAME
  sheet:      $SHEET_ID
  auth:       $AUTH_MODE
  workflow:   $WORKFLOW_ID
  output:     $OUTPUT_MODE

═══ Output mode ═══
The session output_mode above is the project default (Iron Law 8). When 'caveman':
  - Auto-invoke skill 'caveman' for response style.
  - User types '?' (alone or prefixed) → respond in normal mode for THAT turn only.
  - Flip default with: codi preferences set output-mode normal

═══ Available workflows ═══
  project        bootstrap a new project + Google Sheet from stakeholder docs
  feature        deliver a UserStory end-to-end
  bug-fix        reproduce → plan hypotheses → fix → verify
  refactor       deepen a module without behavior change
  migration      schema/data migration with rollback path required
  quality-gates  set up + verify hooks/CI

═══ First-turn behavior ═══
Decide if the user's first prompt is EXPLORATORY or DIRECTIVE:

EXPLORATORY (empty / 'hi' / 'what can I do?' / 'help'):
  Print the state above + workflow menu. Wait.

DIRECTIVE ('start the project' / 'fix this' / 'let's go' / 'do X'):
  SKIP the menu. Start executing the matching workflow IMMEDIATELY. Print one
  state line for context if useful, but the FIRST concrete action is the
  workflow's first step (read inputs, run the CLI, propose a value to confirm).
  Do NOT ask 'should I start?' — the directive IS authorization.

When the workflow needs a real decision from you (project name, auth mode,
phase transition gate), pause THEN — not before any action.

For one-off Sheet operations the user can run directly:
  codi sheets pull-all      patch-model baseline before editing
  codi sheets snapshot      manual safety capture
  codi sheets restore --latest   undo last sync
  codi sheets archive <Entity> <id>   soft-delete a row"

emit_context "$MESSAGE"
exit 0
