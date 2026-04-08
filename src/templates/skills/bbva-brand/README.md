# codi-bbva-brand — BBVA Content Studio

A Codi built-in skill template that turns Claude Code into a complete BBVA brand content
studio. Given any request for BBVA-branded content, the skill runs a structured 8-phase
workflow from discovery through export.

---

## What This Skill Does

When activated, the skill:

1. **Asks five discovery questions** (content type, output format, theme, audience)
2. **Loads brand context** from `brand/tokens.json`, `brand/tokens.css`, and `references/brand-guide.md`
3. **Starts a live preview server** (brainstorming-compatible, WebSocket live-reload)
4. **Generates an HTML prototype** with BBVA brand tokens fully inlined
5. **Iterates visually** — reads feedback from the browser chat panel AND the terminal
6. **Generates the full output** (complete deck/document/carousel)
7. **Exports** to PDF, PPTX, DOCX, or HTML
8. **Stops the server** and delivers the final files

PNG downloads are always available via the preview-shell toolbar — no extra command needed.

---

## Directory Structure

```
bbva-brand/
├── template.ts                    ← TypeScript source for SKILL.md (edit this, not SKILL.md)
├── index.ts                       ← Exports template + staticDir for the Codi build system
├── README.md                      ← This file
├── brand/
│   ├── tokens.json                ← Canonical brand data: colors, fonts, layout, voice rules
│   ├── tokens.css                 ← CSS custom properties (inlined into every HTML output)
│   └── tokens.ts                  ← TypeScript adapter for PPTX/DOCX generation
├── assets/
│   ├── BBVA_RGB.svg               ← BBVA logo (used in HTML outputs)
│   ├── BBVA_RGB.png               ← Raster fallback
│   ├── fonts/                     ← BBVA brand webfonts (woff2)
│   │   ├── tiempos-headline-bold.woff2
│   │   ├── tiempos-headline-bold-italic.woff2
│   │   ├── TiemposTextWeb-Regular.woff2
│   │   ├── TiemposTextWeb-RegularItalic.woff2
│   │   ├── BentonSansBBVA-Book.woff2
│   │   ├── BentonSansBBVA-Light.woff2
│   │   ├── BentonSansBBVA-Medium.woff2
│   │   └── BentonSansBBVA-Bold.woff2
│   └── icons/                     ← 600+ BBVA brand icons (SVG)
├── generators/
│   ├── slides-base.html           ← 16:9 slide HTML shell with BBVA design system
│   ├── document-base.html         ← A4 document HTML shell
│   └── social-base.html           ← Social card HTML shell (1:1 default, switchable)
├── scripts/
│   ├── server.cjs                 ← Brainstorming-compatible WebSocket preview server
│   ├── start-server.sh            ← Session launcher — returns screen_dir, state_dir, url
│   ├── stop-server.sh             ← Session cleanup
│   ├── frame-template.html        ← Server frame for HTML fragments
│   ├── helper.js                  ← WebSocket client injected by server
│   ├── preview-shell.js           ← Chat panel + PNG download toolbar (inlined into outputs)
│   ├── vendor/
│   │   └── html2canvas.min.js     ← Client-side canvas renderer (required by preview-shell)
│   └── export/
│       ├── pdf.js                 ← Playwright → per-slide PDF export
│       └── pptx.js                ← Playwright screenshots + PptxGenJS rebuild → PPTX
├── references/
│   ├── brand-guide.md             ← Full brand rationale, color usage rules, tone of voice
│   ├── icon-catalog.md            ← Catalog of the 600+ bundled brand icons
│   ├── values-imagery.md          ← Visual values and imagery guidelines
│   ├── bbva-deck-reference.html   ← Reference deck example (rendered HTML)
│   ├── bbva-deck-reference.css    ← Reference deck styles
│   └── bbva-deck-reference.js     ← Reference deck interactions
└── evals/
    └── evals.json                 ← 10 test cases (7 positive, 3 negative)
```

---

## The 8-Phase Workflow

### Phase 1 — Discovery
The agent asks the user five questions before writing anything:
content, type (slides/doc/social), format (HTML/PDF/PPTX/DOCX/PNG), theme (dark/light), audience.

### Phase 2 — Brand Context Loading
Reads `brand/tokens.json`, `references/brand-guide.md`, and the logo SVG.
Builds an internal model of colors, fonts, and voice rules.

### Phase 3 — Start Preview Server
Runs `scripts/start-server.sh --project-dir $(pwd)`.
Returns `{ url, screen_dir, state_dir }`.
The server watches `screen_dir/` and live-reloads the browser on file changes.

### Phase 4 — HTML Prototype Generation
Generates a minimal prototype (3 slides for decks) and writes it to `screen_dir/prototype.html`.
All CSS and scripts are **inlined** — `file://` protocol blocks external `<script src>`.

Font path substitution: `SKILL_FONTS_DIR` in `brand/tokens.css` is replaced with
the absolute path `${CLAUDE_SKILL_DIR}/assets/fonts` before inlining.

### Phase 5 — Visual Iteration Loop
Reads feedback from three sources:
- Browser chat panel (`document.getElementById('cf-events')`)
- State dir events file (`state_dir/events`)
- User's terminal message

Max 3 rounds. Rewrites `screen_dir/prototype.html` on each iteration.

### Phase 6 — Full Content Generation
Generates all slides/pages using the approved style.
Writes to `screen_dir/deck.html`, `document.html`, or `social.html`.

### Phase 7 — Export

| Format | Command |
|--------|---------|
| HTML | File is already at `screen_dir/deck.html` |
| PDF | `node scripts/export/pdf.js --input deck.html --output deck.pdf` |
| PPTX | `node scripts/export/pptx.js --input deck.html --tokens brand/tokens.json --theme dark --output deck.pptx` |
| PNG | Available via preview-shell toolbar — no command needed |

