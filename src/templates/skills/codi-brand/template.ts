import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Codi brand identity. Use when creating any branded deliverable for Codi —
  slides, documents, social cards, reports, or any HTML/PDF/PPTX/DOCX output
  that must carry Codi visual identity. Also activate when the user mentions
  'codi brand', 'codi design system', or asks for Codi-branded output of any kind.
  Provides design tokens (colors, fonts), voice guidelines, references, and
  Content Factory templates. Rendering and export are handled by the
  codi-content-factory skill — this skill ships no preview server or code.
category: ${SKILL_CATEGORY.BRAND_IDENTITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
version: 18
---

# {{name}} — Codi Brand Identity

## When to Activate

- User asks to create any branded content for Codi (slides, deck, presentation,
  document, report, one-pager, social post, carousel, blog, proposal)
- User mentions 'codi brand', 'codi design system', or 'codi style'
- User needs a deliverable that carries Codi visual identity or voice

## How to Apply This Brand

This skill is **pure content** — it provides brand tokens, voice rules, and
visual references, but no rendering code. When you need to generate an actual
deliverable (HTML, PDF, PPTX, DOCX, social image), route through
\`codi-content-factory\`, which consumes this skill via its \`/api/brands\`
discovery and renders using its own preview server and Playwright pipeline.

To produce on-brand output:

1. **Read the tokens.** Load \`brand/tokens.json\` from this skill — the single
   source of truth for colors, fonts, assets, and voice.
2. **Inline the CSS variables.** Paste the full contents of \`brand/tokens.css\`
   into a \`<style>\` block in every generated HTML file. Do NOT use
   \`<link href="...">\` — file:// and iframe contexts cannot resolve relative
   stylesheet paths.
3. **Add the Google Fonts link.** Include the URL from
   \`fonts.google_fonts_url\` in \`<head>\`:
   \`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap">\`
4. **Apply the voice rules** from \`voice.tone\` when writing copy — direct,
   technical, short declarative sentences, active voice. Use phrases from
   \`voice.phrases_use\`; avoid \`voice.phrases_avoid\`.
5. **Study the references.** Read every file in \`references/\` — they are the
   canonical visual style guide for CSS patterns, layout, and components.
6. **Hand off rendering to Content Factory.** Start or connect to
   \`codi-content-factory\`, set \`/api/active-brand\` to \`{{name}}\`, and use
   its gallery templates or custom HTML generation. Content Factory handles
   preview, PNG/PDF/PPTX/DOCX export, and session management.

---

## Asset Map

Read these files BEFORE generating any output.

| File | Read when | Purpose |
|------|-----------|---------|
| \`\${CLAUDE_SKILL_DIR}[[/brand/tokens.json]]\` | Always | Colors, fonts, voice rules (single source of truth) |
| \`\${CLAUDE_SKILL_DIR}[[/brand/tokens.css]]\` | HTML generation | CSS custom properties — inline in every HTML output |
| \`\${CLAUDE_SKILL_DIR}[[/references/design-tokens.md]]\` | Always | Usage rules, color palette, typography, logo rules |
| \`\${CLAUDE_SKILL_DIR}[[/references/tone-and-copy.md]]\` | Always | Brand positioning, tone of voice, copy rules |
| \`\${CLAUDE_SKILL_DIR}[[/references/site-index.html]]\` | HTML generation | Live site structure and component patterns (style guide) |
| \`\${CLAUDE_SKILL_DIR}[[/references/site-style.css]]\` | HTML generation | Live site CSS — reference for gradients, spacing, typography |
| \`\${CLAUDE_SKILL_DIR}[[/references/site-app.js]]\` | Interactive patterns | Live site JS — reference for animations and interactions |
| \`\${CLAUDE_SKILL_DIR}[[/templates/codi-slides-pitch.html]]\` | Slide decks | Gallery-ready pitch deck template for Content Factory |
| \`\${CLAUDE_SKILL_DIR}[[/templates/codi-social-dark.html]]\` | Social cards | Gallery-ready dark-theme social card template for Content Factory |

---

## Brand Context Loading

Read \`brand/tokens.json\` and \`references/design-tokens.md\`. Build this mental
model before writing any copy or CSS:

- **Dark theme (default)**: bg \`#070a0f\`, surface \`#0d1117\`, text \`#e6edf3\`,
  accent/primary \`#56b6c2\`
- **Light theme**: bg \`#ffffff\`, surface \`#f6f8fa\`, text \`#070a0f\`,
  accent/primary \`#56b6c2\`
- **Fonts**: Outfit (headings and body), Geist Mono (monospace and wordmark) —
  loaded from Google Fonts, URL in \`tokens.json\`
- **Gradient**: \`linear-gradient(135deg, #56b6c2, #61afef)\` — exposed as
  \`var(--grad)\` in \`tokens.css\`
- **Voice**: use "Your rules, your agents", "Ship quality AI workflows today";
  avoid "revolutionary", "seamless", "AI-powered", "cutting-edge"

---

## The Codi Logo

Codi's primary logo is a **CSS gradient wordmark**, not an SVG file. Render it
inline as:

\\\`\\\`\\\`html
<span class="codi-logo" data-role="brand-logo"
      style="font-family:'Geist Mono',monospace;
             background:var(--grad);
             -webkit-background-clip:text;
             background-clip:text;
             -webkit-text-fill-color:transparent;
             color:transparent;">codi</span>
\\\`\\\`\\\`

**Always** use the lowercase wordmark \`codi\` — never \`Codi\`, \`CODI\`, or
\`Codi Platform\` as a logo. The word "Codi" may appear in body copy.

**SVG fallbacks** live in \`assets/logo-dark.svg\` and \`assets/logo-light.svg\`.
Use them only for contexts where CSS cannot render the gradient — PDF metadata,
PPTX image embeds, social media open-graph previews, favicons.

Size guidelines:
- Small (footers, inline): 32 px
- Medium (default, headers, slides): 48 px
- Large (hero, landing): 64 px
- DOCX (plain-text fallback): 40 px minimum, monospace, primary color

---

## Gallery Templates

The files in \`templates/\` are Content Factory gallery templates. They include
the required \`<meta name="codi:template">\` tag and can be loaded directly from
Content Factory's Gallery tab once \`{{name}}\` is the active brand. Use them as
starting points for:

| Template | Type | Use for |
|----------|------|---------|
| \`codi-slides-pitch.html\` | slide deck | Pitch decks, product overviews, roadmaps |
| \`codi-social-dark.html\` | social card | Twitter/LinkedIn announcements, feature launches |

---

## Directory Structure

\\\`\\\`\\\`
codi-brand/
  SKILL.md              ← this file
  LICENSE.txt           ← brand asset usage license
  brand/
    tokens.json         ← canonical brand data (single source of truth)
    tokens.css          ← generated CSS variables — inline in HTML outputs
  assets/
    logo-dark.svg       ← SVG fallback for the wordmark on dark backgrounds
    logo-light.svg      ← SVG fallback for the wordmark on light backgrounds
  references/           ← visual HTML/CSS style guides (read-only references)
    design-tokens.md    ← color palette, typography, logo rules
    tone-and-copy.md    ← voice, positioning, copy patterns
    site-index.html     ← live site structure and components
    site-style.css      ← live site CSS — gradient, spacing, typography
    site-app.js         ← live site JS — animations, interactions
  templates/            ← Gallery-ready Content Factory HTML templates
    codi-slides-pitch.html
    codi-social-dark.html
  evals/
    evals.json          ← evaluation prompts and expected brand outputs
\\\`\\\`\\\`

---

## Voice Guidelines

| | |
|---|---|
| **Tone** | Direct and technical. Short declarative sentences. Active voice. No hype. |
| **Use** | Your rules, your agents · Ship quality AI workflows today · Standards that scale · Built for real engineering teams |
| **Avoid** | revolutionary · seamless · robust · AI-powered · cutting-edge · game-changing |
| **Person** | Second person (you/your), not "users" or "developers" |
| **Naming** | Always lowercase \`codi\` in the wordmark; "Codi" is acceptable in body copy |

Read \`references/tone-and-copy.md\` for the full voice reference with
examples of on-brand and off-brand copy.

---

## Handoff to Content Factory

When the user asks for an actual rendered deliverable (preview, PDF, PPTX,
DOCX, PNG), do NOT attempt to render from this skill. Instead:

1. Activate or start \`codi-content-factory\`.
2. Set \`{{name}}\` as the active brand via
   \`POST /api/active-brand { "name": "{{name}}" }\`.
3. Load a template from the Gallery — the brand's \`templates/\` files are
   auto-discovered by Content Factory and appear alongside built-in templates.
4. Iterate visually in the Content Factory preview, then export to the
   requested format.

Content Factory owns the preview server, Playwright rendering, and all
export logic. This skill owns the brand definition and nothing else.
`;
