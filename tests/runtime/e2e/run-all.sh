#!/usr/bin/env bash
# shellcheck disable=SC2164
# devloop end-to-end validation suite.
#
# Exercises every CLI surface, every hook decision branch, every classifier
# rule, every gate check, and the full workflow lifecycle. Output is
# captured in docs/TEST-EVIDENCE.md format.
#
# Usage:
#   ./tests/e2e/run-all.sh                  # human-readable
#   ./tests/e2e/run-all.sh > evidence.txt   # capture for review

set -uo pipefail

DEVLOOP_ROOT="${DEVLOOP_ROOT:-/Users/laht/projects/devloop}"
TSX="$DEVLOOP_ROOT/node_modules/.bin/tsx"
DEV="$DEVLOOP_ROOT/scripts/devloop.ts"
CLASSIFY="$DEVLOOP_ROOT/scripts/classify.ts"
PRETOOL="$DEVLOOP_ROOT/hooks/pre-tool-use.sh"
PROMPTHOOK="$DEVLOOP_ROOT/hooks/user-prompt-submit.sh"

PASS=0
FAIL=0
TESTS_RUN=0

assert_contains() {
  local description="$1"
  local needle="$2"
  local haystack="$3"
  TESTS_RUN=$((TESTS_RUN + 1))
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ✅ $description"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $description"
    echo "     expected to find: $needle"
    echo "     in: $(echo "$haystack" | head -3 | sed 's/^/       /')"
    FAIL=$((FAIL + 1))
  fi
}

assert_exit_code() {
  local description="$1"
  local expected="$2"
  local actual="$3"
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ $description (exit $expected)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $description"
    echo "     expected exit $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

new_workspace() {
  # Returns the path; caller MUST `cd` into it (command-substitution runs
  # this in a subshell so the cd cannot propagate to the parent).
  local dir
  dir=$(mktemp -d)
  (
    cd "$dir" || exit 1
    git init -q -b main
    git config user.email "test@e2e.com"
    git config user.name "e2e"
    mkdir -p docs
    echo "# Project Context" > docs/CONTEXT.md
  )
  echo "$dir"
}

enter_workspace() {
  WORK=$(new_workspace)
  cd "$WORK" || exit 1
}

section() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  $1"
  echo "═══════════════════════════════════════════════════════════════"
}

# ─── Section A: CLI core ─────────────────────────────────────────────────

section "Section A — CLI core"

OUT=$($TSX $DEV version 2>&1)
assert_contains "A1: version reports v0.1.0" "v0.1.0" "$OUT"

enter_workspace
OUT=$($TSX $DEV status 2>&1)
assert_contains "A2: status without workflow says No active" "No active workflow" "$OUT"

OUT=$($TSX $DEV run feature "E2E test feature" --author tester 2>&1)
assert_contains "A3: run feature creates workflow" "feat-e2e-test-feature" "$OUT"
assert_contains "A4: run reports phase intent" "Phase: intent" "$OUT"

OUT=$($TSX $DEV status 2>&1)
assert_contains "A5: status shows active" "Status:   active" "$OUT"
assert_contains "A6: status shows phase intent" "Phase:    intent" "$OUT"

OUT=$($TSX $DEV transition --to plan 2>&1)
assert_contains "A7: transition --to proposes" "Proposed transition intent → plan" "$OUT"

OUT=$($TSX $DEV transition --reject --reason "needs revision" 2>&1)
assert_contains "A8: transition reject works" "Rejected transition" "$OUT"

OUT=$($TSX $DEV status 2>&1)
assert_contains "A9: rejected proposal keeps phase intent" "Phase:    intent" "$OUT"

$TSX $DEV transition --to plan > /dev/null
OUT=$($TSX $DEV transition --approve 2>&1)
assert_contains "A10: transition approve advances phase" "Approved transition" "$OUT"

OUT=$($TSX $DEV status 2>&1)
assert_contains "A11: approved transition reaches plan" "Phase:    plan" "$OUT"

OUT=$($TSX $DEV abandon --reason "section A complete" 2>&1)
assert_contains "A12: abandon clears active" "Abandoned workflow" "$OUT"

OUT=$($TSX $DEV status 2>&1)
assert_contains "A13: status after abandon" "No active workflow" "$OUT"

# ─── Section B: Knowledge base requirement ───────────────────────────────

