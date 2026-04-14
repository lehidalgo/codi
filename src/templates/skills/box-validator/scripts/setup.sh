#!/usr/bin/env bash
# Idempotent setup for box-validator. Installs playwright + chromium locally
# into the skill's own scripts/ directory so validate.mjs can require it.
#
# First run: ~30s (downloads chromium). Subsequent runs: ~1s (no-op).

set -e

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPTS_DIR"

if [ ! -d "node_modules/playwright" ]; then
  echo "[box-validator] installing playwright..."
  npm install --silent --no-audit --no-fund --loglevel=error
fi

# Check if chromium browser is installed. Playwright stores browsers in a
# shared cache (~/Library/Caches/ms-playwright or ~/.cache/ms-playwright),
# so this may already be present from another project.
if ! node -e "require('playwright').chromium.executablePath()" >/dev/null 2>&1; then
  echo "[box-validator] installing chromium..."
  npx --yes playwright install chromium
fi

echo "[box-validator] ready"
