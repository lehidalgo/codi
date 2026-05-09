#!/usr/bin/env bash
# codi / sheets-sync — guided automation for project-owned OAuth client.
#
# When `oauth-user-setup.sh` fails because Google blocks the unverified-app
# screen (typical on personal Gmail), the canonical recovery is:
#
#   1. Pick / create a Cloud project
#   2. Enable Sheets + Drive APIs
#   3. Configure OAuth Consent Screen (External, Testing) + add yourself as Test User
#   4. Create an OAuth Desktop client + download its JSON
#   5. Re-run gcloud ADC login with that client
#
# Steps 1-2 + 5 are fully automated. Steps 3-4 require Console clicks because
# `gcloud iap oauth-clients create` only handles IAP clients (wrong type).
# This script opens the Console at the right URLs and watches a drop location
# for the downloaded OAuth client JSON.
#
# Usage:
#   oauth-user-project-client-setup.sh [--project <id>] [--client-json <path>]
#
# Flags:
#   --project <id>       use existing Cloud project (skip auto-pick / create)
#   --client-json <path> watch this path for the downloaded OAuth client JSON
#                        (default: ~/.config/codi/oauth-client.json)

set -euo pipefail

# CANONICAL OAuth scopes — keep in sync with oauth-user-setup.sh + auth.ts.
CANONICAL_SCOPES="openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive"

PROJECT_ID=""
CLIENT_JSON_PATH="$HOME/.config/codi/oauth-client.json"
WATCH_TIMEOUT_SEC=300   # 5 minutes for the Console clicks

while [ $# -gt 0 ]; do
  case "$1" in
    --project)     PROJECT_ID="$2"; shift 2 ;;
    --client-json) CLIENT_JSON_PATH="$2"; shift 2 ;;
    -h|--help)     sed -n '2,25p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

if ! command -v gcloud >/dev/null 2>&1; then
  echo "error: gcloud CLI required. Install: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo '')"
if [ -z "$ACTIVE_ACCOUNT" ] || [ "$ACTIVE_ACCOUNT" = "(unset)" ]; then
  echo "→ no active gcloud account — running gcloud auth login first…"
  gcloud auth login
  ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo unknown)"
fi
echo "Active account: $ACTIVE_ACCOUNT"

# ─── 1. Project ──────────────────────────────────────────────────────────
if [ -z "$PROJECT_ID" ]; then
  # Look for an existing codi-sheets-* project
  EXISTING="$(gcloud projects list --format='value(projectId)' --filter='projectId~^codi-sheets-' 2>/dev/null | head -1)"
  if [ -n "$EXISTING" ]; then
    echo "→ found existing project: $EXISTING"
    PROJECT_ID="$EXISTING"
  else
    PROJECT_ID="codi-sheets-$(date +%Y%m%d-%H%M%S)"
    echo "→ creating fresh project: $PROJECT_ID"
    gcloud projects create "$PROJECT_ID" --set-as-default --quiet
  fi
fi
gcloud config set project "$PROJECT_ID" --quiet >/dev/null 2>&1
echo "Project: $PROJECT_ID"

# ─── 2. APIs ─────────────────────────────────────────────────────────────
echo "→ enabling Sheets + Drive APIs (idempotent)…"
gcloud services enable sheets.googleapis.com drive.googleapis.com \
  --project="$PROJECT_ID" --quiet

# ─── 3. Consent screen — open Console; user clicks ──────────────────────
CONSENT_URL="https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
cat <<EOF

────── STEP 1 / 2 — Configure OAuth consent screen (browser click) ──────

Opening: $CONSENT_URL

