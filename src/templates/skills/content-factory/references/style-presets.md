# Content Factory — Style Presets Reference

When generating social cards, the user selects a style preset from the app gallery.
Read the selected preset from `state_dir/preset.json` before generating any HTML.

## Reading the selected preset

```bash
cat <state_dir>/preset.json
# Returns: {"id":"dark-editorial","name":"Dark Editorial","timestamp":1234567890}
```

Use the `id` field to choose the corresponding CSS and layout pattern below.

---

## Preset: `dark-editorial`

**Dark Editorial** — Deep dark base, gradient italic accents, progress track bottom bar.

### CSS foundation

```css
/* Fonts */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@300;400;500&display=swap');

/* Card base */
.social-card {
  width: 1080px;
  height: 1080px;
  background: #070a0f;
  color: #e6edf3;
  font-family: 'Outfit', sans-serif;
  display: flex;
  flex-direction: column;
  padding: 52px;
  position: relative;
  overflow: hidden;
}

/* Gradient italic accent — use on em elements inside headlines */
em.acc {
  font-style: italic;
  font-weight: 800;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Bottom bar with progress track */
.card-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 80px;
  background: rgba(0, 0, 0, 0.28);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  padding: 0 52px;
  gap: 12px;
}

.bar-handle {
  font-family: 'Geist Mono', monospace;
  font-size: 22px;
  color: #e6edf3;
}

.prog-track {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.prog-bar {
  width: 28px;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.12);
}

/* Active bar: set on the bar matching this card's position */
.prog-bar.active {
  background: linear-gradient(135deg, #56b6c2, #61afef);
}
```

### Card HTML pattern

```html
<article class="social-card" data-type="cover" data-index="01">
  <div class="card-tag">01 · INTRO</div>
  <h1 class="card-head">Your rules,<br><em class="acc">your agents</em></h1>
  <p class="card-body">One config source.<br>All AI tools, in sync.</p>
  <div class="card-bar">
    <span class="bar-handle">@username</span>
    <div class="prog-track">
      <div class="prog-bar active"></div>
      <div class="prog-bar"></div>
      <div class="prog-bar"></div>
      <div class="prog-bar"></div>
    </div>
  </div>
</article>
```

---

## Preset: `minimal-mono`

**Minimal Mono** — Monospace type, thin accent border, high contrast typographic hierarchy.

### CSS foundation

```css
.social-card {
  width: 1080px;
  height: 1080px;
  background: #0a0e13;
  color: #e6edf3;
  font-family: 'Geist Mono', monospace;
  display: flex;
  flex-direction: column;
  padding: 60px;
  border: 1px solid rgba(86, 182, 194, 0.18);
}

.card-tag {
  font-size: 18px;
  font-weight: 300;
  color: rgba(86, 182, 194, 0.7);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: auto;
}

.card-head {
  font-size: 104px;
  font-weight: 300;
  line-height: 1.0;
  letter-spacing: -0.04em;
  margin-bottom: 28px;
}

.card-head .accent { color: #56b6c2; }

.card-body {
  font-size: 26px;
  font-weight: 300;
  color: rgba(230, 237, 243, 0.5);
  line-height: 1.6;
  margin-bottom: 48px;
}

.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.bar-handle { font-size: 20px; color: rgba(86, 182, 194, 0.5); }

.card-num {
  font-size: 80px;
  font-weight: 200;
  color: rgba(86, 182, 194, 0.1);
  line-height: 1;
}
```

### Card HTML pattern

```html
<article class="social-card" data-type="intro" data-index="01">
  <div class="card-tag">INTRODUCING</div>
  <h1 class="card-head">codi<span class="accent">.</span></h1>
  <p class="card-body">Unified config platform<br>for AI coding agents</p>
  <div class="card-foot">
    <span class="bar-handle">@username</span>
    <span class="card-num">01</span>
  </div>
</article>
```

---

## Preset: `split-column`

**Split Column** — Two-column contrast layout. Use for before/after, comparisons, or dual-concept cards.

### CSS foundation

