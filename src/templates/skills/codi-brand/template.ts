import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Apply Codi brand identity to any content creation task. Use when creating branded materials for the Codi product — landing pages, marketing copy, presentations, documents, social posts, or any visual/written deliverable that needs Codi branding. Also activate when the user mentions 'codi brand', 'codi design system', or asks for Codi-branded output.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 4
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

## Generator Routing (PPTX / DOCX)

When the user needs a \`.pptx\` or \`.docx\` file, use the brand scripts in \`\${CLAUDE_SKILL_DIR}/scripts/\`. The canonical brand data is \`\${CLAUDE_SKILL_DIR}/scripts/brand_tokens.json\` — do not hardcode any colors or fonts.

### Routing Table

| Format | Runtime | Command |
|--------|---------|---------|
| PPTX | **TypeScript (DEFAULT)** | \`npx tsx \${CLAUDE_SKILL_DIR}/scripts/ts/generate_pptx.ts --content content.json --output output.pptx\` |
| PPTX | Python (fallback) | \`python3 \${CLAUDE_SKILL_DIR}/scripts/python/generate_pptx.py --content content.json --output output.pptx\` |
| DOCX | **TypeScript (DEFAULT)** | \`npx tsx \${CLAUDE_SKILL_DIR}/scripts/ts/generate_docx.ts --content content.json --output output.docx\` |
| DOCX | Python (fallback) | \`python3 \${CLAUDE_SKILL_DIR}/scripts/python/generate_docx.py --content content.json --output output.docx\` |

Use TypeScript by default. Fall back to Python only when \`npx\` is unavailable.

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

