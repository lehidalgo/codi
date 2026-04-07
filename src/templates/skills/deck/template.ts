import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  HTML-first interactive slide deck generator with a three-phase workflow:
  style iteration, full deck generation, and export as PDF or PPTX via Playwright.
  Use when the user needs a presentation, pitch deck, or technical slides with
  live browser preview and brand token integration.
category: ${SKILL_CATEGORY.CREATIVE_AND_DESIGN}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 8
---

# {{name}} — Interactive Slide Deck Generator

## When to Activate

- User asks to create a presentation, slide deck, pitch deck, or talk slides
- User wants a live browser preview while building the deck
- User needs export to PDF or PPTX after deck is approved
- User says "build me slides", "create a deck", "I need a presentation"

## Overview: Three-Phase Workflow

This skill produces an HTML deck through three distinct phases:

1. **Phase 1 — Style Iteration**: Generate 3 style variants, iterate until approved (max 3 rounds)
2. **Phase 2 — Full Deck Generation**: Build the complete deck using the approved style
3. **Phase 3 — Export**: Export as PDF (Playwright) or PPTX (python-pptx)

All phases run with a local Node.js server for live browser preview.

---

## Server Operation

**[CODING AGENT]** Start the preview server before generating any HTML:

\\\`\\\`\\\`bash
node \\\${CLAUDE_SKILL_DIR}[[/scripts/server.js]] --port 3131 --file deck.html
\\\`\\\`\\\`

The server watches \\\`deck.html\\\` and injects a live-reload script. Once started, open
\\\`http://localhost:3131\\\` in the browser. Regenerate the file to see changes.

**Stop the server** when the session ends:

\\\`\\\`\\\`bash
kill $(lsof -ti:3131) 2>/dev/null || true
\\\`\\\`\\\`

---

## Phase 1: Style Iteration

**Goal**: Agree on a visual style before building the full deck.

### Step 1.1 — Gather Requirements

**[HUMAN]** Provide:
- Topic or title of the deck
- Target audience (technical, executive, mixed)
- Key sections or talking points
- Desired tone (formal, energetic, minimal, bold)
- Brand skill name, if any (e.g., \\\`${PROJECT_NAME}-bbva-brand\\\`)

**[CODING AGENT]** Before generating styles:
- Check if a brand skill with \\\`category: Brand Identity\\\` is active in the project
- If found, extract its CSS variables (colors, fonts, logo path) and apply them to all variants
- If not found, use neutral defaults

### Step 1.2 — Generate 3 Style Variants

**[CODING AGENT]** Generate a single \\\`deck.html\\\` file that shows 3 mini-previews side by side.
Each preview is a scaled-down version of the title slide + one content slide.

Style variant dimensions:
- Each preview: 400px wide × 225px tall (16:9), scaled to 50% inside a container
- Variants stacked or in a grid with clear labels: "Option A", "Option B", "Option C"

**Distinct visual directions to explore:**

| Variant | Direction | Characteristics |
|---------|-----------|-----------------|
| Option A | Minimal / Clean | White background, generous whitespace, single accent line, sans-serif |
| Option B | Bold / High-contrast | Dark background or vivid accent fill, large typography, strong hierarchy |
| Option C | Structured / Grid-based | Ruled grid, data-dense layout, professional table/chart aesthetic |

If a brand skill is active, apply its tokens consistently across all three options.

Present to the user:

> "Three style options are ready at http://localhost:3131. Which direction resonates most?
> You can also describe what you like or dislike from each option."

### Step 1.3 — Iterate (max 3 rounds)

**[HUMAN]** Pick a variant or describe changes.

**[CODING AGENT]**:
- Apply feedback and regenerate \\\`deck.html\\\` with updated previews
- Maximum 3 rounds. After round 3, ask the user to commit to a direction before proceeding.
- If the user approves before round 3, move to Phase 2 immediately.

**Phase 1 completion gate:**
> "Style approved. Moving to Phase 2 to generate the full deck."

---

## Phase 2: Full Deck Generation

**Goal**: Build all slides using the approved style.

### Step 2.1 — Storytelling & Structure

**[CODING AGENT]** Choose a narrative arc:

| Arc | Structure | Best For |
|-----|-----------|----------|
| Problem → Solution | Problem, Impact, Solution, Evidence, Next Steps | Proposals, pitches |
| Progressive Disclosure | Overview, Layer 1, Layer 2, Deep Dive, Wrap | Technical explanations |
| 3-Act | Setup, Confrontation, Resolution | Status updates, retrospectives |
| Comparison | Option A, Option B, Analysis, Recommendation | Decision-making |

**Slide budget:**
- Standard: 8-12 slides
- Lightning talk (5 min): 5-7 slides
- Deep dive (30+ min): 15-20 slides
- Rule of thumb: ~2 minutes per slide

### Step 2.2 — Slide Components

Each slide is a \\\`<section class="slide">\\\` inside \\\`.deck > .deck__viewport\\\`.
Content that overflows is clipped — keep slides concise.

**Title slide:**
\\\`\\\`\\\`html
<section class="slide slide--accent">
  <div class="slide__content slide__content--centered">
    <h1 class="title--xl">Presentation Title</h1>
    <p class="subtitle">Subtitle or tagline</p>
    <p class="meta">Presenter · Date</p>
  </div>
</section>
\\\`\\\`\\\`

**Section divider:**
\\\`\\\`\\\`html
<section class="slide slide--accent">
  <div class="slide__content slide__content--centered">
    <p class="section-number">01</p>
    <h2 class="title--lg">Section Title</h2>
  </div>
</section>
\\\`\\\`\\\`

**Bullet list:**
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content">
    <h2>Slide Title</h2>
    <ul class="bullet-list">
      <li class="animate-in">Point one — keep it short</li>
      <li class="animate-in">Point two — one idea per bullet</li>
    </ul>
  </div>
</section>
\\\`\\\`\\\`

**Card grid (2-3 columns):**
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content">
    <h2>Comparison</h2>
    <div class="card-grid card-grid--3">
      <div class="card animate-in"><h3>Title</h3><p>Description</p></div>
    </div>
  </div>
</section>
\\\`\\\`\\\`

**Metric cards:**
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content">
    <h2>Key Metrics</h2>
    <div class="card-grid card-grid--3">
      <div class="metric-card animate-in">
        <span class="metric-value">99.9%</span>
        <span class="metric-label">Uptime</span>
      </div>
    </div>
  </div>
</section>
\\\`\\\`\\\`

### Step 2.3 — Generate \`deck.html\`

**[CODING AGENT]** Generate the complete \\\`deck.html\\\` using this scaffold:

\\\`\\\`\\\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Deck Title</title>
  <style>
    /* Paste contents of \\\${CLAUDE_SKILL_DIR}[[/references/deck-engine.css]] */
    /* Override brand tokens from active brand skill here */
  </style>
</head>
<body>
  <div class="deck">
    <div class="deck__viewport">
      <div class="progress-bar" id="progressBar"></div>
      <div class="slide-counter" id="slideCounter"></div>
      <section class="slide active"><!-- first slide --></section>
      <section class="slide"><!-- subsequent slides --></section>
    </div>
  </div>
  <script>
    /* Paste contents of \\\${CLAUDE_SKILL_DIR}[[/references/deck-engine.js]] */
  </script>
</body>
</html>
\\\`\\\`\\\`

### Step 2.4 — Content Guidelines

- **Headlines, not sentences** — max 8 words per bullet
- **One idea per slide** — max 6 bullets
- **Parallel structure** in lists (all verbs or all nouns)
- **Concrete data** — use numbers, percentages, dates
- **Speaker notes** as HTML comments: \\\`<!-- Note: explain X here -->\\\`

### Step 2.5 — Review Gate

After generating all slides, present:

> "Full deck is ready at http://localhost:3131 — [N] slides.
> Review each slide and let me know what to adjust before export."

Iterate until the user approves the deck. Then proceed to Phase 3.

---

## Phase 3: Export

**[HUMAN]** Choose export format: **PDF** or **PPTX**.

### PDF Export (Playwright)

**[CODING AGENT]** Run:

\\\`\\\`\\\`bash
node \\\${CLAUDE_SKILL_DIR}[[/scripts/export/pdf.js]] --input deck.html --output deck.pdf
\\\`\\\`\\\`

The script uses Playwright to open the deck, iterate through each slide, and print each to a page.
Output: \\\`deck.pdf\\\` in the current directory.

### PPTX Export (python-pptx)

**[CODING AGENT]** Run:

\\\`\\\`\\\`bash
python3 \\\${CLAUDE_SKILL_DIR}[[/scripts/export/pptx.py]] --input deck.html --output deck.pptx
\\\`\\\`\\\`

The script parses the HTML, extracts slide content, and builds a \\\`.pptx\\\` using python-pptx.
Output: \\\`deck.pptx\\\` in the current directory.

### Completion

After export succeeds, report:

> "Export complete: \\\`deck.[format]\\\` is ready in the current directory."

Stop the preview server:

\\\`\\\`\\\`bash
kill $(lsof -ti:3131) 2>/dev/null || true
\\\`\\\`\\\`

---

## Related Skills

- **${PROJECT_NAME}-theme-factory** — Apply curated visual themes to the generated deck
- **${PROJECT_NAME}-deck-engine** — Simpler deck generation without the server-based preview workflow
- **${PROJECT_NAME}-doc-engine** — Generate companion documents from deck content
- **${PROJECT_NAME}-bbva-brand** — BBVA brand tokens for slides
`;