```css
.social-card {
  width: 1080px;
  height: 1080px;
  background: #070a0f;
  font-family: 'Outfit', sans-serif;
  color: #e6edf3;
  display: flex;
  flex-direction: row;
  position: relative;
  overflow: hidden;
}

.col-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 52px;
  background: #0d1117;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.col-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 52px;
  background: rgba(86, 182, 194, 0.03);
}

.col-label {
  font-family: 'Geist Mono', monospace;
  font-size: 18px;
  color: rgba(230, 237, 243, 0.35);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.col-head {
  font-size: 64px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.col-sub {
  font-size: 28px;
  font-weight: 300;
  color: rgba(230, 237, 243, 0.55);
  line-height: 1.4;
}

.accent { color: #56b6c2; }

.card-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 68px;
  background: rgba(0, 0, 0, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  padding: 0 52px;
}

.bar-handle {
  font-family: 'Geist Mono', monospace;
  font-size: 20px;
  color: rgba(230, 237, 243, 0.5);
}
```

### Card HTML pattern

```html
<article class="social-card" data-type="compare" data-index="01">
  <div class="col-left">
    <div class="col-label">Before</div>
    <div>
      <div class="col-head">5 agent<br>configs</div>
      <div class="col-sub">manually synced</div>
    </div>
  </div>
  <div class="col-right">
    <div class="col-label">After <span class="accent">codi</span></div>
    <div>
      <div class="col-head">1 source<br>of truth</div>
      <div class="col-sub">auto-synced</div>
    </div>
  </div>
  <div class="card-bar"><span class="bar-handle">@username</span></div>
</article>
```

---

## Preset: `surface-glow`

**Surface Glow** — Gradient card surface, radial glow accent, rounded corners, layered depth.

### CSS foundation

```css
body { display: flex; align-items: center; justify-content: center; background: #050709; }

.social-card {
  width: 940px;
  height: 940px;
  background: linear-gradient(135deg, #0d1117, #0f1621);
  border: 1px solid rgba(86, 182, 194, 0.18);
  border-radius: 24px;
  box-shadow: 0 0 80px rgba(86, 182, 194, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  font-family: 'Outfit', sans-serif;
  color: #e6edf3;
  display: flex;
  flex-direction: column;
  padding: 60px;
  position: relative;
  overflow: hidden;
}

.card-glow {
  position: absolute;
  top: -100px; right: -60px;
  width: 440px; height: 440px;
  background: radial-gradient(circle, rgba(86, 182, 194, 0.09), transparent 70%);
  pointer-events: none;
}

.card-tag {
  font-family: 'Geist Mono', monospace;
  font-size: 20px;
  color: rgba(86, 182, 194, 0.55);
  margin-bottom: 32px;
  letter-spacing: 0.08em;
}

.card-head {
  font-size: 80px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 24px;
}

em.acc {
  font-style: italic;
  display: inline-block;
  padding-bottom: 0.06em;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.card-body {
  font-size: 30px;
  color: rgba(230, 237, 243, 0.6);
  line-height: 1.5;
  flex: 1;
}

.bar-handle {
  font-family: 'Geist Mono', monospace;
  font-size: 20px;
  color: rgba(86, 182, 194, 0.45);
}
```

### Card HTML pattern

```html
<article class="social-card" data-type="solution" data-index="02">
  <div class="card-glow"></div>
  <div class="card-tag">02 · SOLUTION</div>
  <h1 class="card-head">Ship quality<br><em class="acc">AI workflows</em><br>today</h1>
  <p class="card-body">codi generates the right config<br>for every AI tool you use.</p>
  <span class="bar-handle">@username</span>
</article>
```

---

## Preset: `poster-bold`

**Poster Bold** — Oversized type, maximum graphic impact, minimal words, full-bleed layout.

### CSS foundation

