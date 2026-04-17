import {
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  SUPPORTED_PLATFORMS_YAML,
  SKILL_CATEGORY,
} from "#src/constants.js";
import type { TemplateCounts } from "../types.js";

function buildBrandPrompt(brandSkillNames: string[], projectName: string): string {
  const lines = brandSkillNames.map((name, i) => {
    const label = name
      .replace(/-brand$/, "")
      .replace(
        new RegExp(`^${projectName}$`),
        projectName.charAt(0).toUpperCase() + projectName.slice(1),
      );
    const brandLabel =
      label.length <= 4 ? label.toUpperCase() : label.charAt(0).toUpperCase() + label.slice(1);
    const suffix =
      i === 0
        ? " (default — uses bundled tokens)"
        : `  — requires ${projectName}-${name} skill active`;
    return `  ${i + 1}. ${brandLabel}${suffix}`;
  });
  lines.push(`  ${brandSkillNames.length + 1}. Custom — provide a path to brand_tokens.json`);
  return lines.join("\n");
}

export function getTemplate(counts: TemplateCounts): string {
  const brandPrompt = buildBrandPrompt(counts.brandSkillNames, PROJECT_NAME);
  return `---
name: {{name}}
description: |
  Create, edit, or read PowerPoint (.pptx) files. Use when the user mentions
  a .pptx file, "deck", "slides", "presentation", "PowerPoint", "pitch
  deck", "investor deck", "sales deck", "keynote file", or when the user
  wants to extract speaker notes, insert a slide, edit a deck, or build a
  branded deck. Also activate for phrases like "update slide N", "add a
  slide to the deck", "pull text from the pptx", "combine two decks".
  Stack: python-pptx + pptxgenjs via runtime-detected ts/python scripts.
  Do NOT activate for PDF slide exports (use ${PROJECT_NAME}-pdf), HTML
  slide decks (use ${PROJECT_NAME}-content-factory), Word documents (use
  ${PROJECT_NAME}-docx), or Excel spreadsheets (use ${PROJECT_NAME}-xlsx).
category: ${SKILL_CATEGORY.FILE_FORMAT_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 30
---

# {{name}} — PPTX

## When to Activate

- User wants to create, edit, or read a \\\`.pptx\\\` file
- User mentions 'deck', 'slides', 'presentation', or a \\\`.pptx\\\` filename
- User needs to extract text, speaker notes, or content from a presentation
- User needs to combine, split, or convert slide files

## Skip When

- User wants a PDF — use ${PROJECT_NAME}-pdf
- User wants an HTML slide deck (for browser / Content Factory) — use ${PROJECT_NAME}-content-factory
- User wants a Word document — use ${PROJECT_NAME}-docx
- User wants an Excel spreadsheet — use ${PROJECT_NAME}-xlsx
- User wants a branded one-pager / report — use ${PROJECT_NAME}-content-factory


## Quick Reference

| Task | Guide |
|------|-------|
| Read/analyze content | \\\`python -m markitdown presentation.pptx\\\` |
| Edit or create from template | Read \\\`\${CLAUDE_SKILL_DIR}[[/references/editing.md]]\\\` |
| Create from scratch | Read \\\`\${CLAUDE_SKILL_DIR}[[/references/pptxgenjs.md]]\\\` |

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

**Read \\\`\${CLAUDE_SKILL_DIR}[[/references/editing.md]]\\\` for full details.**

1. Analyze template with \\\`thumbnail.py\\\`
2. Unpack → manipulate slides → edit content → clean → pack

---

## Creating Branded Output

When the user asks to create a branded PPTX, ask two questions if not already stated:

**Step 1 — Brand** (skip if brand already named):
\`\`\`
Which brand styling would you like to apply?
${brandPrompt}
\`\`\`

**Step 2 — Theme** (skip if theme already named):
\`\`\`
Which color theme?
  1. Dark (default)
  2. Light
\`\`\`

Then run (detect runtime first):
\`\`\`bash
if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
  # TypeScript (preferred)
  npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/generate_pptx.ts]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.pptx
elif command -v uv &>/dev/null; then
  # Python via uv (ephemeral isolated env — no system pollution)
  uv run --with python-pptx --with Pillow python3 \${CLAUDE_SKILL_DIR}[[/scripts/python/generate_pptx.py]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.pptx
else
  # Python via venv fallback
  SKILL_VENV="/tmp/${PROJECT_NAME}-skill-venv" && python3 -m venv "\$SKILL_VENV" 2>/dev/null || true
  "\$SKILL_VENV/bin/pip" install -q python-pptx Pillow
  "\$SKILL_VENV/bin/python3" \${CLAUDE_SKILL_DIR}[[/scripts/python/generate_pptx.py]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.pptx
fi
\`\`\`

Omit \`--tokens\` to use ${PROJECT_NAME_DISPLAY} default brand. Replace \`dark\` with \`light\` for the light theme.

---

## Creating from Scratch

**Read \\\`\${CLAUDE_SKILL_DIR}[[/references/pptxgenjs.md]]\\\` for full details.**

Use when no template or reference presentation is available.

---

## Design Ideas

Read \\\`\${CLAUDE_SKILL_DIR}[[/references/design-guide.md]]\\\` for design principles, color palettes, typography, and layout options.

---

## Brand Integration

When a brand skill is active or the user names a brand (e.g., ${PROJECT_NAME}), use the brand skill's generators instead of building slides from scratch.

1. **If the brand skill is already active** in this session, its generator commands are in its content with paths already resolved — use them directly.
2. **If the brand skill is not active**, tell the user to enable it (e.g., \\\`${PROJECT_NAME}-brand\\\`) and re-run.
3. Write \\\`content.json\\\` using the schema below, then run the TypeScript generator (DEFAULT) or Python fallback.

**Your role as the agent: create content.json only.** The generator script owns all layout decisions — logo position, slide structure, font sizes, spacing. You control what is said on each slide, not how it looks.

**content.json schema:**

\\\`\\\`\\\`json
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle",
  "author": "Author Name",
  "slides": [
    { "type": "title" },
    {
      "type": "section",
      "number": "01",
      "label": "SECTION LABEL",
      "heading": "Slide Heading",
      "body": "Optional body paragraph.",
      "items": ["Bullet 1", "Bullet 2"],
      "callout": "Optional callout quote"
    },
    {
      "type": "quote",
      "quote": "The most important insight from this quarter.",
      "attribution": "Name, Title"
    },
    {
      "type": "metrics",
      "heading": "KEY NUMBERS",
      "metrics": [
        { "value": "€12M", "label": "Revenue" },
        { "value": "34%",  "label": "Growth" },
        { "value": "420",  "label": "Clients" }
      ]
    },
    { "type": "closing", "message": "Thank you", "contact": "team@example.com" }
  ]
}
\\\`\\\`\\\`

**Slide types reference:**

| type | Required fields | Optional fields |
|------|----------------|-----------------|
| \\\`title\\\`   | — (uses top-level title/subtitle/author) | title, subtitle, author |
| \\\`section\\\` | heading | number, label, body, items, callout |
| \\\`quote\\\`   | quote | attribution |
| \\\`metrics\\\` | metrics[] (max 4) | heading |
| \\\`closing\\\` | message | contact |

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
}
