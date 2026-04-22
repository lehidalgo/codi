# Slide Deck Engine — Creative Brief

How Content Factory decks get built: one self-contained HTML file, authored
from scratch per deck, following a structural contract and a motion brief.
No canonical CSS or JS to paste. No sibling files. No reference engine.

Read this file before writing any slide deck. Read it alongside
`[[/references/design-system.md]]` (the 13 quality rules) and `brand/tokens.*` (colors and
fonts for the active brand).

**Anchor-first context.** When the deck is distilled from an anchor (the
default for non-trivial content requests — see `[[/references/methodology.md]]`), the
compression decisions — which anchor sections become which slides, which
fold together, which are visualized as metrics — are governed by
`[[/references/distillation-principles.md]]`. This reference covers the deck's structural
contract and motion language; distillation covers *what to put in it*.
When the deck is a fast-path one-off, ignore the distillation reference
and author directly from this file.

---

## 1. Intent

A Codi slide deck is a premium, modern, animated HTML document — one file,
self-contained, brand-aligned. Each deck expresses its own style within a
quality floor. Motion is deliberate. Typography is brand. Structure is
predictable enough that the preview and export pipeline just works.

Write the HTML, CSS, and JS yourself. Do not copy from a canonical engine.
There is no engine. There is this brief, the brand tokens, the 13 design
rules, and your judgment.

---

## 2. Structural contract (required)

### 2.1 How Content Factory renders slides

Every slide is rendered **in total isolation** by Content Factory's preview
and export pipeline. The server extracts each `.slide` element's
`outerHTML`, joins it with the file's shared `<style>` blocks and
`<link rel="stylesheet">` tags, and renders that combination alone in an
iframe (preview, thumbnail) or in Playwright (PNG / PDF / PPTX).

What this means for authoring:

- Anything **outside** a `<section class="slide">` in the source file is
  dropped during extraction. No wrapper provides chrome. No global progress
  bar, no global counter, no global navigation UI.
- **Top-level `<script>` blocks are dropped.** JavaScript placed in
  `<head>` or as a direct child of `<body>` never runs in a preview,
  thumbnail, or export render.
- **Thumbnail renders strip `<script>` tags from the slide's own HTML.**
  Per-slide inline scripts run in the main preview iframe but not in
  thumbnails.
- CSS from `<style>` blocks and Google Fonts `<link>` tags is preserved
  in every render.
- Each slide must render correctly **by itself**, in its final visible
  state, with no JavaScript required for content to appear.

### 2.2 Render-context matrix

Read this table before authoring. Every feature the agent relies on must
be ✅ in every column the deck needs to live in.

| Feature                                                    | CF preview       | CF thumbnail        | PNG / PDF / PPTX | Standalone browser |
|------------------------------------------------------------|------------------|---------------------|------------------|--------------------|
| Shared `<style>` blocks                                    | ✅               | ✅                  | ✅               | ✅                 |
| Google Fonts `<link>` in `<head>`                          | ✅               | ✅                  | ✅               | ✅                 |
| Top-level `<script>` (in `<head>` or body scope)           | ❌ dropped       | ❌ dropped          | ❌ dropped       | ✅                 |
| `<script>` inside a `.slide` element                       | ✅ kept          | ❌ regex-stripped   | ✅ kept          | ✅                 |
| CSS `@keyframes` + `animation` autoplay                    | ✅               | ✅                  | ✅               | ✅                 |
| Class-based visibility across slides (`.active`, toggles)  | ❌               | ❌                  | ❌               | needs JS driver    |
| `IntersectionObserver` / any JS-gated display              | ❌               | ❌                  | ❌               | ✅                 |
| Per-slide CSS custom property (e.g. `--slide-progress`)    | ✅               | ✅                  | ✅               | ✅                 |
| Sibling selectors (`+`, `~`, `:nth-of-type`, `:has(~)`)    | ❌               | ❌                  | ❌               | ✅                 |
| Presentation-mode dual-layer pattern (head class hook)     | ❌ class dropped | ❌ class dropped    | ❌ class dropped | ✅ full UX         |

