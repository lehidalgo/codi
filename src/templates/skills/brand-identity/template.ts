import { PROJECT_NAME_DISPLAY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Brand identity for {{name}}. Provides design tokens, typography, logo guidance, and tone of voice for ${PROJECT_NAME_DISPLAY} document and presentation skills.
category: brand
managed_by: user
---

# {{name}} — Brand Identity

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| \`--brand-primary\` | \`#000000\` | Main accent color |
| \`--brand-primary-dark\` | \`#000000\` | Darker variant |
| \`--brand-primary-muted\` | \`#00000015\` | Subtle backgrounds |
| \`--brand-bg\` | \`#ffffff\` | Default background |
| \`--brand-bg-alt\` | \`#000000\` | Alternate/inverted background |
| \`--brand-text\` | \`#1a1a2e\` | Primary text color |
| \`--brand-text-secondary\` | \`#4a4a68\` | Secondary text color |

### CSS Variables

\\\`\\\`\\\`css
:root {
  --brand-primary: #000000;
  --brand-primary-dark: #000000;
  --brand-primary-muted: #00000015;
  --brand-bg: #ffffff;
  --brand-bg-alt: #000000;
  --brand-text: #1a1a2e;
  --brand-text-secondary: #4a4a68;
  --brand-heading-font: 'Arial', sans-serif;
  --brand-body-font: system-ui, sans-serif;
  --brand-mono-font: 'Courier New', monospace;
}
\\\`\\\`\\\`

## Typography

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| **Headlines** | Sans-serif | 600-700 | Arial, sans-serif |
| **Body** | Sans-serif | 400-500 | system-ui, sans-serif |
| **Monospace** | Monospace | 400 | 'Courier New', monospace |

## Logo

Provide inline SVG for both light and dark backgrounds.
Place logo files in the \`assets/\` directory.

## Tone of Voice

Describe the brand personality, writing patterns, and communication style.

### Phrases to Use

- Add characteristic brand phrases here

### Phrases to Avoid

- Add phrases that don't match the brand voice`;