section "Section B — Knowledge base bootstrap"

WORK=$(mktemp -d)
cd "$WORK" || exit 1
OUT=$($TSX $DEV run feature "no kb test" --author tester 2>&1) || true
assert_contains "B1: run blocks without CONTEXT.md" "Knowledge base missing" "$OUT"
assert_contains "B2: error instructs init-knowledge-base" "init-knowledge-base" "$OUT"

mkdir -p docs && echo "# Context" > docs/CONTEXT.md
OUT=$($TSX $DEV run feature "kb present test" --author tester 2>&1)
assert_contains "B3: run proceeds with CONTEXT.md present" "Started workflow" "$OUT"

# ─── Section C: Scope discipline ─────────────────────────────────────────

section "Section C — Scope discipline"

enter_workspace
$TSX $DEV run feature "scope test" --author tester > /dev/null

OUT=$($TSX $DEV scope propose-expansion --file src/a.ts --reason "module a" 2>&1)
assert_contains "C1: scope propose-expansion succeeds" "Proposed scope expansion for 'src/a.ts'" "$OUT"

OUT=$($TSX $DEV scope propose-expansion --file src/b.ts --reason "module b" 2>&1)
assert_contains "C2: second proposal queued" "src/b.ts" "$OUT"

OUT=$($TSX $DEV scope approve --file src/a.ts 2>&1)
assert_contains "C3: scope approve specific file" "approved for 'src/a.ts'" "$OUT"

OUT=$($TSX $DEV scope reject --file src/b.ts --reason "out of scope" 2>&1)
assert_contains "C4: scope reject specific file" "rejected for 'src/b.ts'" "$OUT"

OUT=$($TSX $DEV status --json 2>&1)
assert_contains "C5: files_in_plan contains a.ts" '"src/a.ts"' "$OUT"
assert_contains "C6: rejection counter incremented" '"scope_expansions_rejected": 1' "$OUT"

# Re-propose previously rejected
$TSX $DEV scope propose-expansion --file src/b.ts --reason "now needed" > /dev/null
$TSX $DEV scope approve --file src/b.ts > /dev/null
OUT=$($TSX $DEV status --json 2>&1)
assert_contains "C7: re-proposed and approved file in plan" '"src/b.ts"' "$OUT"

OUT=$($TSX $DEV scope approve 2>&1) || true
assert_contains "C8: approve without pending rejects" "No pending scope expansion" "$OUT"

# ─── Section D: Classifier ────────────────────────────────────────────────

section "Section D — Classifier"

OUT=$(echo '{"file_path":"src/foo.test.ts","old_content":"","new_content":"test();"}' | $TSX $CLASSIFY 2>&1)
assert_contains "D1: test file → scope-expansion" '"category": "scope-expansion"' "$OUT"
assert_contains "D2: test file high confidence" '"confidence": "high"' "$OUT"

OUT=$(echo '{"file_path":"package.json","old_content":"{}","new_content":"{\"name\":\"x\"}"}' | $TSX $CLASSIFY 2>&1)
assert_contains "D3: package.json → scope-expansion" '"category": "scope-expansion"' "$OUT"

OUT=$(echo '{"file_path":"migrations/001.sql","old_content":"","new_content":"CREATE TABLE x;"}' | $TSX $CLASSIFY 2>&1)
assert_contains "D4: migration → scope-expansion" '"category": "scope-expansion"' "$OUT"
assert_contains "D5: migration suggests elevation" '"workflow_type": "migration"' "$OUT"

OUT=$(echo '{"file_path":"docs/adr/0001-x.md","old_content":"","new_content":"# ADR"}' | $TSX $CLASSIFY 2>&1)
assert_contains "D6: ADR → scope-expansion" '"category": "scope-expansion"' "$OUT"
assert_contains "D7: ADR suggests refactor elevation" '"workflow_type": "refactor"' "$OUT"

OUT=$(printf '{"file_path":"src/foo.ts","old_content":"const x = 1;","new_content":"%s"}' \
  'import { y } from \"./y\";\nconst x = 1;' | $TSX $CLASSIFY 2>&1)
# Note: shell escape complexity — use a simpler imports-only test
TMPF=$(mktemp)
cat > "$TMPF" <<'JSON'
{"file_path":"src/foo.ts","old_content":"const x = 1;","new_content":"import { y } from './y';\nconst x = 1;"}
JSON
OUT=$($TSX $CLASSIFY < "$TMPF" 2>&1)
assert_contains "D8: imports-only → incidental" '"category": "incidental"' "$OUT"
rm -f "$TMPF"