**Interpretation**: if a feature has any ❌ in a column the deck must
live in, that feature cannot drive content visibility. It may still be
used as an enhancement for the columns where it works.

### 2.3 Document shape

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="codi:template" content='{"id":"<kebab-id>","name":"<Name>","type":"slides","format":{"w":1280,"h":720}}'>
  <title>…</title>
  <!-- inline <style> block(s) — shared across all slides -->
</head>
<body>
  <div class="slides-container">
    <section class="slide" data-type="title"   data-index="01">…</section>
    <section class="slide" data-type="content" data-index="02">…</section>
    <section class="slide" data-type="closing" data-index="06">…</section>
  </div>
  <!-- inline <script> block — shared across all slides -->
</body>
</html>
```

`.slides-container` is only a stacking helper for standalone browser
viewing; Content Factory ignores it. All behavior must be defined on, or
inside, the `.slide` element.

### 2.4 Required per-slide shape

- Element: `<section class="slide" data-type="…" data-index="NN">`. `<article>` is also accepted — the extractor keys on `class="slide"`.
- CSS: `position: relative; width: 1280px; height: 720px; overflow: hidden; display: flex; flex-direction: column;`. **Slides render at exactly 1280×720 (16:9). This is the only supported canvas.** The canonical registry (`CONTENT_TYPES.slides.canvas`), the UI format selector (which offers only the 16:9 button for slides), the validator's default viewport, and every export resolution are all pinned to 1280×720. Declare the same dimensions in the `<meta name="codi:template">` tag's `format` field.
- Self-contained: any chrome you want (logo wordmark, slide counter label, accent bar, brand mark, section number, progress indicator) lives **inside** the `<section>`. Positioning is typically `position: absolute` so chrome doesn't consume the flex body.
- Progress indication — if you want a top progress bar showing deck position — must be driven by an inline CSS custom property on each slide (e.g. `style="--slide-progress: 0.3333"` for slide 2/6), rendered via `::before` track and `::after` fill with `width: calc(var(--slide-progress) * 100%)`. Never driven by JavaScript, because scripts don't run in preview or thumbnail iframes.
- Overflow contract: content must fit inside `width × height` at the base font scale. Never rely on horizontal or vertical scroll inside a slide.
- No dependency on siblings: the slide cannot reference `+ .slide`, `:nth-of-type`, or any selector that requires siblings to exist.

### 2.5 Required `data-type` values

Set `data-type` on every `<section class="slide">` using one of the
values below. Each type brings a recommended structure — the elements
the rest of this brief's CSS and the box-validator's checks assume.

| data-type | Key elements | Note |
|-----------|--------------|------|
| `title`   | `.slide__eyebrow`, `h1`, `.slide__subtitle`, `.slide__meta` | |
| `divider` | `.section-number`, `h2` | add `.slide--blue` |
| `content` | `h2`, `.bullet-list > li` (max 5) | |
| `quote`   | `blockquote`, `.attribution` | add `.slide--blue` |
| `metrics` | `h2`, `.metric-grid > .metric-card` (max 4) | |
| `table`   | `h2`, `<table><thead><tbody>` | |
| `cards`   | `h2`, `.card-grid--2` or `.card-grid--3`, `.card` | |
| `code`    | `h2`, `.code-block > pre` | |
| `split`   | `h2`, `.slide__content--split` → `.split__text` + `.split__visual` | |
| `flow`    | `h2`, `.flow` → `.flow__step` + `.flow__arrow` | |
| `closing` | `h2`, `.contact` | |

Class names are conventions, not requirements — the only hard structural
requirement is `class="slide"` + `data-type` on the `<section>`. You may
invent your own inner class names as long as the result meets the 13
design-system rules and passes the box-validator.

### 2.6 Narrative structure

Pick a narrative arc that matches the deck's purpose:

- **Problem → Solution** — pitches.
- **Progressive Disclosure** — technical explainers.
- **3-Act** — status updates (setup, challenge, resolution).
- **Comparison** — decisions (option A vs option B vs option C).

Slide budgets:

- **5-7 slides** for a 5-minute read.
- **8-12 slides** for a standard deck.
- **15-20 slides** for a deep-dive.

Pacing rule: ~2 minutes per slide, max 5 bullets per slide, lead with
the most important point.

### 2.7 Navigation behavior

Inside Content Factory, navigation is driven by the app's own UI (card
strip, arrow buttons, keyboard arrows forwarded to the preview). The
source file does not implement navigation for that context.

**For standalone viewing (the exported `.html` opened directly in a
browser), the deck MUST ship with fullscreen presentation mode.** One
slide visible at a time, scaled to fit the viewport, with keyboard and
click navigation, a page counter, and animation replay on every slide
change. Users expect decks to behave like Google Slides or PowerPoint —
vertical scrolling through stacked slides is not an acceptable
standalone experience. This is implemented as a **dual-mode** file:

#### On-screen chrome — the one rule

When presentation mode is active:

- **Always render a page counter** (e.g. `3 / 5`) — small, unobtrusive,
  bottom-right. Readers use it to track position and plan pacing.
- **Never render navigation instructions** (no "press ← →", no "click to
  advance", no keyboard hints). Arrow-key and click navigation is
  universal and intuitive for anyone consuming an HTML slide deck; on-screen
  instructions add visual noise and treat the reader as a novice.

This is the only chrome standard. Author the counter; omit the hints.

- **Base CSS** (no class hook) renders stacked slides at canvas size —
  the behavior Content Factory's isolated iframes, thumbnails, and
  Playwright exports all consume.
- **An inline `<script>` in `<head>`** sets
  `document.documentElement.classList.add('js-presentation')` before
  first paint. In every Content Factory render context the top-level
  `<script>` is dropped during card extraction, so the class is never
  applied and the base stacked layout is used. In a standalone browser
  the script runs and the `.js-presentation` class switches CSS into
  presentation mode.
- **Presentation-mode CSS** scoped under `html.js-presentation` hides
  non-current slides, positions the active slide fullscreen, scales it
  to fit via a `--fit-scale` custom property, and suppresses entry
  animations on inactive slides.
- **An end-of-body `<script>`** computes the fit scale, drives keyboard
  (`←` / `→` / `PageUp` / `PageDown` / `Home` / `End`) and click
  navigation, and replays entry animations on the newly active slide.

#### Animation replay — the universal pattern

Do NOT replay by walking a fixed list of helper classes (`.anim`,
`.anim-scale`, …). That approach silently drops any animation declared
directly on a specific selector (e.g. `.chart .bar { animation: barGrow }`)
and any animation on a pseudo-element (`::before`, `::after`). Those
animations fire once on page load while the slide is still hidden, and
never run again.

Use a **class-based reset** that covers every rule:

```css
html[data-presenting] .slide.replay,
html[data-presenting] .slide.replay *,
html[data-presenting] .slide.replay *::before,
html[data-presenting] .slide.replay *::after {
  animation: none !important;
}
```

```js
function replayAnims(slide) {
  slide.classList.add('replay');
  void slide.offsetWidth;   // force reflow
  slide.classList.remove('replay');
}
```

Adding `.replay` cancels every animation descriptor on every descendant
(and pseudo-element). The forced reflow commits that "no animation"
frame. Removing the class restores the authored rules, which now fire
from the top. This works for helper-class animations, selector-scoped
animations (bars, accent lines, card rails), and pseudo-element
animations — all from one hook.

See snippet 5.2 for the reference implementation. The head hook, the
presentation-mode CSS block, the end-of-body driver, and the page
counter are **all four mandatory** in every deck. Shipping a deck
without them — so that standalone viewing falls back to vertical
scrolling — is a defect.

### 2.8 Self-containment

The file must open and work with only the HTML file itself and
(optionally) a network connection for Google Fonts. Everything else is
inline.

---

## 3. Motion principles (creative)

No prescribed CSS. No prescribed JS. These are principles — apply them
with your own implementation.

- **Motion directs attention.** Animation is a pointer, not decoration. If a reveal does not tell the viewer "look here first", rework it.
- **Modern easing.** Use spring-like curves (`cubic-bezier(0.22, 1, 0.36, 1)` is a good default; `cubic-bezier(0.16, 1, 0.3, 1)` reads more premium; experiment). Never `linear` or browser-default `ease`.
- **Stagger with intent.** 60-120 ms between siblings reads as premium. 20 ms or less reads as rushed. 300 ms or more reads as sluggish.
- **Compositor-only.** `transform` and `opacity`. Not `width`, `height`, `top`, `left`, `margin`. The goal is 60 fps on a mid-range laptop.
- **CSS-only — autoplay on mount.** Use `@keyframes` with `animation-fill-mode: both` (or `forwards`) and a staggered `animation-delay` on child elements. Animations play automatically when the element enters the DOM and hold their final state afterward. This works uniformly across every render context: preview iframe, thumbnail iframe (scripts stripped — CSS survives), Playwright export (screenshot after animation completes), and standalone browser viewing.
- **No JavaScript in the content-visibility path.** Scripts may or may not execute depending on the render context (preview: shared scripts dropped; thumbnail: all scripts stripped; export: shared scripts may run but Playwright does not wait for observer callbacks). JS is acceptable for purely additive enhancements like keyboard scroll navigation in standalone viewing — never for making content visible.
- **Feel premium.** This is a pitch deck, not a screensaver. Every easing curve, every duration, every delay matters.

### 3.1 Why CSS autoplay is the robust pattern

Class-based toggling across slides (an "active" slide, cross-fade between
active and inactive) does not survive per-slide isolation — when one slide
renders alone, there is no "previous" or "next". JavaScript-driven
visibility (e.g. `IntersectionObserver` setting a class) does not survive
either: top-level scripts are dropped during extraction, thumbnail scripts
are stripped by regex, and Playwright screenshots before observer
callbacks may fire. CSS `@keyframes` with `animation-fill-mode: both`
runs in every context without coordination: the element mounts, the
animation plays, the final state is held. Deterministic in isolation,
deterministic in full page, deterministic under screenshot.

### 3.2 Accessibility

- Honor `@media (prefers-reduced-motion: reduce)`. Set `animation: none` and place elements in their final state.
- The final state of every animation must leave content fully visible. Never leave elements in a hidden state at the end of the animation.

---

## 4. Brand alignment (required)

- **Colors, typography, spacing** come from the active brand's tokens. Read `brand/tokens.json` for structured values; read `brand/tokens.css` to copy CSS custom properties into the inline `<style>` block.
- **Voice and copy** follow the brand's tone-and-copy reference. Do not invent taglines, do not import external marketing copy.
- **Logo** — for Codi, render the CSS gradient wordmark (see `codi-brand`). For other brands, follow their logo rules.
- **The 13 design-system rules apply** — see `[[/references/design-system.md]]` for the full rule set and SKILL.md for the short summary.

### 4.1 Fonts

- Google Fonts via a single `<link href="https://fonts.googleapis.com/...">` in `<head>` is the recommended approach.
- System font stacks are also acceptable (e.g. `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`).
- If the user explicitly asks for offline portability, inline fonts as `@font-face { src: url(data:font/woff2;base64,…) }` in the inline `<style>` block.

---

## 5. Illustrative snippets

These are **one way** to implement the contract. You are free to replace
them entirely with the Web Animations API, the View Transitions API,
scroll-driven animations, or any approach that meets the brief. Do not
feel bound by the shape of these examples.

### 5.1 CSS — autoplay staggered reveal

```css
.slide .animate-in {
  opacity: 0;
  transform: translateY(22px);
  animation: fadeUp 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.slide .animate-in:nth-child(1) { animation-delay:  80ms; }
.slide .animate-in:nth-child(2) { animation-delay: 160ms; }
.slide .animate-in:nth-child(3) { animation-delay: 240ms; }
.slide .animate-in:nth-child(4) { animation-delay: 320ms; }
.slide .animate-in:nth-child(5) { animation-delay: 400ms; }
.slide .animate-in:nth-child(6) { animation-delay: 480ms; }
.slide .animate-in:nth-child(7) { animation-delay: 560ms; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .slide .animate-in { opacity: 1; transform: none; animation: none; }
}
```

Key properties:

- `animation-fill-mode: both` (the trailing `both` keyword) ensures the
  element holds the `to` state after the animation finishes, and starts
  in the `from` state before it begins. The final frame is always visible.
- No JavaScript is required to trigger the animation. It fires on mount.
- Grid-based staggers (e.g. a metric grid or card grid where
  `:nth-child` doesn't match the visual order) use `animation-delay: calc(var(--i) * 80ms)` with `style="--i: 0"` markers.

### 5.2 MANDATORY — dual-mode standalone presentation

Head hook (runs before first paint; dropped by Content Factory extraction):

```html
<script>document.documentElement.classList.add('js-presentation');</script>
```

Presentation-mode CSS (only activates when the class above is present):

```css
html.js-presentation, html.js-presentation body {
  width: 100vw; height: 100vh;
  margin: 0; padding: 0; overflow: hidden; background: #000;
}
html.js-presentation .slides-container {
  position: relative; width: 100vw; height: 100vh;
  padding: 0; gap: 0;
}
html.js-presentation .slide {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(var(--fit-scale, 1));
  opacity: 0;
  pointer-events: none;
  transition: opacity 520ms cubic-bezier(0.22, 1, 0.36, 1);
}
html.js-presentation .slide.is-current {
  opacity: 1; pointer-events: auto;
}
html.js-presentation .slide:not(.is-current) .animate-in,
html.js-presentation .slide:not(.is-current) .stagger > * {
  animation: none; opacity: 0;
}
```

End-of-body driver (fit, navigate, replay):

```js
(function () {
  var root = document.documentElement;
  var slides = [...document.querySelectorAll('.slide')];
  if (!slides.length) return;
  var CANVAS_W = 1280, CANVAS_H = 720, current = 0;

  function fit() {
    var s = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
    root.style.setProperty('--fit-scale', String(s));
  }
  function replay(slide) {
    var targets = slide.querySelectorAll('.animate-in, .stagger > *');
    targets.forEach((el) => { el.style.animation = 'none'; });
    void slide.offsetWidth;
    targets.forEach((el) => { el.style.animation = ''; });
  }
  function show(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, idx) => s.classList.toggle('is-current', idx === current));
    replay(slides[current]);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); show(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(current - 1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1); }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (e.clientX < window.innerWidth / 3) show(current - 1);
    else show(current + 1);
  });

  fit();
  window.addEventListener('resize', fit);
  show(0);
})();
```

All three pieces are **additive**:

- If the head hook is stripped (Content Factory): `.js-presentation` never applies. Base stacked CSS renders. The end-of-body driver also runs in that case only in standalone viewing — in Content Factory iframes the end-of-body `<script>` is likewise dropped, so nothing runs.
- If only the head hook runs but the driver doesn't (unlikely — same document, same drop rules): CSS hides non-current slides but none are marked current. The reference implementation handles this by calling `show(0)` at startup.
- If neither runs (Content Factory or no-JS browser): stacked base layout with CSS-only autoplay animations — always legible.

Keyboard and click nav, animation replay, viewport-fit scaling, and
fullscreen letterboxing are all standalone-only behaviors that cost
nothing in the Content Factory render path.

---

## 6. Anti-patterns

- **No JavaScript in the content-visibility path.** Scripts are dropped in preview (top-level `<script>` blocks) and stripped in thumbnails (per-slide inline `<script>` tags). Content must reach its final visible state using CSS alone.
- **No `IntersectionObserver`, no class-toggling JS, no observer-gated visibility.** These patterns look correct but silently fail in Content Factory preview and thumbnail iframes.
- **No `.active` state across slides**, no cross-fade between slides, no "current slide" toggling. Each slide renders in isolation; siblings are not available.
- **No global chrome outside `<section class="slide">`**. Progress bars, navigation UI, logos placed as siblings of slides are dropped during extraction.
- **No `<link rel="stylesheet">`** to anything except `https://fonts.googleapis.com/…`.
- **No `<script src>`.** All JavaScript is inline in `<script>` blocks.
- **No `/api/brand/…`, `/vendor/…`, `/static/…` URLs** in the output — these are server-relative paths that break once the file is downloaded.
- **No CDN references** for JavaScript libraries. Write what you need.
- **No `fetch`, `XMLHttpRequest`, or network calls at runtime.**
- **No `eval` or dynamic code generation.**
- **No sibling files.** The output is one `.html` file.
- **Images**: inline `<svg>` markup for SVGs, `<img src="data:image/…;base64,…">` for raster. Never a server-relative image path.
- **No synchronous DOM writes during page load.** Use `createElement` + `append` if you must generate DOM at runtime.
- **No base CSS state that leaves content invisible by default.** The final frame of every `@keyframes` must leave elements visible, and `animation-fill-mode: both` must hold that final state.

