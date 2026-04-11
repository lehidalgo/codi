import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to create blog posts or repurpose content across platforms (LinkedIn, Instagram, TikTok, Medium, Substack). Generates branded visual assets with an interactive web app — gallery of style presets, live card preview, and PNG/ZIP export.
category: ${SKILL_CATEGORY.CONTENT_CREATION}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 15
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
| \`/api/active-file\` | GET | Read which file/preset the user currently has loaded |
| \`/api/active-file\` | POST | Record which file/preset the user just loaded \`{file, preset}\` |
| \`/api/state\` | GET | Aggregate: \`{activeFile, activePreset, preset}\` — use this to orient before editing |

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
| **Format** | 6 buttons: 1:1 (1080×1080), 4:5 (1080×1350), 9:16 (1080×1920), OG (1200×630), 16:9 (1280×720), A4 (794×1123). Active format applies to all content — social and slides presets adapt to the selected format. A4 (Doc) is the only fixed format; document cards always render at 794×1123 regardless of the selector. |
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
bash \${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]] --name content-factory --project-dir .
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

#### Clipping rules — MANDATORY

**Social cards and slides use \`overflow: hidden\`.** Every pixel beyond the card boundary is clipped — hard, with no warning. This applies to text, decorative elements, absolute-positioned glows, and images. Never assume content will wrap gracefully; test every card at the intended format before declaring it done.

**Large headline text**
- Use \`line-height: 1.1\` minimum on all headlines — lower values clip ascenders and descenders at large font sizes
- Use \`letter-spacing\` between \`-0.03em\` and \`-0.05em\` to control width — heavy weights at 80px+ can overflow the content area
- Keep headline text short enough to fit within the card's padding: content width = card width minus horizontal padding × 2

**Gradient italic text (\`background-clip: text\`)**
- Always add \`padding-right: 0.12em\` to any element that combines \`font-style: italic\` with \`background-clip: text\`
- Italic glyphs overhang their typographic advance width; the gradient stops painting at the advance boundary, making the right edge of trailing characters appear clipped against the dark background
- Apply this to every italic gradient span regardless of font size — it is invisible at small sizes but critical at 60px+

\`\`\`css
/* CORRECT — covers the italic glyph's right overhang */
em.acc {
  font-style: italic;
  padding-right: 0.12em;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* WRONG — glyph overhang is outside the painted area */
em.acc {
  font-style: italic;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
\`\`\`

**Absolute-positioned decorative elements**
- Glows and background shapes positioned outside the main layout are intentionally clipped
- Do not let decorative elements overlap critical text — the clip boundary is exact and unforgiving

**Document pages (\`.doc-page\`) are exempt** — they use \`min-height\` with no \`overflow: hidden\`, so content grows vertically without clipping. Horizontal overflow still renders poorly.

### Step 4 — Iterate

The user reviews the Preview tab and gives feedback. Rewrite the HTML file with changes.
The app live-reloads in under 200ms.

### Step 4b — Modify an existing content file

When the user says "change the headline on slide 2" or "update the colors" and there is already
a content file loaded in the Preview:

1. **Read state** to confirm what the user has open:
   \`\`\`bash
   curl -s <url>/api/state
   # {"activeFile":"social.html","activePreset":null,"preset":{...}}
   \`\`\`

2. **Fetch the current HTML** for the active file:
   \`\`\`bash
   curl -s "<url>/api/content?file=social.html"
   \`\`\`

3. **Edit and rewrite** the file at \`<screen_dir>/social.html\` with your changes.
   The WebSocket watcher broadcasts a reload — the user sees the update in under 200ms.

If \`activeFile\` is \`null\` and \`activePreset\` is set, the user is viewing a gallery preset
(not a writable content file). Follow the gallery preset workflow below instead.

### Step 4c — Modify a gallery preset

When \`activePreset\` is set (not null), edit the preset directly in
\`\${CLAUDE_SKILL_DIR}[[/generators/presets.js]]\`. The server watches that file and
broadcasts \`{type:"reload-presets"}\` whenever it changes — the browser reloads
automatically, the gallery updates, and the filmstrip thumbnails reflect the new styles.

1. **Read state** to confirm the preset ID:
   \`\`\`bash
   curl -s <url>/api/state
   # {"activeFile":null,"activePreset":"earthy-bold","preset":{...}}
   \`\`\`

2. **Find the preset** in \`generators/presets.js\` by searching for its \`id:\`:
   \`\`\`bash
   grep -n '"earthy-bold"' generators/presets.js
   \`\`\`

3. **Edit the preset in place** — change \`css\`, \`slides\`, colors, copy, whatever the user
   asked. The preset object is a plain JS literal; edit it directly.

4. **Save the file** — the server's \`presetsWatcher\` fires within 150ms and broadcasts
   \`reload-presets\`. The browser reloads, the gallery and filmstrip both reflect the change.

5. **Sync to the skill directory** if you want the change to persist across sessions:
   \`\`\`bash
   cp generators/presets.js \${CLAUDE_SKILL_DIR}[[/generators/presets.js]]
   \`\`\`
   Skip this step for temporary/session-specific edits.

**Important**: editing \`presets.js\` changes the template for all future sessions. If the user
only wants a one-off variation without touching the template, use the content file path
(Step 4b) instead.

### Step 5 — Export and stop

Export happens in the browser via the sidebar buttons. When done:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]] <session_dir>
\`\`\`

Summarize: session path, preset used, number of slides, format, and where exports were saved.
`;
