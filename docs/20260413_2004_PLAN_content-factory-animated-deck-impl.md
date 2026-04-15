# Content Factory — Animated Slide Deck Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the content factory slide deck pipeline to generate a 3-file animated presentation (HTML + CSS + JS) and add a standalone HTML export that bundles everything into a single shareable file.

**Architecture:** Replace the single static `slides-base.html` template with three files — `slides-base.html` (structure), `slides-base.css` (brand tokens + entrance animations), `slides-base.js` (rich navigation engine). Add `compile-deck.js` to bundle them into a zero-dependency `deck-standalone.html` during export. PDF and PPTX export are untouched — the server serves all 3 files over HTTP and Playwright loads them normally.

**Tech Stack:** Vanilla HTML/CSS/JS (templates), Node.js ESM (compile scripts), existing `lib/state.js` for session state, `spawnSync` for subprocess orchestration.

**Spec:** `docs/20260413_1955_SPEC_content-factory-animated-deck.md`

**Skill dir:** `.claude/skills/codi-content-factory/` (referred to as `SKILL/` below)

---

### Task 1: Rewrite slides-base.html as 3-file structure shell

**Files**: `SKILL/generators/slides-base.html`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Verify current file has inline `<style>` and `<script>` (confirm what we are replacing):
  ```bash
  grep -c '<style>' .claude/skills/codi-content-factory/generators/slides-base.html
  # expected: 1 (inline style block exists)
  ```
- [ ] 2. Overwrite with new structure-only template:
  ```html
  <!DOCTYPE html>
  <!--
    Content Factory Slides Base Template — 16:9 Presentation Shell
    =====================================================
    Purpose: Reference template for the CODING AGENT. Read this file to understand
    the required HTML structure for Content Factory slide decks. Do NOT use this file
    directly — scaffold-session.sh copies it to screen_dir/deck.html.

    This template references deck.css and deck.js (sibling files).
    The compile step (compile-deck.js) bundles all three into deck-standalone.html.

    Slide types (data-type attribute):
      title    — Opening slide: eyebrow, h1, subtitle, meta
      divider  — Section separator: section-number + h2, slide--blue background
      content  — Main content: h2 + bullet-list or paragraphs
      quote    — Full-bleed quote, slide--blue background
      metrics  — metric-grid with metric-card elements
      table    — Data table with real <table> element
      closing  — Final slide: h2 + contact, slide--blue background

    .slide--blue modifier: dark primary background, white text, inverted logo
    .animate-in class: add to every content element for staggered fadeUp entrance

    Logo: uncomment the global-logo img inside .slide-chrome and replace
          SKILL_ASSETS_DIR with the absolute path to your assets directory.

    Navigation: arrow keys, space, home/end, 1-9, wheel, swipe. Handled by deck.js.
  -->
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Slides — Content Factory</title>
    <link rel="stylesheet" href="deck.css">
  </head>
  <body>
    <div class="deck">
      <div class="deck__viewport">

        <!-- TITLE SLIDE -->
        <section class="slide active" data-index="1" data-type="title">
          <div class="slide__content">
            <span class="slide__eyebrow animate-in">CATEGORY · 2026</span>
            <h1 class="animate-in">Presentation Title</h1>
            <p class="slide__subtitle animate-in">Brief subtitle or key message for this deck</p>
            <p class="slide__meta animate-in">Author Name · Date</p>
          </div>
        </section>

        <!-- DIVIDER SLIDE -->
        <section class="slide slide--blue" data-index="2" data-type="divider">
          <span class="section-number">01</span>
          <h2 class="animate-in">Section Title</h2>
        </section>

        <!-- CONTENT SLIDE -->
        <section class="slide" data-index="3" data-type="content">
          <div class="slide__content">
            <h2 class="animate-in">Slide Heading</h2>
            <ul class="bullet-list">
              <li class="animate-in">First key point — keep it to one idea</li>
              <li class="animate-in">Second key point — use concrete numbers when possible</li>
              <li class="animate-in">Third key point — maximum 5 bullets per slide</li>
            </ul>
          </div>
        </section>

        <!-- QUOTE SLIDE -->
        <section class="slide slide--blue" data-index="4" data-type="quote">
          <div class="slide__content">
            <blockquote class="animate-in">"The quote text goes here — one strong sentence."</blockquote>
            <p class="attribution animate-in">— Attribution Name, Title</p>
          </div>
        </section>

        <!-- METRICS SLIDE -->
        <section class="slide" data-index="5" data-type="metrics">
          <div class="slide__content">
            <h2 class="animate-in">Key Metrics</h2>
            <div class="metric-grid">
              <div class="metric-card animate-in">
                <span class="metric-value">99.9%</span>
                <span class="metric-label">Service uptime</span>
              </div>
              <div class="metric-card animate-in">
                <span class="metric-value">2.4M</span>
                <span class="metric-label">Active users</span>
              </div>
              <div class="metric-card animate-in">
                <span class="metric-value">€42B</span>
                <span class="metric-label">Assets under management</span>
              </div>
            </div>
          </div>
        </section>

        <!-- TABLE SLIDE -->
        <section class="slide" data-index="6" data-type="table">
          <div class="slide__content">
            <h2 class="animate-in">Data Table</h2>
            <table class="animate-in">
              <thead>
                <tr><th>Column A</th><th>Column B</th><th>Column C</th></tr>
              </thead>
              <tbody>
                <tr><td>Row 1 A</td><td>Row 1 B</td><td>Row 1 C</td></tr>
                <tr><td>Row 2 A</td><td>Row 2 B</td><td>Row 2 C</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- CLOSING SLIDE -->
        <section class="slide slide--blue" data-index="7" data-type="closing">
          <div class="slide__content">
            <h2 class="animate-in">Thank you</h2>
            <p class="contact animate-in">contact@example.com · example.com</p>
          </div>
        </section>

      </div><!-- /.deck__viewport -->

      <!-- Chrome overlay: logo + progress bar + counter (above all slides, pointer-events: none) -->
      <div class="slide-chrome">
        <!-- Uncomment and replace SKILL_ASSETS_DIR with the absolute path to your assets dir -->
        <!-- <img class="global-logo" id="globalLogo" src="SKILL_ASSETS_DIR/logo.svg" alt="logo"> -->
        <div class="progress-bar" id="progressBar"></div>
        <span class="slide-counter" id="slideCounter"></span>
      </div>

    </div><!-- /.deck -->

    <script src="deck.js"></script>
  </body>
  </html>
  ```