---

## 7. Per-slide verification

The per-slide checklist and the box-validator command both live in SKILL.md
(Step 3b — Validate layout structure) and `[[/references/design-system.md]]`. Run them
after every structural edit; ship only after the final check passes.

Additional checks specific to single-file authoring:

- Open the file directly in a browser (outside Content Factory). Confirm
  the deck enters presentation mode (first slide fullscreen, animated)
  and keyboard/click navigation works.
- Load the file in Content Factory. Confirm the card strip shows every
  slide rendered correctly (not blank), and the main preview animates on
  card change.
- Export PNG, PDF, PPTX. Confirm no slide is black or empty.
- Export HTML · all. Confirm the downloaded file is byte-identical to the
  source (`diff` produces no output).

### 7.1 Pre-ship self-audit

Run through this checklist before declaring a deck done. A single
unchecked item is a blocker.

**Structural contract**

- [ ] Every slide is `<section class="slide" data-type="…" data-index="NN">`.
- [ ] Every slide has `width: 1280px; height: 720px; overflow: hidden; position: relative;`.
- [ ] Every slide is fully self-contained — logo, counter, progress, brand mark all **inside** the `<section>`.
- [ ] No class called `active`, `current`, or any name that implies cross-slide state on slide elements themselves.
- [ ] If a progress bar is shown, each slide declares its own via inline `style="--slide-progress: N/total"`, not via JavaScript.

