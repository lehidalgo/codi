# RL3 Brand Standard — Full Reference

## Visual Identity

**For exact values, always read `brand/tokens.json`** — it is the single source of truth.

### Color Palette

| Token | CSS Variable | Usage |
|-------|-------------|-------|
| black | `--rl3-black` | Primary dark / backgrounds |
| white | `--rl3-white` | Primary light / text on dark |
| accent | `--rl3-accent` | Gold: the "3", highlights, CTAs |
| accent_dim | `--rl3-accent-dim` | Accent at 20% opacity: glows, subtle backgrounds |
| gray | `--rl3-gray` | Secondary text, descriptions |
| dark_gray | `--rl3-dark-gray` | Cards, elevated surfaces on dark backgrounds |
| mid_gray | `--rl3-mid-gray` | Borders, dividers on dark backgrounds |
| light_bg | `--rl3-light-bg` | Light mode background alternative |

**Usage rules**:
- Gold accent is for the "3", highlights, interactive elements, and section labels. Never for large background fills.
- Default to dark mode (dark background, light text). Light mode is secondary.
- Dark mode backgrounds use the `black` token, never pure `#fff`.
- Maintain high contrast: body text on dark backgrounds uses `white` or `light_bg`.

### Typography

| Role | Font | Weight |
|------|------|--------|
| Headlines / Logo | Space Grotesk | 500-700 |
| Monospace / Labels | Space Mono | 400-700 |
| Body text | Instrument Sans | 400-600 |

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

- Headlines: Space Grotesk, weight 600-700, tight letter-spacing
- Section labels: Space Mono, all caps, wide letter-spacing, small size, gold color
- Section label format: `01 — Section Name`
- Body: Instrument Sans, generous line-height, gray for secondary text

### Logo Rules

The logo is pure typography: **RL** + **3** on a single shared baseline, with "AI AGENCY" subtitle in Space Mono below.

**Critical rules**:
1. "RL" and "3" MUST sit on the exact same baseline — one word, one line, one level.
2. Use a single `<text>` element with a `<tspan>` for the color change. **Never** two separate elements.
3. The "3" is ALWAYS in gold (`#c8b88a`). Never the same color as "RL".
4. SVG files: `assets/rl3-logo-dark.svg` (for light backgrounds) and `assets/rl3-logo-light.svg` (for dark backgrounds).

### Design Patterns

Design patterns:
- **Hover**: gold top-border reveal (scaleX from 0), background shift to slightly lighter
- **Entrance**: fadeUp animation (opacity + translateY) with staggered delays
- **Pulse**: subtle glow behind the "3" element using radial-gradient + blur
- **Cursor**: `crosshair` on body (signature detail)
- **Grain overlay**: SVG feTurbulence filter at very low opacity
- **Grid**: subtle 60px background grid with radial-gradient masks for hero sections
- **Cards**: 1px gap separators; max content width 1200px centered; responsive below 768px

---

## Tone of Voice

**Language**: Spanish by default (primary market: Spain/EU). Switch to English when explicitly requested or for US/UAE markets.

**Personality**: Confident but not arrogant. Technical but accessible. Direct and concise. Data-driven.

**Writing patterns**:
- Short, punchy sentences. Break long ideas into fragments.
- Prefer active voice: "Construimos agentes" not "Los agentes son construidos".
- Em dash (—) ONLY in section labels (`01 — Contexto`). Never use em dashes to connect clauses.
- RL metaphors woven naturally: "cada dato es una señal de mejora", "la policy óptima".

**Approved phrases**:
- "Cada iteración nos acerca al resultado óptimo"
- "Observar · Actuar · Iterar"
- "No demos. Soluciones en producción"
- "Sistemas que mejoran con el tiempo"

**Phrases to AVOID**:
- "Revolucionamos" / "Disruptivo" / "Cutting-edge"
- "Nuestro equipo de expertos"
- "Soluciones 360" / "End-to-end" without specifics
- "Inteligencia artificial al servicio de..."

---

## Document & Presentation Standards

**Documents (DOCX/PDF)**:
- Header: RL3 logo top-left, gold accent line below
- Footer: "RL3 AI AGENCY" in Space Mono, page number
- Headings: Space Grotesk, weight 600-700
- Section numbering: 01, 02, 03... format

**Presentations (PPTX)**:
- Dark slides (near-black background) as default
- Title slide: Logo centered, gold "3" on same baseline as "RL", subtitle in Space Mono
- Section dividers: large number in gold + section title in Space Grotesk
- Use the 3-pillar structure (Observe / Act / Iterate) when presenting methodology

**Web content (HTML/React)**:
- Always include CSS variables block and Google Fonts import (from `brand/tokens.css`)
- Dark mode default with grain overlay
- Logo renders RL3 on one baseline — use `<tspan>` for the gold "3", never a separate element
- Include fadeUp animations and hover gold borders
- Responsive: single column below 768px

---

## Validation Rules Summary

**Total: 26 rules** (12 HTML + 5 DOCX + 5 PPTX + 4 style).

### HTML Validator — 12 rules

| # | Rule | What it checks |
|---|------|----------------|
| 1 | css_variables | All 8 CSS variables present with exact hex |
| 2 | google_fonts | URL loads Space Grotesk, Space Mono, Instrument Sans |
| 3 | logo_structure | Single `<text>` with `<tspan>` for "3", not separate elements |
| 4 | logo_3_color | "3" tspan fill matches accent color |
| 5 | forbidden_phrases | No phrase from `PHRASES_AVOID` |
| 6 | section_labels | Labels follow "NN — Name" format |
| 7 | background_color | Body background matches black token |
| 8 | cursor_crosshair | `cursor: crosshair` set on body |
| 9 | grain_overlay | feTurbulence SVG filter present |
| 10 | max_width | Content container has correct max-width |
| 11 | mobile_breakpoint | Media query at the defined breakpoint |
| 12 | fade_animation | `@keyframes fadeUp` defined |

### DOCX Validator — 5 rules

| # | Rule | What it checks |
|---|------|----------------|
| 1 | heading_bold | At least one bold heading run |
| 2 | section_numbers | At least one paragraph with "0N" format |
| 3 | gold_accent | At least one run with gold accent color |
| 4 | footer_text | Footer contains "RL3 AI AGENCY" |
| 5 | forbidden_phrases | No phrase from `PHRASES_AVOID` |

### PPTX Validator — 5 rules

| # | Rule | What it checks |
|---|------|----------------|
| 1 | slide_background | All slides have solid fill matching black token |
| 2 | logo_3_color | "3" text runs use gold color |
| 3 | title_subtitle | First slide contains "AI AGENCY" |
| 4 | section_divider | At least one slide with large gold text (>= 48pt) |
| 5 | forbidden_phrases | No phrase from `PHRASES_AVOID` |

### Style Validator — 4 rules

| # | Rule | What it checks |
|---|------|----------------|
| 1 | forbidden_phrases | Flags any phrase from `PHRASES_AVOID` |
| 2 | passive_voice | Flags Spanish passive constructions |
| 3 | em_dash_misuse | Flags em dashes not used as section labels |
| 4 | generic_filler | Flags hollow marketing clichés |
