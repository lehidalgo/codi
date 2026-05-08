#!/usr/bin/env bash
# devloop / sheets-sync — automated Google Cloud + service-account setup.
#
# Replaces Steps 1–4 of skills/sheets-sync/references/google-sheets-setup.md
# (Cloud project → enable Sheets+Drive APIs → service account → JSON key)
# with a single script. The user only does `gcloud auth login` once.
#
# Steps 5 (Drive folder) and 6 (share folder) still happen at sync time,
# automated by lib/sheets/bootstrap.ts::createProjectSheet — no manual
# Drive UI needed.
#
# PREREQUISITES:
#   - gcloud CLI installed:    gcloud --version
#   - User authenticated:      gcloud auth login   (browser-based, one-time)
#   - Permission to create Cloud projects (Workspace admins sometimes restrict)
#
# OUTPUT:
#   - Cloud project: devloop-sheets-<UTC-timestamp>
#   - Service account: devloop-sheets@<project-id>.iam.gserviceaccount.com
#   - JSON key:        $HOME/.config/devloop/credentials.json (mode 0600)
#   - Stdout summary:  service-account email + project ID for downstream use
#
# IDEMPOTENCY:
#   - Project name carries a UTC timestamp, so re-runs never collide.
#   - To reuse an existing project, pass --project-id <id> instead.
#
# COST:
#   - Free tier: project creation, service account, Sheets/Drive API quota.
#
# USAGE:
#   ./gcloud-setup.sh                                  # fresh project, default key path
#   ./gcloud-setup.sh --project-id my-existing         # reuse an existing project
#   ./gcloud-setup.sh --key-path ~/somewhere/key.json  # custom key destination

set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────────────────
PROJECT_ID=""
KEY_PATH="${HOME}/.config/devloop/credentials.json"
SA_NAME="devloop-sheets"
SA_DISPLAY_NAME="devloop-sheets (Sheets + Drive automation)"

# ─── Args ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-id)   PROJECT_ID="$2"; shift 2 ;;
    --key-path)     KEY_PATH="$2";   shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "error: unknown arg: $1" >&2
      echo "Run with -h for usage." >&2
      exit 2
      ;;
  esac
done

# ─── Preflight ────────────────────────────────────────────────────────────
if ! command -v gcloud >/dev/null 2>&1; then
  cat >&2 <<EOF
error: gcloud CLI not found on PATH.

Install: https://cloud.google.com/sdk/docs/install
Then: gcloud auth login

Or fall back to Path A (self-service) or Path B (guided) — see
skills/sheets-sync/references/google-sheets-setup.md.
EOF
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  cat >&2 <<EOF
error: no active gcloud account.

First-time auth (browser-based, one prompt):
  gcloud auth login

Then re-run this script.
EOF
  exit 1
fi
echo "✓ gcloud authenticated as: ${ACTIVE_ACCOUNT}"

# ─── Project ──────────────────────────────────────────────────────────────
if [[ -z "${PROJECT_ID}" ]]; then
  # Before creating a new project, list existing devloop-sheets projects so
  # the user (or the agent) is aware. Avoids project sprawl across retries.
  EXISTING_PROJECTS="$(gcloud projects list \
    --filter="projectId:devloop-sheets-*" \
    --format="value(projectId)" 2>/dev/null || true)"

  if [[ -n "${EXISTING_PROJECTS}" ]]; then
    echo "ℹ Existing devloop-sheets projects detected (you can pass --project-id <id> to reuse one):"
    echo "${EXISTING_PROJECTS}" | sed 's/^/    /'
    echo "→ Creating a new project anyway (no --project-id given)…"
  fi

  TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
  PROJECT_ID="devloop-sheets-${TIMESTAMP}"
  echo "→ Creating project: ${PROJECT_ID}"
  gcloud projects create "${PROJECT_ID}" --name="devloop-sheets" --quiet >/dev/null
  echo "✓ Project created: ${PROJECT_ID}"
else
  echo "→ Reusing existing project: ${PROJECT_ID}"
  gcloud projects describe "${PROJECT_ID}" --format='value(projectId)' >/dev/null
  echo "✓ Project exists and is accessible: ${PROJECT_ID}"
fi

# Set as active project for subsequent commands.
gcloud config set project "${PROJECT_ID}" --quiet >/dev/null
echo "✓ Active project set: ${PROJECT_ID}"