**Render self-containment**

- [ ] `grep '<script src='` against the file → zero matches.
- [ ] `grep '<link.*href="http'` → only hits are `https://fonts.googleapis.com/` / `https://fonts.gstatic.com/`.
- [ ] `grep '/api/brand/\|/vendor/\|/static/'` → zero matches.
- [ ] `grep 'fetch\s*(\|XMLHttpRequest\|\beval\b'` → zero matches.
- [ ] No `<img src="/…">` or `<img src="http…">` — SVG is inline `<svg>`, raster is `data:` URI.

**Motion**

- [ ] Every `.animate-in` or staggered child uses CSS `@keyframes` + `animation` with `animation-fill-mode: both` (or `forwards`).
- [ ] No element depends on a JS-applied class to become visible.
- [ ] `@media (prefers-reduced-motion: reduce)` is honored and leaves content visible.

**Render-context checks**

- [ ] Content Factory preview — open the file, click each thumbnail, confirm every slide renders (no blanks).
- [ ] Content Factory exports — export PNG (current slide), PDF (all), PPTX (all); every slide is populated.
- [ ] Standalone browser — open the `.html` file directly; confirm fullscreen presentation mode, keyboard navigation, click navigation, animation replay on each slide change.
- [ ] HTML export is byte-identical to the source (`diff <source> <exported>` → empty).

**Quality floor**

- [ ] Box validator passes for every slide at 1280×720 using the session threshold. Default for slides is strict ≥ 0.9 — check `GET /api/validation-config` if unsure.
- [ ] No overflow on any slide (every element visible, nothing clipped).
- [ ] The 13 design-system rules hold on a spot-check.

---

## 8. Reminder — what this brief is

Principles, contract, and anti-patterns. Not a template. Not a code drop.
Every deck is written from scratch. Every deck can look different. All of
them honor the same mechanical contract (per-slide isolation, visibility-
gated motion, self-contained chrome) and the same quality bar (13 design
rules, brand alignment).