- [ ] 3. Verify the new file has no inline `<style>` or `<script src` tags referencing inline code, references the external files correctly, and has `.slide-chrome`:
  ```bash
  grep -c '<link rel="stylesheet" href="deck.css">' .claude/skills/codi-content-factory/generators/slides-base.html
  # expected: 1
  grep -c '<script src="deck.js">' .claude/skills/codi-content-factory/generators/slides-base.html
  # expected: 1
  grep -c 'slide-chrome' .claude/skills/codi-content-factory/generators/slides-base.html
  # expected: 1
  grep -c 'animate-in' .claude/skills/codi-content-factory/generators/slides-base.html
  # expected: at least 10
  grep -c 'slide--blue' .claude/skills/codi-content-factory/generators/slides-base.html
  # expected: 3
  ```
- [ ] 4. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/generators/slides-base.html
  git commit -m "refactor(content-factory): replace slides-base.html with 3-file structure shell"
  ```

---

### Task 2: Create slides-base.css with brand tokens and entrance animations

**Files**: `SKILL/generators/slides-base.css`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Verify file does not exist yet:
  ```bash
  test ! -f .claude/skills/codi-content-factory/generators/slides-base.css && echo "OK: file absent"
  # expected: OK: file absent
  ```
- [ ] 2. Create the file:
  ```css
  /* ── Font Faces ─────────────────────────────────────────────────────────────
     Replace SKILL_FONTS_DIR with the absolute path to your fonts directory.
     Uncomment and populate when brand fonts are available.
  ─────────────────────────────────────────────────────────────────────────── */
  /*
  @font-face {
    font-family: 'Brand Headline';
    src: url('SKILL_FONTS_DIR/headline-bold.woff2') format('woff2');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'Brand Body';
    src: url('SKILL_FONTS_DIR/body-regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  */

  /* ── Design Tokens ───────────────────────────────────────────────────────── */
  :root {
    /* Colors — override these for your brand */
    --brand-primary:      #001391;
    --brand-bg:           #ffffff;
    --brand-surface:      #f5f6fa;
    --brand-text:         #1a1a2e;
    --brand-text-muted:   #4a4a68;
    --brand-accent:       #001391;

    /* Fonts — replace with brand fonts when available */
    --brand-font-headline: Georgia, 'Times New Roman', serif;
    --brand-font-body:     'Helvetica Neue', Arial, sans-serif;

    /* Layout */
    --slide-pad:     clamp(2rem, 5vw, 5rem);
    --content-gap:   clamp(1rem, 2vw, 2rem);
    --element-gap:   clamp(0.5rem, 1vw, 1rem);

    /* Type scale */
    --title-size:    clamp(2rem, 4.5vw, 3.5rem);
    --h2-size:       clamp(1.4rem, 3vw, 2.25rem);
    --body-size:     clamp(0.85rem, 1.3vw, 1.05rem);
    --small-size:    clamp(0.7rem, 1vw, 0.875rem);
    --label-size:    clamp(0.6rem, 0.8vw, 0.72rem);
  }

  /* ── Reset ───────────────────────────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: 100%; height: 100%;
    overflow: hidden;
    font-family: var(--brand-font-body);
    color: var(--brand-text);
    background: #111;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Deck Container ──────────────────────────────────────────────────────── */
  .deck {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%; height: 100%;
    position: relative;
  }

  /* CRITICAL: keeps slides stacked — do not remove overflow:hidden or position:relative */
  .deck__viewport {
    position: relative;
    width: 100%;
    height: 100%;
    max-width:  calc(100vh * 16 / 9);
    max-height: calc(100vw * 9 / 16);
    overflow: hidden;
  }

  /* ── Slide Chrome (persistent overlay above all slides) ─────────────────── */
  .slide-chrome {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width:  min(100vw, calc(100vh * 16 / 9));
    height: min(100vh, calc(100vw * 9 / 16));
    pointer-events: none;
    z-index: 101;
  }

  .global-logo {
    position: absolute;
    top:  clamp(10px, 1.5vh, 20px);
    left: clamp(14px, 2vw, 28px);
    height: clamp(18px, 2.2vh, 28px);
    width: auto;
    opacity: 0.9;
  }

  /* Inverted logo for dark (slide--blue) slides */
  .global-logo--inverted {
    filter: brightness(0) invert(1);
  }

  .progress-bar {
    position: absolute;
    bottom: 0; left: 0;
    height: 3px;
    background: var(--brand-accent);
    transition: width 0.3s ease;
  }

  .slide-counter {
    position: absolute;
    bottom: clamp(6px, 1vh, 12px);
    right:  clamp(10px, 1.5vw, 18px);
    font-size: var(--label-size);
    color: rgba(0, 0, 0, 0.35);
    font-family: var(--brand-font-body);
  }

  /* ── Slide Base ──────────────────────────────────────────────────────────── */
  /* CRITICAL: display:none hides inactive slides — only .active uses display:flex */
  .slide {
    display: none;
    position: absolute;
    inset: 0;
    background: var(--brand-bg);
    padding: var(--slide-pad);
    overflow: hidden;
    flex-direction: column;
    justify-content: center;
  }

  .slide.active { display: flex; }

  .slide__content {
    display: flex;
    flex-direction: column;
    gap: var(--content-gap);
    max-width: 100%;
  }

  /* ── Dark Slide Modifier ─────────────────────────────────────────────────── */
  .slide--blue {
    background: var(--brand-primary);
  }

  .slide--blue h1,
  .slide--blue h2,
  .slide--blue h3,
  .slide--blue p,
  .slide--blue li,
  .slide--blue .slide__subtitle,
  .slide--blue .slide__meta,
  .slide--blue .attribution {
    color: #fff;
  }

  .slide--blue .slide-counter { color: rgba(255, 255, 255, 0.4); }

  /* ── Typography ──────────────────────────────────────────────────────────── */
  .slide h1 {
    font-family: var(--brand-font-headline);
    font-size: var(--title-size);
    font-weight: 700;
    line-height: 1.1;
    color: var(--brand-text);
  }

  .slide h2 {
    font-family: var(--brand-font-headline);
    font-size: var(--h2-size);
    font-weight: 700;
    line-height: 1.15;
    color: var(--brand-text);
    padding-bottom: 12px;
    border-bottom: 2px solid var(--brand-accent);
  }

  .slide__eyebrow {
    font-size: var(--label-size);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--brand-accent);
    font-weight: 500;
  }

  .slide__subtitle {
    font-size: clamp(1rem, 1.8vw, 1.4rem);
    color: var(--brand-text-muted);
    line-height: 1.5;
  }

  .slide__meta {
    font-size: var(--small-size);
    color: var(--brand-text-muted);
    margin-top: auto;
  }

  /* ── Slide Type: title ───────────────────────────────────────────────────── */
  [data-type="title"] {
    justify-content: center;
    align-items: flex-start;
  }

  /* ── Slide Type: divider ─────────────────────────────────────────────────── */
  [data-type="divider"] {
    justify-content: flex-end;
    align-items: flex-start;
  }

  [data-type="divider"] .section-number {
    position: absolute;
    top:   var(--slide-pad);
    right: var(--slide-pad);
    font-size: clamp(60px, 8vw, 100px);
    font-family: var(--brand-font-headline);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.12);
    line-height: 1;
  }

  [data-type="divider"] h2 {
    border-bottom: none;
    padding-bottom: 0;
    color: #fff;
    font-size: clamp(1.5rem, 3.5vw, 2.75rem);
    max-width: 500px;
  }

  /* ── Slide Type: quote ───────────────────────────────────────────────────── */
  [data-type="quote"] {
    justify-content: center;
    align-items: flex-start;
  }

  [data-type="quote"] blockquote {
    font-family: var(--brand-font-headline);
    font-size: clamp(1.2rem, 2.5vw, 2rem);
    font-style: italic;
    color: #fff;
    line-height: 1.4;
    max-width: 700px;
    border-left: 4px solid rgba(255, 255, 255, 0.4);
    padding-left: 24px;
  }

  [data-type="quote"] .attribution {
    font-size: var(--body-size);
    color: rgba(255, 255, 255, 0.6);
    padding-left: 28px;
  }

  /* ── Slide Type: metrics ─────────────────────────────────────────────────── */
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--element-gap);
  }

  .metric-card {
    background: var(--brand-surface);
    border-radius: 8px;
    padding: clamp(1rem, 2vw, 1.75rem);
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 3px solid var(--brand-accent);
  }

  .metric-value {
    font-family: var(--brand-font-headline);
    font-size: clamp(1.8rem, 3.5vw, 3rem);
    font-weight: 700;
    color: var(--brand-accent);
    line-height: 1;
  }

  .metric-label {
    font-size: var(--small-size);
    color: var(--brand-text-muted);
    line-height: 1.3;
  }

  /* ── Bullet list ─────────────────────────────────────────────────────────── */
  .bullet-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: clamp(0.5rem, 1vh, 0.9rem);
  }

  .bullet-list li {
    font-size: var(--body-size);
    line-height: 1.5;
    color: var(--brand-text);
    padding-left: 18px;
    position: relative;
  }

  .bullet-list li::before {
    content: '';
    position: absolute;
    left: 0; top: 0.55em;
    width: 7px; height: 7px;
    background: var(--brand-accent);
    border-radius: 50%;
  }

  /* ── Slide Type: table ───────────────────────────────────────────────────── */
  [data-type="table"] table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--small-size);
  }

  [data-type="table"] th {
    background: var(--brand-primary);
    color: #fff;
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    font-size: var(--label-size);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  [data-type="table"] td {
    padding: 7px 12px;
    color: var(--brand-text);
    border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  }

  [data-type="table"] tr:nth-child(even) td {
    background: var(--brand-surface);
  }

  /* ── Slide Type: closing ─────────────────────────────────────────────────── */
  [data-type="closing"] {
    justify-content: center;
    align-items: flex-start;
  }

  [data-type="closing"] h2 {
    border-bottom: none;
    padding-bottom: 0;
    color: #fff;
    font-size: clamp(1.8rem, 4vw, 3rem);
  }

  [data-type="closing"] .contact {
    font-size: var(--body-size);
    color: rgba(255, 255, 255, 0.65);
  }

  /* ── Entrance Animations ─────────────────────────────────────────────────── */
  /* Elements with .animate-in replay fadeUp each time their slide becomes active.
     resetAnimations() in deck.js forces a reflow to restart the keyframe. */
  .slide.active .animate-in {
    animation: fadeUp 0.45s ease both;
  }

  .slide.active .animate-in:nth-child(1) { animation-delay:   0ms; }
  .slide.active .animate-in:nth-child(2) { animation-delay:  80ms; }
  .slide.active .animate-in:nth-child(3) { animation-delay: 160ms; }
  .slide.active .animate-in:nth-child(4) { animation-delay: 240ms; }
  .slide.active .animate-in:nth-child(5) { animation-delay: 320ms; }
  .slide.active .animate-in:nth-child(6) { animation-delay: 400ms; }
  .slide.active .animate-in:nth-child(7) { animation-delay: 480ms; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Responsive: short screens ───────────────────────────────────────────── */
  @media (max-height: 600px) {
    :root {
      --slide-pad:   clamp(1rem, 3vw, 2.5rem);
      --content-gap: clamp(0.5rem, 1.5vw, 1rem);
      --title-size:  clamp(1.5rem, 4vw, 2.5rem);
      --h2-size:     clamp(1.2rem, 2.5vw, 1.8rem);
    }
    .slide-counter { display: none; }
  }

  /* ── Responsive: narrow screens ──────────────────────────────────────────── */
  @media (max-width: 768px) {
    .metric-grid { grid-template-columns: repeat(2, 1fr); }
  }

  /* ── Reduced motion ──────────────────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- [ ] 3. Verify required patterns exist:
  ```bash
  grep -c 'fadeUp'       .claude/skills/codi-content-factory/generators/slides-base.css
  # expected: 2 (keyframe definition + animation property)
  grep -c 'animate-in'   .claude/skills/codi-content-factory/generators/slides-base.css
  # expected: at least 9 (nth-child rules + animation rule)
  grep -c 'slide--blue'  .claude/skills/codi-content-factory/generators/slides-base.css
  # expected: at least 3
  grep -c '\-\-brand\-'  .claude/skills/codi-content-factory/generators/slides-base.css
  # expected: at least 10 (token usages)
  grep -c 'prefers-reduced-motion' .claude/skills/codi-content-factory/generators/slides-base.css
  # expected: 1
  ```
- [ ] 4. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/generators/slides-base.css
  git commit -m "feat(content-factory): add slides-base.css with brand tokens and entrance animations"
  ```

---

### Task 3: Create slides-base.js with rich navigation engine

**Files**: `SKILL/generators/slides-base.js`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Verify file does not exist yet:
  ```bash
  test ! -f .claude/skills/codi-content-factory/generators/slides-base.js && echo "OK: file absent"
  # expected: OK: file absent
  ```
- [ ] 2. Create the file:
  ```js
  (() => {
    const slides       = Array.from(document.querySelectorAll('.slide'));
    const progressBar  = document.getElementById('progressBar');
    const slideCounter = document.getElementById('slideCounter');
    const globalLogo   = document.getElementById('globalLogo');
    const total        = slides.length;
    let current        = 0;
    let wheelCooldown  = false;

    /**
     * Navigate to a specific slide index.
     * Resets animations on the leaving slide, adds .active to the target.
     */
    function goto(index) {
      if (index < 0 || index >= total || index === current) return;
      resetAnimations(slides[current]);
      slides[current].classList.remove('active');
      current = index;
      slides[current].classList.add('active');
      updateChrome();
      updateHash();
    }

    function next() { goto(current + 1); }
    function prev() { goto(current - 1); }

    /**
     * Forces .animate-in children to replay their keyframe on the next activation.
     * Technique: set animation:none, force reflow, then restore.
     */
    function resetAnimations(slide) {
      slide.querySelectorAll('.animate-in').forEach(el => {
        el.style.animation = 'none';
        void el.offsetHeight; // force reflow — do not remove
        el.style.animation = '';
      });
    }

    /** Update progress bar, slide counter, and logo color for the current slide. */
    function updateChrome() {
      if (progressBar)  progressBar.style.width = ((current + 1) / total * 100) + '%';
      if (slideCounter) slideCounter.textContent = (current + 1) + ' / ' + total;
      if (globalLogo) {
        const isBlue = slides[current].classList.contains('slide--blue');
        globalLogo.classList.toggle('global-logo--inverted', isBlue);
      }
    }

    /** Write #slide-N to URL for deep linking without triggering a page reload. */
    function updateHash() {
      history.replaceState(null, '', '#slide-' + (current + 1));
    }

    /** Read #slide-N from URL on initial load and jump to that slide. */
    function readHash() {
      const match = location.hash.match(/^#slide-(\d+)$/);
      if (match) {
        const idx = parseInt(match[1], 10) - 1;
        if (idx >= 0 && idx < total) {
          slides[current].classList.remove('active');
          current = idx;
          slides[current].classList.add('active');
        }
      }
    }

    // ── Keyboard ───────────────────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ':
          e.preventDefault(); next(); break;
        case 'ArrowLeft': case 'ArrowUp':
          e.preventDefault(); prev(); break;
        case 'Home': e.preventDefault(); goto(0);         break;
        case 'End':  e.preventDefault(); goto(total - 1); break;
        default:
          if (e.key >= '1' && e.key <= '9') {
            const t = parseInt(e.key, 10) - 1;
            if (t < total) goto(t);
          }
      }
    });

    // ── Mouse wheel (debounced 300ms) ──────────────────────────────────────────
    document.addEventListener('wheel', e => {
      e.preventDefault();
      if (wheelCooldown) return;
      wheelCooldown = true;
      if (e.deltaY > 0) next();
      else if (e.deltaY < 0) prev();
      setTimeout(() => { wheelCooldown = false; }, 300);
    }, { passive: false });

    // ── Touch / swipe ──────────────────────────────────────────────────────────
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      const dy = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(dx) < 50 && Math.abs(dy) < 50) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -50) next();
        else if (dx > 50) prev();
      } else {
        if (dy < -50) next();
        else if (dy > 50) prev();
      }
    }, { passive: true });

    // ── Init ───────────────────────────────────────────────────────────────────
    readHash();
    updateChrome();
  })();
  ```
- [ ] 3. Verify JS is syntactically valid and has required functions:
  ```bash
  node --check .claude/skills/codi-content-factory/generators/slides-base.js
  # expected: no output (clean parse)
  grep -c 'resetAnimations' .claude/skills/codi-content-factory/generators/slides-base.js
  # expected: 2 (definition + call in goto)
  grep -c 'touchstart\|touchend' .claude/skills/codi-content-factory/generators/slides-base.js
  # expected: 2
  grep -c 'replaceState' .claude/skills/codi-content-factory/generators/slides-base.js
  # expected: 1
  ```
- [ ] 4. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/generators/slides-base.js
  git commit -m "feat(content-factory): add slides-base.js with keyboard/wheel/touch navigation"
  ```

