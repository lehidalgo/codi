# codi-content-factory

A standalone browser-based production tool for creating social media carousels, slide decks, and documents. Runs as a local Node.js web server. The agent starts the server, the user opens it in their browser, picks a style preset from a gallery, and exports slides as PNG or ZIP.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Node.js 18+ | required | runs the server (`server.cjs`) |
| Playwright (optional) | `npx playwright install chromium` | PNG export via `/api/export-png` |

No `npm install` is needed — `server.cjs` is a self-contained bundle with zero external dependencies.

## Scripts

| File | Purpose |
|------|---------|
| `scripts/server.cjs` | Node.js HTTP + WebSocket server (no deps) |
| `scripts/start-server.sh` | Start the server; outputs JSON with URL and content paths |
| `scripts/stop-server.sh` | Stop the server gracefully |

## Generators

| File | Purpose |
|------|---------|
| `generators/app.html` | App shell served at `/` |
| `generators/app.css` | App styles served at `/static/app.css` |
| `generators/app.js` | App logic served at `/static/app.js` |
| `generators/social-base.html` | HTML template for social card output |
| `generators/slides-base.html` | HTML template for slide deck output |
| `generators/document-base.html` | HTML template for document output |
| `generators/templates/` | Stock template HTML files (Gallery → Templates tab) |

## Quick Start

```bash
# Start the server
bash scripts/start-server.sh --name content-factory --project-dir .

# The command outputs JSON:
# { "url": "http://localhost:PORT", "screen_dir": "...", "state_dir": "..." }

# Open the URL in your browser, pick a preset in Gallery, then chat to generate content.

# Stop when done
bash scripts/stop-server.sh <session_dir>
```

## Server API

The server exposes REST endpoints at the same port:

| Route | Purpose |
|-------|---------|
| `GET /` | Serve the web app |
| `GET /api/state` | Read active file, preset, and session |
| `GET /api/files` | List HTML content files |
| `POST /api/export-png` | Render a card to PNG via Playwright |

A WebSocket endpoint auto-reloads the browser when content files change.

## Adding Templates

Drop a `.html` file in `generators/templates/`. Include a `<meta name="codi:template">` tag with JSON metadata. The file appears in the Gallery → Templates tab immediately.
