# codi-content-factory

A local browser-based content production tool. Create branded social cards,
slide decks, documents, and full cross-platform campaigns through an
interactive preview with live reload and one-click export.

The skill runs a Node.js HTTP + WebSocket server. The coding agent starts the
server, tells you the URL, writes HTML files to a project folder, and the
browser app renders them as cards you can preview, iterate on, and export.

---

## Table of contents

1. [What you can build](#what-you-can-build)
2. [Who this is for](#who-this-is-for)
3. [Prerequisites](#prerequisites)
4. [Quick start](#quick-start)
5. [Core concepts](#core-concepts)
6. [User journeys](#user-journeys)
   - [Journey A — Make a quick single card](#journey-a--make-a-quick-single-card)
   - [Journey B — Make a slide deck](#journey-b--make-a-slide-deck)
   - [Journey C — Make a document / blog post](#journey-c--make-a-document--blog-post)
   - [Journey D — Run a full cross-platform campaign](#journey-d--run-a-full-cross-platform-campaign)
   - [Journey E — Edit a specific card you are looking at](#journey-e--edit-a-specific-card-you-are-looking-at)
   - [Journey F — Apply a brand](#journey-f--apply-a-brand)
   - [Journey G — Export your content](#journey-g--export-your-content)
   - [Journey H — Reopen past work](#journey-h--reopen-past-work)
   - [Journey I — Promote a project to a reusable template](#journey-i--promote-a-project-to-a-reusable-template)
   - [Journey J — Handle anchor edits in a campaign](#journey-j--handle-anchor-edits-in-a-campaign)
7. [App UI tour](#app-ui-tour)
8. [Project layout on disk](#project-layout-on-disk)
9. [Server API reference](#server-api-reference)
10. [Templates — adding your own](#templates--adding-your-own)
11. [Brand skills — how they plug in](#brand-skills--how-they-plug-in)
12. [URL-pinned tab state](#url-pinned-tab-state)
13. [Live element editing](#live-element-editing)
14. [Box Layout validation](#box-layout-validation)
15. [Marketing skills — soft integration](#marketing-skills--soft-integration)
16. [Visual density rules](#visual-density-rules)
17. [Troubleshooting](#troubleshooting)

---

## What you can build

| Output | Format | Typical use |
|--------|--------|-------------|
| **Social card** — single image | 1:1 / 4:5 / 9:16 / OG 1200×630 | LinkedIn post, Instagram feed, Twitter card |
| **Carousel** — multiple linked cards | 4:5 or 9:16 | LinkedIn carousel, Instagram carousel, IG story set |
| **Slide deck** — 16:9 presentation | 1280×720 | Webinars, pitches, internal updates |
| **Document** — A4 pages | 794×1123 | Blog post, technical docs, guide, one-pager |
| **Full campaign** — one topic, many variants | All of the above | Launch post distilled into blog + LinkedIn + Instagram + TikTok + Twitter |

Every output is a self-contained HTML file you can also open in any browser.

---

## Who this is for

- Solo creators who want branded social content without a design tool
- Founders shipping a launch across many platforms in one sitting
- Engineers who write technical docs and want shareable summaries for social
- Marketing teams iterating on carousels with an AI agent in the loop

If you only need a single image, use one of the quick-start journeys below. If
you are publishing one topic across many platforms, use the campaign pipeline.

---

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Node.js 18+ | required | runs the server |
| Playwright (optional) | `npx playwright install chromium` | PNG and PDF export |
| A modern browser | required | opens the app |

The server has zero npm dependencies at runtime — `scripts/server.cjs` is a
self-contained bundle.

---

## Quick start

Open your coding agent in any project directory and say:

> "Start content factory and make me a LinkedIn carousel about my edge caching results."

The agent will:

1. Run `scripts/start-server.sh` and print the URL
2. Create a project folder under `.codi_output/`
3. Ask a couple of clarifying questions
4. Write a cover slide + content slides + CTA slide as a single HTML file
5. Tell you to open the URL and review the preview

Open the URL in your browser, go to the **Preview** tab, and iterate with the
agent in chat. When you are happy, click **Export PDF** or **Export PPTX** in
the sidebar.

To stop:

```bash
bash scripts/stop-server.sh <workspace_dir>
```

The agent will do this automatically if you say "done" or close the session.

---

## Core concepts

### Card

One rendered "page" inside a content file. Three HTML element types:

- `<article class="social-card">` — social media card
- `<article class="slide">` — slide deck page
- `<article class="doc-page">` — A4 document page

Each card has `data-type` (cover / content / stat / quote / cta / closing) and
`data-index` (zero-padded: 01, 02, …). The app scans these attributes to build
the preview strip.

### Content file

One HTML file that contains one or more cards plus a `<meta name="codi:template">`
tag describing the content (id, name, type, format). One file = one logical
unit of content (a carousel, a deck, or a document).

### Project

A named folder under `.codi_output/`. Contains a `content/` directory with one
or more content files, a `state/` directory with session metadata, and an
`exports/` directory for output. You can switch between projects via the
Gallery → My Work tab.

### Brief (campaign mode only)

A `brief.json` file at the project root. Captures the campaign intake: topic,
audience, voice, brand, goal, CTA, anchor type, and the list of variants to
distill. Only created when you run the campaign pipeline.

### Anchor (campaign mode only)

The long-form master file in a campaign. Always named `00-anchor-<type>.html`
where `<type>` is `blog`, `docs`, or `deck`. Single source of truth — all
variants derive from it. Shown in the file list with an `ANCHOR` badge.

### Variant (campaign mode only)

A platform-specific content file distilled from the anchor. Lives in the same
project with a numeric prefix (`10-linkedin-carousel.html`,
`21-instagram-story.html`, `30-tiktok-cover.html`, …). Each variant carries a
`<meta name="codi:variant">` tag that links it back to a specific anchor
revision.

### Format

The canvas dimensions. Six presets: **1:1** (1080×1080), **4:5** (1080×1350),
**9:16** (1080×1920), **OG** (1200×630), **16:9** (1280×720), **A4** (794×1123).
Social cards and slides adapt to the format you pick in the sidebar; documents
always render at A4.

### Preset / template

A stock HTML file in `generators/templates/` that the app shows in the Gallery.
Click one to load it into the preview strip as a starting point for your own
content.

### Brand

A separate Codi skill (any skill whose folder contains `brand/tokens.json`)
that ships colors, fonts, logo, voice, and optional Gallery templates.
Content Factory detects installed brand skills and lets you activate one per
project. The agent then applies the brand to every generated file.

---

## User journeys

Each journey lists what you say to the agent, what the agent does, and what
you do in the browser. All journeys assume the agent has already started the
server and given you the URL.

### Journey A — Make a quick single card

**You want** a one-off social card for an announcement. No brief, no
distillation, just one image.

Say:
> "Make me an Instagram post about our 2.0 release."

The agent will:

1. Create a project folder
2. Ask 1-2 clarifying questions (headline, key points, CTA)
3. Write `content/social.html` with one `social-card` element at 1:1 format
4. Tell you to open the Preview tab

You:

1. Open the URL, Preview tab
2. Review the card at full zoom
3. Give feedback in chat: "make the headline larger", "change the background"
4. Each rewrite reloads the preview in under 200 ms via WebSocket
5. When happy, click **Export PNG** in the sidebar

### Journey B — Make a slide deck

**You want** a 16:9 slide deck for a talk or webinar.

Say:
> "Build me a 10-slide deck about API caching strategies."

The agent will:

1. Create a project
2. Ask audience, tone, and which sections to include
3. Plan the slides (cover → agenda → content → takeaway → CTA)
4. Write `content/slides.html` with ten `<article class="slide">` elements
5. Apply visual density rules so no slide ships with blank space

You:

1. Open the Preview tab, click **16:9** in the format buttons if not already
2. Click any slide to zoom in
3. Use **left / right arrow keys** to navigate slides
4. Give feedback per slide: "change slide 3 headline", "add a stat to slide 5"
5. Export: click **Export PPTX** for PowerPoint, **Export PDF** for a single
   PDF, or **Export PNG** for the current slide only

### Journey C — Make a document / blog post

**You want** a multi-page document — a technical guide, a blog post, or a
product one-pager.

Say:
> "Write a technical guide about setting up edge caching with Cloudflare."

The agent will:

1. Create a project
2. Ask how many pages, what sections, and whether to include code blocks
3. Plan each A4 page to fit within the ~950px body budget
4. Write `content/document.html` with one `<article class="doc-page">` per page
5. Include page headers, footers, callouts, data tables, and code blocks as
   needed
6. Apply DOCX-compatible class conventions so export to Word works cleanly

You:

1. Open the Preview tab, click **A4** in the format buttons
2. Scroll through the pages
3. Give feedback: "add a FAQ page", "move the code block to page 3"
4. Export: **Export PDF** for a print-ready file, **Export DOCX** for
   Word/Google Docs (uses Playwright screenshots for code blocks and SVG
   diagrams)

### Journey D — Run a full cross-platform campaign

**You want** to publish one topic across many platforms in a coordinated set.
This is the most powerful journey — it runs the full anchor → distill pipeline.

Say one of:
> "Create a campaign about how we cut API latency 80% with edge caching."
>
> "I want a blog post plus a LinkedIn carousel, Instagram story, and TikTok
> cover about our 2.0 launch."
>
> "Turn this topic into content for all the main social platforms."

The agent will run five phases.

**Phase 1 — Intake.** The agent asks you six questions, one or two at a time:

1. What is the core topic?
2. What anchor fits best — blog, docs, or deck? (Agent proposes a default.)
3. Who is the audience?
4. What voice? (Inherits from your active brand if any.)
5. Which platforms do you want to generate for? (Checklist — default is
   LinkedIn carousel + Instagram feed.)
6. What is the CTA or goal?

The agent writes `brief.json`, shows you a summary, and waits for you to reply
"go" before doing anything else.

**Phase 2 — Anchor generation.** The agent writes only the anchor file first
(`content/00-anchor-blog.html`, or `00-anchor-docs.html`, or
`00-anchor-deck.html`). You iterate with the agent until the master is good.
Say "approve" or "looks good" to mark the anchor as approved — this unlocks
distillation.

**Phase 3 — Distillation.** The agent loops over your chosen platforms and
writes one file per platform, serially:

- `10-linkedin-carousel.html`
- `11-linkedin-post.html`
- `20-instagram-feed.html`
- `21-instagram-story.html`
- `30-tiktok-cover.html` (plus a video script block)
- `40-twitter-card.html` (plus a thread block)
- `50-summary-deck.html`

Each variant follows the per-platform rules in
`references/platform-rules.md` — hook length, slide count, safe areas,
hashtag strategy, CTA placement. Each file also carries a `codi:variant` meta
tag linking back to the anchor revision it was distilled from.

**Phase 4 — Per-file iteration.** Open any file in the Preview tab, give
feedback, see updates in real time. Works the same as the single-file
journeys.

**Phase 5 — Edit propagation.** When you edit the anchor, the agent bumps
`anchor.revision` in `brief.json`. The next time you message the agent, it
checks whether any variants are now out of date and asks:

> "The anchor changed since I distilled these variants:
> - 10-linkedin-carousel.html (was rev 1, now rev 3)
> - 20-instagram-feed.html (was rev 1, now rev 3)
>
> Should I re-distill them? (all / name a file / skip)"

Choose `all` to re-distill everything, name a single file, or `skip` to keep
the variants as-is. A "skip" is sticky — the same prompt will not fire again
for the same anchor revision.

When the whole campaign is ready, export each file individually from the
sidebar, or ask the agent to export everything into `exports/`.

### Journey E — Edit a specific card you are looking at

**You want** to change "this slide" without naming its number.

The app automatically tracks which card you clicked (or navigated to with
arrow keys) and reports it to the server. When you say "change this", the
agent reads `/api/state`, finds the `activeCard` entry, and edits only the
matching element by its `data-index`.

Say, while looking at a specific card:
> "Make this headline shorter and bolder."
> "Change the background color on this page."
> "Add a bullet to the card I am viewing."

The agent:

1. Reads `/api/state` and confirms which card is active
2. Reads the current HTML
3. Finds the element with the matching `data-index`
4. Rewrites only that element
5. Confirms with "Updated slide 3 of 7 (stat card) — new value is …"

If you name a slide explicitly ("change slide 5"), the agent uses your
number. The "active card" mechanism only kicks in for deictic language
(this, here, the one I am on).

### Journey F — Apply a brand

**You want** your content to use your company's colors, fonts, logo, and voice.

Prerequisite: a brand skill is installed in your project (any skill folder
with `brand/tokens.json`). Use the `codi-brand-creator` skill to build one if
you do not have one yet.

Say, at the start of a session:
> "Use the Codi brand for this content."

The agent will:

1. Call `GET /api/brands` to list available brand skills
2. Call `POST /api/active-brand` with your choice
3. Read `tokens.json` (colors, fonts, logo paths, voice tone)
4. Read `tokens.css` and inline it into every generated HTML file
5. Load Google Fonts via `<link>` or generate `@font-face` blocks for local
   fonts (served at `/api/brand/<name>/assets/fonts/…`)
6. Fetch the logo SVG via `/api/brand/<name>/assets/<logo>` and inline it
7. Open the brand's `references/` directory to learn the brand's layout and
   component patterns
8. Write copy using `voice.tone`, `voice.phrases_use`, and avoiding
   `voice.phrases_avoid`

The brand stays active for the rest of the session. Every file the agent
writes after activation inherits the brand automatically.

### Journey G — Export your content

Exports are **context-aware** — the sidebar button set changes based on the
type of content you have open:

| Content type | Buttons shown | Default |
|--------------|---------------|---------|
| Social card | Export PNG (current), Export PDF (all) | PNG |
| Slide deck | Export PPTX (all), Export PDF (all), Export PNG (current) | PPTX |
| Document | Export PDF (all), Export DOCX (all), Export PNG (current) | PDF |

**PNG** uses Playwright at 2× resolution for crisp output.
**PDF** renders slides to a multi-page PDF server-side via Playwright.
**PPTX** embeds PNG screenshots of each slide via PptxGenJS — preserves fonts
and layout exactly as you see them.
**DOCX** captures text with Pandoc and renders code blocks / SVG diagrams as
Playwright screenshots so they survive the Word export.

All exports land in `<projectDir>/exports/`.

### Journey H — Reopen past work

**You want** to keep iterating on a project you started yesterday.

1. Open the URL → Gallery tab
2. Click the **My Work** filter
3. You see a grid of past project cards — each shows the project date,
   preset name, and a live thumbnail of the first content file
4. Click any card to activate that project; the server loads its content
   files and switches the sidebar file list to that project
5. Click any file in the sidebar to open it in the Preview tab
6. Keep iterating — the agent will detect the project via `/api/state` and
   edit the existing file in place (not create a new one)

### Journey I — Promote a project to a reusable template

**You want** to save a project as a template so future sessions can start
from it.

Say:
> "Save this project as a new template called 'edge-caching-report'."

The agent will:

1. Confirm the template name
2. Copy the content file to `generators/templates/<name>.html` in both the
   installed skill and the source
3. Update the `<meta name="codi:template">` tag with a clean id and name
4. Broadcast a `reload-templates` event — the Gallery refreshes within
   150ms without a page reload; the new template appears inline under the
   matching type filter (Social / Slides / Document)
5. Confirm that the template is now selectable from the Gallery for all
   future sessions

If you want to share the template with others, ask the agent to "contribute
this template upstream" and it will package it for a PR or ZIP export.

### Journey J — Handle anchor edits in a campaign

**You want** to make a change to the long-form anchor and keep the variants
in sync.

1. Open `00-anchor-blog.html` (or whichever anchor you have)
2. Edit it with the agent — "Add a fifth section about cache warming"
3. The agent rewrites the anchor and silently bumps `anchor.revision`
4. Send any next message to the agent — e.g. "change the LinkedIn cover
   headline"
5. **Before** applying the new change, the agent detects stale variants and
   asks:
   > "The anchor changed since I distilled 10-linkedin-carousel.html and
   > 21-instagram-story.html — should I re-distill? (all / name a file / skip)"
6. Pick your option; the agent re-distills the selected variants from the
   new anchor revision, then applies your new feedback
7. If you pick `skip`, those variants get marked `status: "manual"` in
   `brief.json` so the same prompt never fires again for that revision

---

## App UI tour

### Sidebar (left, scrollable)

| Control | What it does |
|---------|--------------|
| **Format** | Six buttons: 1:1, 4:5, 9:16, OG, 16:9, A4. Switches the canvas dimensions for all cards. Documents always render at A4. |
| **Handle** | `@username` placeholder. The agent replaces `@handle` in generated content with your value. |
| **Zoom** | 15% - 120% slider. Scales the preview cards. Default 40%. |
| **Logo** | ON/OFF toggle plus size and X/Y sliders. Adds a logo overlay to every card. |
| **Content files** | List of HTML files in the active project. Anchor files show an `ANCHOR` badge. Click to load. |
| **Export** | Context-aware export buttons (see Journey G). |
| **Activity log** | Timestamped server events and WebSocket status. Green dot = connected. |

### Main area

**Preview tab** — horizontal card strip. Click any card to select it. Arrow
keys navigate. The active card is highlighted and reported to the server via
`/api/active-card` so the agent knows which card you are looking at. A
metadata bar above the canvas shows the content name, type, format, and slide
count.

**Gallery tab** — preset browser. Five filters:

- **All** — every built-in template and every installed brand skill template, side by side. Past projects are hidden from this view.
- **Social** — templates whose `type` meta is `social` (cards, carousels, stories)
- **Slides** — templates whose `type` meta is `slides` (16:9 decks)
- **Document** — templates whose `type` meta is `document` (A4 pages)
- **My Work** — past projects from `.codi_output/`, most recent first. When active, a secondary status row appears (All / Draft / In Progress / Review / Done) for filtering by project status.

Stock templates (from `generators/templates/`) and brand templates (from any installed brand skill's `templates/` folder) land in the same flat list — the Gallery does not separate them into their own tab. Each card's `type` decides which filter it appears under. Click any card to load it into Preview.

---

## Project layout on disk

A single-file project:

```
.codi_output/
  my-quick-post/
    content/
      social.html
    state/
      active.json            # which file is open
      active-card.json       # which card is selected
      preset.json            # which template was picked
      manifest.json          # project metadata + status
    exports/                 # PNG / PDF / PPTX / DOCX output lands here
```

A campaign project:

```
.codi_output/
  edge-caching-launch/
    brief.json               # intake answers + variants + pipeline state
    content/
      00-anchor-blog.html    # master (document, A4)
      10-linkedin-carousel.html
      11-linkedin-post.html
      20-instagram-feed.html
      21-instagram-story.html
      30-tiktok-cover.html
      40-twitter-card.html
      50-summary-deck.html
    state/
    exports/
```

Numeric prefixes give natural sort order in the app's file list:
`00-` anchor first, then `10-19` LinkedIn, `20-29` Instagram, `30-39` TikTok,
`40-49` Twitter, `50-59` decks, `60-69` email/ads/other.

---

## Server API reference

All endpoints run on the same port as the web app. Routes are grouped by concern.

### App assets

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Serve the web app HTML shell |
| `/static/*` | GET | Serve `app.css`, `app.js` |
| `/vendor/*` | GET | Serve `html2canvas`, `jszip` |

### Projects and sessions

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/create-project` | POST | Create and activate a new project — body `{name, type}`. `type` is required and must be one of `social`, `slides`, `document`. Returns `{projectDir, contentDir, stateDir, exportsDir}` |
| `/api/open-project` | POST | Activate an existing project — body `{projectDir}` |
| `/api/sessions` | GET | List all projects in the workspace |
| `/api/session-status` | POST | Persist project status — body `{sessionDir, status}` where status is `draft`, `in-progress`, `review`, or `done` |

### Files and content

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/files` | GET | List HTML files in the active project's `content/` |
| `/api/content?file=X` | GET | Return raw HTML for a content file |
| `/api/session-content?session=&file=` | GET | Serve a file from a specific project |
| `/api/content-metadata?kind=&id=` | GET | Unified descriptor for templates and sessions: `{kind, id, name, type, format, cardCount, status, createdAt, modifiedAt, readOnly, source}`. `readOnly=true` for built-in templates |
| `/api/content-list` | GET | Debug/utility — every content descriptor the server knows about, templates and sessions merged |
| `/api/clone-template-to-session` | POST | Copy a built-in template into a new editable session — body `{templateId, name?}`. Use before applying any `persist-style` edit when the content is a template |

### State and selection

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/state` | GET | Aggregate state: `{mode, contentId, activeFile, activeFilePath, activePreset, activeSessionDir, status, activeCard, brief, activeBrand}`. `mode` is `template`, `mywork`, or `null`. Use `contentId` and `activeFilePath` as the authoritative identifiers — never reconstruct paths from name fragments |
| `/api/active-file` | GET/POST | Which file is currently loaded |
| `/api/active-card` | GET | The card currently highlighted in Preview: `{index, total, dataType, dataIdx, file, timestamp}` |
| `/api/active-card` | POST | App-only — the browser posts this when you click a card or use arrow keys |
| `/api/preset` | GET/POST | Which Gallery preset was picked — `{id, name, type, timestamp}` |

### Live inspection

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/active-element` | GET | The DOM element the user most recently clicked in the preview — full context (selector, tag, id, classes, attributes, text, outerHTML snippet, bounding rect, computed styles, parent chain, and a `context` field carrying `{kind, id, name, file, cardIndex, readOnly}`). `null` if no click yet |
| `/api/active-elements` | GET | Multi-select set of Cmd/Ctrl-clicked elements — `{count, selections:[...]}` |
| `/api/active-elements` | DELETE | Clear the multi-select set |
| `/api/inspect-events?since=<seq>` | GET | Ring buffer of preview interactions (clicks, inputs, submits, scrolls). Poll with `?since=<lastSeq>` for incremental updates |
| `/api/eval` | POST | Run JavaScript inside the currently-previewed HTML page — body `{js, timeoutMs?}`. Returns `{ok, result, error}`. Ephemeral — changes revert on reload. Disable with env `CONTENT_FACTORY_ALLOW_EVAL=0` |

### Style persistence

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/persist-style` | POST | Persist a style edit to the card source file — body `{targetSelector, patches}`. The server assigns a stable `data-cf-id`, writes it into the HTML, and upserts a CSS rule in a bounded `/* === cf:user-edits === */` region. Returns `409` with a `cloneSuggestion` payload when the target is read-only (template). Idempotent: re-applying the same edit is a no-op |
| `/api/persist-style` | DELETE | Revert a persisted edit — query `?cfId=<id>&project=<dir>&file=<basename>`. Removes the rule and strips the `data-cf-id` attribute if no other rule references it |
| `/api/persist-style` | GET | List persisted edits for a card — query `?project=<dir>&file=<basename>`. Returns `{count, rules:[{selector, declarations:[...]}]}` |

### Campaign brief and anchor revisions

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/brief` | GET | Return the active project's `brief.json` or `null` |
| `/api/brief` | POST | Write the brief — body is an arbitrary JSON object (no schema enforcement). Returns 400 if no project is active |
| `/api/distill-status` | GET | Anchor revision and per-variant staleness: `{anchor:{file,revision,status}, variants:[{file,format,derivedFromRevision,status,staleBy}], stale:[files]}`. Use at the start of every iteration turn to detect stale variants |
| `/api/anchor/revise` | POST | Bump `brief.anchor.revision` and mark variants with `derivedFromRevision < new revision` as `status: "stale"`. Optional body `{reason?}` |
| `/api/anchor/approve` | POST | Set `brief.anchor.status = "approved"`, record `approvedAt`. Idempotent. Call only when the user explicitly approves the anchor |

Variant metadata uses camelCase throughout — `derivedFromRevision`, `derivedFrom`, `createdAt`. Older references may show snake_case; camelCase is authoritative.

### Box Layout validation

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/validate-card` | POST | Validate one card — body `{project, file, cardIndex, force?}`. Returns `{ok, pass, score, violations:[{rule, severity, path, message, fix}], summary, fixInstructions}`. Cached by SHA-1 of HTML + dimensions + preset |
| `/api/validate-cards?project=&file=` | GET | Batch validate every card in a file — `{ok, pass, cards:[...], failingCards:[...]}` |
| `/api/validation-config?project=<dir>[&file=<basename>]` | GET | Resolved config cascade with `source` map showing which scope produced each field. Cascade: type-default → user default → session → per-file |
| `/api/validation-config` | PATCH | Merge a partial patch — body `{project|user:true, patch}`. Returns the new resolved config |
| `/api/validation-config/toggle` | POST | Flip a layer on or off — body `{project, layer, value}`. Layers: `all` (master), `endpoint`, `badge`, `agentDiscipline`, `exportPreflight`, `statusGate` |
| `/api/validation-config/ignore-violation` | POST | Add a per-file exemption — body `{project, file, rule, selector?, cardIndex?}` |
| `/api/validator-health` | GET | `{degraded, workers, cacheSize, cacheHits, cacheMisses, avgLatencyMs, lastError}`. `degraded: true` means Playwright is missing and all layers default to pass |

### Templates

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/templates` | GET | List all stock and brand templates with metadata |
| `/api/template?file=X[&brand=Y]` | GET | Serve a single template HTML file |

### Brands

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/brands` | GET | List installed brand skills (those with `brand/tokens.json`) |
| `/api/active-brand` | POST | Set or clear the active brand — body `{name}` or `{}` to clear |
| `/api/brand/:name/assets/*` | GET | Serve a file from a brand skill's `assets/` — use these URLs for logos and fonts in generated HTML |

### Export

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/export-png` | POST | Render a card to 2× PNG via Playwright — body `{html, width, height}` |
| `/api/export-pdf` | POST | Render slides to a multi-page PDF — body `{slides:[{html,width,height}]}` |

PPTX and DOCX export run in the browser via PptxGenJS and client-side Pandoc — no dedicated server endpoints. PNG screenshots for PPTX slides and DOCX figures still route through `/api/export-png`.

### WebSocket

The server runs a WebSocket endpoint at the same port. The browser app
connects automatically and receives:

- `{type: "reload"}` whenever a content file changes — triggers a live update
- `{type: "reload-templates"}` whenever a template file changes — refreshes
  the Gallery without a page reload

---

## Templates — adding your own

Drop a `.html` file in `generators/templates/`. It must include a
`<meta name="codi:template">` tag in `<head>`:

```html
<meta name="codi:template" content='{"id":"my-template","name":"My Template","type":"social","format":{"w":1080,"h":1080}}'>
```

Required fields: `id` (kebab-case), `name` (human-readable), `type`
(`social` / `slides` / `document`), `format` (width + height in pixels).

The template watcher picks up the new file within 150 ms and pushes a
`reload-templates` event — your template appears in the Gallery without
restarting the server.

See `references/visual-density.md` and the main skill workflow for the card
structure rules.

---

## Brand skills — how they plug in

Any skill folder that contains `brand/tokens.json` is detected as a brand.
The agent discovers brands via `GET /api/brands`, activates one via
`POST /api/active-brand`, and applies it to every generated file:

1. Inlines `brand/tokens.css` as a `<style>` block
2. Loads fonts from `tokens.json.fonts.google_fonts_url` OR from
   `assets/fonts/` via `@font-face` blocks pointing at
   `/api/brand/<name>/assets/fonts/<file>`
3. Inlines the logo SVG from `assets/<logo-file>` based on card background
4. Reads the brand's `references/` directory for layout guidance
5. If the brand has a `templates/` folder, those templates appear in the
   Gallery alongside the built-in ones, filtered by each template's `type`
   (Social / Slides / Document). They carry a `brand` tag on their metadata
   so the agent knows which skill they come from.
6. Writes copy using `voice.tone`, `voice.phrases_use`, and avoiding
   `voice.phrases_avoid`

Use the `codi-brand-creator` skill to build a brand package.

---

## Logo discovery

Every content project loads its overlay logo from the canonical path:

```
.codi_output/<project>/assets/logo.svg
```

The browser app requests it via `GET /api/project/logo`. The server runs a
three-step fallback chain:

1. `<project>/assets/logo.svg` — the project's own logo (wins when present)
2. `<active-brand>/brand/assets/logo.svg` — the active brand skill's logo
3. Built-in `codi` mark — last resort

The first time the factory needs a logo for a project that has none, it
copies the active brand's logo to the canonical project path. From that
moment the project owns the file — subsequent edits to the brand skill do
not retroactively flow into existing projects. This keeps projects portable
(zipping one ships its identity with it) and predictable (the convention
path is always where the logo lives).

Both the in-page preview overlay and exported HTML inline the resolved
SVG, so exports are self-contained (no external `<img src>`). The overlay
size tracks the inspector's size slider; see *Logo defaults* below for the
format-derived starting value.

---

## Content fit

Canvas overflow is emitted as **rule R11 "Canvas Fit"** by the standard
box-layout validator. The agent catches it in the same
`/api/validate-cards` loop that runs R1–R10 — no separate report file, no
parallel notification channel.

```json
{
  "rule": "R11",
  "severity": "error",
  "path": "body > div.doc-container > section.doc-page[0]",
  "message": "Canvas overflow on .doc-page — content is 287px larger than 794x1123 (25.6%)",
  "fix": "paginate: Page exceeds 794x1123 by 287px (25.6%). Add a new .doc-page sibling after this one and move overflow content into it. Preserve the existing header and footer on every page.",
  "remediation": "paginate",
  "overflowPx": 287,
  "overflowPct": 25.6,
  "canvasType": "document"
}
```

The remediation is content-type aware:

| Type | Overflow > 15% | Overflow ≤ 15% |
|------|----------------|----------------|
| `document` | paginate (add a new `.doc-page` sibling) | tighten |
| `slides` | split into multiple slides at the next section break | tighten |
| `social` | tighten (single canvas, no pagination) | tighten |

**Pagination contract** — a multi-page document is a sequence of sibling
`.doc-page` elements inside `.doc-container`. Each `.doc-page` is its own
canvas (e.g. `794×1123` for A4) and ships its own header and footer. The
validator measures *per page*, not the whole document; adding pages
legitimately resolves overflow only when every page fits.

The canvas-root `overflow: hidden` that templates ship for export is
overridden in preview by an injected stylesheet
(`scripts/lib/injector.cjs`), so authors see overflow while editing
instead of silent clipping. Exports still clip per the template's own CSS.

Rule source: `scripts/lib/box-layout/rules/r11-canvas-fit.cjs`.

---

## Logo defaults

The overlay logo size defaults to 8% of the active canvas's shortest side:

| Format | Canvas | Default size |
|--------|--------|--------------|
| Document (A4) | 794 × 1123 | 64 px |
| Social (square) | 1080 × 1080 | 86 px |
| Slides (16:9) | 1280 × 720 | 58 px |

Switching the active format recomputes the size automatically — until the
user moves the size slider, at which point the flag `logo.userOverridden`
flips to `true` and the user's value sticks across future format changes.

---

## URL-pinned tab state

Every preview tab is addressable by URL. Reloads land on exactly the same
project, file, and card. Two tabs with different URLs show independent
states. The agent can construct a URL directly and send it to the user for
deep-linking.

| Param | Meaning |
|-------|---------|
| `kind` | `template` or `session` |
| `id` | Stable content id (template id or session dir basename) |
| `file` | Content file basename (e.g. `social.html`) |
| `card` | Active card index, 0-based (default 0) |

Example (template):

```
http://localhost:PORT/?kind=template&id=linkedin-carousel-concept-story&file=social.html&card=2
```

Example (session):

```
http://localhost:PORT/?kind=session&id=my-campaign-oct&file=social.html&card=0
```

The URL is the single source of truth for a tab. Legacy `?project=` and
`?preset=` parameters are honored for one release for existing bookmarks.

---

## Live element editing

Click any element in the preview. The agent can read what you clicked,
propose a change, and persist it to the card source file. Edits survive
reloads, regeneration, and exports.

The edit flow:

1. **Click** the target element in the preview. `Cmd`/`Ctrl`-click to build a
   multi-select set for a batch operation.
2. **Agent reads the selection** via `GET /api/active-element` (or
   `/api/active-elements` for multi-select). The response carries a
   `context` field with `{kind, id, name, file, cardIndex, readOnly}`.
3. **If `context.readOnly` is `true`**, the selection came from a built-in
   template. The agent calls `POST /api/clone-template-to-session` with
   `{templateId: context.templateId}` to create an editable copy in My Work,
   then loads it via `?kind=session&id=<newId>&file=<basename>` and asks
   you to re-click the element.
4. **Persist the edit** via `POST /api/persist-style` with
   `{targetSelector, patches}`. The server writes a stable `data-cf-id` into
   the HTML and upserts a CSS rule in a bounded
   `/* === cf:user-edits === */` region of the card's `<style>` block.
5. **Optional live preview** via `POST /api/eval` for instant visual feedback
   before the next render cycle.

Revert an edit with `DELETE /api/persist-style?cfId=<id>&project=<dir>&file=<basename>`.
The rule and the `data-cf-id` attribute both go away cleanly.

List all persisted edits on a card with `GET /api/persist-style?project=<dir>&file=<basename>`.

Edits are byte-additive: everything outside the user-edits region is
untouched. Idempotent: re-applying the same edit is a no-op.

---

## Box Layout validation

Every generated card passes through the vendored Box Layout validator
before the agent ships it. Five layers enforce spacing, hierarchy, and
structural consistency:

| Layer | Purpose |
|-------|---------|
| L1 | Primitive validation via `POST /api/validate-card` |
| L2 | Pass/fail score badges on preview cards |
| L3 | Agent discipline — every `persist-style` write triggers a validate-and-fix loop |
| L4 | Export preflight — blocks export of cards below threshold |
| L5 | Session-status gate — blocks `done` status when any card fails |

Default thresholds:

- Slides and documents: strict, score ≥ 0.9
- Social cards: lenient, score ≥ 0.8

Install the validator once per machine:

```bash
bash scripts/setup-validation.sh
```

If Playwright is not installed, `GET /api/validator-health` reports
`degraded: true` and all layers silently default to pass. The skill still
works, but without validation feedback.

Toggle any layer on or off with `POST /api/validation-config/toggle`.
Override the threshold per session or globally with
`PATCH /api/validation-config`. Exempt a specific violation with
`POST /api/validation-config/ignore-violation`.

---

## Marketing skills — soft integration

Content Factory softly uses the external `marketing-skills` plugin if it is
installed. If not, the workflow and outputs are identical — the only
difference is whether extra LLM passes refine the copy.

| Phase | Skill invoked if present |
|-------|--------------------------|
| Intake | `content-strategy` — validate topic and audience fit |
| Anchor (blog / docs) | `copywriting` → `humanizer` |
| Anchor (deck) | `launch-strategy` (if present) → `humanizer` |
| Distillation | `social-content` — one call per platform → `humanizer` |
| Optional | `ad-creative`, `email-sequence` for paid or email variants |

If you want to force inline generation even when the plugin is installed,
say "do not use marketing skills for this campaign" — the agent will skip
detection.

Codi will eventually ship its own first-party marketing skills to replace
this external dependency. When that lands, the soft-detect pattern means you
get the benefit automatically with no workflow change.

---

## Visual density rules

Every generated card must visibly occupy **≥85% of its canvas** with
purposeful content. No single centered headlines floating on blank space.
Full rules live in `references/visual-density.md`, but the key ideas are:

- Mentally draw a 3×3 grid over the card; at least 7 of the 9 cells must
  contain content or a purposeful decorative element
- Use two or more of these fill techniques per card: grid/multi-column
  layouts, supporting visual elements (eyebrow, stat row, meta strip),
  decorative accents (gradients, shapes, large outlined numerals),
  code/data mockups for technical content, edge-anchored chrome (brand mark,
  page number, handle, CTA arrow), oversized typography, background imagery
  or gradient fills
- Per card type, minimum elements are enforced — e.g. a social cover needs
  headline + sub-headline + eyebrow + brand mark + handle + one accent

If the agent ever generates a card with too much blank space, say "this is
too empty" and it will rewrite the card applying the density rules.

---

## Troubleshooting

### The browser app cannot reach the server

- Check the activity log in the sidebar — the WebSocket dot should be green
- Restart the server: `bash scripts/stop-server.sh <workspace>` then
  `bash scripts/start-server.sh --project-dir .`
- Check that the port from the startup JSON is not blocked by a firewall

### Cards look clipped or have content falling off the edge

- The preview *shows* overflow (it used to clip silently) — content
  visibly extends past the canvas when it doesn't fit
- Run `GET /api/validate-cards?project=<dir>&file=<file>` — any R11
  "Canvas Fit" violation names the overflowing page and prescribes the
  remediation (`paginate`, `split`, or `tighten`) in the `fix` field
- For documents, either tighten the layout or add a new `.doc-page` sibling
- For slides, split at the next natural section break
- Exports still clip per each template's own CSS — the relaxation applies
  to the in-app preview only, so overflow is visible at authoring time

### Fonts look wrong

- If a brand is active and uses Google Fonts, make sure your machine has
  internet access — Google Fonts are loaded from the web inside iframes
- If the brand ships local fonts, check that
  `/api/brand/<name>/assets/fonts/<file>` returns 200 in your browser
- Never use `<link href="file://…">` — iframes block `file://` URLs

### PNG export produces a blank image

- Install Playwright Chromium: `npx playwright install chromium`
- Check that the card has non-zero dimensions in the preview
- Try exporting from the sidebar "Export PNG" button; it uses Playwright
  server-side at 2× resolution

### Validator says `degraded: true` or scores never appear

- Run `bash scripts/setup-validation.sh` once — it installs Playwright
  Chromium and the validator's own dependencies
- Check `GET /api/validator-health` — if `degraded: true`, Playwright is
  missing and every validation layer silently passes
- If install succeeds but scores still don't render, check the sidebar
  activity log for worker crashes and restart the server

### DOCX export is missing code blocks or diagrams

- Make sure `.code-block`, `pre`, and `.diagram-wrap` use
  `overflow: visible` — `overflow: hidden` clips content and corrupts the
  screenshot capture
- Tables must include `table-layout: fixed` in CSS to render correctly in
  both the preview and the exported DOCX

### The file list shows an anchor badge but clicking does nothing

- Check that `brief.json` exists at the project root
- Check that `brief.anchor.file` matches a file in `content/`
- Run `curl -s <url>/api/brief` to verify the brief is readable

### The agent keeps asking to re-distill variants after I said "skip"

- The `skip` answer marks variants as `status: "manual"` in `brief.json` for
  the current anchor revision. If the anchor changes again, the check fires
  again for the new revision — this is intentional
- To permanently stop propagation for a variant, edit `brief.json` and
  remove the variant from `variants[]`

---

## What's next

- Campaign export bundle — single ZIP with manifest listing each variant
- Gallery "Campaigns" filter — group projects with `brief.json` and show
  mini-thumbnails per platform
- Codi-native marketing skills — first-party replacement for the external
  `marketing-skills` plugin
- Multi-card selection in the preview strip — right now `activeCard` tracks
  one card at a time