---

### Task 4: Create lib/bundle-html.js — CSS and JS inliner

**Files**: `SKILL/scripts/export/lib/bundle-html.js`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Write a test fixture and test script to verify behavior before implementing:
  ```bash
  # Create test fixture directory
  mkdir -p /tmp/cf-bundle-test

  # Fixture HTML with external link and script
  cat > /tmp/cf-bundle-test/deck.html << 'EOF'
  <!DOCTYPE html><html><head>
  <link rel="stylesheet" href="deck.css">
  </head><body>
  <p>Hello</p>
  <script src="deck.js"></script>
  </body></html>
  EOF

  # Fixture CSS
  echo 'body { color: red; }' > /tmp/cf-bundle-test/deck.css

  # Fixture JS
  echo 'console.log("hi");' > /tmp/cf-bundle-test/deck.js
  ```
- [ ] 2. Create the implementation file:
  ```js
  // @ts-nocheck
  /**
   * bundle-html.js — inlines <link rel="stylesheet"> and <script src> tags
   * from files in the same directory as the HTML file.
   */

  import { readFileSync, existsSync } from 'fs';
  import { join } from 'path';

  /**
   * Inlines CSS and JS referenced by <link href="..."> and <script src="..."> tags.
   * Only resolves files relative to htmlDir — skips http:// and data: URIs.
   *
   * @param {string} html     - source HTML string
   * @param {string} htmlDir  - directory of the HTML file
   * @returns {string} modified HTML string
   */
  export function bundleHtml(html, htmlDir) {
    let result = html;

    // Inline <link rel="stylesheet" href="*.css">
    result = result.replace(
      /<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/gi,
      (match, href) => {
        if (href.startsWith('http') || href.startsWith('data:')) return match;
        const cssPath = join(htmlDir, href);
        if (!existsSync(cssPath)) {
          console.warn(`  [bundle-html] CSS not found: ${cssPath} — skipping`);
          return match;
        }
        const css = readFileSync(cssPath, 'utf8');
        return `<style>\n${css}\n</style>`;
      }
    );

    // Inline <script src="*.js"></script>
    result = result.replace(
      /<script\s+src="([^"]+)"><\/script>/gi,
      (match, src) => {
        if (src.startsWith('http') || src.startsWith('data:')) return match;
        const jsPath = join(htmlDir, src);
        if (!existsSync(jsPath)) {
          console.warn(`  [bundle-html] JS not found: ${jsPath} — skipping`);
          return match;
        }
        const js = readFileSync(jsPath, 'utf8');
        return `<script>\n${js}\n</script>`;
      }
    );

    return result;
  }
  ```
