import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to create blog posts or repurpose content across platforms (LinkedIn, Instagram, TikTok, Medium, Substack). Generates branded visual assets with an interactive web app — gallery of style presets, live card preview, and context-aware export (PNG, PDF, PPTX).
category: ${SKILL_CATEGORY.CONTENT_CREATION}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 56
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
| \`\${CLAUDE_SKILL_DIR}[[/generators/slides-base.html]]\` | HTML shell for agent-generated slide decks (3-file: links to deck.css + deck.js) |
| \`\${CLAUDE_SKILL_DIR}[[/generators/slides-base.css]]\` | Brand tokens + all slide styles — copy as deck.css in the session content dir |
| \`\${CLAUDE_SKILL_DIR}[[/generators/slides-base.js]]\` | Deck navigation engine — copy as deck.js in the session content dir |
| \`\${CLAUDE_SKILL_DIR}[[/generators/document-base.html]]\` | HTML template for agent-generated documents |
| \`\${CLAUDE_SKILL_DIR}[[/generators/templates/]]\` | Stock template HTML files — appear in the Gallery under the All / Social / Slides / Document filters based on each template's \`type\` |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/export/compile-deck.js]]\` | Bundle deck.html + deck.css + deck.js into a single portable standalone HTML |

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
| \`/api/active-card\` | GET | Read which **individual card/slide/page** the user currently has selected in Preview — returns \`{index, total, dataType, dataIdx, file, timestamp}\` |
| \`/api/active-card\` | POST | App-only — automatically posted by the browser app whenever the user clicks a card, navigates with arrows, or loads a new file. The agent does not call this. |
| \`/api/active-element\` | GET | **Live element inspection.** Returns the DOM element the user most recently clicked inside the preview — full context (selector, tag, id, classes, attributes, text, outerHTML snippet, bounding rect, curated computed styles, parent chain). \`null\` if no click yet. Combine with \`/api/active-card\` to know which card the element belongs to. |
| \`/api/active-elements\` | GET | Multi-selection set — everything the user has Cmd/Ctrl-clicked. Returns \`{count, selections:[...]}\`. Use this to apply an operation to many elements at once. |
| \`/api/active-elements\` | DELETE | Clear the multi-selection set. |
| \`/api/inspect-events?since=<seq>\` | GET | Ring buffer of user interactions in the preview (clicks, inputs, submits, scrolls). Poll with \`?since=<lastSeq>\` for incremental updates. |
| \`/api/eval\` | POST | Run JavaScript inside the currently-previewed HTML page. Body: \`{js, timeoutMs?}\`. Returns \`{ok, result, error}\`. Use this for **ephemeral** live-preview only — changes revert on reload. Eval is on by default; disable with env \`CONTENT_FACTORY_ALLOW_EVAL=0\`. |
| \`/api/persist-style\` | POST | **Persist a style edit to the card source file.** Body: \`{project, file, targetSelector, patches: {prop: value}, snapshot?}\`. Response: \`{ok, cfId, selector, rule, sourceModified}\`. On first use against an element, the server assigns a stable \`data-cf-id\` attribute and writes it into the HTML; subsequent edits reuse it. The CSS rule is upserted inside a \`/* === cf:user-edits === */\` region of the card's \`<style>\` block. Idempotent: re-applying the same edit is a no-op. Returns \`409\` if the selector no longer matches (source drift) — refresh the selection and retry. Edits **survive reload, regeneration, and export**. |
| \`/api/persist-style\` | DELETE | Revert a persisted edit. Query: \`?cfId=<id>&project=<dir>&file=<basename>\`. Removes the rule from the user-edits region and strips the \`data-cf-id\` attribute if no other rule references it. |
| \`/api/persist-style\` | GET | List all persisted edits for a card. Query: \`?project=<dir>&file=<basename>\`. Returns \`{count, rules: [{selector, declarations: [{property, value}]}]}\`. |
| \`/api/brief\` | GET | Read the active project's \`brief.json\` (campaign intake) — returns \`null\` if no project is active or no brief has been written |
| \`/api/brief\` | POST | Write the active project's \`brief.json\` — body is a full brief object (schema v1). Returns 400 if no project is active. |
| \`/api/state\` | GET | Aggregate: \`{activeFile, activePreset, activeSessionDir, activeFilePath, mode, contentId, status, preset, activeCard, brief}\` — use this to orient before editing |
| \`/api/create-project\` | POST | Create a new named project dir, activate it — body: \`{name}\`, returns \`{projectDir, contentDir, stateDir, exportsDir}\` |
| \`/api/open-project\` | POST | Activate an existing project — body: \`{projectDir}\` |
| \`/api/sessions\` | GET | List all projects from the workspace directory |
| \`/api/session-content?session=&file=\` | GET | Serve an HTML file from a specific project's content dir |
| \`/api/content-metadata?kind=&id=\` | GET | **Unified content descriptor.** Returns a single shape for both built-in templates and My Work sessions: \`{kind, id, name, type, format, cardCount, status, createdAt, modifiedAt, readOnly, source}\`. \`kind\` is \`template\` or \`session\`. \`readOnly=true\` for templates (edits refused); \`readOnly=false\` for sessions. \`source.sessionDir\` is the absolute project path for sessions; \`source.templateId\` is the template id for templates. Use this to populate the preview header, resolve URL pins, or verify a selection's origin before calling \`/api/persist-style\`. |
| \`/api/content-list\` | GET | Debug/utility: returns every content descriptor the server knows about, templates and sessions merged into one list. |
| \`/api/clone-template-to-session\` | POST | **Copy a built-in template into a new editable session.** Body: \`{templateId, name?}\`. The server creates a new session directory under the workspace, copies the template HTML byte-for-byte into \`<session>/content/\`, writes a manifest with provenance (\`preset\` pointing at the origin template), and returns \`{ok, session: <unified descriptor>, sessionDir, file}\`. Use this when the user wants to edit a template — call this first, then drive all subsequent edits against the returned session. The Gallery also exposes this via a "Save to My Work" button on every template card. |
| \`/api/validate-card\` | POST | **Box Layout Theory validation.** Body: \`{project, file, cardIndex, force?}\`. Runs the content-factory box-layout validator (vendored from box-validator) and returns \`{ok, pass, score, violations:[{rule, severity, path, message, fix}], summary, fixInstructions}\`. Cached by SHA-1 of HTML + dimensions + preset. Returns \`{ok:true, skipped:"master-switch-off"}\` when the session has validation disabled. |
| \`/api/validate-cards?project=&file=\` | GET | Batch validation for all cards in a file. Returns \`{ok, pass, cards:[...], failingCards:[...]}\`. Used by Layer 4 (export preflight) and Layer 5 (status gate). |
| \`/api/validation-config?project=<dir>[&file=<basename>]\` | GET | Returns the resolved validation config cascade \`{config, source, contentType}\`. The cascade order is type-default → user default → session → per-file. The \`source\` map shows which scope produced each top-level field. |
| \`/api/validation-config\` | PATCH | Body: \`{project|user:true, patch}\`. Merges a partial patch into session or user defaults. Returns the new resolved config. |
| \`/api/validation-config/toggle\` | POST | Body: \`{project, layer, value}\`. Flip a layer on or off. Layers: \`all\` (master), \`endpoint\`, \`badge\`, \`agentDiscipline\`, \`exportPreflight\`, \`statusGate\`. |
| \`/api/validation-config/ignore-violation\` | POST | Body: \`{project, file, rule, selector?, cardIndex?}\`. Adds a per-file exemption to the session manifest so future validation runs skip that specific violation. |
| \`/api/validator-health\` | GET | Returns \`{degraded, workers, cacheSize, cacheHits, cacheMisses, avgLatencyMs, lastError}\`. Use this to check if Playwright is installed (\`degraded: true\` means it is missing and all layers default to pass). |

## URL-pinned tab state

The app URL is the **single source of truth** for what a tab is viewing.
Every reload lands on exactly the same project, file, and card. Two tabs
with different URLs show two independent states. The server-side
\`_workspace.json\` is a home-screen convenience — it is never consulted
on reload.

Query parameters (unified):

| Param | Meaning |
|-------|---------|
| \`kind\` | \`template\` or \`session\` |
| \`id\` | Stable content id (template id, or session dir basename) |
| \`file\` | Content file basename, e.g. \`social.html\` |
| \`card\` | Active card index (0-based), default 0 |

Example (template): \`http://localhost:PORT/?kind=template&id=linkedin-carousel-concept-story&file=social.html&card=2\`
Example (session): \`http://localhost:PORT/?kind=session&id=my-campaign-oct&file=social.html&card=0\`

Legacy \`?project=\` and \`?preset=\` parameters are honored for one release so existing bookmarks keep working.

The agent can construct a URL directly and send it to the user for deep-linking.

## Persisting element-level edits

The robust edit flow for element styling is:

1. **Read the selection**: \`GET /api/active-element\` (or \`/api/active-elements\` for multi-set). The response includes a \`context\` field carrying \`{kind, id, name, file, sessionDir?, templateId?, cardIndex, readOnly}\` — captured by the iframe that hosted the click.
2. **Check \`context.readOnly\`**: if \`true\`, the selection came from a built-in template. Call \`POST /api/clone-template-to-session\` with \`{templateId: context.templateId}\` to create an editable copy in My Work. The response includes the new session descriptor — load it via the normal session flow (URL \`?kind=session&id=<newId>&file=<basename>\`), ask the user to re-click the element in the new session, then retry \`/api/persist-style\`. The 409 response from \`persist-style\` also includes a ready-to-use \`cloneSuggestion\` payload so you do not have to construct it yourself.

## Validation — Box Layout Theory enforcement

content-factory vendors the box-validator rule engine. Five layers all
on by default, toggleable via \`POST /api/validation-config/toggle\`:
L1 \`/api/validate-card\` primitive, L2 score badges, L3 agent discipline,
L4 export preflight, L5 session-status gate. Defaults: slides/document
strict@0.9, social lenient@0.8. If Playwright is not installed,
\`/api/validator-health\` reports \`degraded:true\` and all layers
degrade to pass silently. Install with
\`bash \${CLAUDE_SKILL_DIR}[[/scripts/setup-validation.sh]]\`.

**Agent workflow (L3)**: after every \`persist-style\` write, check
\`GET /api/validation-config\` — if \`enabled===false\` or
\`layers.agentDiscipline===false\`, skip. Otherwise call
\`POST /api/validate-card {project, file, cardIndex}\`. If \`pass:false\`,
read \`violations[].fix\`, apply fixes via more \`persist-style\` calls,
re-validate, iterate up to \`config.iterateLimit\` (default 3), then
report remaining violations and stop.
3. **Persist to source**: \`POST /api/persist-style\` with \`{targetSelector, patches}\`. The server reads the context from the selection (no project/file needed in the body). It writes a stable \`data-cf-id\` into the card HTML and upserts a CSS rule inside a bounded \`/* === cf:user-edits === */\` region of the \`<style>\` block. Returns \`409\` with \`{templateId, suggestion}\` if the context is read-only — the server refuses cleanly even if the agent skipped step 2.
4. **(Optional) Live-preview**: \`POST /api/eval\` for instant visual feedback without waiting for the iframe to rebuild. The persisted source will take effect on the next render cycle anyway.

Persisted edits survive reloads, card regeneration, and exports. They are
byte-additive: everything outside the user-edits region is untouched.
Revert with \`DELETE /api/persist-style?cfId=...&project=<sessionDir>&file=<basename>\` — the rule and the \`data-cf-id\` attribute both go away cleanly.
| \`/api/session-status\` | POST | Persist status \`{sessionDir, status}\` to a project's manifest |
| \`/api/templates\` | GET | List template files with metadata (id, type, format, url) — includes templates from brand skills' \`templates/\` dirs |
| \`/api/template?file=xxx[&brand=yyy]\` | GET | Serve a single template HTML file; \`brand\` param routes to brand skill's \`templates/\` dir |
| \`/api/brands\` | GET | List available brand skills (those with \`brand/tokens.json\`) |
| \`/api/active-brand\` | POST | Set or clear the active brand — body: \`{name}\` or \`{}\` to clear |
| \`/api/brand/:name/assets/*\` | GET | Serve a file from a brand skill's \`assets/\` directory — use this URL for logos and fonts in generated HTML |
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

**Gallery tab** — vertical list of preset cards. Each shows a horizontal strip of all slide thumbnails (IntersectionObserver lazy-loaded). Filter buttons: **All / Social / Slides / Document / My Work** (5 filters, no separate Templates tab).
- **All** — every built-in template plus every installed brand skill template, regardless of type. Session cards are excluded from this view.
- **Social** / **Slides** / **Document** — narrow to templates whose \`type\` meta matches the filter. Built-in templates and brand templates appear side by side, grouped only by type.
- **My Work** — past projects loaded from \`.codi_output/\`. Shows project date, preset name, and resolved content name. Click any project card to activate it and load its content files. A secondary status filter row appears (All / Draft / In Progress / Review / Done) when this filter is active.

Stock template HTML files in \`generators/templates/\` and brand templates (from any installed brand skill's \`templates/\` dir) land in the same flat list — the Gallery does not separate them into their own tab. Each card's \`type\` attribute decides which type filter it shows up under.

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
  -d '{"name": "acme-social-campaign"}'
\`\`\`

Response:
\`\`\`json
{
  "ok": true,
  "projectDir": "/path/to/.codi_output/acme-social-campaign",
  "contentDir": "/path/to/.codi_output/acme-social-campaign/content",
  "stateDir": "/path/to/.codi_output/acme-social-campaign/state",
  "exportsDir": "/path/to/.codi_output/acme-social-campaign/exports"
}
\`\`\`

Save \`contentDir\` — this is where you write HTML files. The project is now active.

**Skip Step 1b** when the user opens an existing My Work project from the gallery — the server
activates the project automatically when the user clicks it.

### Step 1b.ii — Campaign pipeline intake (optional)

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/campaign-pipeline.md]]\`
Platform rules: \`\${CLAUDE_SKILL_DIR}[[/references/platform-rules.md]]\`

**When to switch to campaign mode** — scan the user's initial request for any of:
"campaign", "blog post", "launch", "launch post", "repurpose across", "publish
about X on [LinkedIn / Instagram / TikTok / Twitter]", "turn this into a blog + …".
These phrases signal the user wants **one long-form anchor distilled into multiple
platform variants** — not a quick one-off card.

**If the user's request is a single-format one-off** ("make me a quick Instagram post"),
skip this step and continue with the normal Step 3 single-file flow.

**The pipeline has 5 phases:**

1. **Intake** — ask 6 questions (topic, anchor type, audience, voice, platforms, CTA),
   write \`brief.json\` via \`POST /api/brief\`, show a summary, wait for explicit confirmation
2. **Anchor generation** — write one long-form master (\`00-anchor-<type>.html\`) where
   \`type\` is \`blog\` / \`docs\` / \`deck\`. Iterate until the user approves; each rewrite
   increments \`anchor.revision\` in the brief
3. **Distillation** — after approval, loop over \`brief.variants[]\` serially and write one
   platform-specific file per variant (LinkedIn carousel, Instagram feed/story, TikTok
   cover, Twitter card, summary deck). Each variant carries a \`codi:variant\` meta tag
   with its \`derived_from_revision\`
4. **Per-file iteration** — unchanged from Step 4; the targeted-card-edit workflow works
   the same on variant files as on any other content file
5. **Edit propagation** — on the *next* skill invocation after an anchor edit, if any
   variant has \`derived_from_revision < anchor.revision\`, ask the user which stale
   variants to re-distill (\`all\` / named file / \`skip\`). Never auto-propagate.

**Marketing-skills soft dependency**: Content Factory softly uses the external
\`marketing-skills\` plugin if installed (\`content-strategy\`, \`copywriting\`,
\`social-content\`, \`humanizer\`, etc.). If the plugin is absent, fall back to inline
generation — the workflow and file outputs are identical. The reference file has the
full detection table and future Codi-native migration notes.

**File naming** (numeric prefixes give natural sort order):
\`00-anchor-<type>.html\` · \`10-19\` LinkedIn · \`20-29\` Instagram · \`30-39\` TikTok ·
\`40-49\` Twitter · \`50-59\` decks · \`60-69\` email/ads/other.

### Step 1c — Detect and apply a brand (optional)

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/brand-integration.md]]\`

After creating a project, query \`GET /api/brands\` to discover installed brand
skills. If any exist and the user has not specified one, ask whether to apply it.
If the user confirms, \`POST /api/active-brand\` with \`{name}\`, then apply the
brand end-to-end (tokens, fonts, logo, voice) using the full procedure in the
reference file.

**Skip this step** if the user explicitly provides a template or says "no brand".

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
  "activeFilePath": "/abs/path/.codi_output/acme-social-campaign/content/social.html",
  "activeFile": "social.html", "activeSessionDir": "/abs/path/.codi_output/acme-social-campaign",
  "status": "in-progress", "preset": null }

// Nothing selected
{ "mode": null, "contentId": null, "activeFilePath": null, ... }

// With an active brand
{ ..., "activeBrand": { "name": "codi-codi-brand", "display_name": "Codi Platform" } }
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
  <!-- FONTS: if a brand is active and tokens.json.fonts.google_fonts_url is set, use that URL.
       If the brand has local fonts (google_fonts_url is null), generate @font-face blocks in <style> below
       using http://localhost:PORT/api/brand/<name>/assets/fonts/<file>.woff2 URLs.
       If no brand is active, use the default: -->
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    /* If brand is active: paste full content of brand/tokens.css here (inline — not a <link>) */
    /* Then add any @font-face blocks for local fonts (see Step 1c for URL pattern) */
    /* Then add card-specific styles */
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

Full rules: \`\${CLAUDE_SKILL_DIR}[[/references/html-clipping.md]]\`

**Key points:**
- Social cards and slides: \`overflow: hidden\` — every pixel beyond the boundary is clipped. Test all content at the intended format.
- Document pages (\`.doc-page\`): \`overflow: visible\` — content grows vertically. Never use \`overflow: hidden\` on \`.code-block\`, \`pre\`, or \`table\` — it clips content in the browser preview and breaks DOCX screenshot capture.
- Tables inside \`.doc-page\` (a flex column container): the flex-column wrapper (e.g. \`.page-body\`) MUST have \`width: 100%\` — without it, \`width: 100%\` on a child table resolves against an indefinite width and columns collapse to near-zero even with \`table-layout: fixed\`. Also add \`min-width: 0\` on flex children.

#### Document template conventions — DOCX export

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/docx-export.md]]\`

**Key points:**
- Standard HTML tags (\`h1\`–\`h3\`, \`p\`, \`ul\`/\`ol\`, \`strong\`, \`em\`, \`code\`) map automatically to DOCX paragraph styles
- Use \`.page-header\`, \`.page-footer\`, \`.callout\`, \`.eyebrow\` for page chrome
- Use \`<table class="data-table">\` for DOCX tables — always include \`table-layout: fixed\` in CSS; this prevents column collapse in the HTML preview (flex container context) and ensures Google Docs renders column widths correctly via the DOCX \`<w:tblGrid>\`
- Use \`<div class="code-block">\` for syntax-highlighted code — exported as Playwright screenshot PNG; \`overflow: visible\` is required on both \`.code-block\` and \`pre\` — \`overflow: hidden\` clips code in the browser and corrupts the screenshot
- Use \`<div class="diagram-wrap"><svg ...>\` for SVG diagrams — SVG must be a **direct child** of the wrapper; apply \`max-width\` + \`align-self: center\` to constrain diagram width in the DOCX output
- \`.doc-page\` is \`display: flex; flex-direction: column\` — all direct flex children need \`min-width: 0\` to prevent tables and code blocks from overflowing the 794px page boundary
- Remote \`https://\` image URLs are not fetched during DOCX export — use data URIs or \`file://\` paths

#### Visual density — MANDATORY for all card types

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/visual-density.md]]\`

**The rule**: every card must visibly occupy **≥85% of its canvas** with purposeful content.
A single centered headline on a blank canvas reads as unfinished work — treat every card as
a composed layout, not a text slot.

**Quick check before writing each card**: mentally draw a 3×3 grid. At least 7 of the 9 cells
must contain content or a purposeful decorative element. If 3+ cells are empty, add content
from the fill techniques list in the reference file (multi-column layout, supporting elements,
decorative accents, code/data mockups, edge-anchored chrome, oversized typography, background
fills). The reference also has per-card-type minimum element checklists and anti-patterns.

#### Design system — MANDATORY for all slides

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/design-system.md]]\`

**The 13 core rules** (every slide must pass all of them before being shipped):

1. **Fixed frame** — chrome-top, header (h2 + secondary description), chrome-bottom sit at
   identical y-coordinates across every slide. Only the content zone between them varies.
   Enforce via \`min-height\` on h2 (120px) and \`.sub\`/\`.feat-lead\` (80px).
2. **Chrome indicators match** — \`.slide-num\` and \`.chrome-feat\` pills must render at
   identical height/font/padding/border. Same font-size for label and bold number (e.g. 18px);
   differentiate only via color + weight, never size.
3. **Text size standard** — all plain body text maps to 5 tiers: T1=28px (secondary
   description), T2=26px (primary body), T3=24px (supporting), T4=22px (tertiary),
   T5=20px (minimum). **No body text smaller than 20px** and **no values between tiers** (no
   19/21/23/27). Titles, big numerals, badges, monospace code blocks, and pill labels are
   allowed outside this range.
4. **Two-color titles** — every h2 and h3 splits into plain white text + a cyan-gradient
   \`<span class="grad">\` on the punch phrase. Register a CSS rule for both:
   \`h2 .grad, h3 .grad { background: var(--grad); -webkit-background-clip: text;
   -webkit-text-fill-color: transparent; }\`.
5. **Equidistant spacing** — every container uses a single \`gap\` value on its flex/grid;
   children never use \`margin-top\`/\`margin-bottom\` overrides. Rule is recursive.
6. **Three-element pinned card layout (lbl/val/note)** — feature stat cards use
   \`position: absolute\` for lbl (top-left) and note (bottom), with the val as the sole
   flex-centered child. Note has **fixed height** (e.g. 115px) so its separator line renders
   at the same y across every card in the row. Card padding reserves space:
   \`padding: 64px 28px 155px\`.
7. **Feature slide layout hierarchy** — on feature slides, \`.feat-stats { flex: 1 }\` gets
   the vertical space; \`.feat-bullets\` and \`.feat-terminal\` are \`flex: 0 0 auto\`
   (content-sized). Never give bullets/terminal \`flex: 1\` — they stretch and create dead
   space between their items.
8. **Bullet uniform spacing** — \`.feat-bullets\` uses \`justify-content: space-evenly\` with
   zero vertical container padding (\`padding: 0 26px\`) and uniform item padding
   (\`14px 0 14px 44px\`). Top/between/bottom gaps end up identical.
9. **Stretch rows** — grid cell rows use \`align-items: stretch\` so all cells share the
   tallest cell's height.
10. **No content overflow ever** — after every structural edit, measure all slides with the
    verification script. Fix by compacting content, never by expanding the canvas, never by
    shrinking text below 20px, never by removing fixed frame zones.
11. **Quote / dialogue box** — use the standard pattern: dashed cyan border, dark surface-3
    background, italic monospace text at T5, big decorative " mark in cyan, glowing status
    dot top-right.
12. **Per-slide verification checklist** — frame locked, chrome indicators matched, text in
    tier, two-color titles, equidistant spacing, lbl/val/note aligned across the row, feature
    layout hierarchy respected, bullet spacing uniform, zero overflow, nested cards also
    respect the rules.
13. **Cover slide exception** — the first slide can break rule 1 (fixed frame) to be a
    visual scroll-stopper. Rules 3, 5, and 10 still apply.

The reference file contains full CSS patterns, before/after examples, verification scripts
you can paste into DevTools/Playwright, and the origin story of each rule.

**Do not skip the verification**: after any edit to a slide's layout, run the overflow
check and the frame-lock check from the reference before declaring the edit done.

#### Slide deck generation — 3-file approach (MANDATORY)

Slide decks MUST use the canonical 3-file reference pattern — no exceptions, no single-file shortcuts:

1. **\`deck.html\`** — structure only. Use \`<section class="slide" data-type="…">\` (never \`<article>\`). Wrap with the canonical \`<div class="deck"><div class="deck__viewport">\` container, include \`<div class="progress-bar" id="progressBar"></div>\` and \`<span class="slide-counter" id="slideCounter"></span>\` as the first children of the viewport, reference \`<link rel="stylesheet" href="deck.css">\` in \`<head>\`, and \`<script src="deck.js"></script>\` at the end of \`<body>\`.
2. **\`deck.css\`** — copy the full contents of \`slides-base.css\` verbatim, then replace the \`:root { ... }\` block with the active brand's tokens. Do NOT author a parallel style system.
3. **\`deck.js\`** — copy the full contents of \`slides-base.js\` verbatim. Do NOT rewrite the navigation engine.

**Animation contract**: mark every element that should animate on slide entry with \`class="animate-in"\`. The canonical CSS defines \`@keyframes fadeUp\` + staggered \`animation-delay\` for nth-child 1-7; the canonical JS replays these via \`resetAnimations()\` on every slide visit. Elements without \`.animate-in\` appear instantly.

**Bundle fidelity guarantee**: the "HTML · all" export inlines \`deck.css\` into \`<style>\` and \`deck.js\` into \`<script>\` without modification, so the bundle is byte-equivalent to the three files merged — the same animations, navigation, and chrome you see when opening \`deck.html\` in the browser.

**Narrative arc**: Problem→Solution (pitches), Progressive Disclosure (technical), 3-Act (status updates), Comparison (decisions). Budget: 5-7 slides (5 min), 8-12 (standard), 15-20 (deep dive). Rule: ~2 min/slide, max 5 bullets, lead with the most important point.

**Slide types** (set \`data-type\` on the \`<section class="slide">\`):

| data-type | Key elements | Note |
|-----------|--------------|------|
| \`title\`   | \`.slide__eyebrow\`, \`h1\`, \`.slide__subtitle\`, \`.slide__meta\` | |
| \`divider\` | \`.section-number\`, \`h2\` | add \`.slide--blue\` |
| \`content\` | \`h2\`, \`.bullet-list > li\` (max 5) | |
| \`quote\`   | \`blockquote\`, \`.attribution\` | add \`.slide--blue\` |
| \`metrics\` | \`h2\`, \`.metric-grid > .metric-card\` (max 4) | |
| \`table\`   | \`h2\`, \`<table><thead><tbody>\` | |
| \`cards\`   | \`h2\`, \`.card-grid--2\` or \`.card-grid--3\`, \`.card\` | |
| \`code\`    | \`h2\`, \`.code-block > pre\` | |
| \`split\`   | \`h2\`, \`.slide__content--split\` → \`.split__text\` + \`.split__visual\` | |
| \`flow\`    | \`h2\`, \`.flow\` → \`.flow__step\` + \`.flow__arrow\` | |
| \`closing\` | \`h2\`, \`.contact\` | |

Add \`.animate-in\` to every visible element. Add \`.slide--blue\` to use the dark brand color. Standalone export:
\`\`\`bash
node \${CLAUDE_SKILL_DIR}[[/scripts/export/compile-deck.js]] --content <contentDir>
\`\`\`

#### Document page discipline — MANDATORY

Each \`.doc-page\` is a **fixed A4 canvas** (794×1123px). The preview renders every page at exactly this height — there is no auto-expand. Content that overflows is hidden in the viewer and may be missing from DOCX export.

**Rules:**
- One \`.doc-page\` = one printed page. Plan content explicitly per page before writing HTML.
- If content does not fit, split it into a new \`<article class="doc-page">\` — never try to squeeze more into one page.
- Use consistent structure on every page: \`.page-header\` + \`.page-body\` + \`.page-footer\` — this ensures all pages have the same visual height and footer position.
- \`.page-body\` must use \`display: flex; flex-direction: column; flex: 1; overflow: hidden\` so it fills the space between header and footer without growing beyond it.
- Never use \`min-height\` values larger than what fits inside \`.page-body\` — the body height is approximately 1123 − header − footer ≈ ~950px.

**Content budget per page** (approximate at default font sizes):
| Element | Approx. height |
|---------|---------------|
| \`h1\` (2.2rem) | ~50px |
| \`h2\` (1.5rem) | ~40px |
| \`h3\` (1.2rem) | ~32px |
| \`p\` (1rem, 1.5 line-height, ~3 lines) | ~70px |
| \`ul\`/\`ol\` (4–5 items at 1rem) | ~120px |
| \`table\` (3 rows × 40px + header) | ~160px |
| \`.code-block\` (10 lines at 0.85rem) | ~180px |
| \`.callout\` (2 lines) | ~80px |
| \`.stat-row\` (3 stats) | ~120px |
| \`.two-col\` (2 columns, ~4 lines each) | ~150px |
| \`.diagram-wrap\` (SVG ~200px tall) | ~220px |
| Page padding (top + bottom) | ~80px |

A \`.page-body\` of ~950px fits roughly 2–3 major sections. When in doubt, use fewer elements and add a new page.

**Page split checklist before writing HTML:**
1. List all content sections for the document
2. Assign each section to a page — confirm each page's estimated total height < ~950px
3. If a section (e.g. a large table or code block) alone exceeds ~800px, split it across two pages with a continuation header
4. Write one \`<article class="doc-page">\` per planned page

### Step 3b — Validate layout structure (all modes)

After writing any HTML file, validate it with the Box Layout Validator skill before showing anything to the user. This catches spacing, hierarchy, and sibling-consistency bugs you cannot see by reading the code.

\`\`\`bash
bash ~/.claude/skills/codi-box-validator/scripts/setup.sh   # first run only
node ~/.claude/skills/codi-box-validator/scripts/validate.mjs \\
  --input <absolute-path-to-html> --width <W> --height <H> --threshold 0.85
\`\`\`

If \`valid: false\` in the JSON output, read \`fixInstructions\`, patch the HTML, and revalidate. Max 4 iterations. Only show the user the final validated result.

### Step 4 — Iterate (loop until done)

Content creation is a back-and-forth process. This step repeats until the user is satisfied.

#### Campaign propagation check — run FIRST when a brief exists

Before applying any new feedback, if the project has a campaign brief, read it and
check whether the anchor has drifted ahead of any variants:

\`\`\`bash
curl -s <url>/api/brief
\`\`\`

If the response is non-null, scan \`variants[]\` for entries where
\`derived_from_revision < anchor.revision\` AND \`status !== "manual"\`. If any exist,
**ask the user before processing new feedback**:

> "Before I apply this change — the anchor changed since I distilled these variants:
> - \`10-linkedin-carousel.html\` (was rev 1, now rev 3)
> - \`20-instagram-feed.html\` (was rev 1, now rev 3)
>
> Want me to re-distill them? (\`all\` / name a file / \`skip\`)"

On \`skip\`, set each stale variant's \`status = "manual"\` in \`brief.json\` and POST
it back — this prevents the same prompt from firing again for the same revision.
On \`all\` or a named file, re-run Phase 3 distillation for the selected variants
(see \`\${CLAUDE_SKILL_DIR}[[/references/campaign-pipeline.md]]\` Phase 5). Only
then proceed to apply the user's new feedback.

**When the current edit IS an anchor edit**, increment \`anchor.revision\` in
\`brief.json\` after writing the file. This is what makes the next invocation's
propagation check fire.

**If no brief exists** (quick one-off flow), skip this check entirely.

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

#### Targeted card edits — "this slide", "this page", "update this"

When the user says "change **this** slide", "fix **this** page", "update the card I'm looking at",
or gives feedback without naming a specific slide number, they are referring to the card
currently highlighted in the Preview strip. The app automatically reports the selected card
to the server — you can read it from \`/api/state\` under \`activeCard\`:

\`\`\`bash
curl -s <url>/api/state
\`\`\`

\`\`\`jsonc
{
  "mode": "mywork",
  "activeFilePath": "/abs/path/.codi_output/acme/content/slides.html",
  "activeCard": {
    "index": 2,          // zero-based position in state.cards
    "total": 7,          // total cards in the file
    "dataType": "stat",  // the card's data-type attribute
    "dataIdx": "03",     // the card's data-index attribute (zero-padded string)
    "file": "slides.html",
    "timestamp": 1744478800000
  },
  ...
}
\`\`\`

**Resolution rule — use \`dataIdx\` first, then \`dataType\`, then \`index\` as fallback.** The
\`dataIdx\` is the stable identifier baked into the HTML; \`index\` shifts when cards are added
or removed. To locate the exact element in the file:

\`\`\`
<article class="slide" data-type="stat" data-index="03">
\`\`\`

**Targeted edit workflow:**

1. **Read \`/api/state\`** and confirm \`activeCard\` matches what the user is looking at (the
   Preview strip highlights it with the accent border).
2. **Read the file** at \`activeFilePath\` and locate the element whose \`data-index\` matches
   \`activeCard.dataIdx\`.
3. **Edit only that element** — leave all other cards untouched. Preserve the \`data-type\`
   and \`data-index\` attributes unless the user asked to change them.
4. **Rewrite the whole file** (the watcher needs a file write to trigger reload). Even though
   you only changed one card's inner HTML, the file rewrite is the signal.
5. **Confirm to the user** which card changed using its human-readable position: "Updated
   slide 3 of 7 (stat card) — new value is 42%." Do not say "updated the active card" — be
   specific so the user can verify immediately.

**If \`activeCard\` is \`null\`** (user has not clicked any card yet, or no file is loaded), ask
the user to click the card they want to change in the Preview strip, then re-read \`/api/state\`.

**Ambiguity guard:** if the user names a slide explicitly ("change slide 5"), trust the user's
number — do NOT silently remap it to \`activeCard\`. Only use \`activeCard\` when the user uses
deictic language ("this", "here", "the one I'm on") or gives feedback without any position
reference at all.

**Multi-card selection is not supported yet** — \`activeCard\` always refers to a single card
(the most recently clicked one). If the user says "update these three cards", ask which ones
by slide number.

**After each rewrite, confirm what changed** — tell the user exactly which slides were updated and what changed so they can review quickly without hunting for the difference.

**Do not stop at one pass.** Keep iterating until the user says they are done, satisfied, or wants to export.

### Step 4b — Edit a My Work project

When \`mode\` is \`"mywork"\` in \`/api/state\`, the user has a past project open.

1. **Read state** — \`activeFilePath\` is the absolute path to edit:
   \`\`\`bash
   curl -s <url>/api/state
   # { "mode": "mywork", "contentId": "a3f9c2d1",
   #   "activeFilePath": "/abs/path/.codi_output/acme-social-campaign/content/social.html",
   #   "activeSessionDir": "/abs/path/.codi_output/acme-social-campaign",
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

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/promote-template.md]]\`

**Trigger phrases**: "save this as a template", "add this to my presets", "make this reusable",
"add my project from .codi_output as a new template".

This follows the \`codi-improvement-dev\` principle: you are both a consumer and an improver of
Codi skills. Read the reference for the full 8-step workflow (read state → verify doc
conventions → confirm name → copy to both installed and source paths → update meta → verify
in Gallery → log feedback → optional upstream contribution).

**Do not run \`codi generate\`** unless the user explicitly asks — copying the source file is
sufficient to persist the template.

### Step 5 — Export and stop

Export happens in the browser via the sidebar buttons. When done:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]] <workspace_dir>
\`\`\`

Summarize: workspace path, project name, number of slides, format, and where exports were saved.
`;
