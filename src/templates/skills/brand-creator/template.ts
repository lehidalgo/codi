import { SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Brand identity skill for {{name}}. Use when creating any branded deliverable — social cards, slides, documents, or any visual output that must carry {{name}} brand identity. Provides design tokens (colors, fonts), voice guidelines, and Content Factory templates.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: user
user-invocable: true
disable-model-invocation: false
version: 6
---

# {{name}} — Brand Identity

## How to Apply This Brand

When creating content that must carry this brand identity:

1. Read \`brand/tokens.json\` from this skill's directory for colors, fonts, and voice
2. Import \`brand/tokens.css\` into any HTML output for CSS variable definitions
3. Apply \`voice.tone\` when writing copy — concise, confident, and on-brand
4. Use phrases from \`voice.phrases_use\`; avoid \`voice.phrases_avoid\`
5. Check \`templates/\` for pre-styled Content Factory HTML templates

---

## brand/tokens.json

The canonical source of brand data. All colors, fonts, and voice come from this file — nothing is hardcoded elsewhere.

\\\`\\\`\\\`json
{
  "brand":        "{{name}}",
  "display_name": "{{name}} Brand",
  "version": 1,
  "themes": {
    "dark": {
      "background":     "#000000",
      "surface":        "#111111",
      "text_primary":   "#ffffff",
      "text_secondary": "#aaaaaa",
      "primary":        "#000000",
      "accent":         "#000000",
      "logo":           "logo_dark_bg"
    },
    "light": {
      "background":     "#ffffff",
      "surface":        "#f5f5f5",
      "text_primary":   "#111111",
      "text_secondary": "#555555",
      "primary":        "#000000",
      "accent":         "#000000",
      "logo":           "logo_light_bg"
    }
  },
  "fonts": {
    "headlines":      "Arial",
    "body":           "Arial",
    "monospace":      "Courier New",
    "fallback_serif": "Georgia",
    "fallback_sans":  "Arial"
  },
  "assets": {
    "logo_dark_bg":  "assets/logo-light.svg",
    "logo_light_bg": "assets/logo-dark.svg",
    "fonts_dir":     null
  },
  "voice": {
    "tone":          "Professional and direct. Short sentences. Active voice.",
    "phrases_use":   ["Brand phrase 1", "Brand phrase 2"],
    "phrases_avoid": ["Phrase to avoid 1", "Phrase to avoid 2"]
  }
}
\\\`\\\`\\\`

---

## brand/tokens.css

Generate this file from \`tokens.json\` so HTML content can import it directly:

\\\`\\\`\\\`css
/* {{name}} — Brand CSS Variables */
/* Generated from brand/tokens.json — do not edit manually */

:root {
  /* Dark theme (default) */
  --brand-bg:         #000000;
  --brand-surface:    #111111;
  --brand-text:       #ffffff;
  --brand-text-muted: #aaaaaa;
  --brand-primary:    #000000;
  --brand-accent:     #000000;

  /* Typography */
  --brand-font-headline: 'Arial', sans-serif;
  --brand-font-body:     'Arial', sans-serif;
  --brand-font-mono:     'Courier New', monospace;
}

[data-theme="light"] {
  --brand-bg:         #ffffff;
  --brand-surface:    #f5f5f5;
  --brand-text:       #111111;
  --brand-text-muted: #555555;
  --brand-primary:    #000000;
  --brand-accent:     #000000;
}
\\\`\\\`\\\`

---

## Directory Structure

\\\`\\\`\\\`
{{name}}/
  SKILL.md                ← this file
  brand/
    tokens.json           ← canonical brand data (single source of truth)
    tokens.css            ← generated CSS variables — import in HTML outputs
  assets/
    logo-dark.svg         ← logo for dark backgrounds
    logo-light.svg        ← logo for light backgrounds
  templates/              ← optional: Content Factory HTML templates
    social-cover.html     ← pre-styled social card template
    slides-intro.html     ← pre-styled slide deck template
    document-report.html  ← pre-styled document template
\\\`\\\`\\\`

Each file in \`templates/\` must include a \`<meta name="codi:template">\` tag and follow the
same format as built-in Content Factory templates (see content-factory skill for full spec).

---

## Voice Guidelines

| | |
|---|---|
| **Tone** | Professional and direct. Short sentences. Active voice. |
| **Use** | Brand phrase 1 · Brand phrase 2 |
| **Avoid** | Phrase to avoid 1 · Phrase to avoid 2 |

---

Read \`\${CLAUDE_SKILL_DIR}[[/references/brand-standard.md]]\` for the full schema reference,
color palette scaffold, typography table, logo guidelines, and validation checklist.`;