- [ ] 3. Run test against the fixture created in step 1:
  ```bash
  node --input-type=module << 'EOF'
  import { strict as assert } from 'assert';
  import { readFileSync } from 'fs';
  import { bundleHtml } from './.claude/skills/codi-content-factory/scripts/export/lib/bundle-html.js';

  const html    = readFileSync('/tmp/cf-bundle-test/deck.html', 'utf8');
  const result  = bundleHtml(html, '/tmp/cf-bundle-test');

  assert.ok(!result.includes('<link rel="stylesheet"'), 'link tag should be removed');
  assert.ok(!result.includes('<script src='),           'script src should be removed');
  assert.ok(result.includes('<style>'),                 'style tag should be present');
  assert.ok(result.includes('body { color: red; }'),    'CSS content should be inlined');
  assert.ok(result.includes('console.log("hi")'),       'JS content should be inlined');
  assert.ok(result.includes('<script>'),                'inline script tag should be present');

  console.log('bundle-html: all assertions passed');
  EOF
  # expected: bundle-html: all assertions passed
  ```
- [ ] 4. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/scripts/export/lib/bundle-html.js
  git commit -m "feat(content-factory): add lib/bundle-html.js CSS and JS inliner"
  ```

---

### Task 5: Create lib/inline-assets.js — font and image base64 encoder

**Files**: `SKILL/scripts/export/lib/inline-assets.js`
**Est**: 4 minutes

**Steps**:
- [ ] 1. Create test fixtures for fonts and images:
  ```bash
  mkdir -p /tmp/cf-assets-test/fonts

  # Create a minimal dummy font file (4 bytes — just enough to be a real file)
  node -e "require('fs').writeFileSync('/tmp/cf-assets-test/fonts/test.woff2', Buffer.from([0,1,2,3]))"

  # Create a minimal SVG image
  echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>' \
    > /tmp/cf-assets-test/logo.svg

  # HTML with font reference in <style> and an <img> tag
  cat > /tmp/cf-assets-test/deck.html << 'EOF'
  <!DOCTYPE html><html><head>
  <style>
  @font-face {
    font-family: 'Test';
    src: url('fonts/test.woff2') format('woff2');
  }
  </style>
  </head><body>
  <img class="global-logo" id="globalLogo" src="logo.svg" alt="logo">
  </body></html>
  EOF
  ```
- [ ] 2. Create the implementation file:
  ```js
  // @ts-nocheck
  /**
   * inline-assets.js — converts local font and image references to base64 data URIs.
   *
   * Processes:
   *   - @font-face url('path') inside <style> blocks
   *   - <img src="path"> attributes with local file paths
   */

  import { readFileSync, existsSync } from 'fs';
  import { join, extname } from 'path';

  const FONT_MIME = {
    '.woff2': 'font/woff2',
    '.woff':  'font/woff',
    '.ttf':   'font/ttf',
    '.otf':   'font/otf',
  };

  const IMAGE_MIME = {
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
  };

  /**
   * Converts local @font-face url() references to base64 data URIs.
   * Skips http:// and data: URIs.
   *
   * @param {string} html    - source HTML string (may contain <style> blocks)
   * @param {string} baseDir - directory for resolving relative paths
   * @returns {string} modified HTML string
   */
  export function inlineFonts(html, baseDir) {
    return html.replace(
      /url\(['"]?([^'")]+\.(woff2?|ttf|otf))['"]?\)/gi,
      (match, filePath) => {
        if (filePath.startsWith('data:') || filePath.startsWith('http')) return match;
        const absPath = join(baseDir, filePath);
        if (!existsSync(absPath)) {
          console.warn(`  [inline-assets] Font not found: ${absPath} — skipping`);
          return match;
        }
        const mime = FONT_MIME[extname(absPath).toLowerCase()] ?? 'font/woff2';
        const b64  = readFileSync(absPath).toString('base64');
        return `url('data:${mime};base64,${b64}')`;
      }
    );
  }

  /**
   * Converts local <img src="..."> references to base64 data URIs.
   * Skips http:// and data: URIs.
   *
   * @param {string} html    - source HTML string
   * @param {string} baseDir - directory for resolving relative paths
   * @returns {string} modified HTML string
   */
  export function inlineImages(html, baseDir) {
    return html.replace(
      /<img([^>]*?)\ssrc="([^"]+)"([^>]*?)>/gi,
      (match, before, src, after) => {
        if (src.startsWith('data:') || src.startsWith('http')) return match;
        const absPath = join(baseDir, src);
        if (!existsSync(absPath)) {
          console.warn(`  [inline-assets] Image not found: ${absPath} — skipping`);
          return match;
        }
        const ext  = extname(absPath).toLowerCase();
        const mime = IMAGE_MIME[ext] ?? 'image/png';
        const b64  = readFileSync(absPath).toString('base64');
        return `<img${before} src="data:${mime};base64,${b64}"${after}>`;
      }
    );
  }
  ```
- [ ] 3. Run test against fixtures:
  ```bash
  node --input-type=module << 'EOF'
  import { strict as assert } from 'assert';
  import { readFileSync } from 'fs';
  import { inlineFonts, inlineImages } from './.claude/skills/codi-content-factory/scripts/export/lib/inline-assets.js';

  const html   = readFileSync('/tmp/cf-assets-test/deck.html', 'utf8');
  const dir    = '/tmp/cf-assets-test';

  const withFonts = inlineFonts(html, dir);
  assert.ok(!withFonts.includes("url('fonts/test.woff2')"), 'font url should be replaced');
  assert.ok(withFonts.includes("url('data:font/woff2;base64,"),  'base64 font should be present');

  const withImages = inlineImages(withFonts, dir);
  assert.ok(!withImages.includes('src="logo.svg"'),             'img src should be replaced');
  assert.ok(withImages.includes('src="data:image/svg+xml;base64,'), 'base64 image should be present');

  console.log('inline-assets: all assertions passed');
  EOF
  # expected: inline-assets: all assertions passed
  ```
- [ ] 4. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/scripts/export/lib/inline-assets.js
  git commit -m "feat(content-factory): add lib/inline-assets.js font and image base64 encoder"
  ```

