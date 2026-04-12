# codi-webapp-testing

Tests and automates local web applications using Playwright. Verifies frontend functionality, captures screenshots, reads browser console logs, and interacts with UI elements programmatically.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Node.js 18+ | required | TypeScript scripts via `npx tsx` |
| Playwright (Node.js) | `npx playwright install chromium` | browser automation (TypeScript) |
| Python 3.9+ | optional | Python Playwright scripts |
| Playwright (Python) | `pip install playwright && playwright install chromium` | browser automation (Python) |

TypeScript is the default runtime. Python is used when the project prefers it or `python3` is available.

## Scripts

| File | Purpose |
|------|---------|
| `scripts/ts/with-server.ts` | Manages server lifecycle before running automation (TypeScript) |
| `scripts/python/with_server.py` | Same as above — Python variant |

Run with `--help` before reading source to see all options.

## Quick Start

```bash
# Install Playwright browsers (do this once)
npx playwright install chromium

# Start a dev server and run an automation script
npx tsx scripts/ts/with-server.ts --server "npm run dev" --port 5173 -- node your_automation.js

# Multiple servers (e.g., backend + frontend)
npx tsx scripts/ts/with-server.ts \
  --server "node server.js" --port 3000 \
  --server "npm run dev" --port 5173 \
  -- node your_automation.js
```

## Writing Automation Scripts

Your automation script handles only Playwright logic. Server lifecycle is managed by `with-server.ts`:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5173")
    page.screenshot(path="screenshot.png")
    browser.close()
```

Always launch Chromium in **headless mode** in automation scripts.
