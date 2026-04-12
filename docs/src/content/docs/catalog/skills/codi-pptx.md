---
title: codi-pptx
description: >
  Use when the user wants to create, edit, or read a .pptx file. Also activate when the user mentions 'deck', 'slides', or 'presentation', or references a .pptx filename. Do NOT activate for PDF slide exports or HTML presentations.
sidebar:
  label: "codi-pptx"
artifactType: skill
artifactCategory: File Format Tools
userInvocable: true
compatibility:
  - claude-code
  - cursor
  - codex
  - windsurf
  - cline
version: 1
---

# README

Creates, edits, and analyzes PowerPoint presentations (`.pptx`). Supports reading slide content, editing via XML manipulation, creating from scratch with `pptxgenjs`, and converting to PDF or images via LibreOffice.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Python 3.9+ | required | core runtime |
| markitdown | `pip install markitdown` | quick text extraction from .pptx |
| LibreOffice | `brew install --cask libreoffice` | convert .ppt → .pptx, export to PDF/images |
| Node.js | required for creation | `pptxgenjs` for creating .pptx from scratch |
| pptxgenjs | `npm install pptxgenjs` | programmatic .pptx creation |

## Scripts

| File | Purpose |
|------|---------|
| `scripts/thumbnail.py` | Render slide thumbnails via LibreOffice for visual inspection |
| `scripts/office/unpack.py` | Unzip .pptx to raw XML for direct editing |
| `scripts/office/soffice.py` | LibreOffice wrapper — convert formats, export to PDF/images |
| `scripts/__init__.py` | Python package init |
| `scripts/clean.py` | Remove unused slide layouts and master slides |
| `scripts/add_slide.py` | Add slides to an existing presentation |
| `scripts/brand_tokens.json` | Brand colors, fonts, and layout values |

## Workflow Summary

| Task | Approach |
|------|----------|
| Read / extract text | `python -m markitdown presentation.pptx` |
| Visual inspection | `python scripts/thumbnail.py presentation.pptx` |
| Edit existing slides | Unpack XML → edit content → clean → repack |
| Create from scratch | `pptxgenjs` (see `references/pptxgenjs.md`) |
| Convert `.ppt` → `.pptx` | `python scripts/office/soffice.py --convert-to pptx file.ppt` |

## Quick Start

```bash
# Install dependencies (macOS)
brew install --cask libreoffice
pip install markitdown

# Read a presentation
python -m markitdown presentation.pptx

# Generate slide thumbnails
python scripts/thumbnail.py presentation.pptx

# Unpack for XML editing
python scripts/office/unpack.py presentation.pptx unpacked/
```

## Branded Output

For branded presentations, a `brand_tokens.json` file provides color palette, font names, and layout constants. The skill reads this automatically when a brand skill is active in the project.

---

# SKILL.md

## When to Activate

- User wants to create, edit, or read a `.pptx` file
- User mentions 'deck', 'slides', 'presentation', or a `.pptx` filename
- User needs to extract text, speaker notes, or content from a presentation
- User needs to combine, split, or convert slide files


## Quick Reference

| Task | Guide |
|------|-------|
| Read/analyze content | `python -m markitdown presentation.pptx` |
| Edit or create from template | Read [editing.md](editing.md) |
| Create from scratch | Read [pptxgenjs.md](pptxgenjs.md) |

---

## Reading Content

```bash
# Text extraction
python -m markitdown presentation.pptx

# Visual overview
python ${CLAUDE_SKILL_DIR}[[/scripts/thumbnail.py]] presentation.pptx

# Raw XML
python ${CLAUDE_SKILL_DIR}[[/scripts/office/unpack.py]] presentation.pptx unpacked/
```

---

## Editing Workflow

**Read [editing.md](editing.md) for full details.**

1. Analyze template with `thumbnail.py`
2. Unpack → manipulate slides → edit content → clean → pack

---

## Creating Branded Output

When the user asks to create a branded PPTX, ask two questions if not already stated:

**Step 1 — Brand** (skip if brand already named):
```
Which brand styling would you like to apply?
  1. CODI (default — uses bundled tokens)
  2. Custom — provide a path to brand_tokens.json
```

**Step 2 — Theme** (skip if theme already named):
```
Which color theme?
  1. Dark (default)
  2. Light
```

Then run (detect runtime first):
```bash
if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
  # TypeScript (preferred)
  npx tsx ${CLAUDE_SKILL_DIR}[[/scripts/ts/generate_pptx.ts]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.pptx
elif command -v uv &>/dev/null; then
  # Python via uv (ephemeral isolated env — no system pollution)
  uv run --with python-pptx --with Pillow python3 ${CLAUDE_SKILL_DIR}[[/scripts/python/generate_pptx.py]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.pptx
else
  # Python via venv fallback
  SKILL_VENV="/tmp/codi-skill-venv" && python3 -m venv "$SKILL_VENV" 2>/dev/null || true
  "$SKILL_VENV/bin/pip" install -q python-pptx Pillow
  "$SKILL_VENV/bin/python3" ${CLAUDE_SKILL_DIR}[[/scripts/python/generate_pptx.py]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.pptx
fi
```

Omit `--tokens` to use Codi default brand. Replace `dark` with `light` for the light theme.

---

## Creating from Scratch

**Read [pptxgenjs.md](pptxgenjs.md) for full details.**

Use when no template or reference presentation is available.

---

## Design Ideas

Read `${CLAUDE_SKILL_DIR}[[/references/design-guide.md]]` for design principles, color palettes, typography, and layout options.

---

## Brand Integration

When a brand skill is active or the user names a brand (e.g., codi), use the brand skill's generators instead of building slides from scratch.

1. **If the brand skill is already active** in this session, its generator commands are in its content with paths already resolved — use them directly.
2. **If the brand skill is not active**, tell the user to enable it (e.g., `codi-brand`) and re-run.
3. Write `content.json` using the schema below, then run the TypeScript generator (DEFAULT) or Python fallback.

**Your role as the agent: create content.json only.** The generator script owns all layout decisions — logo position, slide structure, font sizes, spacing. You control what is said on each slide, not how it looks.

**content.json schema:**

```json
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
```

**Slide types reference:**

| type | Required fields | Optional fields |
|------|----------------|-----------------|
| `title`   | — (uses top-level title/subtitle/author) | title, subtitle, author |
| `section` | heading | number, label, body, items, callout |
| `quote`   | quote | attribution |
| `metrics` | metrics[] (max 4) | heading |
| `closing` | message | contact |

---

## QA (Required)

**Assume there are problems. Your job is to find them.**

Your first render is almost never correct. Approach QA as a bug hunt, not a confirmation step. If you found zero issues on first inspection, you weren't looking hard enough.

### Content QA

```bash
python -m markitdown output.pptx
```

Check for missing content, typos, wrong order.

**When using templates, check for leftover placeholder text:**

```bash
python -m markitdown output.pptx | grep -iE "xxxx|lorem|ipsum|this.*(page|slide).*layout"
```

If grep returns results, fix them before declaring success.

### Visual QA

**USE SUBAGENTS** — even for 2-3 slides. You've been staring at the code and will see what you expect, not what's there. Subagents have fresh eyes.

Convert slides to images (see [Converting to Images](#converting-to-images)), then use this prompt:

```
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
```

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

```bash
python ${CLAUDE_SKILL_DIR}[[/scripts/office/soffice.py]] --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
```

This creates `slide-01.jpg`, `slide-02.jpg`, etc.

To re-render specific slides after fixes:

```bash
pdftoppm -jpeg -r 150 -f N -l N output.pdf slide-fixed
```

---

## Dependencies

- `pip install "markitdown[pptx]"` - text extraction
- `pip install Pillow` - thumbnail grids
- `npm install -g pptxgenjs` - creating from scratch
- LibreOffice (`soffice`) - PDF conversion (auto-configured for sandboxed environments via `${CLAUDE_SKILL_DIR}[[/scripts/office/soffice.py]]`)
- Poppler (`pdftoppm`) - PDF to images