**PPTX export strategy** (implemented in `scripts/export/pptx.js`):
1. Playwright renders each `.slide` at 960×540 with `deviceScaleFactor: 2` → 1920×1080 screenshots
2. Text elements hidden via `opacity: 0` before screenshot → screenshot captures only visual design
3. Text positions extracted via `getBoundingClientRect()` in CSS pixel coordinates
4. PptxGenJS assembles the PPTX: full-bleed screenshot as background + editable text boxes overlaid
5. Result: pixel-perfect visual fidelity + fully editable text in PowerPoint

### Phase 8 — Stop Server
Runs `scripts/stop-server.sh` to clean up the preview session.

---

## Brand Tokens

### Colors (`brand/tokens.json`)

| Token | Dark | Light |
|-------|------|-------|
| `background` | `#000519` Night | `#F7F8F8` White |
| `surface` | `#070E46` Midnight | `#ffffff` |
| `text_primary` | `#ffffff` | `#1A1A2A` |
| `text_secondary` | `#8A8AB0` | `#4A4A68` |
| `primary` | `#001391` Electric Blue | `#001391` Electric Blue |
| `accent` | `#FFE761` Yellow | `#001391` Electric Blue |

### Fonts

| Role | Font | File |
|------|------|------|
| Headlines | Tiempos Headline | `tiempos-headline-bold.woff2` |
| Body | Benton Sans BBVA | `BentonSansBBVA-Book.woff2` |
| Body italic | Tiempos Text | `TiemposTextWeb-RegularItalic.woff2` |

### CSS Custom Properties (`brand/tokens.css`)

```css
--brand-bg          /* background color */
--brand-surface     /* card/panel background */
--brand-text        /* primary text color */
--brand-text-muted  /* secondary text color */
--brand-primary     /* BBVA Electric Blue */
--brand-accent      /* Yellow (dark) / Electric Blue (light) */
--brand-font-headline  /* Tiempos Headline stack */
--brand-font-body      /* Benton Sans BBVA stack */
--slide-w / --slide-h  /* 960px / 540px */
--doc-w / --doc-page-h /* 794px / 1123px */
--social-w / --social-h /* 1080px / 1080px */
```

---

## HTML Output Conventions

### Slides
- Container: `.deck > .deck__viewport`
- Each slide: `<section class="slide" data-index="N" data-type="TYPE">`
- Slide types: `title`, `divider`, `content`, `quote`, `metrics`, `table`, `closing`
- Dimensions: exactly 960×540px per slide

### Documents
- Container: `.doc-container`
- Each page: `<article class="doc-page" data-index="N" data-type="TYPE">`
- Dimensions: 794px wide × min 1123px tall per page

### Social Cards
- Container: `.social-container`
- Each card: `<section class="social-card" data-index="N" data-type="TYPE">`
- Dimensions: 1080×1080px default (switchable in toolbar)

---

## Installed Requirements

| Tool | Install | Used for |
|------|---------|---------|
| `playwright` | `npm install playwright` | PPTX and PDF export |
| `pptxgenjs` | `npm install pptxgenjs` | PPTX slide assembly |
| Chromium | `npx playwright install chromium` | Headless rendering |

---

## Design Decisions

### JavaScript-only (no Python)
This skill deliberately does NOT include Python scripts. All generation and export runs
via Node.js. Reason: the new HTML-first workflow uses Playwright for rendering — a Node.js
runtime — so Python adds no value and doubles the maintenance surface.

> **Note**: This conflicts with the `codi-skill-creator` Step 2 rule requiring both
> Python and TypeScript for skills with scripts. The conflict is intentional and documented
> here. The brand skill architecture (approved in `docs/20260407_2217_SPEC_brand-skill-unified-workflow.md`)
> supersedes the default skill-creator requirement for this specific skill family.

### HTML as the canonical intermediate format
Instead of generating PPTX/DOCX directly from a JSON schema, the skill generates HTML
first, validates it visually in the browser, then exports via Playwright screenshot + PptxGenJS.
Benefits: pixel-perfect fidelity, zero layout approximation, visual validation before export.

### Fonts inlined at generation time
`brand/tokens.css` contains `SKILL_FONTS_DIR` placeholders. The agent replaces these
with absolute paths (`${CLAUDE_SKILL_DIR}/assets/fonts`) before inlining into HTML.
This ensures fonts load correctly via both `file://` protocol and the preview server.

---

## Adapting for a New Brand

This skill is the reference implementation for the unified brand skill architecture.
To create a new brand skill (e.g., `codi-acme-brand`):

1. Copy this template directory: `cp -r bbva-brand acme-brand`
2. Replace brand assets: `assets/logo-*.svg`, `assets/fonts/`
3. Update `brand/tokens.json`: colors, fonts, voice, layout
4. Regenerate `brand/tokens.css` from the new token values
5. Update `brand/tokens.ts` if the schema changes
6. Rewrite `generators/*.html` with the new brand's design system
7. Update `references/brand-guide.md` with the new brand's rules
8. Update `template.ts`: substituted brand name, trigger keywords, descriptions
9. Update `evals/evals.json`: brand-specific test cases
10. Register in `src/templates/skills/index.ts` and `skill-template-loader.ts`
11. Run `npm run build && codi generate`

---

## Testing

Run evals manually by presenting each prompt from `evals/evals.json` to an agent with
the skill active and verifying the expectations listed. Automated eval runner:

```bash
# Not yet implemented — run evals manually per skill-creator Step 5
```

Validate the skill schema:
```bash
codi validate
```
