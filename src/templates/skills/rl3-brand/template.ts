import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Apply RL3 AI Agency brand identity to any content creation task. Use when creating branded materials for RL3 — presentations, documents, landing pages, proposals, or any visual/written deliverable that needs RL3 branding.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 19
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
| HTML / landing / dashboard | Claude inline | Read \\\`\${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]]\\\` → generate HTML → validate |
| Word / proposal / memo | Script | Write \\\`content.json\\\` → run \\\`codi-docx\\\` generator with \\\`--tokens\\\` → validate |
| PowerPoint / deck / pitch | Script | Write \\\`content.json\\\` → run \\\`codi-pptx\\\` generator with \\\`--tokens\\\` → validate |
| Email / text content | Claude inline | Read brand_tokens for tone → write text → validate |

### HTML / Landing Page / Dashboard

1. Read \\\`\${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]]\\\` to get current colors, fonts, layout values, and logo paths.
2. Read \\\`\${CLAUDE_SKILL_DIR}[[/scripts/ts/brand_tokens.ts]]\\\` for the TypeScript adapter with CSS variable names, SVG logos, and service pillar data.
3. Generate the HTML file inline using CSS variables, Google Fonts URL, grain overlay, and logo SVG from brand_tokens.
4. Validate:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}[[/scripts/validators/html_validator.py]] --input output.html
\\\`\\\`\\\`
5. Fix any errors and re-validate until all 12 rules pass.

### Word Document / Proposal / Memo

1. Create \\\`content.json\\\` following the schema below.
2. Generate the DOCX using the \\\`codi-docx\\\` format skill with RL3 brand tokens:
\\\`\\\`\\\`bash
if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
  npx tsx \${CODI_DOCX_SKILL_DIR}/scripts/ts/generate_docx.ts --content content.json --tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme \${BRAND_THEME} --output output.docx
elif command -v uv &>/dev/null; then
  uv run --with python-docx python3 \${CODI_DOCX_SKILL_DIR}/scripts/python/generate_docx.py --content content.json --tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme \${BRAND_THEME} --output output.docx
else
  SKILL_VENV="/tmp/codi-skill-venv" && python3 -m venv "\$SKILL_VENV" 2>/dev/null || true
  "\$SKILL_VENV/bin/pip" install -q python-docx
  "\$SKILL_VENV/bin/python3" \${CODI_DOCX_SKILL_DIR}/scripts/python/generate_docx.py --content content.json --tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme \${BRAND_THEME} --output output.docx
fi
\\\`\\\`\\\`
3. Validate:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}[[/scripts/validators/doc_validator.py]] --input output.docx
\\\`\\\`\\\`
4. Fix any errors and re-validate until all 5 rules pass.

### PowerPoint / Deck / Pitch

1. Create \\\`content.json\\\` following the schema below.
2. Generate the PPTX using the \\\`codi-pptx\\\` format skill with RL3 brand tokens:
\\\`\\\`\\\`bash
if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
  npx tsx \${CODI_PPTX_SKILL_DIR}/scripts/ts/generate_pptx.ts --content content.json --tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme \${BRAND_THEME} --output output.pptx
elif command -v uv &>/dev/null; then
  uv run --with python-pptx python3 \${CODI_PPTX_SKILL_DIR}/scripts/python/generate_pptx.py --content content.json --tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme \${BRAND_THEME} --output output.pptx
else
  SKILL_VENV="/tmp/codi-skill-venv" && python3 -m venv "\$SKILL_VENV" 2>/dev/null || true
  "\$SKILL_VENV/bin/pip" install -q python-pptx
  "\$SKILL_VENV/bin/python3" \${CODI_PPTX_SKILL_DIR}/scripts/python/generate_pptx.py --content content.json --tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme \${BRAND_THEME} --output output.pptx
fi
\\\`\\\`\\\`
3. Validate:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}[[/scripts/validators/pptx_validator.py]] --input output.pptx
\\\`\\\`\\\`
4. Fix any errors and re-validate until all 5 rules pass.

### Email / Text Content

1. Read \\\`\${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]]\\\` → \\\`voice\\\` field for tone guidance: \\\`phrases_use\\\`, \\\`phrases_avoid\\\`, \\\`tagline\\\`, \\\`cycle_label\\\`.
2. Write content following tone of voice rules below.
3. Validate:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}[[/scripts/validators/style_validator.py]] --input output.txt
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

Read \\\`\${CLAUDE_SKILL_DIR}[[/references/brand-standard.md]]\\\` for the complete brand reference: colors, typography, logo rules, design patterns, tone of voice, document standards, and all 26 validation rules.

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
| \\\`\${CLAUDE_SKILL_DIR}[[/references/services.md]]\\\` | Writing proposals, service descriptions, pricing tiers, deliverables |
| \\\`\${CLAUDE_SKILL_DIR}[[/references/ecosystem.md]]\\\` | Regional targeting (Spain, UAE, US), use case matrix, technology platform catalog |
| \\\`\${CLAUDE_SKILL_DIR}[[/references/brandguide.html]]\\\` | Visual implementation reference: logo, colors, typography, component demos |
| \\\`\${CLAUDE_SKILL_DIR}[[/references/brand-concept.html]]\\\` | Layout patterns, animations, full service section structure |
| \\\`\${CLAUDE_SKILL_DIR}[[/assets/rl3-logo-dark.svg]]\\\` | Logo for light backgrounds |
| \\\`\${CLAUDE_SKILL_DIR}[[/assets/rl3-logo-light.svg]]\\\` | Logo for dark backgrounds |
| \\\`\${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]]\\\` | Canonical brand data — single source of truth for all colors, fonts, layout, voice |
| \\\`\${CLAUDE_SKILL_DIR}[[/scripts/ts/brand_tokens.ts]]\\\` | TypeScript adapter — CSS variable names, logo SVGs, service pillar data |
`;
