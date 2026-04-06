import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Apply BBVA brand identity to any content creation task. Use when creating branded materials for BBVA — presentations, documents, reports, dashboards, or any visual/written deliverable that needs BBVA branding. Also activate when the user mentions 'BBVA', 'marca BBVA', 'estilo BBVA', or asks for BBVA-branded output of any kind.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 8
---

## When to Activate

- User mentions 'BBVA', 'marca BBVA', or asks for BBVA-branded output
- User needs a client-facing or internal deliverable (presentation, report, dashboard) for BBVA
- User is creating any document or visual that should carry the BBVA corporate identity

## Generator Routing

All generators read \`\${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]]\` as the single source of truth.

| Output | TypeScript (DEFAULT) | Python (FALLBACK) |
|--------|---------------------|-------------------|
| PPTX | \`npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/generate_pptx.ts]] --content content.json --output out.pptx\` | \`python3 \${CLAUDE_SKILL_DIR}[[/scripts/python/generate_pptx.py]] --content content.json --output out.pptx\` |
| DOCX | \`npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/generate_docx.ts]] --content content.json --output out.docx\` | \`python3 \${CLAUDE_SKILL_DIR}[[/scripts/python/generate_docx.py]] --content content.json --output out.docx\` |
| Validate PPTX | \`npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/validators/validate_pptx.ts]] --input out.pptx\` | \`python3 \${CLAUDE_SKILL_DIR}[[/scripts/python/validators/pptx_validator.py]] --input out.pptx\` |

**content.json schema**:
\`\`\`json
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle",
  "author": "Author Name",
  "sections": [
    {
      "number": "01",
      "label": "Section Name",
      "heading": "Section heading text",
      "body": "Body paragraph text",
      "items": ["bullet one", "bullet two"],
      "callout": "Optional callout text"
    }
  ]
}
\`\`\`

---

# BBVA — Brand Identity System

BBVA is a global financial group with a purpose: to bring the age of opportunity to everyone.
Full brand guide: \`\${CLAUDE_SKILL_DIR}[[/references/brand-guide.md]]\`

## Bundled Assets

- \`\${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]]\` — canonical color/font data
- \`\${CLAUDE_SKILL_DIR}[[/scripts/ts/]]\` — TypeScript generators (pptxgenjs, docx npm)
- \`\${CLAUDE_SKILL_DIR}[[/scripts/python/]]\` — Python generators (python-pptx, python-docx)
- \`\${CLAUDE_SKILL_DIR}[[/references/brand-guide.md]]\` — full brand rationale and usage rules
- \`\${CLAUDE_SKILL_DIR}[[/references/icon-catalog.md]]\` — complete 600+ icon listing
- \`\${CLAUDE_SKILL_DIR}[[/references/bbva-deck-reference.html]]\` — branded presentation example
`;
