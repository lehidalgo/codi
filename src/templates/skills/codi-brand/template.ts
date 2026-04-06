import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Apply Codi brand identity to any content creation task. Use when creating branded materials for the Codi product — landing pages, marketing copy, presentations, documents, social posts, or any visual/written deliverable that needs Codi branding. Also activate when the user mentions 'codi brand', 'codi design system', or asks for Codi-branded output.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 14
---

## When to Activate

- User asks to create a landing page, marketing page, or web UI for Codi
- User needs a Codi-branded document, presentation, or one-pager
- User requests social media copy or marketing text for the Codi product
- User mentions "codi brand", "codi design system", or "codi style"
- User is building any deliverable that should visually or tonally represent Codi

---

## Reference Files

Before generating any output, read the relevant reference files:

| File | Purpose |
|------|---------|
| \${CLAUDE_SKILL_DIR}[[/references/design-tokens.md]] | Color palette, CSS variables, typography, logo rules, all design patterns |
| \${CLAUDE_SKILL_DIR}[[/references/tone-and-copy.md]] | Brand positioning, tone of voice, copy rules, key product facts, output guides per artifact type |
| \${CLAUDE_SKILL_DIR}[[/references/site-index.html]] | Live site HTML — source of truth for structure, copy, and component patterns |
| \${CLAUDE_SKILL_DIR}[[/references/site-style.css]] | Live site CSS — source of truth for all visual tokens and design patterns |
| \${CLAUDE_SKILL_DIR}[[/references/site-app.js]] | Live site JS — source of truth for interactions and animations |

---

## Process

### Step 1 — Read references

**[CODING AGENT]** Before writing any output, read:
1. \`\${CLAUDE_SKILL_DIR}[[/references/design-tokens.md]]\` — get colors, fonts, CSS variables, and all design patterns
2. \`\${CLAUDE_SKILL_DIR}[[/references/tone-and-copy.md]]\` — get brand voice, copy rules, product facts, and output guides

For HTML outputs also read:
3. \`\${CLAUDE_SKILL_DIR}[[/references/site-index.html]]\` — understand the live site structure and component patterns
4. \`\${CLAUDE_SKILL_DIR}[[/references/site-style.css]]\` — get exact CSS patterns from the live implementation

### Step 2 — Identify artifact type

**[CODING AGENT]** Determine what to produce:
- **HTML / landing page** → follow the HTML checklist in tone-and-copy.md
- **Document** → follow the Documents section in tone-and-copy.md
- **Presentation** → follow the Presentations section in tone-and-copy.md
- **Marketing copy** → follow the Marketing Copy section in tone-and-copy.md

### Step 3 — Generate output

**[CODING AGENT]** Generate the deliverable using tokens and patterns from the reference files.

### Step 4 — Validate

**[CODING AGENT]** Before delivering, verify:

- [ ] Background is \`#070a0f\` — never light mode
- [ ] CSS variables block present in HTML outputs
- [ ] Outfit + Geist Mono loaded from Google Fonts
- [ ] Logo wordmark is lowercase \`codi\` in Geist Mono + gradient
- [ ] Primary CTAs use \`--grad\` background
- [ ] Gradient text used on at least one H1/H2 phrase
- [ ] No banned phrases (revolutionary, seamless, robust, AI-powered)
- [ ] Copy uses second person — not "users" or "developers"
- [ ] Agent names spelled correctly: Claude Code, Cursor, Codex, Windsurf, Cline
- [ ] Terminal commands use exact CLI syntax: \`codi init\`, \`codi generate\`, \`codi add rule\`

---

## Generator Routing (PPTX / DOCX / XLSX)

Generation is handled by the format skills (\`codi-pptx\`, \`codi-docx\`, \`codi-xlsx\`). This brand skill provides only \`\${CLAUDE_SKILL_DIR}/scripts/brand_tokens.json\` — pass it via \`--tokens\`.

### Runtime Detection

Detect the available runtime and route accordingly:

\`\`\`bash
if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
  # TypeScript (preferred)
  npx tsx \${CODI_PPTX_SKILL_DIR}/scripts/ts/generate_pptx.ts --content content.json --tokens \${CLAUDE_SKILL_DIR}/scripts/brand_tokens.json --theme \${BRAND_THEME} --output out.pptx
elif command -v uv &>/dev/null; then
  # Python via uv (ephemeral isolated env)
  uv run --with python-pptx python3 \${CODI_PPTX_SKILL_DIR}/scripts/python/generate_pptx.py --content content.json --tokens \${CLAUDE_SKILL_DIR}/scripts/brand_tokens.json --theme \${BRAND_THEME} --output out.pptx
else
  # Python via venv fallback
  SKILL_VENV="/tmp/codi-skill-venv" && python3 -m venv "\${SKILL_VENV}" 2>/dev/null || true
  "\${SKILL_VENV}/bin/pip" install -q python-pptx
  "\${SKILL_VENV}/bin/python3" \${CODI_PPTX_SKILL_DIR}/scripts/python/generate_pptx.py --content content.json --tokens \${CLAUDE_SKILL_DIR}/scripts/brand_tokens.json --theme \${BRAND_THEME} --output out.pptx
fi
\`\`\`

Apply the same pattern for DOCX (\`CODI_DOCX_SKILL_DIR\`, \`generate_docx\`, \`out.docx\`) and XLSX (\`CODI_XLSX_SKILL_DIR\`, \`generate_xlsx\`, \`out.xlsx\`).

- \`\${CLAUDE_SKILL_DIR}\` — this brand skill directory (provides tokens)
- \`\${CODI_PPTX_SKILL_DIR}\` / \`\${CODI_DOCX_SKILL_DIR}\` / \`\${CODI_XLSX_SKILL_DIR}\` — respective format skill directories
- \`\${BRAND_THEME}\` — \`dark\` or \`light\` (ask the user if not specified)

### content.json Schema

\`\`\`json
{
  "title": "Document or Presentation Title",
  "subtitle": "Optional subtitle",
  "author": "Author Name",
  "sections": [
    {
      "number": "01",
      "label": "Section Label",
      "heading": "Section Heading",
      "body": "Section body text.",
      "items": ["Bullet point 1", "Bullet point 2"],
      "callout": "Optional highlighted quote or takeaway"
    }
  ]
}
\`\`\`

`;
