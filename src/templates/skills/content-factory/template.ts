import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to create blog posts or repurpose content across platforms (LinkedIn, Instagram, TikTok, Medium, Substack). Generates branded visual assets with interactive browser preview and PNG export.
category: Content Creation
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 7
---

# {{name}} — Content Factory

## When to Activate

- User asks to create blog content, social media posts, or carousel slides
- User wants to repurpose a blog post into platform-specific formats
- User needs branded visual assets for LinkedIn, Instagram, TikTok, or OG images
- User asks to create social media cards, carousels, or story slides

## Skill Assets

This skill ships with reusable assets in the \`assets/\` directory:

| Asset | Purpose |
|-------|---------|
| \`\${CLAUDE_SKILL_DIR}[[/assets/preview-shell.js]]\` | Interactive preview UI: toolbar, aspect ratio switching, CSS scale-to-fit, PNG export, resizable chat panel, DOM event storage |
| \`\${CLAUDE_SKILL_DIR}[[/assets/carousel-template.html]]\` | HTML skeleton for multi-slide carousels with \`data-index\`/\`data-type\` attributes |
| \`\${CLAUDE_SKILL_DIR}[[/assets/social-card-template.html]]\` | HTML skeleton for social media cards |
| \`\${CLAUDE_SKILL_DIR}[[/assets/blog-export-template.html]]\` | HTML skeleton for blog post layouts |
| \`\${CLAUDE_SKILL_DIR}[[/assets/vendor/html2canvas.min.js]]\` | Client-side PNG export library (v1.4.1, 198KB) |

## Step 1: Gather Requirements

**[HUMAN]** Provide:
- Topic or raw idea (a paragraph, bullet points, or a draft blog post)
- Target platforms (LinkedIn carousel, Instagram story, blog, etc.)
- Tone (professional, casual, educational, inspirational)

**[CODING AGENT]** Check for brand skills:
- Search for any skill with **category: brand** in the project
- If found, use its design tokens (\`--brand-*\` CSS variables, fonts, logos)
- If not found, use neutral dark theme defaults

## Step 2: Create Session Directory

**[CODING AGENT]** Run the scaffold script:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/scaffold-session.sh]] <session-name>
\`\`\`

This creates:
\`\`\`
content-factory-output/<session-name>/
  carousel/
  social/cards/
  blog/
  preview-shell.js      (copied from skill assets)
  vendor/html2canvas.min.js (copied from skill assets)
\`\`\`

## Step 3: Write the Blog Post

**[CODING AGENT]** Transform the raw idea into a structured blog post:
1. Create a compelling headline
2. Write an introduction hook
3. Develop 3-5 key sections with subheadings
4. Add a conclusion with call-to-action
5. Save as \`blog/blog-post.md\`

## Step 4: Generate Visual Assets

**[CODING AGENT]** For each target platform, generate HTML files using the skill templates:

### Carousel Slides
- Copy \`carousel-template.html\` from skill assets
- Populate sections with content from the blog post
- Each \`<section>\` must have \`data-index\` and \`data-type\` attributes
- Apply brand CSS variables (\`--brand-bg\`, \`--brand-text\`, \`--brand-accent\`)

### Social Cards
- Copy \`social-card-template.html\` from skill assets
- Create platform-specific cards (LinkedIn, Instagram, Twitter/X)

## Step 5: Inline Preview Infrastructure

**[CODING AGENT]** For every generated HTML file:

1. Read \`preview-shell.js\` from the session directory
2. Read \`vendor/html2canvas.min.js\` from the session directory
3. Inline both scripts into the HTML before \`</body>\`:

\`\`\`html
<script>/* html2canvas v1.4.1 content here */</script>
<script>/* preview-shell.js content here */</script>
</body>
\`\`\`

**Why inline?** Browsers block external \`<script src>\` on \`file://\` protocol. Inlining ensures the toolbar, chat panel, and export work when opening HTML files directly.

## Step 6: Visual Review with Chat Feedback

This is the interactive feedback loop between you (the coding agent) and the user.

### Opening the Preview

**[CODING AGENT]** Open the generated HTML in the browser:

\`\`\`
mcp__playwright__browser_navigate({ url: "file:///path/to/carousel.html" })
\`\`\`

Tell the user: "Check the preview in your browser. Click any slide and type feedback in the chat panel. Return to the terminal when ready."

### The Review Loop

1. **End your turn** and wait for the user to respond in the terminal

2. **On your next turn** — read feedback from the browser:
   \`\`\`
   mcp__playwright__browser_evaluate({
     expression: "JSON.parse(document.getElementById('cf-events').textContent)"
   })
   \`\`\`
   Returns: \`[{ slide: 3, type: "content", text: "headline too long", timestamp: ... }]\`

3. **Process each feedback message**:
   - Identify the target slide by \`slide\` number and \`type\`
   - Apply the requested change to the HTML file
   - Re-inline preview-shell.js if the HTML was regenerated

4. **Reload the browser**:
   \`\`\`
   mcp__playwright__browser_navigate({ url: "file:///path/to/carousel.html" })
   \`\`\`

5. **Repeat** until the user sends "done" or "approved" in the chat panel, or says so in the terminal

### How the Chat Panel Works

The preview UI (\`preview-shell.js\`) provides:
- **Toolbar**: Aspect ratio presets (1:1 LinkedIn, 4:5 Instagram, 9:16 Story, 1200x630 OG)
- **Slides area**: CSS \`transform: scale()\` to fit viewport, independently scrollable
- **Chat panel**: Resizable right-side panel where the user clicks slides and types feedback
- **Event storage**: Feedback stored in a hidden DOM element \`<script id="cf-events">\`
- **PNG export**: In-browser export via html2canvas at 2x resolution

The user clicks a slide to select it, types feedback, and presses Enter. The feedback is stored as JSON in the DOM. You read it on your next turn via \`browser_evaluate\`.

If \`cf-events\` returns an empty array \`[]\`, the user did not interact with the browser — use only their terminal text.

## Step 7: Export Final Assets

**[CODING AGENT]** After the user approves:

### Method 1: In-Browser Export (preferred)
Tell the user to use the toolbar buttons:
- "Export All PNGs" downloads every slide at the selected aspect ratio (2x resolution)
- Individual "Export PNG" buttons appear on hover over each slide

### Method 2: Script-Based Export
If Playwright is available, automate the export:
\`\`\`
mcp__playwright__browser_evaluate({
  expression: "document.querySelector('.cf-toolbar button:nth-child(7)').click()"
})
\`\`\`

## Step 8: Deliver Final Package

**[CODING AGENT]** Summarize what was created:
- List all output files with their paths
- Note the aspect ratios and dimensions of exported PNGs
- Remind the user that HTML files can be reopened for further editing
`;
