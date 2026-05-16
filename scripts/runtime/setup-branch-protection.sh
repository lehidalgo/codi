#!/usr/bin/env bash
# scripts/setup-branch-protection.sh
#
# Configure GitHub branch protection for the production and integration
# branches. Idempotent — safe to re-run.
#
# Prerequisites:
#   - gh CLI installed and authenticated as a user with admin scope on the repo
#   - the repo already pushed to GitHub (gh resolves the remote)
#   - .copier-answers.yml present (reads production_branch / integration_branch)
#
# Override the required CI checks via env var (default: empty — no required
# checks until your CI workflow exists):
#   REQUIRED_CHECKS="ci,pr-policy" bash scripts/setup-branch-protection.sh
#
# Override reviewer counts:
#   PROD_REVIEWERS=2 INTEG_REVIEWERS=1 bash scripts/setup-branch-protection.sh

set -euo pipefail

ANSWERS=".copier-answers.yml"
if [ ! -f "$ANSWERS" ]; then
  echo "ERROR: $ANSWERS not found. Run 'copier copy' first." >&2
  exit 1
fi

# Minimal extractor for `<key>: <value>` lines (no nested YAML support needed).
get_answer() {
  grep -E "^${1}:" "$ANSWERS" \
    | head -1 \
    | sed -E "s/^${1}:[[:space:]]*//; s/['\"]//g; s/[[:space:]]+$//"
}

PROD=$(get_answer "production_branch")
INTEG=$(get_answer "integration_branch")
PROD="${PROD:-master}"
INTEG="${INTEG:-develop}"
PROD_REVIEWERS="${PROD_REVIEWERS:-2}"
INTEG_REVIEWERS="${INTEG_REVIEWERS:-1}"
REQUIRED_CHECKS="${REQUIRED_CHECKS:-}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not installed. See https://cli.github.com/" >&2
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
  echo "ERROR: not in a GitHub repo, or 'gh' not authenticated." >&2
  echo "  Run: gh auth login" >&2
  exit 1
fi

echo "Configuring branch protection for: $REPO"
echo "  Production:           $PROD       ($PROD_REVIEWERS reviewers)"
echo "  Integration:          $INTEG      ($INTEG_REVIEWERS reviewers)"
echo "  Required CI checks:   ${REQUIRED_CHECKS:-<none>}"
echo ""

# Build required_status_checks JSON fragment.
build_status_checks() {
  if [ -z "$REQUIRED_CHECKS" ]; then
    echo "null"
    return
  fi
  python3 -c "
import json, os
checks = [c.strip() for c in os.environ.get('REQUIRED_CHECKS', '').split(',') if c.strip()]
print(json.dumps({'strict': True, 'contexts': checks}))
"
}

protect() {
  local branch="$1"
  local reviewers="$2"
  local code_owner_review="$3"
  local status_checks
  status_checks=$(build_status_checks)

  echo "→ Protecting $branch ($reviewers reviewers, code-owner-review=$code_owner_review)..."

  # Verify branch exists on the remote
  if ! gh api "repos/$REPO/branches/$branch" >/dev/null 2>&1; then
    echo "  WARN: branch $branch not found on $REPO. Push it first, then re-run." >&2
    return 0
  fi

  python3 - "$REPO" "$branch" "$reviewers" "$code_owner_review" "$status_checks" <<'PY'
import json, subprocess, sys

repo, branch, reviewers, code_owner_review, status_checks_json = sys.argv[1:6]
status_checks = json.loads(status_checks_json)

body = {
    "required_status_checks": status_checks,
    "enforce_admins": False,  # admins keep emergency override
    "required_pull_request_reviews": {
        "required_approving_review_count": int(reviewers),
        "dismiss_stale_reviews": True,
        "require_code_owner_reviews": code_owner_review == "true",
    },
    "restrictions": None,
    "required_linear_history": True,
    "allow_force_pushes": False,
    "allow_deletions": False,
    "block_creations": False,
    "required_conversation_resolution": True,
}

result = subprocess.run(
    ["gh", "api", "-X", "PUT", f"repos/{repo}/branches/{branch}/protection",
     "--input", "-"],
    input=json.dumps(body),
    text=True,
    capture_output=True,
)
if result.returncode != 0:
    print(f"  ERROR: {result.stderr}", file=sys.stderr)
    sys.exit(result.returncode)
print(f"  OK: {branch} protected.")
PY
}

protect "$PROD"  "$PROD_REVIEWERS"  "true"
protect "$INTEG" "$INTEG_REVIEWERS" "false"

echo ""
echo "Done. Verify in GitHub:  Settings → Branches"
echo ""
echo "Emergency override: this script sets enforce_admins=false so two named"
echo "human admins can bypass for genuine emergencies. Keep that list short."
