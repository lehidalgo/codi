import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Apply BBVA brand identity to any content creation task. Use when creating branded materials for BBVA — presentations, documents, reports, dashboards, or any visual/written deliverable that needs BBVA branding. Also activate when the user mentions 'BBVA', 'marca BBVA', 'estilo BBVA', or asks for BBVA-branded output of any kind.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 18
---

## When to Activate

- User mentions 'BBVA', 'marca BBVA', or asks for BBVA-branded output
- User needs a client-facing or internal deliverable (presentation, report, dashboard) for BBVA
- User is creating any document or visual that should carry the BBVA corporate identity

## Generator Routing (PPTX / DOCX / XLSX)

BBVA PPTX uses a **brand-specific generator** that reproduces the official BBVA presentation template (10" × 5.625"). Run it from the brand skill directory:

\`\`\`bash
if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
  npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/generate_pptx.ts]] --content content.json --theme \${BRAND_THEME} --output out.pptx
elif command -v uv &>/dev/null; then
  uv run --with python-pptx python3 \${CODI_PPTX_SKILL_DIR}/scripts/python/generate_pptx.py --content content.json --tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme \${BRAND_THEME} --output out.pptx
else
  SKILL_VENV="/tmp/codi-skill-venv" && python3 -m venv "\${SKILL_VENV}" 2>/dev/null || true
  "\${SKILL_VENV}/bin/pip" install -q python-pptx
  "\${SKILL_VENV}/bin/python3" \${CODI_PPTX_SKILL_DIR}/scripts/python/generate_pptx.py --content content.json --tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme \${BRAND_THEME} --output out.pptx
fi
\`\`\`

For DOCX and XLSX, use the format skill generators with \`--tokens \${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]]\`.

- \`\${CLAUDE_SKILL_DIR}\` — this brand skill directory (provides BBVA-specific generator + tokens)
- \`\${CODI_PPTX_SKILL_DIR}\` / \`\${CODI_DOCX_SKILL_DIR}\` / \`\${CODI_XLSX_SKILL_DIR}\` — format skill directories (DOCX/XLSX fallback)
- \`\${BRAND_THEME}\` — \`dark\` or \`light\` (ask the user if not specified; dark = Electric Blue bg on cover/closing)

| Validator | Command |
|-----------|---------|
| Validate PPTX (TypeScript) | \`npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/validators/validate_pptx.ts]] --input out.pptx\` |

**content.json schema** (BBVA-specific slide types):
\`\`\`json
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle",
  "author": "Author Name",
  "date": "April 2026",
  "slides": [
    { "type": "title" },
    {
      "type": "divider",
      "number": "01",
      "label": "SECCIÓN",
      "heading": "Título de sección"
    },
    {
      "type": "section",
      "heading": "Título de diapositiva",
      "breadcrumb": "NOMBRE PRESENTACIÓN / SECCIÓN",
      "body": "Párrafo de cuerpo",
      "items": ["Punto uno", "Punto dos"],
      "callout": "Texto destacado opcional"
    },
    {
      "type": "quote",
      "quote": "Creando oportunidades para todos.",
      "attribution": "Nombre, Cargo"
    },
    {
      "type": "metrics",
      "heading": "CIFRAS CLAVE",
      "breadcrumb": "NOMBRE PRESENTACIÓN / SECCIÓN",
      "metrics": [
        { "value": "€12M", "label": "Ingresos" },
        { "value": "34%",  "label": "Crecimiento" },
        { "value": "420",  "label": "Clientes" }
      ]
    },
    { "type": "closing", "message": "Gracias", "contact": "equipo@bbva.com" }
  ]
}
\`\`\`

**Slide types reference:**

| type | Required fields | Optional fields | Layout |
|------|----------------|-----------------|--------|
| \`title\`   | — (uses top-level fields) | title, subtitle, author, date | White cover (light) or Electric Blue (dark) |
| \`divider\` | heading | number, label | Ice Blue bg (#85C8FF), large title at bottom-left |
| \`section\` | heading | body, items, callout, breadcrumb | White bg, breadcrumb at top |
| \`quote\`   | quote | attribution | Electric Blue bg, italic quote |
| \`metrics\` | metrics[] (max 4) | heading, breadcrumb | White bg, colored metric boxes |
| \`closing\` | message | contact | Electric Blue bg, logo + centered message |

---

# BBVA — Brand Identity System

BBVA is a global financial group with a purpose: to bring the age of opportunity to everyone.
Full brand guide: \`\${CLAUDE_SKILL_DIR}[[/references/brand-guide.md]]\`

## Bundled Assets

- \`\${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]]\` — canonical color/font/layout data (pass via \`--tokens\`)
- \`\${CLAUDE_SKILL_DIR}[[/scripts/ts/brand_tokens.ts]]\` — TypeScript adapter for brand_tokens.json
- \`\${CLAUDE_SKILL_DIR}[[/scripts/ts/validators/validate_pptx.ts]]\` — TypeScript PPTX validator
- \`\${CLAUDE_SKILL_DIR}[[/references/brand-guide.md]]\` — full brand rationale and usage rules
- \`\${CLAUDE_SKILL_DIR}[[/references/icon-catalog.md]]\` — complete 600+ icon listing
- \`\${CLAUDE_SKILL_DIR}[[/references/bbva-deck-reference.html]]\` — branded presentation example
`;
