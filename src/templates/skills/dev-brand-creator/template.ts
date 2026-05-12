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
version: 15
---

# {{name}}

## When to Activate

- User asks to create a social card, slide, document, poster, or email that carries {{name}} identity
- User mentions brand guidelines, brand standard, corporate identity, or visual identity for {{name}}
- User asks for the color palette, brand colors, brand fonts, or typography for {{name}}
- User wants to follow {{name}} voice and tone in copy
- Another skill (Content Factory) needs brand tokens for slides, documents, or business deliverables

## Skip When

- Generic design request where the user specifies their own palette and fonts
- Content unrelated to {{name}} — do not force brand tokens onto someone else's design
- Pure code or infrastructure tasks

## What Is a Brand Skill?

A brand skill is a bundle of visual and written identity rules — colors, fonts, logo placement, tone of voice, example phrases — that any other skill can consult when producing content. When Content Factory generates a slide deck, a branded report, or a social carousel, it reads this brand skill to decide how the output looks and sounds. One brand skill = one identity. A team with three product lines would have three brand skills.

You do not need design skills to create one. This skill will interview you, then fill in the files for you.

---

## Before You Start — First-Time Brand Intake

**Trigger:** If \`brand/tokens.json\` still contains placeholder values (e.g. \`#000000\` primary color, \`"Brand phrase 1"\`, \`"Arial"\` fonts), the brand has not been filled in yet. Run this intake **before** applying the brand anywhere.

### What the agent needs from you

Gather anything you already have before answering the questions:

- Logo files (SVG preferred, PNG/JPG OK) — for light background and dark background if different
- Existing brand guidelines PDF or Figma link (optional)
- Your current website URL (if you have one)
- 2-4 screenshots or links of brands you admire — these become "style references", not to copy
- 2-4 screenshots or links of **competitors** — the agent uses these to differentiate your brand, not to imitate

Drop any of these into the chat before answering. It is fine to have none — the intake still works.

### The 9 intake questions

**Identity (required — agent stops until answered):**

1. **Brand name + one-liner.** Example: "Codi — AI agent configuration for teams."
2. **Industry or category.** Pick or describe: developer tools / fintech / agency / e-commerce / SaaS / media / physical product / service / non-profit / personal brand / other.
3. **Primary audience.** Who sees this brand most? Pick: developers / designers / executives / small-business owners / general consumers / students / internal team only / other.

**Personality (required):**

4. **Pick 3 adjectives** from this list that describe the brand's feel. If none fit, propose your own:
   minimal · bold · playful · serious · retro · corporate · warm · technical · rebellious · editorial · luxurious · friendly · clinical · raw · handcrafted · futuristic · nostalgic · calm · energetic · trustworthy
5. **Competitors or peers to differentiate from.** Share 1-3 brands you do NOT want to look like. Prevents the agent from producing a convergent "generic AI slop" aesthetic.

**Assets (optional but recommended):**

6. **What exists today?** Answer any that apply:
   - Logo files: yes (share paths) / no — agent scaffolds placeholder assets
   - Existing colors: yes (list hex codes or describe) / no — agent proposes 3 palette options
   - Existing fonts: yes (Google Fonts name or font file) / no — agent proposes 3 pairings
   - Inspiration references: yes (share URLs/screenshots) / no

**Voice (required):**

7. **Tone axis.** Pick one and optionally shade: formal ↔ casual, technical ↔ warm, serious ↔ playful. Example: "casual and warm, leaning technical."
8. **Sample sentences.** Write 2 sentences you *would* publish under this brand, and 2 you *would not*. Short is fine.

**Scope (required):**

9. **Where will this brand appear?** Check all that apply: slide decks / branded documents (reports, one-pagers) / social posts (carousels, single cards) / email templates / web page / print deliverable / internal docs only. Drives which template files the brand ships.

### "Not sure?" escape hatches

- **"I don't know my brand personality."** Agent proposes 3 archetypes (e.g. "Minimal Dev Tool", "Warm Consumer SaaS", "Serious Enterprise") with color+font examples; you pick one.
- **"I don't have a logo."** Agent scaffolds a wordmark-style placeholder using the chosen display font. You can replace later without re-running the intake.
- **"I have no idea what colors I want."** Agent proposes 3 palettes per chosen personality (e.g. Minimal Dev Tool → monochrome / dusk blue / forest green). Pick one, agent fills \`tokens.json\`.
- **"What if this changes later?"** Edit \`brand/tokens.json\` at any time. Everything downstream re-reads from it — no regeneration of the skill needed.

### After the intake

**[CODING AGENT]** Only once you have answers for Identity (Q1-3), Personality (Q4-5), Voice (Q7-8), and Scope (Q9):

1. Populate \`brand/tokens.json\` with the gathered values
2. Generate \`brand/tokens.css\` from the tokens
3. Replace any placeholder asset paths; if no logo, create a simple SVG wordmark using the chosen display font
4. Write 1-2 reference HTML files in \`references/\` showing the brand applied to a card and a document
5. Update the description at the top of this SKILL.md to reflect the brand (optional — the description is the file a consumer sees first)
6. Run \`codi generate\` to propagate
7. Report to the user: summary of identity/personality/voice decisions, path to tokens.json, and suggested next step (generate a sample deck with Content Factory to see the brand in action)

---

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
