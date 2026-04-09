import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  RL3 AI Agency brand content studio. Use when creating any branded deliverable for RL3 —
  presentations, documents, social content, reports, or any HTML/PDF/PPTX/DOCX
  output that must carry RL3 brand identity. Also activate when the user mentions
  'RL3', 'marca RL3', 'estilo RL3', or asks for RL3-branded output of any kind.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
version: 21
---

# {{name}} — RL3 Content Studio

## When to Activate

- User asks to create any content for RL3 (slides, deck, presentation, document,
  report, one-pager, social post, carousel, blog, proposal)
- User mentions 'RL3', 'marca RL3', or any RL3-related keyword
- User needs a deliverable that carries RL3 visual identity or voice

---

## Asset Map

Read these files BEFORE generating any output.

| File | Read when | Purpose |
|------|-----------|---------|
| \`\${CLAUDE_SKILL_DIR}[[/brand/tokens.json]]\` | Always | Colors, fonts, layout, voice rules |
| \`\${CLAUDE_SKILL_DIR}[[/brand/tokens.css]]\` | HTML generation | CSS custom properties to inline |
| \`\${CLAUDE_SKILL_DIR}[[/brand/tokens.ts]]\` | PPTX/DOCX generation | Typed brand values adapter |
| \`\${CLAUDE_SKILL_DIR}[[/references/brand-standard.md]]\` | Always | Usage rules, prohibited patterns, tone |
| \`\${CLAUDE_SKILL_DIR}[[/assets/rl3-logo-light.svg]]\` | Dark backgrounds | RL3 logo for dark theme |
| \`\${CLAUDE_SKILL_DIR}[[/assets/rl3-logo-dark.svg]]\` | Light backgrounds | RL3 logo for light theme |
| \`\${CLAUDE_SKILL_DIR}[[/generators/slides-base.html]]\` | Slide output | 16:9 slide HTML structure |
| \`\${CLAUDE_SKILL_DIR}[[/generators/document-base.html]]\` | Doc output | A4 document HTML structure |
| \`\${CLAUDE_SKILL_DIR}[[/generators/social-base.html]]\` | Social output | Social card HTML structure |

**NEVER read these files — they are large binaries/bundles handled by the server:**

| File | Reason |
|------|--------|
| \`scripts/vendor/html2canvas.min.js\` | ~300 KB minified bundle — server injects it automatically |
| \`scripts/preview-shell.js\` | Preview toolbar — server injects it automatically |
| \`scripts/helper.js\` | Live-reload client — server injects it automatically |

---

## Phase 1 — Discovery

**[CODING AGENT]** Read the user's message carefully BEFORE asking. Extract everything already provided.
Only ask for what is genuinely missing. Ask all missing items in ONE message.

### What to infer without asking

| Signal in user message | Infer |
|------------------------|-------|
| Mentions topic/title/bullets | Q1 answered — propose default brief (see below) |
| "slides", "deck", "presentación" | Q2 = slides |
| "document", "report", "propuesta" | Q2 = document |
| "social", "carousel", "cards" | Q2 = social |
| "all formats" / "todos los formatos" | Q3 = all; start HTML-first, add others after — no re-confirmation |
| "dark" / "oscuro" | Q4 = dark |
| "light" / "claro" | Q4 = light |
| "formal", "executive" | Q5 = formal |
| "casual", "team" | Q5 = internal/casual |

### Content brief — offer default, don't block

If the user gave a topic but no key points, **propose a default brief and ask to confirm**:
> "I'll structure the content as:
> 1. [Proposed key point 1]
> 2. [Proposed key point 2]
> 3. [Proposed key point 3]
> Does this work, or would you like to adjust it?"

**Do NOT ask an open-ended "what are your key points?" when the topic is clear.**

### Questions to ask only when missing

\`\`\`
[Ask only what is not yet known from the user's message]

Q2 — Type of output?
   □ Slides / presentation (16:9)
   □ Document / report / proposal (A4)
   □ Social content (carousel, cards)

Q3 — Output format(s)?  [Skip if user said "all formats" — start HTML-first by default]
   □ HTML  (browser preview + file)
   □ PDF   (print-ready)
   □ PPTX  (editable PowerPoint)
   □ DOCX  (editable Word)
   □ PNG   (per-slide images — always available via toolbar)

Q4 — Theme?
   □ Dark  (Near-black #0a0a0b background, white text, Gold #c8b88a accent — RL3 default)
   □ Light (Off-white #f5f5f5 background, dark text, Gold accent)

Q5 — Audience and tone?
   (e.g. "executive board, formal" / "internal team, casual" / "client pitch, persuasive")

Q6 — Logo placement? (optional — skip to use defaults)
   Show:     □ Yes (default)   □ No
   Position: □ bottom-right (default)   □ bottom-left   □ bottom-center
             □ top-right                □ top-left
   Size:     □ small (32 px)   □ medium (48 px, default)   □ large (64 px)
\`\`\`

**Do not proceed until Q2, Q4, and Q5 are answered** (Q3 and Q6 have usable defaults).

> **Workflow routing** — decide before Phase 2:
> - User wants **HTML output** or wants to **visually iterate**: follow full workflow (Phase 2 → 8)
> - User wants **only PPTX / DOCX / PDF** and does NOT need visual iteration: skip Phase 3–5,
>   go Phase 2 → 6 → 7 → 8 (no server needed — generate final HTML once, export immediately)

---

## Phase 2 — Brand Context Loading

Read \`tokens.json\` and \`brand-standard.md\` per the Asset Map. Build this mental model:

- **Dark theme**: bg #0a0a0b, surface #1a1a1b, text #fff, accent/primary #c8b88a
- **Light theme**: bg #f5f5f5, surface #fff, text #0a0a0b, accent/primary #c8b88a
- **Fonts**: Space Grotesk (headings), Instrument Sans (body) — loaded from Google Fonts
- **Voice**: use "Observar · Actuar · Iterar", "Cada iteración nos acerca al resultado óptimo" — avoid "Disruptivo", "Cutting-edge"
- **Logo dark bg**: read SVG from \`\${CLAUDE_SKILL_DIR}[[/assets/rl3-logo-light.svg]]\`
- **Logo light bg**: read SVG from \`\${CLAUDE_SKILL_DIR}[[/assets/rl3-logo-dark.svg]]\`

---

## Phase 3 — Start Preview Server

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]] --project-dir $(pwd) --name rl3-brand
\`\`\`

Output (save all five values):
\`\`\`json
{ "url": "http://localhost:49XXX", "session_dir": "...", "screen_dir": "...", "state_dir": "...", "exports_dir": "..." }
\`\`\`

Session files are stored under \`.codi_output/YYYYMMDD_HHMM_rl3-brand/\` in the project root.
This directory persists after the server stops — each run creates a new timestamped folder.

Tell the user:
> "Preview server is running at {{url}}. Open it in your browser.
> I'll write prototype files there as we iterate."

---

## Phase 4 — HTML Prototype Generation

### Rules for ALL HTML outputs

> **Plug-and-play:** The preview server automatically injects html2canvas, preview-shell,
> and the live-reload helper into every HTML file it serves. Write **clean HTML only** —
> no need to inline any scripts. The server handles the full preview experience.

1. Read the base template from \`generators/\` matching the content type
2. **Inline brand CSS** — paste full contents of \`brand/tokens.css\` into a \`<style>\` block.
   Replace \`SKILL_FONTS_DIR\` with the absolute path to the \`assets/fonts\` directory inside
   the folder containing this SKILL.md file (e.g. \`\${CLAUDE_SKILL_DIR}/assets/fonts\`).
   Replace \`SKILL_ASSETS_DIR\` with the absolute path to the \`assets\` directory inside
   the folder containing this SKILL.md file (e.g. \`\${CLAUDE_SKILL_DIR}/assets\`).
   Add Google Fonts link for Space Grotesk + Instrument Sans.
3. Write to \`screen_dir/prototype.html\`

The server watches \`screen_dir\` and reloads the browser on every write.
When multiple files exist, a file picker appears in the toolbar automatically.

### Slide output (16:9)

**CRITICAL — copy these CSS rules verbatim from \`generators/slides-base.html\`. Do NOT change them:**

\`\`\`css
/* These rules control visibility — changing them causes ALL slides to render simultaneously.
   min() approach: self-contained, works with the preview-shell fixed toolbar overlay. */
html, body { overflow: hidden; background: #ccc; }
.deck { display: flex; align-items: center; justify-content: center; background: #ccc; }
.deck__viewport {
  position: relative;
  width: min(100vw, calc(100vh * 16 / 9));
  height: min(100vh, calc(100vw * 9 / 16));
  overflow: hidden;
}
.slide { display: none; position: absolute; inset: 0; }   /* hidden by default */
.slide.active { display: flex; flex-direction: column; }  /* only active slide shows */
\`\`\`

**CRITICAL — copy the deck engine \`<script>\` verbatim from \`generators/slides-base.html\`** (arrow-key + click navigation, \`show(0)\` on load). This script is what makes slides advance.

- Responsive 16:9 letterbox viewport — fills browser window while maintaining aspect ratio
- Safe zone: \`var(--slide-pad)\` padding (default 36px) all sides
- Use CSS vars: \`var(--brand-bg)\`, \`var(--brand-text)\`, \`var(--brand-accent)\`, etc.
- Required \`data-type\` values: \`title\`, \`divider\`, \`content\`, \`quote\`, \`metrics\`, \`table\`, \`closing\`
- Required \`data-index\` values: \`01\`, \`02\`, \`03\`… (zero-padded) — drives PNG export filenames (\`slide-01-title.png\`)
- Every \`.slide\` must have **both** attributes: \`<section class="slide" data-type="title" data-index="01">\`

**Logo placement** — apply the choices from Phase 1 Q6. Set these CSS variables in \`:root\`:

\`\`\`css
:root {
  --logo-size: 48px;   /* small=32px, medium=48px (default), large=64px */
  --slide-pad: 36px;
}
\`\`\`

Place the logo element inside every \`.slide\` as \`position: absolute\` using these offsets:

| Position | CSS |
|----------|-----|
| bottom-right (default) | \`bottom: var(--slide-pad); right: var(--slide-pad);\` |
| bottom-left | \`bottom: var(--slide-pad); left: var(--slide-pad);\` |
| bottom-center | \`bottom: var(--slide-pad); left: 50%; transform: translateX(-50%);\` |
| top-right | \`top: var(--slide-pad); right: var(--slide-pad);\` |
| top-left | \`top: var(--slide-pad); left: var(--slide-pad);\` |

Logo element (dark theme): \`<img src="/files/rl3-logo-light.svg" class="slide__logo" data-role="brand-logo" alt="RL3">\`
Logo element (light theme): \`<img src="/files/rl3-logo-dark.svg" class="slide__logo" data-role="brand-logo" alt="RL3">\`
Logo CSS: \`height: var(--logo-size); width: auto; position: absolute; opacity: 0.9;\`
**REQUIRED**: every logo element across ALL output types (slides, document, social) MUST carry \`data-role="brand-logo"\`.
This attribute is what the preview toolbar uses to find and control logos — wrong or missing attribute means the controls stop working.
If user chose **No logo**: omit the logo element entirely (do NOT render a hidden element).

**Prototype scope (Phase 4 only):** 3 slides — title, one content, closing.
Full deck comes in Phase 6.

### Document output (A4)

- 794px wide × min 1123px tall per \`.doc-page\`
- Vertical scroll — pages stack
- Brand header (logo + color bar) + footer (page number) on each page
- Logo in header: \`<img src="/files/rl3-logo-light.svg" class="doc__logo" data-role="brand-logo" alt="RL3" style="height:40px;width:auto">\` — never smaller than 40px

### Social output (default 1:1)

- 1080×1080px per \`.social-card\`
- Cards stack vertically for scrolling preview
- Toolbar allows aspect ratio switching (1:1, 4:5, 9:16, 1200×630)
- Logo per card: \`<img src="/files/rl3-logo-light.svg" class="card-logo" data-role="brand-logo" alt="RL3">\`, apply Q6 placement; use \`height: var(--logo-size, 48px); width: auto\` — never smaller than 40px

---

## PNG Downloads — Always Available

The preview server injects the preview-shell toolbar into every HTML file it serves.
- **Per item**: hover → "Export PNG" button appears on each slide / page / card
- **All at once**: "Export All PNGs" in toolbar → downloads a ZIP file
- Resolution: 2× display size (1920×1080 for 16:9 slides)
- Naming: \`slide-01-title.png\`, \`slide-02-content.png\`, etc. (requires \`data-index\` + \`data-type\`)

---

## Phase 5 — Visual Iteration Loop

After writing the prototype, tell the user:
> "Prototype is ready at {{url}}. The toolbar lets you:
> - Export any slide as PNG — hover a slide and click 'Export PNG'
> - Click 'Export All PNGs' in the toolbar to download all slides as a ZIP
>
> Describe your feedback here when ready."

**End your turn and wait.**

### Reading feedback on your next turn

Read the user's reply in the conversation — they will describe what to change.

Apply feedback and rewrite \`screen_dir/prototype.html\`.
Max 3 iteration rounds. After round 3, ask the user to approve a direction before proceeding.

---

## Phase 6 — Full Content Generation

Generate all slides/pages using the approved style.

- Slides → write to \`screen_dir/deck.html\`
- Document → \`screen_dir/document.html\`
- Social → \`screen_dir/social.html\`

Tell the user:
> "Full [deck/document/carousel] ready at {{url}} — [N] slides/pages.
> Export PNGs from the toolbar anytime. Ready to generate [FORMAT]?"

---

## Phase 7 — Export

All exports are saved to \`exports_dir\` (the \`exports/\` folder inside the session directory).

> **Substitution reminder**: \`screen_dir\` and \`exports_dir\` are the actual paths saved from
> Phase 3 output — substitute them with those values. The source HTML filename depends on
> content type: slides → \`deck.html\`, document → \`document.html\`, social → \`social.html\`.

### PDF
\`\`\`bash
node \${CLAUDE_SKILL_DIR}[[/scripts/export/pdf.js]] \\
  --input <screen_dir>/<output-file>.html \\
  --output <exports_dir>/output.pdf
\`\`\`
Requires: \`npx playwright install chromium\` (once)

### PPTX
\`\`\`bash
node \${CLAUDE_SKILL_DIR}[[/scripts/export/pptx.js]] \\
  --input <screen_dir>/deck.html \\
  --tokens \${CLAUDE_SKILL_DIR}[[/brand/tokens.json]] \\
  --theme dark|light \\
  --output <exports_dir>/deck.pptx
\`\`\`
Requires: \`npm install pptxgenjs playwright\` (once per project)

The script uses Playwright + pptxgenjs internally (screenshots each slide, extracts text as editable boxes).

### DOCX
Generate a Word document using the \`docx\` npm library.
Install: \`npm install docx sharp\`
Output to: \`<exports_dir>/document.docx\`

**Logo in DOCX**: Word does not render SVG. Convert the RL3 SVG to PNG first, then embed:
\`\`\`js
const sharp = require("sharp");
const { ImageRun } = require("docx");
const logoPng = await sharp(path.join(SKILL_DIR, "assets/rl3-logo-light.svg"))
  .resize({ height: 40 }).png().toBuffer();
// Then use: new ImageRun({ data: logoPng, transformation: { width: 100, height: 40 } })
\`\`\`

### HTML
No extra work — tell the user the path: \`<screen_dir>/<output-file>.html\` (already saved).

---

## Phase 8 — Stop Server

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]] {{session_dir}}
\`\`\`

---

## RL3 — Reference Files

- Brand standard: \`\${CLAUDE_SKILL_DIR}[[/references/brand-standard.md]]\`
- Brand guide (HTML): \`\${CLAUDE_SKILL_DIR}[[/references/brandguide.html]]\`
- Brand concept (HTML): \`\${CLAUDE_SKILL_DIR}[[/references/brand-concept.html]]\`
- Services catalog: \`\${CLAUDE_SKILL_DIR}[[/references/services.md]]\`
- Ecosystem & markets: \`\${CLAUDE_SKILL_DIR}[[/references/ecosystem.md]]\`

---

## Error Handling

| Error | Recovery |
|-------|----------|
| Server fails to start | Retry: \`BRAINSTORM_PORT=XXXXX bash .../start-server.sh\` |
| Playwright not installed | Run \`npx playwright install chromium\` then retry |
| pptxgenjs not found | Run \`npm install pptxgenjs\` then retry |
| html2canvas PNG fails | Use Playwright PDF export instead |
`;