---

### Task 6: Create compile-deck.js — standalone HTML CLI orchestrator

**Files**: `SKILL/scripts/export/compile-deck.js`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Verify `lib/state.js` exports `readState` (required dependency):
  ```bash
  grep -c 'readState' .claude/skills/codi-content-factory/scripts/export/lib/state.js
  # expected: at least 1 (named export or assignment of readState)
  ```
- [ ] 2. Create the file:
  ```js
  #!/usr/bin/env node
  // @ts-nocheck

  /**
   * compile-deck.js — bundles deck.{html,css,js} into a single standalone HTML file.
   *
   * Usage:
   *   node compile-deck.js --session <session-dir> [--out <filename>]
   *
   * Reads session state (screen_dir, exports_dir) from lib/state.js.
   * Source:  screen_dir/deck.html (must already have deck.css and deck.js as siblings)
   * Output:  exports_dir/<filename>  (default: deck-standalone.html)
   *
   * The output file has no external dependencies — fonts and images are base64-encoded,
   * CSS and JS are inlined. Safe to share as a single file.
   */

  import { readFileSync, writeFileSync, mkdirSync } from 'fs';
  import { dirname }                                from 'path';
  import { fileURLToPath }                          from 'url';
  import { readState }                              from './lib/state.js';
  import { bundleHtml }                             from './lib/bundle-html.js';
  import { inlineFonts, inlineImages }              from './lib/inline-assets.js';
  import path                                       from 'path';

  // ── CLI ─────────────────────────────────────────────────────────────────────
  const args = process.argv.slice(2);
  let sessionDir  = null;
  let outFilename = 'deck-standalone.html';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && args[i + 1]) sessionDir  = args[++i];
    if (args[i] === '--out'     && args[i + 1]) outFilename = args[++i];
  }

  if (!sessionDir) {
    console.error(
      'Usage: node compile-deck.js --session <session-dir> [--out <filename>]\n' +
      '  Example: node compile-deck.js --session .codi_output/20260413_content-factory'
    );
    process.exit(1);
  }

  // ── Main ─────────────────────────────────────────────────────────────────────
  const state   = readState(sessionDir);
  const htmlIn  = path.join(state.screen_dir, 'deck.html');
  const outPath = path.join(state.exports_dir, outFilename);

  console.log(`  Source : ${htmlIn}`);
  console.log(`  Output : ${outPath}`);

  let html = readFileSync(htmlIn, 'utf8');

  // Step 1: inline <link rel="stylesheet"> and <script src>
  html = bundleHtml(html, state.screen_dir);

  // Step 2: base64-encode @font-face url() references in the now-inlined <style>
  html = inlineFonts(html, state.screen_dir);

  // Step 3: base64-encode <img src> with local paths
  html = inlineImages(html, state.screen_dir);

  // Ensure exports_dir exists
  mkdirSync(state.exports_dir, { recursive: true });

  writeFileSync(outPath, html, 'utf8');
  console.log(`  Done → ${outFilename}`);
  ```
