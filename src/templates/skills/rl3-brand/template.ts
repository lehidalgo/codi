import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Apply RL3 AI Agency brand identity to any content creation task. Use when creating branded materials for RL3 — presentations, documents, landing pages, proposals, or any visual/written deliverable that needs RL3 branding.
category: Brand Identity
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 1
---

## When to Activate

- User mentions 'RL3', 'nuestra marca', 'RL3 branding', or asks for RL3-branded output
- User needs a client-facing deliverable (proposal, deck, landing page) for RL3
- User is creating any document or visual that should carry the RL3 identity

# RL3 AI Agency — Brand System

## Brand Essence

**RL3** = **R**einforcement **L**earning. The **3** represents the three project phases:

> **Observar · Actuar · Iterar**

Tagline: *"Cada iteracion nos acerca al resultado optimo."*

**Core positioning**: Production AI systems that improve with every iteration. Not demos — systems that generate value from day one.

**Three service pillars**:

| # | Pilar | Phase | Description |
|---|-------|-------|-------------|
| 01 | Estrategia AI | Observe | Observamos tu entorno, disenamos la policy optima |
| 02 | Implementacion | Act | Agentes, automatizaciones y sistemas inteligentes en produccion |
| 03 | Optimizacion Continua | Iterate | Cada dato es una senal de recompensa; iterar y escalar |

---

## Process by Artifact Type

### Routing Table

