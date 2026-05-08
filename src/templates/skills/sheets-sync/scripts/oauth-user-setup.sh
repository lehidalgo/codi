#!/usr/bin/env bash
# devloop / sheets-sync — OAuth user-acting setup helper.
#
# Runs `gcloud auth application-default login` with the canonical Sheets+Drive
# scopes, then probes the resulting ADC token to confirm the scopes actually
# stuck. On failure (typical for personal Gmail accounts hitting Google's
# unverified-app block), points at the project-owned-OAuth-client recovery
# script.
#
# Usage:
#   oauth-user-setup.sh                          # gcloud built-in OAuth client
#   oauth-user-setup.sh --client-id-file <path>  # bring-your-own (Desktop) client
#
# Prerequisite:
#   - gcloud CLI installed: gcloud --version

set -euo pipefail

# CANONICAL OAuth scopes. KEEP IN SYNC with
# lib/sheets/auth.ts::OAUTH_USER_LOGIN_SCOPES (a unit test asserts this).
CANONICAL_SCOPES="openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive"

CLIENT_ID_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --client-id-file) CLIENT_ID_FILE="$2"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

if ! command -v gcloud >/dev/null 2>&1; then
  cat >&2 <<'EOF'
error: gcloud CLI not found on PATH.

Install: https://cloud.google.com/sdk/docs/install
Or use service_account mode (skills/sheets-sync/scripts/gcloud-setup.sh).
EOF
  exit 1
fi

# ─── ADC path (cross-platform) ───────────────────────────────────────────
case "$(uname -s)" in
  Darwin|Linux*) ADC_PATH="${HOME}/.config/gcloud/application_default_credentials.json" ;;
  *)             ADC_PATH="${APPDATA:-${HOME}/AppData/Roaming}/gcloud/application_default_credentials.json" ;;
esac

# ─── Run the OAuth flow ──────────────────────────────────────────────────
echo "→ Running gcloud auth application-default login (opens a browser)…"
echo "  Sign in with the Google account you want devloop to act as."
echo "  Scopes requested: openid, userinfo.email, cloud-platform, spreadsheets, drive"
echo ""

if [ -n "$CLIENT_ID_FILE" ]; then
  if [ ! -f "$CLIENT_ID_FILE" ]; then
    echo "error: --client-id-file '$CLIENT_ID_FILE' not found" >&2
    exit 1
  fi
  echo "  Using project-owned OAuth client: $CLIENT_ID_FILE"
  echo ""
  gcloud auth application-default login \
    --client-id-file="$CLIENT_ID_FILE" \
    --scopes="$CANONICAL_SCOPES"
else
  gcloud auth application-default login --scopes="$CANONICAL_SCOPES"
fi

# ─── Verify ──────────────────────────────────────────────────────────────
if [ ! -f "${ADC_PATH}" ]; then
  echo "" >&2
  echo "error: ADC was not written to ${ADC_PATH}" >&2
  echo "Did the browser flow complete successfully? Try re-running this script." >&2
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo unknown)"

# ─── Scope probe ─────────────────────────────────────────────────────────
# The ADC file does NOT carry the granted-scopes list. To verify scopes
# actually include Sheets/Drive, hit a Sheets endpoint with the access token
# and inspect the response code:
#   404 → token works (we used a bogus Sheet ID; expected)
#   403 + "insufficient" → scopes are missing
#   401 → token invalid

echo ""
echo "→ Probing ADC scopes (Sheets API smoke call)…"

ACCESS_TOKEN="$(gcloud auth application-default print-access-token 2>/dev/null || echo '')"
if [ -z "$ACCESS_TOKEN" ]; then
  echo "✗ could not retrieve access token via gcloud" >&2
  exit 1
fi

PROBE_URL="https://sheets.googleapis.com/v4/spreadsheets/__devloop_probe_invalid_id__"
PROBE_BODY="$(curl -sS -o /tmp/_devloop_probe.json -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" "$PROBE_URL" || echo "ERR")"

case "$PROBE_BODY" in
  404|400)
    echo "✓ scope probe passed (HTTP $PROBE_BODY — expected; bogus Sheet ID)"
    ;;
  403)
    if grep -qi "insufficient" /tmp/_devloop_probe.json 2>/dev/null; then
      cat <<EOF >&2

✗ ADC was granted but lacks Sheets/Drive scopes.

Cause: Google blocked the unverified-app screen
       (typical for personal Gmail accounts on gcloud's built-in OAuth client).

Recovery (~90 seconds):
  bash $(dirname "$0")/oauth-user-project-client-setup.sh

That script walks you through creating a project-owned OAuth client + adding
yourself as a Test User, then re-runs ADC login with your own client.

Manual recovery: see google-sheets-setup.md Path D'.
EOF
      exit 1
    fi
    echo "✗ unexpected 403 from Sheets API; check error log at /tmp/_devloop_probe.json" >&2
    exit 1
    ;;
  401)
    echo "✗ token rejected (HTTP 401). Re-run this script to refresh ADC." >&2
    exit 1
    ;;
  *)
    echo "⚠ unexpected probe result (HTTP $PROBE_BODY). ADC may still be usable." >&2
    ;;
esac

# ─── Success ─────────────────────────────────────────────────────────────
cat <<EOF

──────────────────────── OAuth user-acting setup complete ───────────────────────

Active gcloud account:  ${ACTIVE_ACCOUNT}
ADC credentials path:   ${ADC_PATH}
Granted scopes:         openid, userinfo.email, cloud-platform, spreadsheets, drive

devloop will now act as YOU (your Drive quota, your file ownership) when
auth_mode=oauth_user.

Next:
  devloop sheets auth-check                    # verify resolution
  devloop sheets create-project \\
    --name "<project>" \\
    --auth-mode oauth_user                     # folder-id optional

EOF