```css
.social-card {
  width: 1080px;
  height: 1080px;
  background: #070a0f;
  font-family: 'Outfit', sans-serif;
  color: #e6edf3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 60px 60px 0;
  overflow: hidden;
}

.card-head {
  font-size: 160px;
  font-weight: 900;
  line-height: 1.0;
  letter-spacing: -0.05em;
}

em.acc {
  font-style: italic;
  display: inline-block;
  padding-bottom: 0.06em;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.card-sub {
  font-size: 36px;
  font-weight: 300;
  color: rgba(230, 237, 243, 0.45);
}

.card-bar {
  height: 100px;
  background: linear-gradient(90deg, rgba(86, 182, 194, 0.1), transparent);
  border-top: 2px solid rgba(86, 182, 194, 0.25);
  display: flex;
  align-items: center;
  padding: 0 60px;
  margin: 0 -60px;
}

.bar-handle {
  font-family: 'Geist Mono', monospace;
  font-size: 24px;
  color: rgba(86, 182, 194, 0.6);
}

.bar-brand {
  font-family: 'Geist Mono', monospace;
  font-size: 24px;
  font-weight: 500;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-left: auto;
}
```

### Card HTML pattern

```html
<article class="social-card" data-type="poster" data-index="01">
  <div>
    <h1 class="card-head">One<br><em class="acc">config.</em></h1>
    <p class="card-sub">Every AI tool.</p>
  </div>
  <div class="card-bar">
    <span class="bar-handle">@username</span>
    <span class="bar-brand">codi</span>
  </div>
</article>
```

---

## General rules for all presets

- Each `.social-card` needs `data-type` and `data-index` attributes
- Default card size: 1080×1080px unless format changed (4:5 = 1080×1350, 9:16 = 1080×1920, OG = 1200×630)
- Write all cards into one file: `<screen_dir>/social.html`
- Each card is a full `<article class="social-card">` element; the app extracts them individually
- Replace `@username` with the handle from the app's Handle input (default: `@lehidalgo`)
- Include all CSS in `<style>` tags in the document `<head>` — the app extracts and applies them per card

---

## MANDATORY — Typography safety rules (no exceptions)

These rules prevent glyph clipping. All social cards use `overflow: hidden` on the container.
Italic glyphs have ink that physically extends beyond their line box. When `line-height < 1.0`,
the line box is shorter than the cap height, so italic ascenders overflow the box and get
hard-clipped by the parent `overflow: hidden`. The `-webkit-background-clip: text` gradient
technique makes this visible as a sharp cut through letterforms.

### Rule 1 — Never use `line-height` below `1.0` on any headline

```css
/* BAD — glyph ink clips at the line box edge */
.card-head { font-size: 80px; line-height: 0.9; }

/* GOOD — line box tall enough for italic glyph ink */
.card-head { font-size: 80px; line-height: 1.05; }
```

Recommended minimum values by font-size range:

| Font size | Minimum `line-height` |
|-----------|----------------------|
| < 60px    | 1.1                  |
| 60–100px  | 1.05                 |
| 100–160px | 1.0                  |
| > 160px   | 1.0                  |

### Rule 2 — Always add `display: inline-block; padding-bottom: 0.06em` to gradient italic elements

`-webkit-background-clip: text` renders only inside the element's own box. `display: inline`
(the default for `em`) does not create a block box — the bottom padding is ignored. Use
`display: inline-block` so the element gets a real box and `padding-bottom` adds physical
space below the baseline for descenders and italic overhang.

```css
/* BAD — gradient clips at baseline; italic descenders cut off */
em.acc {
  font-style: italic;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* GOOD — full glyph ink visible */
em.acc {
  font-style: italic;
  display: inline-block;       /* creates a real box so padding works */
  padding-bottom: 0.06em;      /* room for italic descenders */
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

This rule applies to **every** element that combines all three of: `font-style: italic`,
`-webkit-background-clip: text`, and a parent with `overflow: hidden`.

### Rule 3 — Apply the same fix to any other gradient text inside `overflow: hidden` containers

Stat values, pull quotes, brand wordmarks — any element using `-webkit-background-clip: text`
inside an `overflow: hidden` container must also use `display: inline-block` and
`padding-bottom: 0.06em` if the element is italic, or if the font is large enough that
the gradient may clip at the bottom of tall numerals or capitals.

### Checklist before writing final HTML

Before writing any generated card HTML, check each rule:

- [ ] Every headline has `line-height >= 1.0`
- [ ] Every `em.acc` / gradient italic element has `display: inline-block; padding-bottom: 0.06em`
- [ ] Every gradient stat/number element inside `overflow: hidden` has `display: inline-block`
- [ ] No element uses `line-height` values like `.85`, `.88`, `.9`, `.95` on heading classes