| Request type | Who generates | Process |
|---|---|---|
| HTML / landing / dashboard | Claude inline | Read \\\`scripts/brand_tokens.py\\\` → generate HTML → validate |
| Word / proposal / memo | Script | Write \\\`content.json\\\` → run \\\`generate_docx.py\\\` → validate |
| PowerPoint / deck / pitch | Script | Write \\\`content.json\\\` → run \\\`generate_pptx.py\\\` → validate |
| Email / text content | Claude inline | Read brand_tokens for tone → write text → validate |

### HTML / Landing Page / Dashboard

1. Read \\\`scripts/brand_tokens.py\\\` to get current colors, fonts, layout values, and logo SVGs.
2. Generate the HTML file inline using CSS variables, Google Fonts URL, grain overlay, and logo SVG from brand_tokens.
3. Validate:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}/scripts/validators/html_validator.py --input output.html
\\\`\\\`\\\`
4. Fix any errors and re-validate until all 12 rules pass.

### Word Document / Proposal / Memo

1. Create \\\`content.json\\\` following the schema below.
2. Generate the DOCX:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}/scripts/generate_docx.py --content content.json --output output.docx
\\\`\\\`\\\`
3. Validate:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}/scripts/validators/doc_validator.py --input output.docx
\\\`\\\`\\\`
4. Fix any errors and re-validate until all 5 rules pass.

### PowerPoint / Deck / Pitch

1. Create \\\`content.json\\\` following the schema below.
2. Generate the PPTX:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}/scripts/generate_pptx.py --content content.json --output output.pptx
\\\`\\\`\\\`
3. Validate:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}/scripts/validators/pptx_validator.py --input output.pptx
\\\`\\\`\\\`
4. Fix any errors and re-validate until all 5 rules pass.

### Email / Text Content

1. Read \\\`scripts/brand_tokens.py\\\` for tone guidance: \\\`PHRASES_USE\\\`, \\\`PHRASES_AVOID\\\`, \\\`TAGLINE\\\`, \\\`CYCLE_LABEL\\\`.
2. Write content following tone of voice rules below.
3. Validate:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}/scripts/validators/style_validator.py --input output.txt
\\\`\\\`\\\`
4. Fix any errors and re-validate until all 4 rules pass.

---

## content.json Schema

All generators accept a JSON file with this structure:

\\\`\\\`\\\`json
{
  "title": "string (required)",
  "subtitle": "string (optional)",
  "date": "YYYY-MM-DD (optional)",
  "sections": [
    {
      "number": "01",
      "label": "Section Label",
      "heading": "Section Heading",
      "body": "Paragraph text.",
      "items": ["Bullet point 1", "Bullet point 2"],
      "callout": "Optional highlighted callout text"
    }
  ],
  "footer_text": "RL3 AI AGENCY"
}
\\\`\\\`\\\`

- \\\`title\\\` and \\\`sections\\\` are required; all other fields are optional.
- \\\`sections[].number\\\` uses zero-padded format: "01", "02", "03".
- \\\`sections[].callout\\\` is optional — omit the key if not needed.
- \\\`footer_text\\\` defaults to "RL3 AI AGENCY" if omitted.

---

## Visual Identity

**For exact values, always read \\\`scripts/brand_tokens.py\\\`** — it is the single source of truth.

### Color Palette

| Token | CSS Variable | Usage |
|-------|-------------|-------|
| black | \\\`--rl3-black\\\` | Primary dark / backgrounds |
| white | \\\`--rl3-white\\\` | Primary light / text on dark |
| accent | \\\`--rl3-accent\\\` | Gold: the "3", highlights, CTAs |
| accent_dim | \\\`--rl3-accent-dim\\\` | Accent at 20% opacity: glows, subtle backgrounds |
| gray | \\\`--rl3-gray\\\` | Secondary text, descriptions |
| dark_gray | \\\`--rl3-dark-gray\\\` | Cards, elevated surfaces on dark backgrounds |
| mid_gray | \\\`--rl3-mid-gray\\\` | Borders, dividers on dark backgrounds |
| light_bg | \\\`--rl3-light-bg\\\` | Light mode background alternative |

**Usage rules**:
- Gold accent is for the "3", highlights, interactive elements, and section labels. Never for large background fills.
- Default to dark mode (dark background, light text). Light mode is secondary.
- Dark mode backgrounds use the \\\`black\\\` token, never pure \\\`#fff\\\`.
- Maintain high contrast: body text on dark backgrounds uses \\\`white\\\` or \\\`light_bg\\\`.

### Typography

| Role | Font | Weight |
|------|------|--------|
| Headlines / Logo | Space Grotesk | 500-700 |
| Monospace / Labels | Space Mono | 400-700 |
| Body text | Instrument Sans | 400-600 |

See \\\`brand_tokens.GOOGLE_FONTS_URL\\\` for the import link and \\\`brand_tokens.TYPOGRAPHY\\\` for tracking and line-height values.

- Headlines: Space Grotesk, weight 600-700, tight letter-spacing
- Section labels: Space Mono, all caps, wide letter-spacing, small size, gold color
- Section label format: \\\`01 — Section Name\\\` (see \\\`brand_tokens.SECTION_LABEL_FORMAT\\\`)
- Body: Instrument Sans, generous line-height, gray for secondary text

### Logo Rules

The logo is pure typography: **RL** + **3** on a single shared baseline, with "AI AGENCY" subtitle in Space Mono below.

**Critical rules**:
1. "RL" and "3" MUST sit on the exact same baseline — one word, one line, one level.
2. Use a single \\\`<text>\\\` element with a \\\`<tspan>\\\` for the color change. **Never** two separate elements.
3. The "3" is ALWAYS in gold (\\\`brand_tokens.COLORS["accent"]\\\`). Never the same color as "RL".
4. For exact SVG markup: read \\\`brand_tokens.LOGO_DARK_BG\\\` and \\\`brand_tokens.LOGO_LIGHT_BG\\\`.
5. SVG files also available in \\\`assets/rl3-logo-dark.svg\\\` and \\\`assets/rl3-logo-light.svg\\\`.

### Design Patterns

See \\\`brand_tokens.ANIMATIONS\\\` and \\\`brand_tokens.GRAIN_OVERLAY_CSS\\\`:
- **Hover**: gold top-border reveal (scaleX from 0), background shift to slightly lighter
- **Entrance**: fadeUp animation (opacity + translateY) with staggered delays
- **Pulse**: subtle glow behind the "3" element using radial-gradient + blur
- **Cursor**: \\\`crosshair\\\` on body (signature detail)
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
- Em dash (—) ONLY in section labels (\\\`01 — Contexto\\\`). Never use em dashes to connect clauses.
- RL metaphors woven naturally: "cada dato es una senal de mejora", "la policy optima".

**Approved phrases** (see \\\`brand_tokens.PHRASES_USE\\\`):
- "Cada iteracion nos acerca al resultado optimo"
- "Observar · Actuar · Iterar"
- "No demos. Soluciones en produccion"
- "Sistemas que mejoran con el tiempo"

**Phrases to AVOID** (see \\\`brand_tokens.PHRASES_AVOID\\\`):
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
- Always include CSS variables block and Google Fonts import (from brand_tokens)
- Dark mode default with grain overlay
- Logo renders RL3 on one baseline — use \\\`<tspan>\\\` for the gold "3", never a separate element
- Include fadeUp animations and hover gold borders
- Responsive: single column below 768px

---

## Validation Rules Summary

**Total: 26 rules** (12 HTML + 5 DOCX + 5 PPTX + 4 style).

### HTML Validator — 12 rules (\\\`scripts/validators/html_validator.py\\\`)

| # | Rule | What it checks |
|---|------|----------------|
| 1 | css_variables | All 8 CSS variables present with exact hex |
| 2 | google_fonts | URL loads Space Grotesk, Space Mono, Instrument Sans |
| 3 | logo_structure | Single \\\`<text>\\\` with \\\`<tspan>\\\` for "3", not separate elements |
| 4 | logo_3_color | "3" tspan fill matches accent color |
| 5 | forbidden_phrases | No phrase from \\\`PHRASES_AVOID\\\` |
| 6 | section_labels | Labels follow "NN — Name" format |
| 7 | background_color | Body background matches black token |
| 8 | cursor_crosshair | \\\`cursor: crosshair\\\` set on body |
| 9 | grain_overlay | feTurbulence SVG filter present |
| 10 | max_width | Content container has correct max-width |
| 11 | mobile_breakpoint | Media query at the defined breakpoint |
| 12 | fade_animation | \\\`@keyframes fadeUp\\\` defined |

### DOCX Validator — 5 rules (\\\`scripts/validators/doc_validator.py\\\`)

| # | Rule | What it checks |
|---|------|----------------|
| 1 | heading_bold | At least one bold heading run |
| 2 | section_numbers | At least one paragraph with "0N" format |
| 3 | gold_accent | At least one run with gold accent color |
| 4 | footer_text | Footer contains "RL3 AI AGENCY" |
| 5 | forbidden_phrases | No phrase from \\\`PHRASES_AVOID\\\` |

### PPTX Validator — 5 rules (\\\`scripts/validators/pptx_validator.py\\\`)

| # | Rule | What it checks |
|---|------|----------------|
| 1 | slide_background | All slides have solid fill matching black token |
| 2 | logo_3_color | "3" text runs use gold color |
| 3 | title_subtitle | First slide contains "AI AGENCY" |
| 4 | section_divider | At least one slide with large gold text (>= 48pt) |
| 5 | forbidden_phrases | No phrase from \\\`PHRASES_AVOID\\\` |

### Style Validator — 4 rules (\\\`scripts/validators/style_validator.py\\\`)

| # | Rule | What it checks |
|---|------|----------------|
| 1 | forbidden_phrases | Flags any phrase from \\\`PHRASES_AVOID\\\` |
| 2 | passive_voice | Flags Spanish passive constructions |
| 3 | em_dash_misuse | Flags em dashes not used as section labels |
| 4 | generic_filler | Flags hollow marketing cliches |

---

## Testing

Run the full test suite (generates HTML, DOCX, PPTX x3 runs each, validates all, verifies SHA-256 determinism):

\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}/scripts/run_tests.py
\\\`\\\`\\\`

Expected: \\\`ALL TESTS PASSED - 3 runs, 0 errors, SHA-256 deterministic\\\`

---

## Available Agents

For automated brand quality evaluation (see \\\`agents/\\\` directory):

- **${PROJECT_NAME}-rl3-grader** — Evaluates branded outputs against RL3 brand expectations. Runs a core brand checklist (logo baseline, gold usage, dark mode, fonts, no em dashes, no banned phrases, correct cycle name "Iterar" not "Aprender", section label format) and grades each expectation pass/fail with evidence.
- **${PROJECT_NAME}-rl3-comparator** — Blind A/B comparison of two branded outputs across 6 weighted dimensions: Logo Integrity, Color Fidelity, Typography, Tone & Copy, Layout & Motion, Overall Brand Coherence. Flags critical violations that override scores.
- **${PROJECT_NAME}-rl3-analyzer** — Root-cause analysis of why one output outperformed another. Identifies failures by category (missing/ambiguous/buried instruction, missing example/warning) and generates concrete SKILL.md improvement suggestions with priority levels.

---

## Reference Files

| File | When to read |
|------|-------------|
| \\\`references/services.md\\\` | Writing proposals, service descriptions, pricing tiers, deliverables |
| \\\`references/ecosystem.md\\\` | Regional targeting (Spain, UAE, US), use case matrix, technology platform catalog |
| \\\`references/brandguide.html\\\` | Visual implementation reference: logo, colors, typography, component demos |
| \\\`references/brand-concept.html\\\` | Layout patterns, animations, full service section structure |
| \\\`assets/rl3-logo-dark.svg\\\` | Logo for light backgrounds |
| \\\`assets/rl3-logo-light.svg\\\` | Logo for dark backgrounds |
| \\\`scripts/brand_tokens.py\\\` | Single source of truth: colors, fonts, logo SVGs, approved phrases |
`;
