# Codi Design Tokens

> Source of truth: [[/references/site-style.css]]

## Color Palette

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| Background | `--bg` | `#070a0f` | Page backgrounds |
| Surface 1 | `--surface` | `#0d1117` | Cards, panels, elevated containers |
| Surface 2 | `--surface-2` | `#13181f` | Nested cards, install blocks, code blocks |
| Surface 3 | `--surface-3` | `#1c2128` | Hover states, active backgrounds |
| Border | `--border` | `rgba(255,255,255,0.06)` | Default borders |
| Accent border | `--border-a` | `rgba(86,182,194,0.22)` | Highlighted/focused borders |
| Cyan (primary) | `--c0` | `#56b6c2` | Section labels, code tint, primary accent |
| Blue (secondary) | `--c1` | `#61afef` | Secondary accent, gradient end |
| Gradient | `--grad` | `linear-gradient(135deg, #56b6c2, #61afef)` | Buttons, logo, heading highlights |
| Text primary | `--text-1` | `#e6edf3` | Body text, headings |
| Text secondary | `--text-2` | `#8b949e` | Subtext, nav links, descriptions |
| Text muted | `--text-3` | `#3d4450` | Placeholders, disabled states |
| Green | `--green` | `#98c379` | Success states, terminal checkmarks |
| Red | `--red` | `#e06c75` | Error states, problem indicators |
| Yellow | `--yellow` | `#e5c07b` | Warnings |

## CSS Variables Block

```css
:root {
  --bg: #070a0f;
  --surface: #0d1117;
  --surface-2: #13181f;
  --surface-3: #1c2128;
  --border: rgba(255, 255, 255, 0.06);
  --border-a: rgba(86, 182, 194, 0.22);
  --c0: #56b6c2;
  --c1: #61afef;
  --grad: linear-gradient(135deg, #56b6c2, #61afef);
  --text-1: #e6edf3;
  --text-2: #8b949e;
  --text-3: #3d4450;
  --green: #98c379;
  --red: #e06c75;
  --yellow: #e5c07b;
  --r: 10px;
  --rl: 16px;
  --max: 1100px;
  --gap: 76px;
}
```

## Typography

| Role | Font | Weight | Notes |
|------|------|--------|-------|
| Headlines (H1-H4) | `Outfit` | 700-800 | Google Fonts — tight letter-spacing |
| Body text | `Outfit` | 400-500 | Same family, comfortable line-height |
| Monospace / Code | `Geist Mono` | 400-500 | Google Fonts — labels, CLI, badges |

Google Fonts import:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Type scale:
- H1: `clamp(2.8rem, 6.5vw, 5.5rem)`, weight 800, letter-spacing `-0.035em`
- H2: `clamp(2rem, 4vw, 3.25rem)`, weight 700, letter-spacing `-0.025em`
- H3: `1.35rem`, weight 700, letter-spacing `-0.01em`
- H4: `1.05rem`, weight 700
- Section labels: Geist Mono, `0.68rem`, uppercase, letter-spacing `0.16em`, color `var(--c0)`
- Code inline: Geist Mono, `0.86em`, color `var(--c0)`, background `rgba(86,182,194,0.08)`, padding `2px 6px`, border-radius `4px`
- Body line-height: `1.65`

## Logo / Wordmark

Always lowercase `codi` in Geist Mono with cyan-to-blue gradient:

```css
.logo {
  font-family: 'Geist Mono', monospace;
  font-size: 1.15rem;
  font-weight: 500;
  background: var(--grad);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

Rules: always lowercase, always Geist Mono + gradient, dark backgrounds only, no image asset needed.

## Design Patterns

### Noise Overlay
```html
<div class="noise" aria-hidden="true"></div>
```
```css
.noise {
  position: fixed; inset: 0; pointer-events: none; z-index: 999; opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

### Reveal Animations
```css
.reveal { opacity: 0; transform: translateY(22px); transition: opacity 0.65s ease, transform 0.65s ease; }
.reveal.visible { opacity: 1; transform: translateY(0); }
.reveal-d1 { transition-delay: 0.08s; }
.reveal-d2 { transition-delay: 0.18s; }
.reveal-d3 { transition-delay: 0.28s; }
.reveal-d4 { transition-delay: 0.38s; }
```
Activate via IntersectionObserver adding `.visible` when elements enter the viewport.

### Gradient Text
```css
.gradient-text {
  background: var(--grad);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Card Corner Accents
```html
<div class="card">
  <span class="ps-corner ps-corner--tl"></span>
  <span class="ps-corner ps-corner--tr"></span>
  <span class="ps-corner ps-corner--bl"></span>
  <span class="ps-corner ps-corner--br"></span>
</div>
```
8px × 8px L-shaped corners via `::before`/`::after`, colored `var(--c0)` at ~40% opacity.

### Hero Glow
```css
.hero-glow {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 600px; height: 500px; pointer-events: none;
  background: radial-gradient(ellipse at center,
    rgba(86,182,194,0.13) 0%, rgba(97,175,239,0.05) 45%, transparent 70%);
}
```

### Buttons
```css
.btn-primary {
  background: var(--grad); color: #070a0f;
  padding: 13px 28px; border-radius: var(--r); font-weight: 600;
}
.btn-primary:hover { opacity: 0.87; transform: translateY(-2px); box-shadow: 0 10px 36px rgba(86,182,194,0.22); }

.btn-ghost {
  background: rgba(255,255,255,0.04); border: 1px solid var(--border);
  color: var(--text-2); padding: 13px 28px; border-radius: var(--r);
}
.btn-ghost:hover { border-color: var(--border-a); color: var(--text-1); background: rgba(86,182,194,0.05); }
```

### Feature Icon Box
```css
.feature-icon-box {
  width: 44px; height: 44px; border-radius: 10px;
  background: rgba(86,182,194,0.08); border: 1px solid var(--border-a);
  display: flex; align-items: center; justify-content: center;
}
.feature-icon {
  font-size: 1.3rem;
  background: var(--grad); -webkit-background-clip: text;
  -webkit-text-fill-color: transparent; background-clip: text;
}
```
Symbols: `⬡ ◈ ⊛ ◉ ⬘ ⊗ ◎ ⌘ ✦`

### Terminal Mockups
Geist Mono with color-coded lines:
- `.pt-muted` — `var(--text-3)` — comments
- `.pt-cmd` — `var(--text-1)` — commands
- `.pt-g` — `var(--green)` — success (`✓`)
- `.pt-cyan` — `var(--c0)` — highlight lines

### Step Numbering
Zero-padded: `01`, `02`, `03`, `04` — Geist Mono, gradient text, ~3rem, above step headings.
