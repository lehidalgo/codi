import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  HTML slide deck generator with brand token integration. Use when the user
  needs a self-contained HTML presentation with navigation, animations, and
  print-to-PDF support. Also activate for pitch decks, technical presentations,
  or any slide content that should use project brand tokens.
category: Document Generation
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
intentHints:
  taskType: Presentation
  examples:
    - "Create a slide deck"
    - "Build a presentation"
    - "Generate a pitch deck"
version: 1
---

# {{name}} — Presentation Deck Engine

## When to Activate

- User asks to create a presentation, slide deck, pitch deck, or keynote
- User needs an HTML-based presentation that works offline in a browser
- User wants to present technical content, a proposal, or project status
- User asks to generate slides from a topic outline or document

## Step 1: Gather Requirements

**[HUMAN]** Provide:
- Topic or title
- Target audience (technical, executive, mixed)
- Key points or sections to cover
- Time limit (default: 20 minutes → ~10 slides at 2 min/slide)

**[CODING AGENT]** Check if any skill with **category: brand** is defined in the project. If a brand skill exists, use its design tokens (CSS variables, fonts, logos, tone of voice). If the user specifies a brand name, use that one. If no brand skill exists, use neutral defaults.

## Step 2: Storytelling & Structure

**[CODING AGENT]** Choose a narrative arc based on topic:

| Arc | Structure | Best For |
|-----|-----------|----------|
| **Problem → Solution** | Problem, Impact, Solution, Evidence, Next Steps | Proposals, pitches |
| **Progressive Disclosure** | Overview, Layer 1, Layer 2, Deep Dive, Wrap | Technical explanations |
| **3-Act** | Setup, Confrontation, Resolution | Status updates, retrospectives |
| **Comparison** | Option A, Option B, Analysis, Recommendation | Decision-making |

**Slide budget:**
- Standard: 8-12 slides
- Lightning talk (5 min): 5-7 slides
- Deep dive (30+ min): 15-20 slides
- Rule of thumb: ~2 minutes per slide

## Step 3: Slide Components

Slides live inside a \\\`.deck > .deck__viewport\\\` wrapper (see Step 6). Each slide is a \\\`<section class="slide">\\\` element. Content that overflows the slide area is clipped — keep content concise.

### Title Slide
\\\`\\\`\\\`html
<section class="slide slide--accent">
  <div class="slide__content slide__content--centered">
    <h1 class="title--xl">Presentation Title</h1>
    <p class="subtitle">Subtitle or tagline</p>
    <p class="meta">Presenter Name · Date</p>
  </div>
</section>
\\\`\\\`\\\`

### Section Divider
\\\`\\\`\\\`html
<section class="slide slide--accent">
  <div class="slide__content slide__content--centered">
    <p class="section-number">01</p>
    <h2 class="title--lg">Section Title</h2>
  </div>
</section>
\\\`\\\`\\\`

### Bullet List
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content">
    <h2>Slide Title</h2>
    <ul class="bullet-list">
      <li class="animate-in">Point one — keep it short</li>
      <li class="animate-in">Point two — one idea per bullet</li>
      <li class="animate-in">Point three — max 6 bullets</li>
    </ul>
  </div>
</section>
\\\`\\\`\\\`

### Card Grid (2-3 columns)
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content">
    <h2>Comparison</h2>
    <div class="card-grid card-grid--3">
      <div class="card animate-in">
        <h3>Card Title</h3>
        <p>Short description</p>
      </div>
      <!-- repeat -->
    </div>
  </div>
</section>
\\\`\\\`\\\`

### Metric Cards
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content">
    <h2>Key Metrics</h2>
    <div class="card-grid card-grid--3">
      <div class="metric-card animate-in">
        <span class="metric-value">99.9%</span>
        <span class="metric-label">Uptime</span>
      </div>
      <!-- repeat -->
    </div>
  </div>
</section>
\\\`\\\`\\\`

### Code Block
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content">
    <h2>Implementation</h2>
    <pre class="code-block"><code>// Keep code short: 5-10 lines max
function example() {
  return "highlight the key concept";
}</code></pre>
  </div>
</section>
\\\`\\\`\\\`

### Split Layout (text + visual)
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content slide__content--split">
    <div class="split__text">
      <h2>Title</h2>
      <p>Explanation text on the left</p>
    </div>
    <div class="split__visual">
      <!-- diagram, image, or code block -->
    </div>
  </div>
</section>
\\\`\\\`\\\`

### Flow Diagram (CSS-based)
\\\`\\\`\\\`html
<section class="slide">
  <div class="slide__content">
    <h2>Process Flow</h2>
    <div class="flow">
      <div class="flow__step animate-in">Step 1</div>
      <div class="flow__arrow">→</div>
      <div class="flow__step animate-in">Step 2</div>
      <div class="flow__arrow">→</div>
      <div class="flow__step animate-in">Step 3</div>
    </div>
  </div>
</section>
\\\`\\\`\\\`

## Step 4: Deck Engine (CSS + JS)

**[CODING AGENT]** Copy the CSS and JS reference files into the generated deck:

- CSS foundation: \\\`references/deck-engine.css\\\` — brand token integration, layout, components, animations, print styles
- JS navigation engine: \\\`references/deck-engine.js\\\` — keyboard, wheel, touch, and hash navigation

Embed both inline in the output HTML (no external dependencies):

\\\`\\\`\\\`html
<style>
  /* paste contents of references/deck-engine.css here */
  /* then override brand tokens from the active brand skill */
</style>
...slides...
<script>
  /* paste contents of references/deck-engine.js here */
</script>
\\\`\\\`\\\`

## Step 5: Content Guidelines

- **Headlines, not sentences** — max 8 words per bullet
- **One idea per slide** — max 6 bullets per slide
- **Parallel structure** in lists (all verbs, all nouns)
- **Concrete data** — use numbers, percentages, dates
- **Speaker notes** as HTML comments: \\\`<!-- Note: explain X here -->\\\`
- **Code examples** — 5-10 lines max, highlight the key concept
- **Diagrams** — use CSS grids/flexbox, not images

## Step 6: Output

Generate a single \\\`.html\\\` file using this exact scaffold:

\\\`\\\`\\\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Presentation Title</title>
  <style>
    /* paste contents of references/deck-engine.css here */
    /* then override brand tokens if a brand skill is active */
  </style>
</head>
<body>
  <div class="deck">
    <div class="deck__viewport">
      <div class="progress-bar" id="progressBar"></div>
      <div class="slide-counter" id="slideCounter"></div>

      <!-- slides go here — first slide gets class="slide active" -->
      <section class="slide active">...</section>
      <section class="slide">...</section>

    </div>
  </div>
  <script>
    /* paste contents of references/deck-engine.js here */
  </script>
</body>
</html>
\\\`\\\`\\\`

The \\\`.deck\\\` wrapper fills the screen. The \\\`.deck__viewport\\\` maintains a 16:9 aspect ratio with letterboxing on other proportions. All content is clipped to the viewport — nothing overflows.

**For PDF export:** Open in browser → File → Print → Save as PDF (the print CSS renders each slide on its own page).

**For Google Slides:** Generate simplified HTML, then copy-paste content slide by slide.

## Related Skills

- **codi-theme-factory** — Apply curated visual themes to the generated deck
- **codi-doc-engine** — Generate companion documents from deck content
`;