In that page:
  1. User Type: External  →  Create
  2. App name:        codi
     User support email: $ACTIVE_ACCOUNT
     Developer email:    $ACTIVE_ACCOUNT
     →  Save and continue
  3. Scopes:          (leave empty)  →  Save and continue
  4. Test users:      Add Users  →  $ACTIVE_ACCOUNT  →  Save and continue
  5. Summary:         Back to dashboard
     (Status stays "Testing" — that's the whole point; no verification needed.)

Press ENTER here when you have completed the consent-screen setup.
EOF

if command -v open >/dev/null 2>&1; then open "$CONSENT_URL" || true
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$CONSENT_URL" >/dev/null 2>&1 || true
fi
read -r _ < /dev/tty || true

# ─── 4. OAuth client — open Console; user clicks; watch for JSON ─────────
mkdir -p "$(dirname "$CLIENT_JSON_PATH")"
# Wipe any prior client JSON so the file-watch detects a fresh one.
rm -f "$CLIENT_JSON_PATH"

CRED_URL="https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
cat <<EOF

────── STEP 2 / 2 — Create OAuth Desktop client (browser click) ─────────

Opening: $CRED_URL

In that page:
  1. Create credentials → OAuth client ID
  2. Application type: Desktop app
     Name:             codi-cli
     →  Create
  3. In the modal, click  Download JSON
  4. Save the file to:  $CLIENT_JSON_PATH

Watching $CLIENT_JSON_PATH (timeout: ${WATCH_TIMEOUT_SEC}s)…
EOF

if command -v open >/dev/null 2>&1; then open "$CRED_URL" || true
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$CRED_URL" >/dev/null 2>&1 || true
fi

ELAPSED=0
while [ $ELAPSED -lt $WATCH_TIMEOUT_SEC ]; do
  if [ -f "$CLIENT_JSON_PATH" ]; then
    sleep 1   # let the OS finish writing
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [ ! -f "$CLIENT_JSON_PATH" ]; then
  echo "" >&2
  echo "✗ timed out waiting for $CLIENT_JSON_PATH" >&2
  echo "  Re-run this script when the JSON is in place, or pass" >&2
  echo "  --client-json <path> if you saved it elsewhere." >&2
  exit 1
fi

# ─── Validate the downloaded JSON ────────────────────────────────────────
if ! python3 -c "
import json, sys
d = json.load(open('$CLIENT_JSON_PATH'))
sect = d.get('installed') or d.get('web') or {}
if not sect.get('client_id') or not sect.get('client_secret'):
    sys.exit('client_id / client_secret missing — wrong file?')
print('client_id:', sect['client_id'][:30] + '...')
" 2>&1; then
  echo "✗ $CLIENT_JSON_PATH does not look like an OAuth client JSON" >&2
  exit 1
fi
echo "✓ OAuth client JSON validated"

# ─── 5. ADC login with the project-owned client ──────────────────────────
echo ""
echo "→ Running gcloud auth application-default login --client-id-file=… --scopes=…"
echo "  Browser will open. Sign in as $ACTIVE_ACCOUNT (you added yourself as a Test User)."
echo ""

gcloud auth application-default login \
  --client-id-file="$CLIENT_JSON_PATH" \
  --scopes="$CANONICAL_SCOPES"

# ─── Probe + summarize ───────────────────────────────────────────────────
echo ""
echo "→ Probing ADC scopes…"
ACCESS_TOKEN="$(gcloud auth application-default print-access-token 2>/dev/null || echo '')"
if [ -z "$ACCESS_TOKEN" ]; then
  echo "✗ could not retrieve access token after login" >&2
  exit 1
fi
PROBE_URL="https://sheets.googleapis.com/v4/spreadsheets/__codi_probe_invalid_id__"
PROBE_BODY="$(curl -sS -o /tmp/_codi_probe.json -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" "$PROBE_URL" || echo ERR)"

case "$PROBE_BODY" in
  404|400) echo "✓ scope probe passed (HTTP $PROBE_BODY — expected)" ;;
  *)
    echo "✗ scope probe FAILED (HTTP $PROBE_BODY)" >&2
    cat /tmp/_codi_probe.json 2>/dev/null >&2 || true
    exit 1
    ;;
esac

case "$(uname -s)" in
  Darwin|Linux*) ADC_PATH="${HOME}/.config/gcloud/application_default_credentials.json" ;;
  *)             ADC_PATH="${APPDATA:-${HOME}/AppData/Roaming}/gcloud/application_default_credentials.json" ;;
esac

cat <<EOF

──────────────── OAuth user-acting setup complete (project-owned client) ───────────────

Cloud project:      $PROJECT_ID
Active account:     $ACTIVE_ACCOUNT  (added as Test User on the consent screen)
OAuth client JSON:  $CLIENT_JSON_PATH
ADC credentials:    $ADC_PATH
Granted scopes:     openid, userinfo.email, cloud-platform, spreadsheets, drive

You can now bootstrap a project Sheet:

  codi sheets create-project --name "<project>" --auth-mode oauth_user

EOF