- [ ] 3. Verify syntax is valid:
  ```bash
  node --check .claude/skills/codi-content-factory/scripts/export/compile-deck.js
  # expected: no output (clean parse)
  grep -c 'bundleHtml\|inlineFonts\|inlineImages' \
    .claude/skills/codi-content-factory/scripts/export/compile-deck.js
  # expected: at least 3 (one call each)
  ```
- [ ] 4. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/scripts/export/compile-deck.js
  git commit -m "feat(content-factory): add compile-deck.js standalone HTML bundler"
  ```

---

### Task 7: Update all.js — add runCompileDeck after PPTX export

**Files**: `SKILL/scripts/export/all.js`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Confirm the current slides export block and `runPptxExport` function location:
  ```bash
  grep -n 'runPptxExport\|type === .slides' \
    .claude/skills/codi-content-factory/scripts/export/all.js
  # expected: lines showing the if (type === 'slides') block and runPptxExport definition
  ```
- [ ] 2. Add `runCompileDeck` call inside the slides block (after `runPptxExport`):

  Find this block in `all.js`:
  ```js
        if (type === 'slides') {
          await exportSlidesPdf(exportPage, fileUrl, pdfOut);
          await exportPage.close();

          // PPTX: spawned as a subprocess (has its own browser + Playwright session)
          const pptxOut = path.join(state.exports_dir, `${baseName}.pptx`);
          runPptxExport(fileUrl, pptxOut);
        }
  ```

  Replace with:
  ```js
        if (type === 'slides') {
          await exportSlidesPdf(exportPage, fileUrl, pdfOut);
          await exportPage.close();

          // PPTX: spawned as a subprocess (has its own browser + Playwright session)
          const pptxOut = path.join(state.exports_dir, `${baseName}.pptx`);
          runPptxExport(fileUrl, pptxOut);

          // Standalone HTML: bundles deck.{html,css,js} + inlines fonts/images
          runCompileDeck(sessionDir, baseName);
        }
  ```

- [ ] 3. Add the `runCompileDeck` function after the existing `runPptxExport` function:

  Find this block (end of `runPptxExport`):
  ```js
    if (result.status !== 0) {
      console.error(`  PPTX export failed (exit ${result.status})`);
    }
  }
  ```

  Add after it:
  ```js

  // ─── Standalone HTML compile ──────────────────────────────────────────────

  /**
   * Spawns compile-deck.js to bundle deck.{html,css,js} + assets into one HTML file.
   * Non-fatal: a compile failure logs an error but does not stop PDF/PPTX output.
   *
   * @param {string} sessionDir - session root directory (contains state/server.log)
   * @param {string} baseName   - base filename without extension (e.g. "deck")
   */
  function runCompileDeck(sessionDir, baseName) {
    const compileScript = path.join(__dirname, 'compile-deck.js');
    const outFile       = baseName + '-standalone.html';
    console.log(`  Exporting Standalone HTML...`);
    const result = spawnSync(
      process.execPath,
      [compileScript, '--session', sessionDir, '--out', outFile],
      { stdio: 'inherit' }
    );
    if (result.status !== 0) {
      console.error(`  Standalone HTML compile failed (exit ${result.status})`);
    }
  }
  ```

- [ ] 4. Verify both additions landed:
  ```bash
  grep -c 'runCompileDeck' .claude/skills/codi-content-factory/scripts/export/all.js
  # expected: 2 (call in slides block + function declaration)
  node --check .claude/skills/codi-content-factory/scripts/export/all.js 2>&1 | head -5
  # expected: no output (ESM import syntax is valid but --check is enough for parse errors)
  ```
- [ ] 5. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/scripts/export/all.js
  git commit -m "feat(content-factory): add runCompileDeck to all.js export pipeline"
  ```

