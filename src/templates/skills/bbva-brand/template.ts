export const template = `---
name: codi-bbva-brand
description: "Apply BBVA brand identity to any content creation task. Use this skill whenever creating branded materials for BBVA — including presentations, documents, reports, dashboards, HTML pages, React components, emails, or any visual/written deliverable that needs BBVA branding. Also use when the user mentions 'BBVA', 'banco', 'marca BBVA', 'identidad corporativa BBVA', 'estilo BBVA', or asks to create any BBVA-branded material. Covers corporate colors, typography (BentonSans + Tiempos), logo usage, icon library, corporate values, and tone of voice."
category: brand
---

# BBVA — Brand Identity System

BBVA is a global financial group with a purpose: to bring the age of opportunity to everyone. The brand identity reflects digital transformation, customer-centricity, and trust through a clean, modern visual system.

## Brand Essence

**Purpose**: To bring the age of opportunity to everyone.

**Core values**:
1. **El cliente es lo primero** (Customer comes first) — Every decision starts with the customer
2. **Pensamos en grande** (We think big) — Ambitious goals, bold execution
3. **Somos un solo equipo** (We are one team) — Collaboration across boundaries

---

## Visual Identity

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| \`--bbva-blue\` | \`#004481\` | Primary brand color — headers, CTAs, key elements |
| \`--bbva-navy\` | \`#072146\` | Dark variant — backgrounds, text on light surfaces |
| \`--bbva-aqua\` | \`#2DCCCD\` | Secondary accent — highlights, data visualization, interactive elements |
| \`--bbva-coral\` | \`#F5835A\` | Tertiary accent — alerts, warm highlights, badges |
| \`--bbva-dark\` | \`#121212\` | Dark mode backgrounds |
| \`--bbva-white\` | \`#FFFFFF\` | Light backgrounds, text on dark |
| \`--bbva-light-gray\` | \`#F4F4F4\` | Subtle backgrounds, card surfaces |
| \`--bbva-medium-gray\` | \`#BDBDBD\` | Borders, dividers, disabled states |
| \`--bbva-text\` | \`#333333\` | Primary text on light backgrounds |
| \`--bbva-text-secondary\` | \`#666666\` | Secondary text, descriptions |

**Usage rules**:
- BBVA Blue (#004481) is the primary brand color — use for headers, primary buttons, and key UI elements
- BBVA Aqua (#2DCCCD) is the secondary accent — use for data highlights, links, and interactive states. Never use as a primary background fill.
- Maintain high contrast ratios (WCAG AA minimum) for all text/background combinations
- Light mode is the default for corporate materials. Dark mode is available for digital dashboards and presentations.

### CSS Variables Block

\`\`\`css
:root {
  --bbva-blue: #004481;
  --bbva-navy: #072146;
  --bbva-aqua: #2DCCCD;
  --bbva-coral: #F5835A;
  --bbva-dark: #121212;
  --bbva-white: #FFFFFF;
  --bbva-light-gray: #F4F4F4;
  --bbva-medium-gray: #BDBDBD;
  --bbva-text: #333333;
  --bbva-text-secondary: #666666;
  --bbva-heading-font: 'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
  --bbva-body-font: 'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
  --bbva-serif-font: 'Tiempos Text', Georgia, 'Times New Roman', serif;
}
\`\`\`

### Typography

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| **Headlines** | BentonSans BBVA | Bold (700) | 'Helvetica Neue', Arial, sans-serif |
| **Body** | BentonSans BBVA | Book (400) / Medium (500) | 'Helvetica Neue', Arial, sans-serif |
| **Editorial / Long-form** | Tiempos Text | Regular (400) | Georgia, 'Times New Roman', serif |
| **Data / Numbers** | BentonSans BBVA | Medium (500) | 'Helvetica Neue', Arial, sans-serif |

**Available font files** (in \`assets/bbva_brand/fonts/\`):
- \`benton_designers_developers/BentonSansBBVA-Light.ttf\` (300)
- \`benton_designers_developers/BentonSansBBVA-Book.ttf\` (400)
- \`benton_designers_developers/BentonSansBBVA-Medium.ttf\` (500)
- \`benton_designers_developers/BentonSansBBVA-Bold.ttf\` (700)
- \`BBVATiempos_Web(Developers)/TiemposTextWeb-Regular.woff2\`
- \`TiemposHeadline/\` (otf, ttf, woff2 formats)

**Typography rules**:
- BentonSans BBVA is the primary typeface for all digital and print materials
- Tiempos is reserved for editorial contexts, long-form reading, and premium communications
- Headlines: BentonSans Bold, tight letter-spacing
- Body: BentonSans Book/Medium, comfortable line-height (1.5-1.6)
- When BentonSans is unavailable, fallback to Helvetica Neue or Arial

### Logo

**Primary logo**: The BBVA wordmark in BBVA Blue (#004481) on white backgrounds, or white on dark backgrounds.

**Logo files available** in \`assets/bbva_brand/bbva_blue/\`:
- \`BBVA_RGB.svg\` — Vector logo (preferred for web)
- \`BBVA_RGB.png\` — Raster logo (for contexts requiring PNG)
- \`BBVA_RGB.ai\` — Source file (Adobe Illustrator)

**Logo rules**:
- Always use the official BBVA wordmark — never recreate or modify
- Minimum clear space around the logo: height of the "B" character on all sides
- On dark backgrounds, use white version of the logo
- Never stretch, rotate, or add effects to the logo

### Icon Library

300+ SVG icons available in \`assets/bbva_brand/all_icons/SVG/\`. Key categories include:
- Finance: account, add-to-cart, atm, advance, card-payment
- Navigation: arrows, back, collapse, expand, menu
- Communication: chat, email, notification, phone
- Status: check, error, warning, info
- Accessibility: accessible-toilet, accessibility

Use these icons consistently across all BBVA-branded interfaces.

---

## Tone of Voice

**Language**: Spanish by default for Spain/LATAM markets. English for global communications.

**Personality**:
- **Clear and simple** — Complex financial products explained in everyday language
- **Warm and human** — Banking is personal; write as a trusted advisor, not an institution
- **Forward-looking** — Focus on opportunity, growth, and digital innovation
- **Inclusive** — Language that welcomes everyone, avoids jargon

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

---

## Document & Presentation Standards

When creating **documents** for BBVA:
- Header: BBVA logo top-left, blue accent line
- Footer: "BBVA" in BentonSans, page number
- Headings: BentonSans Bold, BBVA Navy
- Body: BentonSans Book, adequate line spacing
- Accent color (BBVA Blue) for highlights and section markers

When creating **presentations** for BBVA:
- Use the SPHERICA template system (\`assets/bbva_brand/templates/SPHERICA-Plantilla-BBVA-16-9.potx\`)
- Light backgrounds as default (white or light gray)
- BBVA Blue for titles and key data
- Aqua for secondary highlights and data visualization
- Clean layouts with generous whitespace

When creating **web content** for BBVA:
- Include CSS variables block
- Light mode default
- Use BentonSans with appropriate fallbacks
- Follow BBVA icon library for UI elements
- Ensure WCAG AA accessibility compliance

---

## Reference Files

- \`assets/bbva_brand/bbva_blue/BBVA_RGB.svg\` — Official logo (vector)
- \`assets/bbva_brand/fonts/\` — BentonSans and Tiempos font families
- \`assets/bbva_brand/all_icons/SVG/\` — 300+ SVG icon library
- \`assets/bbva_brand/all_values/values/\` — Corporate values imagery (ES/EN)
- \`assets/bbva_brand/templates/SPHERICA-Plantilla-BBVA-16-9.potx\` — PowerPoint template
- \`assets/bbva_brand/templates/SPHERICA-Plantilla-graficos-tablas.xltx\` — Excel chart template
`;
