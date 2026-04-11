import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to create blog posts or repurpose content across platforms (LinkedIn, Instagram, TikTok, Medium, Substack). Generates branded visual assets with an interactive web app — gallery of style presets, live card preview, and context-aware export (PNG, PDF, PPTX).
category: ${SKILL_CATEGORY.CONTENT_CREATION}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 20
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
| \`\${CLAUDE_SKILL_DIR}[[/generators/social-base.html]]\` | HTML template for agent-generated social cards |
| \`\${CLAUDE_SKILL_DIR}[[/generators/slides-base.html]]\` | HTML template for agent-generated slide decks |
| \`\${CLAUDE_SKILL_DIR}[[/generators/document-base.html]]\` | HTML template for agent-generated documents |
| \`\${CLAUDE_SKILL_DIR}[[/generators/templates/]]\` | Stock template HTML files — browsable in the Gallery Templates tab |

---

## Server API

| Route | Method | Purpose |
|-------|--------|---------|
| \`/\` | GET | Serve the content factory web app |
| \`/static/*\` | GET | Serve app assets (app.css, app.js) |
| \`/vendor/*\` | GET | Serve vendor scripts (html2canvas, jszip) |
| \`/api/files\` | GET | Return list of HTML files in the active project's content dir |
| \`/api/content?file=xxx\` | GET | Return raw HTML for a content file in the active project |
| \`/api/preset\` | GET | Read the currently selected preset from active project state |
| \`/api/preset\` | POST | Write preset selection \`{id, name, type, timestamp}\` |
| \`/api/active-file\` | GET | Read which file/preset the user currently has loaded |
| \`/api/active-file\` | POST | Record which file/preset the user just loaded \`{file, preset, sessionDir}\` |
| \`/api/state\` | GET | Aggregate: \`{activeFile, activePreset, activeSessionDir, activeFilePath, mode, contentId, status, preset}\` — use this to orient before editing |
| \`/api/create-project\` | POST | Create a new named project dir, activate it — body: \`{name}\`, returns \`{projectDir, contentDir, stateDir, exportsDir}\` |
| \`/api/open-project\` | POST | Activate an existing project — body: \`{projectDir}\` |
| \`/api/sessions\` | GET | List all projects from the workspace directory |
| \`/api/session-content?session=&file=\` | GET | Serve an HTML file from a specific project's content dir |
| \`/api/session-status\` | POST | Persist status \`{sessionDir, status}\` to a project's manifest |
| \`/api/templates\` | GET | List template files with metadata (id, type, format, url) |
| \`/api/export-png\` | POST | Render card HTML to PNG via Playwright at 2× resolution |
| \`/api/export-pdf\` | POST | Render slides array to multi-page PDF — body: \`{slides:[{html,width,height}]}\`, returns \`application/pdf\` |

The server also runs a WebSocket endpoint at the same port. The app connects automatically
and receives \`{type:"reload"}\` messages whenever a content file changes, triggering a live update.

---

## Template Library

Built-in templates are standalone HTML files in \`generators/templates/\`.
They are served via \`/api/templates\` and loaded by the browser into the Gallery.

Each template HTML file must include a \`<meta name="codi:template">\` tag:
\`\`\`json
{"id":"<kebab-id>","name":"<Human Name>","type":"<social|slides|document>","format":{"w":<w>,"h":<h>}}
\`\`\`

When the user clicks a template in the Gallery:
1. The app fetches and parses the HTML file
2. All \`social-card\` / \`slide\` / \`doc-page\` elements load into the Preview strip
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
| **Export** | Context-aware buttons based on content type: **social** → PNG (current slide) + PDF (all); **slides** → PPTX (all, primary) + PDF (all) + PNG (current); **document** → PDF (all, primary) + PNG (current). PNG uses Playwright 2× resolution; PDF renders via Playwright server-side; PPTX embeds PNG images using PptxGenJS. |
| **Activity log** | Timestamped log of server events and user actions. WebSocket status dot (green = connected). |

### Main area (tabs)

**Preview tab** — horizontal card strip. Keyboard arrow keys navigate between slides. Active card highlighted with accent border. Click any card to select it. A **metadata bar** above the canvas shows the active content name, type chip, pixel dimensions, and slide count — updated whenever content changes.

**Gallery tab** — vertical list of preset cards. Each shows a horizontal strip of all slide thumbnails (IntersectionObserver lazy-loaded). Filter buttons: All / Social / Slides / Document / My Work / Templates.
- **My Work** — past sessions loaded from \`.codi_output/\`. Shows session date, preset name, and resolved content name. Click any session card to load its content files.
- **Templates** — stock template HTML files from \`generators/templates/\`. Click to load as a starting point for agent-generated content.

---

## Agent Workflow

### Step 1 — Start the server

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]] --project-dir .
\`\`\`

Save the JSON output:
\`\`\`json
{
  "type": "server-started",
  "url": "http://localhost:PORT",
  "workspace_dir": "/path/to/.codi_output"
}
\`\`\`

Tell the user:
> "Content factory is ready at \`<url>\` — open it in your browser.
> Go to the Gallery tab, pick a preset, then describe the content you want."

### Step 1b — Create a project (when generating new content)

Before writing any files, create a named project. This returns the directory paths to use:

\`\`\`bash
curl -s -X POST <url>/api/create-project \\
  -H "Content-Type: application/json" \\
  -d '{"name": "bbva-social-campaign"}'
\`\`\`

Response:
\`\`\`json
{
  "ok": true,
  "projectDir": "/path/to/.codi_output/bbva-social-campaign",
  "contentDir": "/path/to/.codi_output/bbva-social-campaign/content",
  "stateDir": "/path/to/.codi_output/bbva-social-campaign/state",
  "exportsDir": "/path/to/.codi_output/bbva-social-campaign/exports"
}
\`\`\`

Save \`contentDir\` — this is where you write HTML files. The project is now active.

**Skip Step 1b** when the user opens an existing My Work project from the gallery — the server
activates the project automatically when the user clicks it.

### Step 2 — Read state and determine mode

Before doing anything else, read the current state to know what the user has open:

\`\`\`bash
curl -s <url>/api/state
\`\`\`

Example responses:

\`\`\`jsonc
// Built-in template open
{ "mode": "template", "contentId": "b2e4a9f3", "activePreset": "earthy-bold",
  "activeFilePath": "/abs/path/generators/templates/earthy-bold.html",
  "activeFile": null, "activeSessionDir": null, "preset": {...} }

// My Work project open
{ "mode": "mywork", "contentId": "a3f9c2d1", "activePreset": null,
  "activeFilePath": "/abs/path/.codi_output/bbva-social-campaign/content/social.html",
  "activeFile": "social.html", "activeSessionDir": "/abs/path/.codi_output/bbva-social-campaign",
  "status": "in-progress", "preset": null }

// Nothing selected
{ "mode": null, "contentId": null, "activeFilePath": null, ... }
\`\`\`

**Use \`contentId\` as the anchor — not the template name.** The \`contentId\` is a hash of
\`activeFilePath\` and is always unique. If you are ever unsure which item is open, re-read
\`/api/state\` and confirm the \`contentId\` matches what the user is looking at.

**Use \`activeFilePath\` for all file edits.** Never reconstruct the path from name fragments — the
server has already resolved the absolute path for you.

| \`mode\` value | Meaning | What to do |
|----------------|---------|------------|
| \`"template"\` | User opened a **Gallery template** | → Step 1b + Step 3: create a project, then generate content styled after that template |
| \`"mywork"\` | User opened a **My Work project** | → Step 4b: edit \`activeFilePath\` in place |
| \`null\` | Nothing selected yet | → Tell the user: "Open the Gallery tab, pick a template to start fresh, or pick a My Work project to continue editing." |

**Template mode** means the user is looking at a read-only built-in template as a style reference.
Your job is to create a new project (Step 1b) and generate a new HTML file in \`contentDir\` that
follows that template's visual identity — colors, typography, layout — but with the user's content.

**My Work mode** means the user is looking at content they already created.
Your job is to edit the existing HTML file at \`activeFilePath\` in place.

If the user skipped the gallery, ask them to pick a template or a My Work project before proceeding.
Do not assume a default — mode selection determines where changes are written.

### Step 3 — Generate content (Template mode)

After creating a project (Step 1b), write \`<contentDir>/social.html\` (or \`slides.html\` /
\`document.html\`). The app detects the new file via WebSocket and adds it to the Content Files list.

#### Required HTML structure

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <!-- REQUIRED: content identity — powers the preview metadata bar -->
  <meta name="codi:template" content='{"id":"my-content","name":"My Content Title","type":"social","format":{"w":1080,"h":1080}}'>
  <title>My Content Title</title>
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

#### Content identity — REQUIRED

Every generated HTML file MUST include a \`<meta name="codi:template">\` tag and a \`<title>\` in \`<head>\`.
These power the preview metadata bar (name · type · format · slide count) shown above the canvas.

\`\`\`json
{"id":"<kebab-case-id>","name":"<Human Readable Name>","type":"<social|slides|document>","format":{"w":<width>,"h":<height>}}
\`\`\`

- \`type\` must match: \`social\` for cards, \`slides\` for decks, \`document\` for A4 pages
- \`format\` must match the active format button dimensions
- \`name\` describes the content topic, not the template (e.g. "AI Agents Series", not "Dark Editorial")
- Set \`<title>\` to the same human-readable name as a fallback

#### Card rules

- Element selectors scanned by the app:
  - \`class="social-card"\` — social media cards (1:1, 4:5, 9:16, OG)
  - \`class="slide"\` — slide deck pages (16:9)
  - \`class="doc-page"\` — document pages (A4)
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

### Step 4 — Iterate (loop until done)

Content creation is a back-and-forth process. This step repeats until the user is satisfied.

**The loop:**
1. User opens the Preview tab and reviews the rendered cards
2. User gives feedback in chat: "change the headline on slide 2", "make the background darker", "add a stat slide"
3. Agent reads current state to confirm what the user has open:
   \`\`\`bash
   curl -s <url>/api/state
   # {"activeFile":"social.html","activePreset":null,"preset":{...}}
   \`\`\`
4. Agent fetches the current HTML, applies the changes, and rewrites the file
5. App reloads in under 200ms — user sees the update immediately
6. Repeat from step 1

**Do not ask the user to reload the page** — the WebSocket handles it.

**After each rewrite, confirm what changed** — tell the user exactly which slides were updated and what changed so they can review quickly without hunting for the difference.

**Do not stop at one pass.** Keep iterating until the user says they are done, satisfied, or wants to export.

### Step 4b — Edit a My Work project

When \`mode\` is \`"mywork"\` in \`/api/state\`, the user has a past project open.

1. **Read state** — \`activeFilePath\` is the absolute path to edit:
   \`\`\`bash
   curl -s <url>/api/state
   # { "mode": "mywork", "contentId": "a3f9c2d1",
   #   "activeFilePath": "/abs/path/.codi_output/bbva-social-campaign/content/social.html",
   #   "activeSessionDir": "/abs/path/.codi_output/bbva-social-campaign",
   #   "activeFile": "social.html", "status": "in-progress", ... }
   \`\`\`

2. **Read the current HTML** from disk:
   \`\`\`bash
   cat "<activeFilePath>"
   \`\`\`

3. **Edit and rewrite** \`activeFilePath\` directly on disk.
   The WebSocket watcher broadcasts a reload — the user sees the update in under 200ms.

4. **Do not create a new file** — this is an edit of the user's existing work. Preserve all
   slides they did not ask to change.

**Never reconstruct the path from name fragments** — always use \`activeFilePath\` verbatim.
A built-in template and a My Work project can have the same name; \`activeFilePath\` and
\`contentId\` are the only unambiguous identifiers.

### Step 4c — Modify a built-in template

When \`mode\` is \`"template"\` in \`/api/state\`, the user has a built-in template open.

1. **Read state** — \`activeFilePath\` is the absolute path to the template file:
   \`\`\`bash
   curl -s <url>/api/state
   # { "mode": "template", "contentId": "b2e4a9f3",
   #   "activeFilePath": "/abs/path/generators/templates/earthy-bold.html",
   #   "activePreset": "earthy-bold", "activeSessionDir": null, ... }
   \`\`\`

2. **Edit \`activeFilePath\` in place** — change CSS, slide copy, colors, structure, whatever
   the user asked. The server's template watcher fires within 150ms and broadcasts
   \`reload-templates\`. The browser gallery and filmstrip update automatically.

4. **Also edit the source** so the change persists across \`codi generate\`:
   \`\`\`bash
   # Edit both paths — they are the same file in two locations
   \${CLAUDE_SKILL_DIR}/generators/templates/earthy-bold.html
   src/templates/skills/content-factory/generators/templates/earthy-bold.html
   \`\`\`

**Important**: editing a template changes it for all future sessions. If the user only
wants a one-off variation without touching the original, generate a new content file
(Step 3) and use the template as a style reference only.

### Step 4d — Promote a My Work project to a built-in template

When the user says "save this as a template", "add this to my presets", or "make this reusable",
use the Codi self-improvement workflow to add the project as a new built-in template.

This follows the \`codi-improvement-dev\` principle: you are both a consumer and an improver of
Codi skills. A user project that is worth reusing belongs in the skill's template library.

1. **Read state** to get the source file:
   \`\`\`bash
   curl -s <url>/api/state
   # {"activeFile":"social.html","activeSessionDir":"/abs/path/.codi_output/20260410_content-factory",...}
   \`\`\`

2. **Ask the user** for a template name and confirm:
   > "I'll add this as a new template named '[name]'. It will appear in the Gallery Templates tab
   > for all future sessions. Confirm?"

3. **Copy the HTML file** to both the installed skill and the source:
   \`\`\`bash
   TEMPLATE_NAME="<kebab-case-name>"
   # Installed skill (active immediately)
   cp "<activeSessionDir>/content/<activeFile>" \\
      "\${CLAUDE_SKILL_DIR}/generators/templates/\${TEMPLATE_NAME}.html"
   # Source (persists across codi generate)
   cp "<activeSessionDir>/content/<activeFile>" \\
      "src/templates/skills/content-factory/generators/templates/\${TEMPLATE_NAME}.html"
   \`\`\`

4. **Update the \`<meta name="codi:template">\`** tag inside the copied file to set a stable
   \`id\` and a clean \`name\` matching what the user confirmed. The \`id\` must be the same
   kebab-case name as the filename.

5. **Verify it appears** in the Gallery — the server's template watcher broadcasts
   \`reload-templates\` within 150ms of the file being written:
   \`\`\`bash
   curl -s <url>/api/templates | grep "\${TEMPLATE_NAME}"
   \`\`\`

6. **Invoke the skill feedback reporter** to record the improvement:
   Use \`codi-skill-feedback-reporter\` to log that a new template was added, so the
   improvement loop can track what changed.

**Do not run \`codi generate\`** unless the user explicitly asks — copying the source file is
sufficient to persist the template. \`codi generate\` regenerates the SKILL.md from template.ts,
which is a separate concern.

### Step 5 — Export and stop

Export happens in the browser via the sidebar buttons. When done:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]] <workspace_dir>
\`\`\`

Summarize: workspace path, project name, number of slides, format, and where exports were saved.
`;