---

### Task 8: Update scaffold-session.sh to copy 3 generator files

**Files**: `SKILL/scripts/scaffold-session.sh`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Check current copy block:
  ```bash
  grep -n 'slides-base\|deck.html' \
    .claude/skills/codi-content-factory/scripts/scaffold-session.sh
  # expected: 1 line copying slides-base.html → deck.html
  ```
- [ ] 2. Find the single `cp` line for slides and replace it with three lines:

  Find:
  ```bash
  cp "$SKILL_DIR/generators/slides-base.html"   "$CONTENT_DIR/deck.html"
  ```

  Replace with:
  ```bash
  cp "$SKILL_DIR/generators/slides-base.html" "$CONTENT_DIR/deck.html"
  cp "$SKILL_DIR/generators/slides-base.css"  "$CONTENT_DIR/deck.css"
  cp "$SKILL_DIR/generators/slides-base.js"   "$CONTENT_DIR/deck.js"
  ```

- [ ] 3. Update the echo output block at the end to list all three files:

  Find:
  ```bash
  echo "  deck.html     — slide deck template"
  ```

  Replace with:
  ```bash
  echo "  deck.html     — slide deck structure (edit for content)"
  echo "  deck.css      — brand tokens and animations (edit for brand overrides)"
  echo "  deck.js       — navigation engine (keyboard, wheel, touch)"
  ```

