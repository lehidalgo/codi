import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to create blog posts or repurpose content across platforms (LinkedIn, Instagram, TikTok, Medium, Substack). Generates branded visual assets with interactive browser preview and PNG export.
category: ${SKILL_CATEGORY.CONTENT_CREATION}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 11
---

# {{name}} — Content Factory

## When to Activate

- User asks to create blog content, social media posts, or carousel slides
- User wants to repurpose a blog post into platform-specific formats
- User needs branded visual assets for LinkedIn, Instagram, TikTok, or OG images
- User asks to create social media cards, carousels, or story slides

## Skill Assets

This skill ships with a preview server and generator templates:

| Asset | Purpose |
|-------|---------|
| \`\${CLAUDE_SKILL_DIR}[[/scripts/server.cjs]]\` | Preview server: serves HTML with live reload, injects preview shell automatically |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]]\` | Start the preview server (outputs JSON with URL) |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]]\` | Stop the preview server |
| \`\${CLAUDE_SKILL_DIR}[[/generators/social-base.html]]\` | HTML base for social cards (.social-card elements) |
| \`\${CLAUDE_SKILL_DIR}[[/generators/document-base.html]]\` | HTML base for documents (.doc-page elements) |
| \`\${CLAUDE_SKILL_DIR}[[/generators/slides-base.html]]\` | HTML base for slide decks (.deck + .slide elements) |

## Step 1: Gather Requirements

**[HUMAN]** Provide:
- Topic or raw idea (a paragraph, bullet points, or a draft blog post)
- Target platforms (LinkedIn carousel, Instagram story, blog, etc.)
- Tone (professional, casual, educational, inspirational)

**[CODING AGENT]** Check for brand skills:
- Search for any skill with **category: brand** in the project
- If found, use its design tokens (\`--brand-*\` CSS variables, fonts, logos)
- If not found, use neutral dark theme defaults

## Step 2: Start Preview Server

**[CODING AGENT]** Start the server and seed the session:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/scaffold-session.sh]] <session-name> --project-dir .
\`\`\`

This starts the preview server and outputs a JSON object with the URL:
\`\`\`json
{"type":"server-started","url":"http://localhost:PORT","screen_dir":"/path/to/content/"}
\`\`\`

The server injects \`preview-shell.js\` (sidebar, format switcher, PNG/ZIP export) automatically into every HTML file it serves. No inline scripts needed.

## Step 3: Write the Blog Post

**[CODING AGENT]** Transform the raw idea into a structured blog post:
1. Create a compelling headline
2. Write an introduction hook
3. Develop 3-5 key sections with subheadings
4. Add a conclusion with call-to-action
5. Save as \`blog/blog-post.md\`

## Step 4: Generate Visual Assets

**[CODING AGENT]** For each target platform, generate HTML files using the skill templates:

### Social Cards / Carousels
- Start from \`generators/social-base.html\` — use \`.social-card\` elements
- Each \`.social-card\` gets a \`data-type\` attribute (cover, content, stat, quote, cta)
- Apply brand CSS variables (\`--brand-bg\`, \`--brand-text\`, \`--brand-accent\`)
- Write the file to \`screen_dir/social.html\`

### Documents / Blog
- Start from \`generators/document-base.html\` — use \`.doc-page\` elements
- Write the file to \`screen_dir/document.html\`

## Step 5: Visual Review

**[CODING AGENT]** Navigate to the server URL from Step 2:

\`\`\`
mcp__playwright__browser_navigate({ url: "http://localhost:PORT" })
\`\`\`

The preview shell sidebar provides:
- **File selector** — switch between HTML files in the session
- **Format presets** — 1:1 LinkedIn, 4:5 Instagram, 9:16 Story, 1200×630 OG
- **Logo controls** — show/hide, resize, reposition
- **Export** — "Export All PNGs" downloads a ZIP; per-card PNG buttons on hover

### The Review Loop

1. Show the preview URL to the user and ask for feedback
2. Apply changes to the HTML file in \`screen_dir/\`
3. The server live-reloads the browser automatically
4. Repeat until the user approves

Read \`\${CLAUDE_SKILL_DIR}[[/references/preview-shell-guide.md]]\` for full sidebar feature reference.

## Step 6: Export Final Assets

**[CODING AGENT]** After the user approves, click "Export All PNGs" in the sidebar — downloads a ZIP with all cards at 2x resolution. Or automate via Playwright:

\`\`\`
mcp__playwright__browser_snapshot()  // find the Export All PNGs button ref
mcp__playwright__browser_click({ ref: "..." })
\`\`\`

Stop the server when done:
\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]] <session_dir>
\`\`\`

## Step 7: Deliver Final Package

**[CODING AGENT]** Summarize what was created:
- List all output files with their paths
- Note the aspect ratios and dimensions of exported PNGs
- Remind the user that HTML files can be reopened for further editing
`;