# ─── Enable APIs ──────────────────────────────────────────────────────────
echo "→ Enabling Sheets + Drive APIs (~10–20s)…"
gcloud services enable sheets.googleapis.com drive.googleapis.com \
  --project="${PROJECT_ID}" --quiet
echo "✓ APIs enabled"

# ─── Service account ──────────────────────────────────────────────────────
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" \
     --quiet >/dev/null 2>&1; then
  echo "✓ Service account already exists: ${SA_EMAIL}"
else
  echo "→ Creating service account: ${SA_NAME}"
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="${SA_DISPLAY_NAME}" \
    --project="${PROJECT_ID}" --quiet >/dev/null
  echo "✓ Service account created: ${SA_EMAIL}"
fi

# Eventual-consistency lag: IAM sometimes takes a few seconds.
sleep 3

# ─── Key ──────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "${KEY_PATH}")"
if [[ -f "${KEY_PATH}" ]]; then
  BACKUP="${KEY_PATH}.bak.$(date -u +%Y%m%d-%H%M%S)"
  echo "ℹ existing key found; backing up to ${BACKUP}"
  mv "${KEY_PATH}" "${BACKUP}"
fi

echo "→ Generating JSON key: ${KEY_PATH}"
gcloud iam service-accounts keys create "${KEY_PATH}" \
  --iam-account="${SA_EMAIL}" \
  --project="${PROJECT_ID}" --quiet
chmod 600 "${KEY_PATH}"
echo "✓ Key written and chmod 600"

# ─── Account-type detection ───────────────────────────────────────────────
# Service accounts have ZERO Drive quota — they cannot create files in their
# own root. The Sheet must live under a host with quota: a user-owned folder
# (personal account) or a Shared Drive (Workspace).
#
# Note: ${VAR,,} is bash 4+ only — macOS ships bash 3.2 by default. Use tr.
ACCOUNT_LOWER=$(printf '%s' "${ACTIVE_ACCOUNT}" | tr '[:upper:]' '[:lower:]')
case "${ACCOUNT_LOWER}" in
  *@gmail.com|*@googlemail.com)
    ACCOUNT_TYPE="personal"
    ;;
  *)
    ACCOUNT_TYPE="workspace"
    ;;
esac

# ─── Summary ──────────────────────────────────────────────────────────────
cat <<EOF

──────────────────────── devloop sheets — setup complete ────────────────────────

Project ID:           ${PROJECT_ID}
Service account:      ${SA_EMAIL}
Credentials path:     ${KEY_PATH}
Authenticated as:     ${ACTIVE_ACCOUNT}
Detected account:     ${ACCOUNT_TYPE}

EOF

if [ "${ACCOUNT_TYPE}" = "personal" ]; then
  cat <<EOF
─── Personal Google account ───

Service accounts can't create files on personal Drives (zero storage quota).
The supported pattern:

  1. You create a blank Sheet in your own Drive:
       https://sheets.new
     Or in Drive UI: New → Google Sheets → blank → name it.

  2. You share that Sheet with the service-account email as Editor:
       ${SA_EMAIL}

  3. Copy the Sheet ID from the URL (the segment between /d/ and /edit) and
     run:

       devloop sheets create-project --name "<project>" --sheet-id "<id>"

     This adds the 6 canonical tabs (BusinessGoal, Requirement, UserStory,
     Release, Dashboard, Audit) and writes .devloop/project.json.

EOF
else
  cat <<EOF
─── Workspace account ───

Recommended: use a Shared Drive (org-owned, no individual quota issues).

  1. Open Drive → Shared drives → New (or pick an existing one).
  2. Add the service-account email as Content manager:
       ${SA_EMAIL}
  3. Copy the Shared Drive ID (the segment after /folders/ in the URL).
  4. Run:

       devloop sheets create-project --name "<project>" --folder-id "<id>"

     The agent creates the Sheet inside the Shared Drive (Drive API with
     supportsAllDrives), adds the 6 canonical tabs, writes .devloop/project.json.

Alternative (if your org doesn't use Shared Drives):
  Use a regular folder you own + share with the SA as Editor + same command.
  The Sheet creation may fail depending on Workspace policy — fall back to
  --sheet-id (you create the Sheet, agent populates structure).

EOF
fi

cat <<EOF
Next step: continue the project-workflow elicitation. Once you provide the
folder/Sheet ID, the agent runs \`devloop sheets create-project\` to bootstrap
the Sheet structure and resume the workflow.
EOF
