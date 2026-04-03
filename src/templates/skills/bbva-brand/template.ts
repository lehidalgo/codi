import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Apply BBVA brand identity to any content creation task. Use when creating branded materials for BBVA — presentations, documents, reports, dashboards, or any visual/written deliverable that needs BBVA branding.
category: Brand Identity
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: BBVA Branding
  examples:
    - "Create a BBVA presentation"
    - "Build a BBVA-branded report"
    - "Make a BBVA dashboard"
version: 1
---

## When to Activate

- User mentions 'BBVA', 'marca BBVA', or asks for BBVA-branded output
- User needs a client-facing or internal deliverable (presentation, report, dashboard) for BBVA
- User is creating any document or visual that should carry the BBVA corporate identity



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

**Available font files** (in \`assets/fonts/\`):
- \`BentonSansBBVA-Light.woff2\` (300)
- \`BentonSansBBVA-Book.woff2\` (400)
- \`BentonSansBBVA-Medium.woff2\` (500)
- \`BentonSansBBVA-Bold.woff2\` (700)
- \`TiemposTextWeb-Regular.woff2\` (400)
- \`TiemposTextWeb-RegularItalic.woff2\` (400 italic)
- \`tiempos-headline-bold.woff2\` (700)
- \`tiempos-headline-bold-italic.woff2\` (700 italic)

**Typography rules**:
- BentonSans BBVA is the primary typeface for all digital and print materials
- Tiempos is reserved for editorial contexts, long-form reading, and premium communications
- Headlines: BentonSans Bold, tight letter-spacing
- Body: BentonSans Book/Medium, comfortable line-height (1.5-1.6)
- When BentonSans is unavailable, fallback to Helvetica Neue or Arial

### Logo

**Primary logo**: The BBVA wordmark in BBVA Blue (#004481) on white backgrounds, or white on dark backgrounds.

**Logo files available** in \`assets/\`:
- \`BBVA_RGB.svg\` — Vector logo (preferred for web)
- \`BBVA_RGB.png\` — Raster logo (for contexts requiring PNG)

**Logo rules**:
- Always use the official BBVA wordmark — never recreate or modify
- Minimum clear space around the logo: height of the "B" character on all sides
- On dark backgrounds, use white version of the logo
- Never stretch, rotate, or add effects to the logo

### Icon Library

A curated subset of 35 commonly-used SVG icons is bundled in \`assets/icons/\`:
- Finance: account, bank, card, cart, cash, dollar, euro, transfer, wallet
- Navigation: arrows, menu, search, filter, home, settings, download, upload
- Communication: chat, email, send, share
- Status: check, close, info, warning, lock, delete
- User: my-profile, mobile, calendar, document, edit, favorite, configuration, add

The full 600+ icon library is cataloged in \`references/icon-catalog.md\`. Additional icons can be obtained from the BBVA corporate design portal.

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
- Reference \`references/bbva-deck-reference.html\` for an example of BBVA-branded slide structure and styling
- The SPHERICA PowerPoint template (SPHERICA-Plantilla-BBVA-16-9.potx) is available from the BBVA corporate design portal
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

## Bundled Assets

- \`assets/BBVA_RGB.svg\` — Official logo, vector format (preferred for web)
- \`assets/BBVA_RGB.png\` — Official logo, raster format
- \`assets/fonts/\` — BentonSans BBVA (4 weights) and Tiempos (4 variants), all in WOFF2
- \`assets/icons/\` — Curated subset of 35 commonly-used SVG icons

## Reference Files

- \`references/icon-catalog.md\` — Complete listing of all 600+ icons in the BBVA library
- \`references/values-imagery.md\` — Corporate values image catalog with descriptions
- \`references/bbva-deck-reference.html\` — BBVA-branded presentation example (with .css and .js)

## External Resources (BBVA Corporate Design Portal)

- Full 600+ SVG icon library
- Corporate values imagery (ES/EN, plain and microillustration variants)
- SPHERICA PowerPoint template (16:9)
- SPHERICA Excel chart/table template
- Adobe Illustrator source files
`;
