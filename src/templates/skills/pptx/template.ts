import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: "Use when the user wants to create, edit, or read a .pptx file. Also activate when the user mentions 'deck', 'slides', or 'presentation', or references a .pptx filename. Do NOT activate for PDF slide exports or HTML presentations."
category: ${SKILL_CATEGORY.FILE_FORMAT_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 9
---

# PPTX Skill

## When to Activate

- User wants to create, edit, or read a \\\`.pptx\\\` file
- User mentions 'deck', 'slides', 'presentation', or a \\\`.pptx\\\` filename
- User needs to extract text, speaker notes, or content from a presentation
- User needs to combine, split, or convert slide files


## Quick Reference

| Task | Guide |
|------|-------|
| Read/analyze content | \\\`python -m markitdown presentation.pptx\\\` |
| Edit or create from template | Read [editing.md](editing.md) |
| Create from scratch | Read [pptxgenjs.md](pptxgenjs.md) |

---

## Reading Content

\\\`\\\`\\\`bash
# Text extraction
python -m markitdown presentation.pptx

# Visual overview
python \${CLAUDE_SKILL_DIR}[[/scripts/thumbnail.py]] presentation.pptx

# Raw XML
python \${CLAUDE_SKILL_DIR}[[/scripts/office/unpack.py]] presentation.pptx unpacked/
\\\`\\\`\\\`

---

## Editing Workflow

**Read [editing.md](editing.md) for full details.**

1. Analyze template with \\\`thumbnail.py\\\`
2. Unpack → manipulate slides → edit content → clean → pack

---

## Creating from Scratch

**Read [pptxgenjs.md](pptxgenjs.md) for full details.**

Use when no template or reference presentation is available.

---

## Design Ideas

Read \\\`\${CLAUDE_SKILL_DIR}[[/references/design-guide.md]]\\\` for design principles, color palettes, typography, and layout options.

---

## Brand Integration

When a brand skill is active or the user names a brand (bbva, rl3, codi, etc.), use the brand skill's generators instead of building slides from scratch.

1. **If the brand skill is already active** in this session, its generator commands are in its content with paths already resolved — use them directly.
2. **If the brand skill is not active**, tell the user to enable it (e.g., \\\`codi-bbva-brand\\\`) and re-run.
3. Write \\\`content.json\\\` using the schema from the brand skill, then run its TypeScript generator (DEFAULT) or Python fallback.

**content.json schema:**

\\\`\\\`\\\`json
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle",
  "author": "Author",
  "sections": [
    {
      "number": "01",
      "label": "Section Label",
      "heading": "Slide Heading",
      "body": "Body paragraph.",
      "items": ["Bullet 1", "Bullet 2"],
      "callout": "Optional callout quote"
    }
  ]
}
\\\`\\\`\\\`

---

## QA (Required)

**Assume there are problems. Your job is to find them.**

Your first render is almost never correct. Approach QA as a bug hunt, not a confirmation step. If you found zero issues on first inspection, you weren't looking hard enough.

### Content QA

\\\`\\\`\\\`bash
python -m markitdown output.pptx
\\\`\\\`\\\`

Check for missing content, typos, wrong order.

**When using templates, check for leftover placeholder text:**

\\\`\\\`\\\`bash
python -m markitdown output.pptx | grep -iE "xxxx|lorem|ipsum|this.*(page|slide).*layout"
\\\`\\\`\\\`

If grep returns results, fix them before declaring success.

### Visual QA

**USE SUBAGENTS** — even for 2-3 slides. You've been staring at the code and will see what you expect, not what's there. Subagents have fresh eyes.

Convert slides to images (see [Converting to Images](#converting-to-images)), then use this prompt:

\\\`\\\`\\\`
Visually inspect these slides. Assume there are issues — find them.

Look for:
- Overlapping elements (text through shapes, lines through words, stacked elements)
- Text overflow or cut off at edges/box boundaries
- Decorative lines positioned for single-line text but title wrapped to two lines
- Source citations or footers colliding with content above
- Elements too close (< 0.3" gaps) or cards/sections nearly touching
- Uneven gaps (large empty area in one place, cramped in another)
- Insufficient margin from slide edges (< 0.5")
- Columns or similar elements not aligned consistently
- Low-contrast text (e.g., light gray text on cream-colored background)
- Low-contrast icons (e.g., dark icons on dark backgrounds without a contrasting circle)
- Text boxes too narrow causing excessive wrapping
- Leftover placeholder content

For each slide, list issues or areas of concern, even if minor.

Read and analyze these images:
1. /path/to/slide-01.jpg (Expected: [brief description])
2. /path/to/slide-02.jpg (Expected: [brief description])

Report ALL issues found, including minor ones.
\\\`\\\`\\\`

### Verification Loop

1. Generate slides → Convert to images → Inspect
2. **List issues found** (if none found, look again more critically)
3. Fix issues
4. **Re-verify affected slides** — one fix often creates another problem
5. Repeat until a full pass reveals no new issues

**Do not declare success until you've completed at least one fix-and-verify cycle.**

---

## Converting to Images

Convert presentations to individual slide images for visual inspection:

\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}[[/scripts/office/soffice.py]] --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
\\\`\\\`\\\`

This creates \\\`slide-01.jpg\\\`, \\\`slide-02.jpg\\\`, etc.

To re-render specific slides after fixes:

\\\`\\\`\\\`bash
pdftoppm -jpeg -r 150 -f N -l N output.pdf slide-fixed
\\\`\\\`\\\`

---

## Dependencies

- \\\`pip install "markitdown[pptx]"\\\` - text extraction
- \\\`pip install Pillow\\\` - thumbnail grids
- \\\`npm install -g pptxgenjs\\\` - creating from scratch
- LibreOffice (\\\`soffice\\\`) - PDF conversion (auto-configured for sandboxed environments via \\\`\${CLAUDE_SKILL_DIR}[[/scripts/office/soffice.py]]\\\`)
- Poppler (\\\`pdftoppm\\\`) - PDF to images
`;
