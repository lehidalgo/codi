# BBVA Brand Guide — Full Reference

This document contains the complete BBVA brand identity details.
The SKILL.md holds the routing table and quick reference; this file holds the rationale and
extended usage rules.

---

## Brand Essence

**Purpose**: To bring the age of opportunity to everyone.

**Core values**:
1. **El cliente es lo primero** (Customer comes first) — Every decision starts with the customer
2. **Pensamos en grande** (We think big) — Ambitious goals, bold execution
3. **Somos un solo equipo** (We are one team) — Collaboration across boundaries

---

## Color System — Extended

Colors are extracted from the official SPHERICA BBVA PowerPoint template (Plantilla BBVA_16_9.pptx).
All values are stored in `brand/tokens.json`.

| Token | Hex | Name | Notes |
|-------|-----|------|-------|
| `primary` | `#001391` | Electric Blue | Primary brand color — all primary actions |
| `primary_dark` | `#070E46` | Midnight | Dark backgrounds, title slides |
| `primary_mid` | `#003194` | Layout Blue | Structural containers, secondary backgrounds |
| `secondary` | `#8BE1E9` | Ice | Highlights, data viz, interactive accents |
| `accent` | `#FFE761` | Canary | High-attention: callouts, badges, divider slides |
| `background` | `#F7F8F8` | Sand | Default light surface |
| `background_dark` | `#000519` | Night | Full dark-mode backgrounds |
| `text_primary` | `#1A1A2A` | — | Main body text on light |
| `text_secondary` | `#4A4A68` | — | Captions, secondary labels |
| `text_light` | `#8A8AB0` | — | Muted text, metadata |
| `border` | `#D0D0E0` | — | Dividers, card borders |
| `white` | `#FFFFFF` | — | Text on dark, clean backgrounds |

**Color usage rules**:
- Electric Blue (#001391) is the primary brand color — use for headers, primary buttons, and key UI elements
- Midnight (#070E46) for dark-mode title slides and presentation cover backgrounds
- Ice (#8BE1E9) is the secondary accent — use for data highlights, links, interactive states. Never as a primary background fill
- Canary (#FFE761) for section divider slides and high-attention callouts only — not for body text
- Sand (#F7F8F8) as the default light surface — not pure white
- Night (#000519) for full-bleed dark presentation backgrounds
- Maintain WCAG AA contrast (4.5:1 minimum) for all text/background combinations

**What NOT to use**:
- `#004481` — this is an older legacy value, not the current Electric Blue
- `#2DCCCD` — not in the current BBVA palette
- `#072146` — approximate Midnight; use `#070E46` from the template

---

## Typography — Extended

### PPTX (Python-PPTX / pptxgenjs)
- **Headlines**: Source Serif 4 (Bold) — Available as a Google Font, built into modern Office installations
- **Body**: Lato (Regular/Medium) — Available as a Google Font

### Web (HTML, CSS, dashboards)
- **Primary**: BentonSans BBVA (all weights) — available in `/assets/fonts/` as WOFF2
- **Editorial**: Tiempos Text — editorial, long-form, premium communications only
- **Fallback chain**: `'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif`

### Font files in `/assets/fonts/`
| File | Weight | Usage |
|------|--------|-------|
| BentonSansBBVA-Light.woff2 | 300 | Subtle UI, captions |
| BentonSansBBVA-Book.woff2 | 400 | Body text default |
| BentonSansBBVA-Medium.woff2 | 500 | Emphasis, labels |
| BentonSansBBVA-Bold.woff2 | 700 | Headlines, CTAs |
| TiemposTextWeb-Regular.woff2 | 400 | Long-form editorial |
| TiemposTextWeb-RegularItalic.woff2 | 400 italic | Editorial italic |
| tiempos-headline-bold.woff2 | 700 | Display headlines |
| tiempos-headline-bold-italic.woff2 | 700 italic | Display italic |

---

## Presentation Structure (PPTX)

Standard slide order:
1. **Title slide** — dark background (Night), logo, title, subtitle, author, year
2. **Section divider** — primary background (Electric Blue), large number (Canary), heading (white)
3. **Content slide** — light background (Sand), left accent bar (Electric Blue), heading + body + optional bullets + optional callout
4. **Closing slide** — dark background (Night), accent bar (Canary), "Gracias", title, BBVA wordmark

**Layout constants**:
- Slide size: 13.333" × 7.5" (widescreen 16:9)
- Content margin: 0.5" on all sides
- Left accent bar: 0.08" wide — always Electric Blue on content slides, Canary on closing

---

## Document Structure (DOCX)

Standard document sections:
1. **Cover page** — BBVA wordmark (Electric Blue), title (Midnight, large), subtitle (italic), author + date, page break
2. **Section divider** — section number + label (Electric Blue, with bottom border line), heading (Midnight, H1)
3. **Body content** — paragraphs with 1.5 line height, optional bullets, optional callout box (left border, light blue shading)

**Page margins**: 1" top/bottom, 1.2" left/right

---

## Tone of Voice — Extended

**Language**: Spanish by default for Spain/LATAM markets. English for global/international communications.

**Voice characteristics**:
- **Claro y sencillo** — Complex financial products explained in everyday language
- **Cercano y humano** — Banking is personal; write as a trusted advisor, not an institution
- **Orientado al futuro** — Focus on opportunity, growth, and digital innovation
- **Inclusivo** — Language that welcomes everyone, avoids jargon

**Writing patterns**:
- Lead with benefits, not features
- Use active voice: "Te ayudamos a..." not "Los servicios son proporcionados..."
- Short paragraphs, clear headings
- Address the customer directly ("tú" in Spain, "usted" in formal/LATAM contexts)

**Phrases to USE**:
- "Creando oportunidades"
- "Tu dinero, tus decisiones"
- "Banca responsable"
- "Transformación digital al servicio de las personas"

**Phrases to AVOID**:
- Excessive financial jargon without explanation
- "Somos líderes en..." (corporate cliché)
- Condescending language about financial literacy
- Complex regulatory language without plain-language alternatives
- "Disruptivo", "Cutting-edge", "Soluciones 360"

---

## External Resources (BBVA Corporate Design Portal)

- Full 600+ SVG icon library
- Corporate values imagery (ES/EN, plain and microillustration variants)
- SPHERICA PowerPoint template (16:9) — source of truth for colors extracted above
- SPHERICA Excel chart/table template
- Adobe Illustrator source files
