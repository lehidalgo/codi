import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to create blog posts or repurpose content across platforms (LinkedIn, Instagram, TikTok, Medium, Substack). Generates branded visual assets with an interactive web app — gallery of style presets, live card preview, and PNG/ZIP export.
category: ${SKILL_CATEGORY.CONTENT_CREATION}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 13
---

# {{name}} — Content Factory

## Overview

Content Factory is a standalone browser-based production tool for creating social media carousels,
slide decks, and documents. It runs as a local web server that the agent starts, then the user
opens in their browser to interact with a live preview and export interface.

The tool has two sides:

- **Gallery** — a library of built-in style presets, each with a full deck of rendered slides.
  Click any preset to load all its slides into Preview.
- **Preview** — a scrollable card strip showing all slides at the selected zoom level, with
  sidebar controls for format, handle, zoom, and logo overlay. Export any slide as PNG or all
  slides as a ZIP.

The agent's job is to start the server, tell the user the URL, then generate content HTML files
that the app picks up automatically via WebSocket.

---

## Skill Assets

| Asset | Purpose |
|-------|---------|
| \`\${CLAUDE_SKILL_DIR}[[/scripts/server.cjs]]\` | Node.js HTTP + WebSocket server (no dependencies) |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]]\` | Start the server, outputs JSON with URL and paths |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]]\` | Stop the server gracefully |
| \`\${CLAUDE_SKILL_DIR}[[/generators/app.html]]\` | App shell — always served at \`/\` |
| \`\${CLAUDE_SKILL_DIR}[[/generators/app.css]]\` | App styles — served at \`/static/app.css\` |
| \`\${CLAUDE_SKILL_DIR}[[/generators/app.js]]\` | App logic — served at \`/static/app.js\` |
| \`\${CLAUDE_SKILL_DIR}[[/generators/presets.js]]\` | Built-in preset data — served at \`/static/presets.js\` |
| \`\${CLAUDE_SKILL_DIR}[[/generators/social-base.html]]\` | HTML template for agent-generated social cards |
| \`\${CLAUDE_SKILL_DIR}[[/generators/slides-base.html]]\` | HTML template for agent-generated slide decks |
| \`\${CLAUDE_SKILL_DIR}[[/generators/document-base.html]]\` | HTML template for agent-generated documents |

---

## Server API

| Route | Method | Purpose |
|-------|--------|---------|
| \`/\` | GET | Serve the content factory web app |
| \`/static/*\` | GET | Serve app assets (app.css, app.js, presets.js) |
| \`/vendor/*\` | GET | Serve vendor scripts (html2canvas, jszip) |
| \`/api/files\` | GET | Return list of HTML files in the content dir |
| \`/api/content?file=xxx\` | GET | Return raw HTML for a content file |
| \`/api/preset\` | GET | Read the currently selected preset from state |
| \`/api/preset\` | POST | Write preset selection \`{id, name, type, timestamp}\` |

The server also runs a WebSocket endpoint at the same port. The app connects automatically
and receives \`{type:"reload"}\` messages whenever a content file changes, triggering a live update.

---

## Preset Library

Built-in presets are defined in \`generators/presets.js\` and rendered entirely in the browser —
no server-side rendering. Each preset has:

- \`id\`, \`name\`, \`type\` (social | slides | document)
- \`format\` — native pixel dimensions \`{w, h}\`
- \`css\` — self-contained CSS string
- \`slides[]\` — array of \`{dataType, dataIndex, html}\` objects

Current presets:

| ID | Name | Type | Format | Slides |
|----|------|------|--------|--------|
| \`dark-editorial\` | Dark Editorial | social | 1080×1080 | 4 |
| \`minimal-mono\` | Minimal Mono | social | 1080×1080 | 3 |
| \`poster-bold\` | Poster Bold | social | 1080×1080 | 3 |
| \`clean-slides\` | Clean Slides | slides | 1280×720 | 3 |
| \`doc-article\` | Doc Article | document | 794×1123 | 3 |

When the user clicks a preset in the Gallery:
1. All slides load into the Preview strip
2. The format button updates to match the preset's native format
3. The selection is saved to \`state_dir/preset.json\` so the agent can read it

---

## App UI Reference

### Sidebar (left panel, scrollable)

| Control | Description |
|---------|-------------|
| **Format** | 6 buttons: 1:1 (1080×1080), 4:5 (1080×1350), 9:16 (1080×1920), OG (1200×630), 16:9 (1280×720), A4 (794×1123). Active format applies to agent-generated content only — presets always use their native format. |
| **Handle** | \`@username\` placeholder replaced in agent-generated content. Preset thumbnails show \`@preview\`; preview cards show \`@[handle]\`. |
| **Zoom** | Slider from 15% to 120%. Scales all card frames in the Preview strip. Default: 40%. |
| **Logo** | ON/OFF toggle + Size / X% / Y% sliders. Adds a \`codi\` gradient wordmark overlay positioned absolutely over every card frame. Does not modify iframe content. |
| **Content files** | List of HTML files written by the agent to the content dir. Click to load. |
| **Export** | PNG for the active slide; ZIP for all slides at 2× resolution using html2canvas. |
| **Activity log** | Timestamped log of server events and user actions. WebSocket status dot (green = connected). |

### Main area (tabs)

**Preview tab** — horizontal card strip. Keyboard arrow keys navigate between slides. Active card highlighted with accent border. Click any card to select it.

**Gallery tab** — vertical list of preset cards. Each shows a horizontal strip of all slide thumbnails (IntersectionObserver lazy-loaded). Filter buttons: All / Social / Slides / Document. Click a preset to load it into Preview.

---

## Agent Workflow

### Step 1 — Start the server

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/scaffold-session.sh]] <session-name> --project-dir .
\`\`\`

Save all values from the JSON output:
\`\`\`json
{
  "type": "server-started",
  "url": "http://localhost:PORT",
  "screen_dir": "/path/to/.codi_output/.../content",
  "state_dir": "/path/to/.codi_output/.../state"
}
\`\`\`

Tell the user:
> "Content factory is ready at {{url}} — open it in your browser.
> Go to the Gallery tab, pick a preset, then describe the content you want."

### Step 2 — Read the selected preset

After the user picks a preset and confirms:

\`\`\`bash
cat <state_dir>/preset.json
# {"id":"dark-editorial","name":"Dark Editorial","type":"social","timestamp":...}
\`\`\`

If the user skipped the gallery, use \`dark-editorial\` as default.

### Step 3 — Generate content

Write \`<screen_dir>/social.html\` (or \`slides.html\` / \`document.html\`). The app detects the
new file via WebSocket and adds it to the Content Files list. Click to load.

#### Required HTML structure

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    /* Copy full preset CSS here */
  </style>
</head>
<body>
  <article class="social-card" data-type="cover" data-index="01">
    <!-- slide HTML matching the selected preset's structure -->
  </article>
  <article class="social-card" data-type="content" data-index="02">
    <!-- slide HTML -->
  </article>
  <article class="social-card" data-type="cta" data-index="03">
    <!-- slide HTML -->
  </article>
</body>
</html>
\`\`\`

#### Card rules

- Element selector: \`class="social-card"\` — the app scans for these
- Required attributes: \`data-type\` (cover | content | stat | quote | cta | title | closing) and \`data-index\` (zero-padded: 01, 02…)
- Dimensions come from the active format button, not the HTML itself
- Replace \`@handle\` with the user's actual handle
- All CSS goes in \`<style>\` — the app extracts styles per card and renders each in its own iframe
- Rewrite the whole file to update — the WebSocket watcher broadcasts a reload on every change

### Step 4 — Iterate

The user reviews the Preview tab and gives feedback. Rewrite the HTML file with changes.
The app live-reloads in under 200ms.

### Step 5 — Export and stop

Export happens in the browser via the sidebar buttons. When done:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]] <session_dir>
\`\`\`

Summarize: session path, preset used, number of slides, format, and where exports were saved.
`;
