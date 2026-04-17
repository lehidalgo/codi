#!/usr/bin/env bash
# setup-validation.sh — one-shot Playwright install for content-factory's
# box-layout validator. Optional — only users who want validation pay the
# cost. Runs `npm install` in the scripts/ dir (which has playwright as an
# optional dep) and then downloads a chromium browser binary.
#
# Exit codes: 0 success, 1 error.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[content-factory/validation] installing playwright..."
npm install --silent --no-audit --no-fund --omit=dev 2>&1 || {
  echo "[content-factory/validation] npm install failed"
  exit 1
}

echo "[content-factory/validation] downloading chromium browser..."
npx --yes playwright install chromium --with-deps 2>&1 || {
  echo "[content-factory/validation] playwright install chromium failed"
  exit 1
}

echo "[content-factory/validation] ready. Restart the content-factory server to pick up the new runtime."
exit 0
