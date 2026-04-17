import { SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Brand identity scaffold for {{name}}. Use when creating any branded
  deliverable — social cards, slides, documents, posters, email templates,
  or any visual output that must carry {{name}} brand identity. Also activate
  when the user mentions "brand guidelines", "brand standard", "corporate
  identity", "visual identity", "color palette", "brand colors", "brand fonts",
  "typography pair", "logo placement", "brand voice", or applies this brand's
  design tokens to new content. Provides design tokens (colors, fonts),
  voice guidelines, and Content Factory templates. Do NOT override a
  user-specified palette when the user has not asked for this brand, and do
  not activate for generic design work unrelated to {{name}}.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: user
user-invocable: true
disable-model-invocation: false
version: 11
---

# {{name}}

## When to Activate

- User asks to create a social card, slide, document, poster, or email that carries {{name}} identity
- User mentions brand guidelines, brand standard, corporate identity, or visual identity for {{name}}
- User asks for the color palette, brand colors, brand fonts, or typography for {{name}}
- User wants to follow {{name}} voice and tone in copy
- Another skill (Content Factory, doc-engine, deck-engine) needs brand tokens

## Skip When

- Generic design request where the user specifies their own palette and fonts
- Content unrelated to {{name}} — do not force brand tokens onto someone else's design
- Pure code or infrastructure tasks

## How to Apply This Brand

When creating content that must carry this brand identity:

1. Read \`brand/tokens.json\` from this skill's directory for colors, fonts, and voice
2. Read \`brand/tokens.css\` and inline its full content in every generated HTML file — do NOT use \`<link href="...">\`, iframes cannot resolve file paths
3. Apply \`voice.tone\` when writing copy — concise, confident, and on-brand
4. Use phrases from \`voice.phrases_use\`; avoid \`voice.phrases_avoid\`
5. Read \`references/\` for visual HTML examples — open each file to understand the brand's CSS patterns, layout, and component structure. Use these as the visual style guide.
6. Check \`templates/\` (optional) for Gallery-ready Content Factory HTML templates the user can load directly

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
    "headlines":        "Arial",
    "body":             "Arial",
    "monospace":        "Courier New",
    "fallback_serif":   "Georgia",
    "fallback_sans":    "Arial",
    "google_fonts_url": null
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
  LICENSE.txt             ← usage license for brand assets
  brand/
    tokens.json           ← canonical brand data (single source of truth)
    tokens.css            ← generated CSS variables — inline in HTML outputs
  assets/
    logo-dark.svg         ← logo for dark backgrounds
    logo-light.svg        ← logo for light backgrounds
    fonts/                ← optional: local font files (woff2)
  references/             ← visual HTML examples — style guide for the agent
    brandguide.html       ← brand colors, type, and component reference
    deck-reference.html   ← slide deck visual reference
  evals/
    evals.json            ← evaluation prompts and expected brand outputs
  templates/              ← optional: Gallery-ready Content Factory HTML templates
    social-cover.html     ← pre-styled social card template
    slides-intro.html     ← pre-styled slide deck template
    document-report.html  ← pre-styled document template
\\\`\\\`\\\`

Files in \`references/\` are visual HTML style guides — they do NOT need \`<meta name="codi:template">\`.
Files in \`templates/\` must include \`<meta name="codi:template">\` and follow the Content Factory template spec.

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
