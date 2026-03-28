export const template = `---
name: {{name}}
description: Presentation engine for generating branded HTML slide decks. Creates self-contained HTML presentations with navigation, animations, and print-to-PDF support. Integrates with Codi brand artifacts for consistent visual identity.
compatibility: [claude-code, cursor, codex, cline, windsurf]
managed_by: codi
user-invocable: true
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

**[CODING AGENT]** Check if any **Brand** artifact is defined in the project. If a brand exists, use its design tokens (CSS variables, fonts, logos, tone of voice). If the user specifies a brand name, use that one. If no brand exists, use neutral defaults.

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

Use these HTML patterns for slide content. Each slide is a \\\`<section class="slide">\\\` element.

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

### CSS Foundation

\\\`\\\`\\\`css
/* === Brand Token Integration === */
:root {
  /* If a brand is active, override these with brand tokens */
  --brand-primary: #2563eb;
  --brand-primary-dark: #1d4ed8;
  --brand-primary-muted: #2563eb15;
  --brand-bg: #ffffff;
  --brand-bg-alt: #1e293b;
  --brand-text: #1e293b;
  --brand-text-secondary: #64748b;
  --brand-heading-font: system-ui, -apple-system, sans-serif;
  --brand-body-font: system-ui, -apple-system, sans-serif;
  --brand-mono-font: 'SF Mono', 'Fira Code', monospace;
}

/* === Canvas === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; background: var(--brand-bg); }
.slide {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; visibility: hidden;
  transition: opacity 0.4s ease, visibility 0.4s ease;
  background: var(--brand-bg);
  font-family: var(--brand-body-font);
  color: var(--brand-text);
}
.slide.active { opacity: 1; visibility: visible; }
.slide--accent {
  background: var(--brand-primary);
  color: #ffffff;
}

/* === Typography === */
.slide__content { width: 85%; max-width: 1400px; }
.slide__content--centered { text-align: center; }
.slide__content--split { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
h1, h2, h3 { font-family: var(--brand-heading-font); font-weight: 700; }
.title--xl { font-size: 4rem; line-height: 1.1; margin-bottom: 0.5em; }
.title--lg { font-size: 3rem; line-height: 1.2; margin-bottom: 0.5em; }
h2 { font-size: 2.5rem; margin-bottom: 1em; }
h3 { font-size: 1.5rem; margin-bottom: 0.5em; }
p, li { font-size: 1.5rem; line-height: 1.6; }
.subtitle { font-size: 1.75rem; opacity: 0.85; }
.meta { font-size: 1.1rem; opacity: 0.6; margin-top: 1em; }
.section-number { font-size: 5rem; font-weight: 800; opacity: 0.2; }

/* === Components === */
.bullet-list { list-style: none; padding: 0; }
.bullet-list li { padding: 0.5em 0; padding-left: 1.5em; position: relative; }
.bullet-list li::before {
  content: ''; position: absolute; left: 0; top: 50%;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--brand-primary); transform: translateY(-50%);
}
.card-grid { display: grid; gap: 24px; }
.card-grid--2 { grid-template-columns: repeat(2, 1fr); }
.card-grid--3 { grid-template-columns: repeat(3, 1fr); }
.card {
  padding: 32px; border-radius: 12px;
  background: var(--brand-primary-muted);
  border: 1px solid var(--brand-primary)20;
}
.metric-card { text-align: center; padding: 40px 24px; }
.metric-value {
  display: block; font-size: 3rem; font-weight: 800;
  color: var(--brand-primary); margin-bottom: 0.25em;
}
.metric-label { font-size: 1rem; color: var(--brand-text-secondary); text-transform: uppercase; letter-spacing: 0.1em; }
.code-block {
  background: #1e293b; color: #e2e8f0; padding: 32px;
  border-radius: 12px; font-family: var(--brand-mono-font);
  font-size: 1.1rem; line-height: 1.6; overflow-x: auto;
}
.flow { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; }
.flow__step {
  padding: 20px 32px; border-radius: 12px; font-weight: 600;
  background: var(--brand-primary-muted); border: 2px solid var(--brand-primary);
}
.flow__arrow { font-size: 2rem; color: var(--brand-primary); }

/* === Navigation UI === */
.progress-bar {
  position: fixed; top: 0; left: 0; height: 3px;
  background: var(--brand-primary); transition: width 0.3s ease; z-index: 100;
}
.slide-counter {
  position: fixed; bottom: 24px; right: 32px;
  font-size: 0.9rem; color: var(--brand-text-secondary);
  font-family: var(--brand-mono-font); z-index: 100;
}

/* === Animations === */
.animate-in { opacity: 0; transform: translateY(20px); }
.slide.active .animate-in {
  animation: fadeUp 0.5s ease forwards;
}
.slide.active .animate-in:nth-child(1) { animation-delay: 0.1s; }
.slide.active .animate-in:nth-child(2) { animation-delay: 0.2s; }
.slide.active .animate-in:nth-child(3) { animation-delay: 0.3s; }
.slide.active .animate-in:nth-child(4) { animation-delay: 0.4s; }
.slide.active .animate-in:nth-child(5) { animation-delay: 0.5s; }
.slide.active .animate-in:nth-child(6) { animation-delay: 0.6s; }
@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}

/* === Print === */
@media print {
  body { overflow: visible; }
  .slide {
    position: relative; opacity: 1; visibility: visible;
    page-break-after: always; height: 100vh;
  }
  .progress-bar, .slide-counter { display: none; }
  .animate-in { opacity: 1; transform: none; }
}
\\\`\\\`\\\`

### JavaScript Navigation Engine

\\\`\\\`\\\`javascript
(() => {
  const slides = document.querySelectorAll('.slide');
  const progressBar = document.getElementById('progressBar');
  const slideCounter = document.getElementById('slideCounter');
  const total = slides.length;
  let current = 0;
  let wheelCooldown = false;

  function goto(index) {
    if (index < 0 || index >= total || index === current) return;
    slides[current].classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    const pct = ((current + 1) / total) * 100;
    progressBar.style.width = pct + '%';
    slideCounter.textContent = (current + 1) + ' / ' + total;
    history.replaceState(null, '', '#slide-' + (current + 1));
  }

  function next() { goto(current + 1); }
  function prev() { goto(current - 1); }

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp':
        e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); goto(0); break;
      case 'End': e.preventDefault(); goto(total - 1); break;
      default:
        if (e.key >= '1' && e.key <= '9') {
          const t = parseInt(e.key, 10) - 1;
          if (t < total) goto(t);
        }
    }
  });

  document.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (wheelCooldown) return;
    wheelCooldown = true;
    if (e.deltaY > 0) next(); else if (e.deltaY < 0) prev();
    setTimeout(() => { wheelCooldown = false; }, 300);
  }, { passive: false });

  let tx = 0, ty = 0;
  document.addEventListener('touchstart', (e) => {
    tx = e.changedTouches[0].screenX;
    ty = e.changedTouches[0].screenY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - tx;
    const dy = e.changedTouches[0].screenY - ty;
    if (Math.abs(dx) < 50 && Math.abs(dy) < 50) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -50) next(); else if (dx > 50) prev();
    } else {
      if (dy < -50) next(); else if (dy > 50) prev();
    }
  }, { passive: true });

  // Read initial hash
  const match = location.hash.match(/^#slide-(\\\\d+)$/);
  if (match) {
    const idx = parseInt(match[1], 10) - 1;
    if (idx >= 0 && idx < total) {
      slides[current].classList.remove('active');
      current = idx;
      slides[current].classList.add('active');
    }
  }
  progressBar.style.width = ((current + 1) / total) * 100 + '%';
  slideCounter.textContent = (current + 1) + ' / ' + total;
})();
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

Generate a single \\\`.html\\\` file with:
- All CSS in a \\\`<style>\\\` tag
- Navigation JS in a \\\`<script>\\\` tag
- No external dependencies (works offline)
- \\\`<div class="progress-bar" id="progressBar"></div>\\\`
- \\\`<div class="slide-counter" id="slideCounter"></div>\\\`
- First slide gets class \\\`active\\\`

**For PDF export:** Open in browser → File → Print → Save as PDF (the print CSS handles page breaks).

**For Google Slides:** Generate simplified HTML, then copy-paste content slide by slide.
`;