OUT=$(echo '{"file_path":"src/foo.ts","old_content":"x as A","new_content":"x as B"}' | $TSX $CLASSIFY 2>&1)
assert_contains "D9: type-assertion-only auto-escalates" '"category": "scope-expansion"' "$OUT"
assert_contains "D10: low confidence reported" '"confidence": "low"' "$OUT"

# ─── Section E: Hooks ─────────────────────────────────────────────────────

section "Section E — Hook decisions"

enter_workspace
$TSX $DEV run feature "hook test" --author tester > /dev/null
$TSX $DEV scope propose-expansion --file src/in-scope.ts --reason "ok" > /dev/null
$TSX $DEV scope approve --file src/in-scope.ts > /dev/null
for p in plan decompose execute; do
  $TSX $DEV transition --to $p > /dev/null
  $TSX $DEV transition --approve > /dev/null
done

# Out of scope edit
echo '{"tool_name":"Edit","tool_input":{"file_path":"src/random.ts","old_string":"a","new_string":"b"}}' \
  | CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PRETOOL > /dev/null 2> /tmp/pretool.err
EC=$?
assert_exit_code "E1: pre-tool-use blocks edit out of scope" 2 $EC
assert_contains "E2: feedback mentions scope violation" "Scope violation" "$(cat /tmp/pretool.err)"

# In-scope edit
echo '{"tool_name":"Edit","tool_input":{"file_path":"src/in-scope.ts","old_string":"x","new_string":"y"}}' \
  | CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PRETOOL > /dev/null 2>&1
EC=$?
assert_exit_code "E3: pre-tool-use allows in-scope edit" 0 $EC

# gh pr create
echo '{"tool_name":"Bash","tool_input":{"command":"gh pr create --title x"}}' \
  | CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PRETOOL 2> /tmp/pretool.err
EC=$?
assert_exit_code "E4: pre-tool-use blocks gh pr create" 2 $EC
assert_contains "E5: gh pr create feedback mentions phase done" "phase done" "$(cat /tmp/pretool.err)"

# rm -rf /
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' \
  | CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PRETOOL 2> /tmp/pretool.err
EC=$?
assert_exit_code "E6: pre-tool-use blocks rm -rf /" 2 $EC

# git push --force
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}' \
  | CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PRETOOL 2> /tmp/pretool.err
EC=$?
assert_exit_code "E7: pre-tool-use blocks git push --force" 2 $EC

# git reset --hard
echo '{"tool_name":"Bash","tool_input":{"command":"git reset --hard HEAD"}}' \
  | CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PRETOOL 2> /tmp/pretool.err
EC=$?
assert_exit_code "E8: pre-tool-use blocks git reset --hard" 2 $EC

# Safe bash
echo '{"tool_name":"Bash","tool_input":{"command":"pnpm test"}}' \
  | CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PRETOOL > /dev/null 2>&1
EC=$?
assert_exit_code "E9: pre-tool-use allows pnpm test" 0 $EC

# UserPromptSubmit hook with active workflow
OUT=$(CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PROMPTHOOK 2>&1)
assert_contains "E10: prompt hook emits workflow-state block" "<workflow-state>" "$OUT"
assert_contains "E11: prompt hook includes phase" "Current phase: execute" "$OUT"
assert_contains "E12: prompt hook reminds about transitions" "Phase transitions require explicit human approval" "$OUT"

# UserPromptSubmit without active workflow
WORK_NO_WF=$(mktemp -d)
cd "$WORK_NO_WF"
OUT=$(CLAUDE_PLUGIN_ROOT=$DEVLOOP_ROOT bash $PROMPTHOOK 2>&1)
TESTS_RUN=$((TESTS_RUN + 1))
if [ -z "$OUT" ]; then
  echo "  ✅ E13: prompt hook silent when no active workflow"
  PASS=$((PASS + 1))
else
  echo "  ❌ E13: expected empty output, got: $OUT"
  FAIL=$((FAIL + 1))
fi

# ─── Section F: Composition / elevation ──────────────────────────────────

section "Section F — Composition (elevation, child workflow)"

