import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to create content — articles, blog posts, slide decks, social carousels, documents, business deliverables (reports, proposals, one-pagers, case studies, executive summaries), single-format social posts, or multi-format campaigns (blog + deck + carousel about the same topic). Authors substance first (an anchor article) and distills into every requested visual format. Explicit fast path for one-off requests. Generates branded HTML with an interactive web app — live preview and context-aware export (PNG, PDF, PPTX, DOCX, HTML, ZIP). For branded business documents specifically, see references/business-documents.md.
category: ${SKILL_CATEGORY.CONTENT_CREATION}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 122
---

# {{name}} — Content Factory

## Non-negotiable rules

- **The brand logo lives in \`<brand-skill>/assets/\`.** Preferred name is \`logo.svg\` /
  \`logo.png\`, but the resolver also accepts themed variants (\`logo-light.svg\`, \`logo-dark.svg\`,
  \`logo-black.svg\`) and any file whose basename contains "logo" (e.g. \`bbva-logo.svg\`). All
  conform — no auto-fix needed. If the brand ships the logo OUTSIDE \`assets/\`, fix the brand
  or ask the user — do not build workarounds in content code. Full convention + pre-flight
  decision tree: \`\${CLAUDE_SKILL_DIR}[[/references/logo-convention.md]]\`
- **Never embed the brand logo inside content HTML (\`<img>\`, background-image, inline SVG).**
  Content Factory renders the brand logo as an overlay on every card, automatically sized
  to the canvas (≈20% of the shortest side, top-right by default) and positioned/scaled via the inspector. Embedding
  a second logo in the HTML duplicates the mark on export and desyncs when the brand changes.
  Author content with chrome only (title bars, eyebrows, accent bars) — the factory adds the logo.
- **Slide decks are animated, single-file HTML. Always.** Every \`.slide\` deck ships
  as one self-contained HTML file with all CSS, \`@keyframes\`, fonts, and per-slide
  inline \`<script>\` bundled in. No sibling \`deck.css\` / \`deck.js\`. Motion is
  deliberate: staggered entry animations, compositor-only \`transform\` / \`opacity\`,
  \`@media (prefers-reduced-motion: reduce)\` honored, final state always visible.
  Quality floor: premium, modern, brand-aligned. HTML export is byte-for-byte —
  what you author is exactly what downloads. Full brief:
  \`\${CLAUDE_SKILL_DIR}[[/references/slide-deck-engine.md]]\`. Read it before writing any deck.
- **Slide decks MUST bundle dual-mode presentation.** Every deck must open
  standalone (double-click the downloaded \`.html\`) as a Google-Slides-style
  fullscreen presentation with keyboard (\`← → Space PageUp PageDown Home End\`)
  and click navigation, viewport-fit scaling, animation replay on every slide
  change, and a bottom-right page counter. Vertical scrolling through stacked
  slides is a defect in standalone mode. The pattern is dual-mode — base CSS
  stacks (Content Factory preview / thumbnails / Playwright export see stacked),
  a head \`<script>\` adds \`.js-presentation\` which switches CSS into fullscreen
  horizontal. Content Factory drops the top-level script during extraction, so
  preview stays stacked. All four pieces (head hook, presentation CSS, end-of-body
  driver, page counter element) are required. Reference implementation:
  \`\${CLAUDE_SKILL_DIR}[[/references/slide-deck-engine.md]]\` § 2.7 and § 5.2.
- **Run validation after every content write; fix every violation before declaring done.**
  Call \`GET /api/validate-cards?project=<dir>&file=<file>\` and iterate on the returned
  \`violations[]\` until the report is clean (\`valid: true\`). Canvas overflow (\`rule: R11\`,
  "Canvas Fit") is a standard validation violation alongside the box-layout rules — its
  \`fix\` field prescribes \`paginate\`/\`split\`/\`tighten\` with the exact overflow numbers.
  Full protocol, including the content-fit remediation decision tree, lives at
  \`\${CLAUDE_SKILL_DIR}[[/references/content-fit.md]]\`.

## Skip When

- User wants a single static poster, album cover, or museum-quality art piece — use ${PROJECT_NAME}-canvas-design
- User wants a generative / interactive p5.js sketch — use ${PROJECT_NAME}-algorithmic-art
- User wants to edit a \\\`.pptx\\\` directly (binary format) — use ${PROJECT_NAME}-pptx
- User wants a Word document with tracked changes — use ${PROJECT_NAME}-docx
- User wants a multi-component React artifact — use ${PROJECT_NAME}-claude-artifacts-builder

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

## Terminology

These terms appear throughout the skill and references. They are stable — use them consistently.

| Term | Meaning |
|------|---------|
| **Project** / **Session** | Same thing. A named directory under \`.codi_output/\` containing one or more content files plus state. The HTTP API uses \`session\` in URL params and path names (e.g. \`sessionDir\`, \`/api/sessions\`); the workflow prose uses \`project\`. When reading the code, both refer to the same on-disk folder |
| **Content file** | One HTML file in a project's \`content/\` directory. Carries a \`<meta name="codi:template">\` tag and one or more cards. One file = one logical content unit (a carousel, a deck, a document) |
| **Card** | One rendered page inside a content file. Three element types: \`.social-card\`, \`.slide\`, \`.doc-page\`. The app scanner only recognizes these three class names |
| **Preset** / **Template** | Same thing at the Gallery level. A "preset" is what the user picks from the Gallery. A "template" is the underlying HTML file in \`generators/templates/\` (built-in) or a brand skill's \`templates/\` directory |
| **Anchor** | The long-form master file in an anchor-first flow. Always Markdown, always at \`content/00-anchor.md\`. Rendered in the preview as a styled A4 document; distillation reads the Markdown sections (H1/H2/blockquotes/lists) to produce variants |
| **Variant** | A platform-specific content file distilled from an anchor. Carries a \`<meta name="codi:variant">\` tag linking back to the anchor's revision |
| **Brief** | A project's \`brief.json\` — arbitrary JSON (no schema enforcement) capturing intake, anchor revision, and variant registry |

---

## Skill Assets

| Asset | Purpose |
|-------|---------|
| \`\${CLAUDE_SKILL_DIR}[[/scripts/server.cjs]]\` | Node.js HTTP + WebSocket server. Minimal deps: \`docx\` (DOCX export), optional \`playwright\` (box-layout validation). See \`scripts/package.json\`. |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]]\` | Start the server, outputs JSON with URL and paths |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]]\` | Stop the server gracefully |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/setup-validation.sh]]\` | Install Playwright and validator deps (first-time) |
| \`\${CLAUDE_SKILL_DIR}[[/generators/app.html]]\` | App shell — always served at \`/\` |
| \`\${CLAUDE_SKILL_DIR}[[/generators/app.css]]\` | App styles — served at \`/static/app.css\` |
| \`\${CLAUDE_SKILL_DIR}[[/generators/app.js]]\` | App logic — served at \`/static/app.js\` |
| \`\${CLAUDE_SKILL_DIR}[[/generators/social-base.html]]\` | HTML template for agent-generated social cards |
| \`\${CLAUDE_SKILL_DIR}[[/generators/document-base.html]]\` | HTML template for agent-generated documents |
| \`\${CLAUDE_SKILL_DIR}[[/generators/templates/]]\` | Stock template HTML files — appear in the Gallery under All / Social / Slides / Document filters |
| \`\${CLAUDE_SKILL_DIR}[[/references/operating-system.md]]\` | **MUST-READ first.** The Content Factory operating philosophy — the six-phase validation-first workflow (Discovery → Master → Validation → Planning → Validation → Generation). Describes WHO the skill is and HOW it operates before any mechanics. Every other reference is the HOW behind this WHY |
| \`\${CLAUDE_SKILL_DIR}[[/references/server-api.md]]\` | Full Server API reference — every endpoint, grouped by concern. Read on demand when you need a specific route |
| \`\${CLAUDE_SKILL_DIR}[[/references/url-pinning.md]]\` | URL-pinned tab state — how to construct deep-link URLs |
| \`\${CLAUDE_SKILL_DIR}[[/references/app-ui.md]]\` | Browser app UI layout — sidebar, tabs, filters. Rarely needed by agents |
| \`\${CLAUDE_SKILL_DIR}[[/references/methodology.md]]\` | Content methodology — anchor-first flow, fast-path, quality gates, principles. Read this before any non-trivial content request |
| \`\${CLAUDE_SKILL_DIR}[[/references/intent-detection.md]]\` | How to read user requests and decide anchor-first vs. fast-path |
| \`\${CLAUDE_SKILL_DIR}[[/references/anchor-authoring.md]]\` | How to write a great anchor — shapes, length classes, semantic tagging, worked examples |
| \`\${CLAUDE_SKILL_DIR}[[/references/distillation-principles.md]]\` | How to compress an anchor into any target format — platform norms, five compression moves, thesis + CTA preservation |
| \`\${CLAUDE_SKILL_DIR}[[/references/slide-deck-engine.md]]\` | Creative brief for slide decks — structural contract, motion principles, anti-patterns |
| \`\${CLAUDE_SKILL_DIR}[[/references/design-system.md]]\` | The 13 design rules. Read before authoring any slide |
| \`\${CLAUDE_SKILL_DIR}[[/references/visual-density.md]]\` | 85% canvas fill rule and per-type element minimums |
| \`\${CLAUDE_SKILL_DIR}[[/references/html-clipping.md]]\` | Overflow rules per card type |
| \`\${CLAUDE_SKILL_DIR}[[/references/content-fit.md]]\` | **R11 Canvas Fit rule.** Canvas overflow is emitted by \`/api/validate-cards\` as a standard box-layout violation (\`rule: R11\`). The \`fix\` field prescribes \`paginate\`/\`split\`/\`tighten\`. Handled by the same validate-before-done loop as R1–R10 |
| \`\${CLAUDE_SKILL_DIR}[[/references/logo-convention.md]]\` | **Logo standard + pre-flight.** Brand logos live in \`<brand>/assets/\`: \`logo.svg\`/\`.png\`, \`logo-*.{svg,png}\`, or any \`*logo*.{svg,png}\` all conform. Call \`GET /api/brand/<name>/conformance\` at project creation; auto-fix or ask the user only when the logo sits OUTSIDE \`assets/\` |
| \`\${CLAUDE_SKILL_DIR}[[/references/docx-export.md]]\` | Document page discipline + DOCX class conventions |
| \`\${CLAUDE_SKILL_DIR}[[/references/business-documents.md]]\` | Branded business deliverables — report, proposal, one-pager, case study, executive summary. Use for report/proposal/case-study requests |
| \`\${CLAUDE_SKILL_DIR}[[/references/brand-integration.md]]\` | Apply an installed brand skill end-to-end |
| \`\${CLAUDE_SKILL_DIR}[[/references/platform-rules.md]]\` | Convenience appendix: per-platform distillation recipes |
| \`\${CLAUDE_SKILL_DIR}[[/references/plan-authoring.md]]\` | The plan-first pipeline contract — how to author a Markdown plan per variant, status lifecycle (planned → approved → rendered → stale), revision handling. Read BEFORE writing any variant file |
| \`\${CLAUDE_SKILL_DIR}[[/references/copywriting-formulas.md]]\` | Seven battle-tested formulas (AIDA, PAS, BAB, 4Ps, 1-2-3-4, 4Us, FAB) with structure, worked examples, default formula-per-variant mapping |
| \`\${CLAUDE_SKILL_DIR}[[/references/hooks-and-retention.md]]\` | Hook archetypes (10), anti-patterns, per-platform length budgets, retention tactics (open loops, scan beats, pattern interrupts) |
| \`\${CLAUDE_SKILL_DIR}[[/references/humanized-writing.md]]\` | Anti-AI-sounding techniques — the five tells, banned words, humanization checklist, per-platform AI tolerance. MANDATORY pass before any \`.html\` renders |
| \`\${CLAUDE_SKILL_DIR}[[/references/research-audit-2026.md]]\` | The reference-catalog audit that produced the three craft docs above; tracks what's covered, what's delegated to external skills, and what's still missing |
| \`\${CLAUDE_SKILL_DIR}[[/references/platforms/]]\` | Per-platform playbooks — read the ones you're distilling into. Each playbook's "Plan shape" section shows the exact Markdown structure for that platform's plan. Files: \`linkedin.md\`, \`instagram.md\`, \`facebook.md\`, \`tiktok.md\`, \`x.md\`, \`blog.md\`, \`deck.md\` |
| \`\${CLAUDE_SKILL_DIR}[[/references/external-skills.md]]\` | Soft-dependency integration: marketingskills, claude-blog, claude-seo, banana-claude — when to use, install instructions, detection patterns |
| \`\${CLAUDE_SKILL_DIR}[[/references/promote-template.md]]\` | Promote a My Work project into a built-in Gallery template |

---

## Server API — overview

The full reference lives in \`\${CLAUDE_SKILL_DIR}[[/references/server-api.md]]\`. Read it on
demand. The endpoints agents use most frequently:

| Route | Purpose |
|-------|---------|
| \`GET /api/state\` | Orient before every action — returns mode, contentId, activeFilePath, activeCard, brief, activeBrand |
| \`POST /api/create-project\` | Start a new project — body \`{name, type}\`, \`type\` required (\`social\`\\|\`slides\`\\|\`document\`) |
| \`POST /api/active-brand\` | Set or clear the active brand |
| \`POST /api/validate-card\` | Box Layout validator (Layer 1 primitive) |
| \`GET /api/active-element\` | Read what the user most recently clicked in the preview |
| \`POST /api/persist-style\` | Persist a style edit to the card source file |
| \`POST /api/anchor/revise\` | Bump anchor revision, mark stale variants |
| \`POST /api/anchor/approve\` | Record anchor approval timestamp |

Field names use camelCase throughout (\`activeFilePath\`, \`derivedFromRevision\`,
\`activeSessionDir\`). Older references may show snake_case — camelCase is authoritative.

---

## URL-pinned tab state — overview

Tab state is fully addressable by URL. Every reload lands on the same project, file, and
card. The agent can construct a URL and send it to the user for deep-linking. Full schema
in \`\${CLAUDE_SKILL_DIR}[[/references/url-pinning.md]]\`.

Query params: \`kind\` (\`template\`\\|\`session\`), \`id\` (stable content id), \`file\`
(content file basename), \`card\` (index, 0-based).

Example: \`http://localhost:PORT/?kind=session&id=my-campaign-oct&file=social.html&card=0\`

---

## App UI — overview

Sidebar controls format / handle / zoom / logo / files / export. Main area has **Preview**
(scrollable card strip, arrow-key navigation) and **Gallery** (5 filters: All / Social /
Slides / Document / My Work). Full layout in \`\${CLAUDE_SKILL_DIR}[[/references/app-ui.md]]\`.

---

## Persisting element-level edits

The robust edit flow for element styling:

1. **Read the selection — check multi first, then single.** Call
   \`GET /api/active-elements\` first. If \`count > 0\`, the user is in
   multi-selection mode (orange overlays) — work off \`selections[]\`.
   Only if \`count === 0\` fall back to \`GET /api/active-element\` (blue
   overlay). The two modes are mutually exclusive at the client: a
   plain click clears the orange set, a Cmd/Ctrl+click clears the blue
   single selection. Each response includes a \`context\` field carrying
   \`{kind, id, name, file, sessionDir?, templateId?, cardIndex, readOnly}\`
   captured by the iframe that hosted the click.

   **If \`GET /api/active-element\` returns \`null\` AND
   \`/api/active-elements\` returns \`count: 0\`**, no element has been
   clicked — the user may have navigated to the card (updating
   \`/api/state.activeCard\`) but not clicked inside it. Ask the user
   to click inside the card preview iframe (not the sidebar, not the
   card border, not the preview-strip thumbnail) on the exact element
   they want to target. Cross-check with \`GET /api/inspect-events\` —
   if that is also empty, the inspector client has not received any
   clicks in this session yet.
2. **If \`context.readOnly\` is \`true\`**, the selection came from a built-in template.
   Call \`POST /api/clone-template-to-session\` with \`{templateId: context.templateId}\`
   to create an editable copy in My Work. Load the new session via
   \`?kind=session&id=<newId>&file=<basename>\`, ask the user to re-click the element,
   then retry \`persist-style\`. The 409 response from \`persist-style\` also includes a
   ready-to-use \`cloneSuggestion\` payload.
3. **Persist to source.** Call \`POST /api/persist-style\` with \`{targetSelector, patches}\`.
   The server reads context from the selection (no project/file needed in the body). It
   writes a stable \`data-cf-id\` into the card HTML and upserts a CSS rule inside a
   bounded \`/* === cf:user-edits === */\` region of the card's \`<style>\` block. Returns
   \`409\` with \`{templateId, suggestion}\` if context is read-only.
4. **(Optional) Live preview.** Call \`POST /api/eval\` for instant visual feedback without
   waiting for the iframe to rebuild. The persisted source still takes effect on the next
   render cycle.

Persisted edits survive reloads, card regeneration, and exports. They are byte-additive:
everything outside the user-edits region is untouched. Revert with
\`DELETE /api/persist-style?cfId=<id>&project=<sessionDir>&file=<basename>\`.

---

## Validation — Box Layout Theory enforcement

Content Factory vendors the box-validator rule engine. Five layers are all **on by default**,
each toggleable via \`POST /api/validation-config/toggle\`:

- **L1** \`/api/validate-card\` primitive
- **L2** score badges on preview cards
- **L3** agent discipline (validate after each \`persist-style\`)
- **L4** export preflight
- **L5** session-status gate

**Defaults:** slides and documents strict at ≥ 0.9; social cards lenient at ≥ 0.8.

If Playwright is not installed, \`GET /api/validator-health\` reports \`degraded: true\` and
all layers silently pass. Install with:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/setup-validation.sh]]
\`\`\`

**Agent workflow (Layer 3):** after every \`persist-style\` write, check
\`GET /api/validation-config\` — if \`enabled === false\` or \`layers.agentDiscipline === false\`,
skip. Otherwise call \`POST /api/validate-card {project, file, cardIndex}\`. If \`pass: false\`,
read \`violations[].fix\`, apply fixes via more \`persist-style\` calls, re-validate, iterate
up to \`config.iterateLimit\` (default 3), then report remaining violations and stop.

---

## Template Library

Built-in templates are standalone HTML files in \`generators/templates/\`. Each file must
include a \`<meta name="codi:template">\` tag:

\`\`\`json
{"id":"<kebab-id>","name":"<Human Name>","type":"<social|slides|document>","format":{"w":<w>,"h":<h>}}
\`\`\`

When the user clicks a template in the Gallery, the app fetches and parses the HTML, loads
all \`social-card\` / \`slide\` / \`doc-page\` elements into Preview, and saves the selection
to \`state_dir/preset.json\`.

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

**If \`curl <url>/api/state\` fails but the log shows \`server-started\`:**

- Read \`<workspace_dir>/_server.log\` first — a real crash has a stack trace. No stack trace = the server is fine and the failure is on your side.
- **Codex agents:** \`curl: (7) Failed to connect\` against localhost while the log shows a healthy start means your workspace-write sandbox is blocking outbound loopback. The project \`.codex/config.toml\` grants \`sandbox_workspace_write.network_access = true\`, but the setting only takes effect on a fresh Codex session. Ask the user to restart Codex — do NOT patch the server, the watchers, or any file under \`.agents/skills/\`.
- Scripts under \`[[/scripts/]]\` are generated. Editing \`.agents/skills/\`, \`.claude/skills/\`, \`.cursor/skills/\`, or any other installed copy is lost on the next \`codi generate\`. If a fix is genuinely needed, report via \`codi contribute\` so the change lands in \`src/templates/\`.

### Step 1b — Create a project (when generating new content)

Before writing any files, create a named project. **The \`type\` field is required.** Valid
types: \`social\`, \`slides\`, \`document\`. The server rejects anything else with HTTP 400.

\`\`\`bash
curl -s -X POST <url>/api/create-project \\
  -H "Content-Type: application/json" \\
  -d '{"name": "acme-social-campaign", "type": "social"}'
\`\`\`

Response: \`{ok, projectDir, contentDir, stateDir, exportsDir}\`. Save \`contentDir\` — this
is where you write HTML files. The project is now active.

**Skip Step 1b** when the user opens an existing My Work project from the gallery — the
server activates the project automatically when the user clicks it.

### Step 1c — Content methodology

Read \`\${CLAUDE_SKILL_DIR}[[/references/methodology.md]]\` before any non-trivial content
request. It covers the anchor-first flow, the fast-path for one-off requests, quality gates,
and the principles you apply with judgment. You are framed as a senior content strategist +
designer — the methodology gives you principles and tools, not a script.

**The agent never decides the workflow path silently.** The default is the full
anchor-first workflow (Discovery → Master Anchor → Plans → Render). Fast-path
runs only when the user explicitly authorizes it in Step 1 below. Intent
signals inform the conversation with the user — they do not authorize the
agent to skip steps on its own.

High-level shape:

1. **Read the request, then present the workflow choice to the user.** Never
   pick anchor-first vs. fast-path unilaterally, even when the request looks
   trivially one-off. Present these three options verbatim at the start of
   every new content request:

   > "I can run this two ways:
   > (A) **Default — full workflow.** Discovery intake → master anchor
   >     document → per-variant plans → render. Best for multi-format
   >     campaigns, substantive topics, or anything you'll iterate on.
   > (B) **Fast-path — single artifact.** Skip intake and anchor; go straight
   >     to one rendered file. Best for one-off quick requests.
   > (C) **You choose for me.** I'll read the signals in your request and
   >     pick A or B, then confirm with you before proceeding.
   > Which? (Default is A.)"

   Only proceed past this prompt after the user picks A, B, or C. If the user
   picks C, classify per
   \`\${CLAUDE_SKILL_DIR}[[/references/intent-detection.md]]\`, state your pick
   and the signals behind it, and wait for explicit user confirmation before
   running Step 2 (for A) or Step 8 (for B).
2. **Campaign intake — always ask which platforms.** Runs only after the user
   has confirmed option A (directly or via option C resolved to A). Present
   the platform checklist before authoring: LinkedIn (carousel, post) ·
   Instagram (feed, story, reel cover) · Facebook (post, story, reel) · TikTok (cover) ·
   X/Twitter (card/thread) · blog · slide deck. Also ask: topic, audience, voice, CTA,
   anchor \`length_class\` (default \`standard\`). Persist to \`brief.json\` via \`POST /api/brief\`.
3. **Author the anchor in Markdown.** Write \`content/00-anchor.md\`. The anchor is
   Markdown — not HTML. Read \`\${CLAUDE_SKILL_DIR}[[/references/anchor-authoring.md]]\`
   for frontmatter, length classes, and structure. Iterate until approved; call
   \`POST /api/anchor/approve\`.
4. **Plan each requested variant in Markdown.** For every platform the user selected
   in step 2, write a plan file (Markdown, NOT HTML) at
   \`content/<platform>/<variant>.md\`. The plan is prose — slide-by-slide breakdown,
   copy drafts, caption, hashtags, visual direction. Read
   \`\${CLAUDE_SKILL_DIR}[[/references/plan-authoring.md]]\` for the contract + the
   platform playbook for per-platform quirks. No HTML exists yet at this stage.
5. **HARD GATE — user approves each plan before any HTML renders.** Present each
   plan. Iterate on the prose. Render the matching \`.html\` ONLY after the user
   explicitly says yes / approved / render it for that specific plan. Silence is
   not approval. Partial edits are continued iteration, not approval.
6. **Render approved plans into HTML.** Once a plan is approved, generate
   \`content/<platform>/<variant>.html\` from the same-basename \`.md\`. Tag the HTML
   with \`<meta name="codi:variant" content='{"derivedFromRevision":N,"sourceAnchor":"00-anchor.md","planSource":"<platform>/<variant>.md",...}'>\`.
7. **Revisions.** When the anchor changes substantively, call \`POST /api/anchor/revise\`.
   Plans AND rendered HTML both become stale. At the start of the next iteration,
   surface staleness; let the user choose what to re-plan and re-render. Never
   auto-propagate.
8. **Fast-path.** Runs only when the user explicitly selected option B in
   Step 1 (directly, or via option C resolved to B with user confirmation).
   Never enter fast-path based on inferred signals alone — phrases like
   "quick", "just", "one tweet" hint at fast-path but do not authorize the
   skip. Once the user has authorized fast-path, plan the single variant in
   Markdown, get plan approval, then render. No \`brief.json\`.

**Folder contract** (enforced by the scanner + workspace scaffolder):

| Path | Content |
|------|---------|
| \`content/00-anchor.md\` | Markdown anchor — always at content/ root, always \`.md\` |
| \`content/linkedin/\` | LinkedIn variants (\`carousel.html\`, \`post.html\`) |
| \`content/instagram/\` | Instagram variants (\`feed.html\`, \`story.html\`, \`reel-cover.html\`) |
| \`content/facebook/\` | Facebook variants (\`post.html\`, \`story.html\`, \`reel.html\`) |
| \`content/tiktok/\` | TikTok (\`cover.html\`) |
| \`content/x/\` | X/Twitter (\`card.html\`) |
| \`content/blog/\` | Blog post (\`post.html\`) |
| \`content/deck/\` | Slide deck (\`slides.html\`) |

**External skills — soft dependencies.** See
\`\${CLAUDE_SKILL_DIR}[[/references/external-skills.md]]\`. Probe for
\`marketingskills\`, \`claude-blog\`, \`claude-seo\`, and \`banana-claude\` at the start of
every anchor-first session. If present, invoke relevant slash commands during intake
(/content-strategy, /marketing-psychology), anchor authoring (/blog outline,
/blog write, /blog factcheck, /seo content), and distillation (/social-content,
/copy-editing, /banana generate for hero images). If absent, inline-generate with
lower fidelity and tell the user once which installs would upgrade quality — never
auto-install, never block the workflow.

### Step 1d — Detect and apply a brand (optional)

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/brand-integration.md]]\`

After creating a project, query \`GET /api/brands\` to discover installed brand skills. If
any exist and the user has not specified one, ask whether to apply it. If the user confirms,
\`POST /api/active-brand\` with \`{name}\`, then apply the brand end-to-end (tokens, fonts,
logo, voice) using the full procedure in the reference file.

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
  "activeFilePath": "/abs/path/.codi_output/acme-campaign/content/social.html",
  "activeFile": "social.html", "activeSessionDir": "/abs/path/.codi_output/acme-campaign",
  "status": "in-progress", "preset": null }

// Nothing selected
{ "mode": null, "contentId": null, "activeFilePath": null, ... }
\`\`\`

**Use \`contentId\` as the anchor — not the template name.** \`contentId\` is a hash of
\`activeFilePath\` and is always unique. If unsure which item is open, re-read \`/api/state\`
and confirm \`contentId\` matches what the user is looking at.

**Use \`activeFilePath\` for all file edits.** Never reconstruct the path from name fragments.

| \`mode\` | Meaning | What to do |
|--------|---------|------------|
| \`"template"\` | User opened a **Gallery template** | Step 1b + Step 3: create a project, generate content styled after that template |
| \`"mywork"\` | User opened a **My Work project** | Step 4b: edit \`activeFilePath\` in place |
| \`null\` | Nothing selected yet | Tell the user to pick a template or a My Work project |

**Template mode** means the user is looking at a read-only built-in template as a style
reference. Your job is to create a new project (Step 1b) and generate a new HTML file in
\`contentDir\` that follows that template's visual identity — colors, typography, layout —
but with the user's content.

**My Work mode** means the user is looking at content they already created. Edit the
existing HTML file at \`activeFilePath\` in place.

### Step 3 — Generate content (Template mode)

After creating a project (Step 1b), write \`<contentDir>/social.html\` (or \`slides.html\` /
\`document.html\`). The app detects the new file via WebSocket and adds it to the Content
Files list.

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
       If the brand has local fonts, generate @font-face blocks using
       http://localhost:PORT/api/brand/<name>/assets/fonts/<file>.woff2 URLs.
       If no brand is active, use the default: -->
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    /* If brand is active: paste full content of brand/tokens.css here (inline — not <link>) */
    /* Then @font-face blocks for local fonts */
    /* Then card-specific styles */
  </style>
</head>
<body>
  <article class="social-card" data-type="cover" data-index="01"><!-- slide HTML --></article>
  <article class="social-card" data-type="content" data-index="02"><!-- slide HTML --></article>
  <article class="social-card" data-type="cta" data-index="03"><!-- slide HTML --></article>
</body>
</html>
\`\`\`

#### Content identity — REQUIRED

Every generated HTML file MUST include a \`<meta name="codi:template">\` tag and a \`<title>\`
in \`<head>\`:

\`\`\`json
{"id":"<kebab-case-id>","name":"<Human Readable Name>","type":"<social|slides|document>","format":{"w":<w>,"h":<h>}}
\`\`\`

- \`type\` must match: \`social\` for cards, \`slides\` for decks, \`document\` for A4 pages
- \`format\` must match the active format button dimensions
- \`name\` describes the content topic, not the template (e.g. "AI Agents Series", not "Dark Editorial")

#### Card rules

- Element selectors scanned by the app:
  - \`class="social-card"\` — social media cards (1:1, 4:5, 9:16, OG)
  - \`class="slide"\` — slide deck pages (16:9)
  - \`class="doc-page"\` — document pages (A4)
- Required attributes: \`data-type\` (cover / content / stat / quote / cta / title / closing) and \`data-index\` (zero-padded: 01, 02, ...)
- Dimensions come from the active format button, not the HTML itself
- Replace \`@handle\` with the user's actual handle
- All CSS goes in \`<style>\` — the app extracts styles per card and renders each in its own iframe
- Rewrite the whole file to update — the WebSocket watcher broadcasts a reload on every change

#### Clipping rules — MANDATORY

Full rules: \`\${CLAUDE_SKILL_DIR}[[/references/html-clipping.md]]\`

- Social cards and slides: \`overflow: hidden\` on export — content beyond the canvas is
  clipped in the final PNG/PDF/PPTX. In preview the factory relaxes this so you can
  see overflow visually (and the validator can measure it).
- Document pages (\`.doc-page\`): \`overflow: visible\` — content grows vertically. Never
  use \`overflow: hidden\` on \`.code-block\`, \`pre\`, or \`table\`
- Tables inside \`.doc-page\`: the flex-column wrapper MUST have \`width: 100%\` — without
  it, \`width: 100%\` on a child table resolves against an indefinite width and columns collapse

#### Canvas-fit validation — part of the standard validate-before-done loop

Full protocol: \`\${CLAUDE_SKILL_DIR}[[/references/content-fit.md]]\`

Canvas overflow is emitted as **R11 "Canvas Fit"** by the same
\`/api/validate-cards\` endpoint that runs R1–R10. There is no separate
state file to read, no parallel notification channel. The agent's normal
validate-before-done loop catches overflow automatically.

For every R11 violation in \`violations[]\`:

- \`remediation: "paginate"\` (documents, overflow > 15%) — add a new
  \`.doc-page\` sibling inside \`.doc-container\`, move overflow content into
  it, preserve header/footer on every page
- \`remediation: "split"\` (slides, overflow > 15%) — cut the offending slide
  at the next \`h2\`/\`hr\` boundary
- \`remediation: "tighten"\` (small overflow, or any social card) — reduce
  padding, condense copy, or drop one line-height / font-size notch

The \`fix\` field is prefixed with the remediation name and includes the
exact overflow numbers — patch the HTML and re-validate until \`valid: true\`.

#### Document template conventions — DOCX export

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/docx-export.md]]\`

- Standard HTML tags (\`h1\`–\`h3\`, \`p\`, \`ul\`/\`ol\`, \`strong\`, \`em\`, \`code\`) map
  automatically to DOCX paragraph styles
- Use \`.page-header\`, \`.page-footer\`, \`.callout\`, \`.eyebrow\` for page chrome
- Use \`<table class="data-table">\` with \`table-layout: fixed\` in CSS
- Use \`<div class="code-block">\` for syntax-highlighted code — exported as Playwright
  screenshot PNG; \`overflow: visible\` required
- Use \`<div class="diagram-wrap"><svg ...>\` — SVG must be a **direct child** of the wrapper
- \`.doc-page\` is \`display: flex; flex-direction: column\` — all direct children need
  \`min-width: 0\`
- Remote \`https://\` image URLs not fetched during DOCX export — use data URIs or \`file://\` paths

#### Visual density — MANDATORY for all card types

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/visual-density.md]]\`

Every card must visibly occupy **≥85% of its canvas** with purposeful content. Mentally
draw a 3×3 grid over each card — at least 7 of 9 cells must contain content or a purposeful
decorative element. If 3+ cells are empty, add content from the fill techniques list in the
reference.

#### Design system — MANDATORY for all slides

Read \`\${CLAUDE_SKILL_DIR}[[/references/design-system.md]]\` before authoring any slide.
The reference holds the 13 design rules, full CSS patterns, before/after examples, and
verification scripts. Every slide must pass every rule before shipping.

#### Slide deck generation — single-file authoring (MANDATORY)

Read \`\${CLAUDE_SKILL_DIR}[[/references/slide-deck-engine.md]]\` before authoring any deck.
The brief is the single source of truth for the structural contract (per-slide isolation,
canvas size, document shape), motion principles, and anti-patterns.

Every deck is one self-contained HTML file authored from scratch. No sibling \`deck.css\`
/ \`deck.js\`. No external refs except Google Fonts. The HTML export downloads the source
byte-for-byte.

#### Document page discipline — MANDATORY

Read \`\${CLAUDE_SKILL_DIR}[[/references/docx-export.md]]\` for the full rules on
\`.doc-page\` canvas (794×1123 fixed), per-page structure
(\`.page-header\` + \`.page-body\` + \`.page-footer\`), content height budget (~950px usable),
page-split checklist, and DOCX mapping.

### Step 3b — Validate layout structure

After writing any HTML file, validate every card via the vendored Box Layout validator before
showing anything to the user:

\`\`\`bash
curl -s -X POST <url>/api/validate-card \\
  -H "Content-Type: application/json" \\
  -d '{"project":"<sessionDir>","file":"<basename>","cardIndex":0}'
\`\`\`

If \`pass: false\`, read \`violations[].fix\`, patch the HTML, and re-validate. Iterate up
to 3 times (\`config.iterateLimit\`), then report remaining violations and stop. Only show
the user the final validated result.

For batch validation across all cards in a file, use
\`GET /api/validate-cards?project=<sessionDir>&file=<basename>\`.

### Step 4 — Iterate (loop until done)

Content creation is a back-and-forth process. This step repeats until the user is satisfied.

#### Campaign propagation check — run FIRST when a brief exists

Before applying any new feedback, if the project has a brief, read it and check whether
the anchor has drifted ahead of any variants:

\`\`\`bash
curl -s <url>/api/distill-status
\`\`\`

If \`stale\` is non-empty, ask the user before processing new feedback — which variants
to re-distill, which to mark \`manual\`. See methodology.md §6 for the full re-distill
semantics. If no brief exists, skip this check entirely.

**When the current edit IS an anchor edit**, call \`POST /api/anchor/revise\` after writing
the file. This is what makes the next invocation's propagation check fire.

**The loop:**

1. User opens the Preview tab and reviews the rendered cards
2. User gives feedback in chat: "change the headline on slide 2", "make the background darker"
3. Agent reads \`/api/state\` to confirm what the user has open
4. Agent fetches the current HTML, applies the changes, rewrites the file
5. App reloads in under 200ms — user sees the update immediately
6. Repeat from step 1

**Do not ask the user to reload the page** — the WebSocket handles it.

#### Targeted card edits — "this slide", "this page", "update this"

When the user says "change **this** slide", "fix **this** page", or gives feedback without
naming a specific slide number, they are referring to the card currently highlighted in
Preview. The app posts the selected card to \`/api/active-card\` automatically.

**Resolution rule — use \`dataIdx\` first, then \`dataType\`, then \`index\` as fallback.**
\`dataIdx\` is the stable identifier baked into the HTML; \`index\` shifts when cards are
added or removed.

**Workflow:**

1. Read \`/api/state\`, confirm \`activeCard\` matches what the user is looking at
2. Read the file at \`activeFilePath\`, locate the element whose \`data-index\` matches
   \`activeCard.dataIdx\`
3. Edit only that element. Preserve \`data-type\` and \`data-index\` unless asked to change them
4. Rewrite the whole file (the watcher needs a file write to trigger reload)
5. Confirm to the user which card changed: "Updated slide 3 of 7 (stat card) — new value is 42%"

**If \`activeCard\` is \`null\`**, ask the user to click the card they want to change, then
re-read \`/api/state\`.

**Ambiguity guard:** if the user names a slide explicitly ("change slide 5"), trust the
number — do NOT silently remap it to \`activeCard\`. Only use \`activeCard\` for deictic
language ("this", "here", "the one I'm on").

### Step 4b — Edit a My Work project

When \`mode\` is \`"mywork"\` in \`/api/state\`:

1. **Read state.** \`activeFilePath\` is the absolute path to edit
2. **Read the current HTML** from disk
3. **Edit and rewrite** \`activeFilePath\` directly
4. **Do not create a new file** — this is an edit of the user's existing work. Preserve all
   slides they did not ask to change

Never reconstruct the path from name fragments — always use \`activeFilePath\` verbatim.

### Step 4c — Modify a built-in template

When \`mode\` is \`"template"\` in \`/api/state\`:

1. **Read state.** \`activeFilePath\` is the absolute path to the template file
2. **Edit \`activeFilePath\` in place** — change CSS, copy, colors, structure. The server's
   template watcher fires within 150ms and broadcasts \`reload-templates\`
3. **Also edit the source** so the change persists across \`codi generate\`:

   \`\`\`
   \${CLAUDE_SKILL_DIR}/generators/templates/<name>.html   (installed copy)
   src/templates/skills/content-factory/generators/templates/<name>.html  (self-dev only — Codi repo)
   \`\`\`

   The \`src/templates/\` path only exists when working on the Codi source
   repo itself; skip it in consumer projects.

Editing a template changes it for all future sessions. If the user only wants a one-off
variation without touching the original, generate a new content file (Step 3) and use the
template as a style reference only.

### Step 4d — Promote a My Work project to a built-in template

Full reference: \`\${CLAUDE_SKILL_DIR}[[/references/promote-template.md]]\`

**Trigger phrases:** "save this as a template", "add this to my presets", "make this
reusable", "add my project from .codi_output as a new template".

Read the reference for the full 8-step workflow (read state → verify doc conventions →
confirm name → copy to both installed and source paths → update meta → verify in Gallery →
log feedback → optional upstream contribution).

**Do not run \`codi generate\`** unless the user explicitly asks — copying the source file
is sufficient.

### Step 5 — Export and stop

Export happens in the browser via the sidebar buttons. When done:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]] <workspace_dir>
\`\`\`

Summarize: workspace path, project name, number of slides, format, and where exports were saved.
`;