- [ ] 4. Verify:
  ```bash
  grep -c 'slides-base' .claude/skills/codi-content-factory/scripts/scaffold-session.sh
  # expected: 3 (html, css, js)
  bash -n .claude/skills/codi-content-factory/scripts/scaffold-session.sh
  # expected: no output (valid bash syntax)
  ```
- [ ] 5. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/scripts/scaffold-session.sh
  git commit -m "feat(content-factory): scaffold-session copies 3-file slide deck template"
  ```

---

### Task 9: Update SKILL.md to document 3-file flow and standalone export

**Files**: `SKILL/SKILL.md`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Check current Step 4 (slide deck generation) and Step 6 (export) sections:
  ```bash
  grep -n 'slides-base\|deck.html\|Standalone\|screen_dir/deck' \
    .claude/skills/codi-content-factory/SKILL.md
  ```
- [ ] 2. In the **Skill Assets** table, replace the existing slides row:

  Find:
  ```markdown
  | `/Users/O006783/myprojects/codi/.claude/skills/codi-content-factory/generators/slides-base.html` | HTML base for slide decks (.deck + .slide elements) |
  ```

  Replace with:
  ```markdown
  | `/Users/O006783/myprojects/codi/.claude/skills/codi-content-factory/generators/slides-base.html` | HTML structure for slide decks — references deck.css and deck.js |
  | `/Users/O006783/myprojects/codi/.claude/skills/codi-content-factory/generators/slides-base.css` | Brand tokens, entrance animations (fadeUp + staggered delays), responsive breakpoints |
  | `/Users/O006783/myprojects/codi/.claude/skills/codi-content-factory/generators/slides-base.js` | Navigation engine: keyboard, mouse wheel, touch/swipe, hash URL deep linking |
  ```

- [ ] 3. In **Step 4** (Generate Visual Assets), locate the position to insert the Slide Decks section:
  ```bash
  grep -n 'Documents / Blog\|social.html\|document.html\|screen_dir/social\|screen_dir/document' \
    .claude/skills/codi-content-factory/SKILL.md | head -5
  # Use this output to find the right insertion point in the file
  ```

  Insert the following block before the `### Documents / Blog` heading (or before the first non-slide visual asset section if that heading is absent):
  ```markdown
  ### Slide Decks
  - Start from `generators/slides-base.html` — scaffold-session.sh copies all three files (`deck.html`, `deck.css`, `deck.js`) to `screen_dir`
  - Edit `deck.html` for slide content — add `.animate-in` to every content element (headings, bullets, cards)
  - Edit `deck.css` `:root` block to override `--brand-*` tokens for the project's brand
  - Use `.slide--blue` modifier on divider, quote, and closing slides for dark backgrounds
  - Available slide types via `data-type`: `title`, `divider`, `content`, `quote`, `metrics`, `table`, `closing`

  ```

- [ ] 4. In **Step 6** (Export Final Assets), add a standalone HTML note after the existing export instructions:

  Find:
  ```markdown
  Stop the server when done:
  ```

  Insert before it:
  ```markdown
  The export step also produces `deck-standalone.html` automatically — a zero-dependency file with CSS, JS, fonts, and images all inlined. Share this file via email, Slack, or direct download. No server required.

  ```

- [ ] 5. Verify:
  ```bash
  grep -c 'deck.css\|deck.js\|deck-standalone\|slides-base.css' \
    .claude/skills/codi-content-factory/SKILL.md
  # expected: at least 4 (one mention each)
  ```
- [ ] 6. Commit:
  ```bash
  git add .claude/skills/codi-content-factory/SKILL.md
  git commit -m "docs(content-factory): update SKILL.md for 3-file deck and standalone HTML export"
  ```

---

## Verification Checklist

After all tasks are complete, run this end-to-end check:

```bash
# 1. All 3 generator files exist
ls .claude/skills/codi-content-factory/generators/slides-base.{html,css,js}
# expected: 3 files listed

# 2. All 3 compile scripts exist
ls .claude/skills/codi-content-factory/scripts/export/compile-deck.js \
   .claude/skills/codi-content-factory/scripts/export/lib/bundle-html.js \
   .claude/skills/codi-content-factory/scripts/export/lib/inline-assets.js
# expected: 3 files listed

# 3. No inline <style> or <script> in slides-base.html
grep -c '<style>' .claude/skills/codi-content-factory/generators/slides-base.html
# expected: 0

# 4. scaffold-session.sh copies 3 files
grep -c 'slides-base' .claude/skills/codi-content-factory/scripts/scaffold-session.sh
# expected: 3

# 5. all.js calls runCompileDeck
grep -c 'runCompileDeck' .claude/skills/codi-content-factory/scripts/export/all.js
# expected: 2

# 6. JS files parse cleanly
node --check .claude/skills/codi-content-factory/generators/slides-base.js
node --check .claude/skills/codi-content-factory/scripts/export/compile-deck.js
node --check .claude/skills/codi-content-factory/scripts/export/lib/bundle-html.js
node --check .claude/skills/codi-content-factory/scripts/export/lib/inline-assets.js
# expected: no output for all four
```