enter_workspace
$TSX $DEV run feature "composition test" --author tester > /dev/null
OUT=$($TSX $DEV child elevate --type refactor --reason "decoupling" 2>&1)
assert_contains "F1: child elevate proposes" "Proposed elevation to refactor" "$OUT"

OUT=$($TSX $DEV child approve --author tester 2>&1)
assert_contains "F2: child approve creates workflow ID" "child-refactor" "$OUT"
assert_contains "F3: child approve generates branch" "devloop/" "$OUT"

OUT=$($TSX $DEV status --json 2>&1)
assert_contains "F4: parent paused" '"status": "paused"' "$OUT"

# Extract child id and resolve
CHILD_ID=$(echo "$OUT" | grep -oE 'feat-composition-test-[0-9]+-child-refactor-[0-9]+' | head -1)
OUT=$($TSX $DEV child resolve --id "$CHILD_ID" --status completed --summary "decoupled" --author tester 2>&1)
assert_contains "F5: resolve child returns parent to plan" "resumed in phase plan" "$OUT"

OUT=$($TSX $DEV status 2>&1)
assert_contains "F6: parent active again" "Status:   active" "$OUT"
assert_contains "F7: parent forced to phase plan" "Phase:    plan" "$OUT"

# Reject elevation
$TSX $DEV abandon --reason "f reset" > /dev/null
$TSX $DEV run feature "reject elevation test" --author tester > /dev/null
$TSX $DEV child elevate --type refactor --reason "x" > /dev/null
OUT=$($TSX $DEV child reject --reason "too risky" 2>&1)
assert_contains "F8: reject elevation works" "Elevation rejected" "$OUT"
OUT=$($TSX $DEV status 2>&1)
assert_contains "F9: parent stays active after rejection" "Status:   active" "$OUT"

# ─── Section G: Multi-developer ──────────────────────────────────────────

section "Section G — Multi-developer"

enter_workspace
$TSX $DEV run feature "handover test" --author lehidalgo > /dev/null

OUT=$($TSX $DEV handover --to ana@team.com --reason vacation --author lehidalgo 2>&1)
assert_contains "G1: handover transfers ownership" "lehidalgo → ana@team.com" "$OUT"

OUT=$($TSX $DEV status 2>&1)
assert_contains "G2: status shows new owner" "Owner:    ana@team.com" "$OUT"

OUT=$($TSX $DEV handover --force --to bob@team.com --maintainer maintainer --reason "ana left" --author maintainer 2>&1)
assert_contains "G3: force-handover with maintainer authority" "→ bob@team.com" "$OUT"

# ─── Section H: PR summary ───────────────────────────────────────────────

section "Section H — PR summary and integrity hash"

enter_workspace
$TSX $DEV run feature "pr summary test" --author tester > /dev/null
$TSX $DEV scope propose-expansion --file src/x.ts --reason "x" > /dev/null
$TSX $DEV scope approve --file src/x.ts > /dev/null

OUT=$($TSX $DEV pr generate-summary 2>&1)
assert_contains "H1: PR summary has Workflow Summary header" "## Workflow Summary" "$OUT"
assert_contains "H2: PR summary contains workflow type" "**Type:** feature" "$OUT"
assert_contains "H3: PR summary contains hash" "devloop-summary-hash: sha256:" "$OUT"
assert_contains "H4: PR summary lists files in scope" "**Files in plan:** 1" "$OUT"

# Hash determinism: regenerate, should match
HASH1=$(echo "$OUT" | grep -oE 'sha256:[0-9a-f]{64}')
OUT2=$($TSX $DEV pr generate-summary 2>&1)
HASH2=$(echo "$OUT2" | grep -oE 'sha256:[0-9a-f]{64}')
TESTS_RUN=$((TESTS_RUN + 1))
if [ "$HASH1" = "$HASH2" ] && [ -n "$HASH1" ]; then
  echo "  ✅ H5: PR summary hash is deterministic"
  PASS=$((PASS + 1))
else
  echo "  ❌ H5: hash differed: $HASH1 vs $HASH2"
  FAIL=$((FAIL + 1))
fi

# ─── Section I: Replay ───────────────────────────────────────────────────

section "Section I — Replay (time-travel debugging)"

enter_workspace
$TSX $DEV run feature "replay test" --author tester > /dev/null
WID=$(cat .workflow/active/workflow-id.txt)

