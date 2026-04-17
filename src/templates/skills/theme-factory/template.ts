import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Apply a visual theme (color palette + font pairing) to slides, documents,
  HTML artifacts, or other deliverables. Use when the user wants to apply
  a theme, change colors or fonts, rebrand a deck, re-theme an artifact,
  or pick from 10 pre-set themes (Ocean Depths, Sunset Boulevard, Forest
  Canopy, Modern Minimalist, Golden Hour, Arctic Frost, Desert Rose, Tech
  Innovation, Botanical Garden, Midnight Galaxy). Also activate for
  phrases like "apply a theme", "change colors", "rebrand this deck",
  "font pair", "visual theme", "theme a slide deck", "custom theme from
  description". Do NOT activate for a full brand identity system (use
  ${PROJECT_NAME}-brand-creator or ${PROJECT_NAME}-codi-brand), a new
  design from scratch (use ${PROJECT_NAME}-canvas-design or
  ${PROJECT_NAME}-frontend-design), or generative art (use
  ${PROJECT_NAME}-algorithmic-art).
category: ${SKILL_CATEGORY.CREATIVE_AND_DESIGN}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 6
---

# {{name}} — Theme Factory

## When to Activate

- User wants to apply a consistent visual theme to a slide deck, document, or HTML artifact
- User asks to change colors or fonts on an existing output
- User wants to browse available themes and pick one
- User needs a custom theme generated from a description

## Skip When

- User wants a full brand identity system — use ${PROJECT_NAME}-brand-creator (or ${PROJECT_NAME}-codi-brand for Codi)
- User wants to design a new deck or document from scratch — use ${PROJECT_NAME}-content-factory / ${PROJECT_NAME}-doc-engine
- User wants a static poster or illustration — use ${PROJECT_NAME}-canvas-design
- User wants a frontend UI redesign — use ${PROJECT_NAME}-frontend-design
- User wants generative art — use ${PROJECT_NAME}-algorithmic-art

This skill provides a curated collection of professional font and color themes themes, each with carefully selected color palettes and font pairings. Once a theme is chosen, it can be applied to any artifact.

## Purpose

To apply consistent, professional styling to presentation slide decks, use this skill. Each theme includes:
- A cohesive color palette with hex codes
- Complementary font pairings for headers and body text
- A distinct visual identity suitable for different contexts and audiences

## Usage Instructions

To apply styling to a slide deck or other artifact:

1. **Show the theme showcase**: Display the \\\`\${CLAUDE_SKILL_DIR}[[/assets/theme-showcase.pdf]]\\\` file to allow users to see all available themes visually. Do not make any modifications to it; simply show the file for viewing.
2. **Ask for their choice**: Ask which theme to apply to the deck
3. **Wait for selection**: Get explicit confirmation about the chosen theme
4. **Apply the theme**: Once a theme has been chosen, apply the selected theme's colors and fonts to the deck/artifact

## Themes Available

The following 10 themes are available, each showcased in \\\`\${CLAUDE_SKILL_DIR}[[/assets/theme-showcase.pdf]]\\\`:

1. **Ocean Depths** - Professional and calming maritime theme
2. **Sunset Boulevard** - Warm and vibrant sunset colors
3. **Forest Canopy** - Natural and grounded earth tones
4. **Modern Minimalist** - Clean and contemporary grayscale
5. **Golden Hour** - Rich and warm autumnal palette
6. **Arctic Frost** - Cool and crisp winter-inspired theme
7. **Desert Rose** - Soft and sophisticated dusty tones
8. **Tech Innovation** - Bold and modern tech aesthetic
9. **Botanical Garden** - Fresh and organic garden colors
10. **Midnight Galaxy** - Dramatic and cosmic deep tones

## Theme Details

Each theme is defined in the \\\`\${CLAUDE_SKILL_DIR}[[/references/themes/]]\\\` directory with complete specifications including:
- Cohesive color palette with hex codes
- Complementary font pairings for headers and body text
- Distinct visual identity suitable for different contexts and audiences

## Application Process

After a preferred theme is selected:
1. Read the corresponding theme file from the \\\`\${CLAUDE_SKILL_DIR}[[/references/themes/]]\\\` directory
2. Apply the specified colors and fonts consistently throughout the deck
3. Ensure proper contrast and readability
4. Maintain the theme's visual identity across all slides

## Create your Own Theme
To handle cases where none of the existing themes work for an artifact, create a custom theme. Based on provided inputs, generate a new theme similar to the ones above. Give the theme a similar name describing what the font/color combinations represent. Use any basic description provided to choose appropriate colors/fonts. After generating the theme, show it for review and verification. Following that, apply the theme as described above.

## Related Skills

- **${PROJECT_NAME}-content-factory** — Presentation and slide engine whose output can be themed
- **${PROJECT_NAME}-doc-engine** — Document engine whose output can be themed
- **${PROJECT_NAME}-frontend-design** — Frontend interfaces that can use theme tokens
`;
