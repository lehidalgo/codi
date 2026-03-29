import { PROJECT_NAME } from "../../constants.js";

export const template = `---
name: {{name}}
description: HTML slide deck generation workflow. Creates a single-file presentation with embedded CSS, ready to present in any browser. Follows best practices for minimal text, high contrast, and readable typography.
compatibility: [claude-code, cursor]
managed_by: ${PROJECT_NAME}
---

# {{name}}

## When to Use

Use when asked to create a presentation, slide deck, or pitch deck on any topic.

## When to Activate

- User asks to create a slide deck, presentation, or pitch deck
- User needs an HTML-based presentation that works offline in a browser
- User wants to present technical content, a proposal, or project status
- User asks to generate slides from a topic outline or document

## Presentation Process

### Step 1: Gather Requirements

**[HUMAN]** Provide the following:
- Topic or title of the presentation
- Target audience (technical, executive, mixed)
- Key points or sections to cover
- Optional: preferred color scheme, company branding, time limit

### Step 2: Structure the Deck

**[CODING AGENT]** Plan the slide structure:

1. **Title Slide** — Title, subtitle, presenter name, date
2. **Problem/Context** — Why this topic matters, current state
3. **Solution/Approach** — The proposal, recommendation, or key insight
4. **Detail Slides** (3-5 slides) — Supporting evidence, architecture, data, examples
5. **Summary/Next Steps** — Key takeaways, action items, timeline

Total slides should be 8-12 for a standard presentation. Adjust based on time limit (roughly 2 minutes per slide).

### Step 3: Generate HTML

**[CODING AGENT]** Create a single HTML file with embedded CSS:

**Layout rules:**
- Viewport: \\\`width: 1920px; height: 1080px\\\` (16:9 aspect ratio)
- Each slide is a full-viewport section
- Slides scroll vertically (one per screen height)
- Print-friendly: each slide on its own page

**Typography rules:**
- Title text: 48-64px, bold
- Body text: 28-36px, regular weight
- Code blocks: 24px, monospace font
- Maximum 6 bullet points per slide
- Maximum 8 words per bullet point
- One idea per slide

**Design rules:**
- High contrast: dark text on light background or light text on dark background
- Consistent color palette: 2-3 colors maximum
- Generous whitespace: 80px+ margins
- No clip art or placeholder images
- Use CSS shapes or Unicode symbols for simple visuals
- Subtle slide transitions using CSS

**Navigation:**
- Keyboard navigation: arrow keys or Page Up/Page Down
- Slide counter showing current/total
- Minimal JavaScript for navigation only

### Step 4: Content Guidelines

**[CODING AGENT]** When writing slide content:
- Write headlines, not sentences
- Use parallel structure in bullet lists
- Include concrete numbers and data when available
- Speaker notes as HTML comments (not visible during presentation)
- Code examples: short (5-10 lines max), syntax-highlighted with CSS
- Diagrams: use simple CSS/HTML tables or grids, not images

### Step 5: Output

**[CODING AGENT]** Save as a single \\\`.html\\\` file:
- All CSS embedded in a \\\`<style>\\\` tag
- Minimal JavaScript embedded in a \\\`<script>\\\` tag
- No external dependencies (no CDN links)
- File should work offline when opened in any modern browser
- Test by verifying HTML structure is valid
`;