OUT=$($TSX $DEV replay "$WID" 2>&1)
assert_contains "I1: replay full archive" '"events": [' "$OUT"
assert_contains "I2: replay includes init event" '"event_type": "init"' "$OUT"

# Replay with --until
INIT_EVENT_ID=$(grep -oE '"event_id": "[^"]+"' .workflow/archives/$WID/000_init.json | head -1 | cut -d'"' -f4)
OUT=$($TSX $DEV replay "$WID" --until "$INIT_EVENT_ID" 2>&1)
assert_contains "I3: replay --until stops at event" '"stoppedAt"' "$OUT"

# ─── Section J: Compactor ────────────────────────────────────────────────

section "Section J — Compactor"

enter_workspace
$TSX $DEV run feature "compact recent" --author tester > /dev/null
$TSX $DEV abandon --reason "test" > /dev/null

# Recent (default threshold 180d)
OUT=$($TSX $DEV compact 2>&1)
assert_contains "J1: compact skips recent archive" '"summarized": false' "$OUT"

# Threshold 0 → past
OUT=$($TSX $DEV compact --threshold 0 2>&1)
assert_contains "J2: compact processes past archive" '"summarized": true' "$OUT"

# Idempotent: second run skips
OUT=$($TSX $DEV compact --threshold 0 2>&1)
assert_contains "J3: compact is idempotent" "Already compacted" "$OUT"

# ─── Section K: Stats ────────────────────────────────────────────────────

section "Section K — Stats"

enter_workspace
$TSX $DEV run feature "stats test 1" --author tester > /dev/null
$TSX $DEV abandon --reason "x" > /dev/null
$TSX $DEV run bug-fix "stats test 2" --author tester > /dev/null
$TSX $DEV abandon --reason "x" > /dev/null

OUT=$($TSX $DEV stats 2>&1)
assert_contains "K1: stats counts workflows" '"workflowCount": 2' "$OUT"
assert_contains "K2: stats categorizes by type" '"feature": 1' "$OUT"
assert_contains "K3: stats categorizes bug-fix" '"bug-fix": 1' "$OUT"

OUT=$($TSX $DEV stats tokens 2>&1)
assert_contains "K4: stats tokens subset" '"totalTokens": 0' "$OUT"

OUT=$($TSX $DEV stats durations 2>&1)
assert_contains "K5: stats durations subset" '"workflowCount": 2' "$OUT"

# ─── Section L: Recovery ─────────────────────────────────────────────────

section "Section L — Recovery"

enter_workspace
$TSX $DEV run feature "recovery test" --author tester > /dev/null

# Simulate corruption: delete active ID file
rm -f .workflow/active/workflow-id.txt

OUT=$($TSX $DEV status 2>&1)
assert_contains "L1: status reports no active after corruption" "No active workflow" "$OUT"

OUT=$($TSX $DEV recover 2>&1)
assert_contains "L2: recover finds non-terminal archive" "Recovered" "$OUT"

OUT=$($TSX $DEV status 2>&1)
assert_contains "L3: recovered workflow accessible" "feat-recovery-test" "$OUT"

# ─── Section M: Manifest verify ──────────────────────────────────────────

section "Section M — Manifest verify (tamper detection)"

enter_workspace
$TSX $DEV run feature "tamper test" --author tester > /dev/null
WID=$(cat .workflow/active/workflow-id.txt)

# Write reduced state snapshot
$TSX $DEVLOOP_ROOT/scripts/manifest.ts reduce --write > /dev/null

OUT=$($TSX $DEVLOOP_ROOT/scripts/manifest.ts verify "$WID" 2>&1)
assert_contains "M1: verify clean archive" "OK" "$OUT"

# Tamper
sed -i '' 's/"feature"/"refactor"/' .workflow/archives/$WID/000_init.json

OUT=$($TSX $DEVLOOP_ROOT/scripts/manifest.ts verify "$WID" 2>&1) || true
assert_contains "M2: verify detects tampering" "MISMATCH" "$OUT"

# ─── Summary ─────────────────────────────────────────────────────────────

section "Summary"
echo "  Tests run:  $TESTS_RUN"
echo "  Passed:     $PASS"
echo "  Failed:     $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "  All tests passed."
  exit 0
else
  echo ""
  echo "  $FAIL test(s) failed."
  exit 1
fi
