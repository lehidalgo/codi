---
title: codi-docx
description: >
  Use when creating, editing, or working with Word documents (.docx). Also activate when extracting content, adding tracked changes, comments, or images, or producing reports, memos, and letters as .docx. Do NOT activate for PDFs or spreadsheets.
sidebar:
  label: "codi-docx"
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

Creates, edits, and analyzes Word documents (`.docx`). Supports tracked changes, comments, images, tables, and style manipulation. Handles legacy `.doc` conversion via LibreOffice.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Python 3.9+ | required | core runtime |
| pandoc | `brew install pandoc` | read .docx → markdown; create .docx from markdown |
| LibreOffice | `brew install --cask libreoffice` | convert `.doc` → `.docx`, render to PDF/PNG |
| python-docx | `pip install python-docx` | programmatic .docx editing |
| markitdown | `pip install markitdown` | quick text extraction |
| Node.js | optional | `docx-js` for creating .docx from scratch |

## Scripts

| File | Purpose |
|------|---------|
| `scripts/accept_changes.py` | Accept all tracked changes in a .docx file |
| `scripts/comment.py` | Add or list comments in a document |
| `scripts/office/unpack.py` | Unzip .docx to raw XML for direct editing |
| `scripts/office/soffice.py` | LibreOffice wrapper — convert formats, export to PDF/images |

## Workflow Summary

| Task | Approach |
|------|----------|
| Read / analyze content | `pandoc` or `markitdown` |
| Create new document | `docx-js` (Node.js) |
| Edit existing document | Unpack XML → edit → repack |
| Convert `.doc` to `.docx` | `python scripts/office/soffice.py --convert-to docx file.doc` |
| Accept tracked changes | `python scripts/accept_changes.py input.docx output.docx` |

## Quick Start

```bash
# Install core dependencies (macOS)
brew install pandoc
brew install --cask libreoffice
pip install python-docx markitdown

# Read a document
markitdown document.docx

# Unpack XML for direct editing
python scripts/office/unpack.py document.docx unpacked/
```

---

# SKILL.md

## When to Activate

- User wants to create, edit, read, or manipulate a `.docx` file
- User mentions 'Word doc', 'Word document', or `.docx`
- User needs tracked changes, comments, or images in a document
- User wants a report, memo, letter, or template as a Word file

A .docx file is a ZIP archive containing XML files.

## Quick Reference

| Task | Approach |
|------|----------|
| Read/analyze content | `pandoc` or unpack for raw XML |
| Create new document | Use `docx-js` - see Creating New Documents below |
| Edit existing document | Unpack → edit XML → repack - see Editing Existing Documents below |

### Converting .doc to .docx

Legacy `.doc` files must be converted before editing:

```bash
python ${CLAUDE_SKILL_DIR}[[/scripts/office/soffice.py]] --headless --convert-to docx document.doc
```

### Reading Content

```bash
# Text extraction with tracked changes
pandoc --track-changes=all document.docx -o output.md

# Raw XML access
python ${CLAUDE_SKILL_DIR}[[/scripts/office/unpack.py]] document.docx unpacked/
```

### Converting to Images

```bash
python ${CLAUDE_SKILL_DIR}[[/scripts/office/soffice.py]] --headless --convert-to pdf document.docx
pdftoppm -jpeg -r 150 document.pdf page
```

### Accepting Tracked Changes

To produce a clean document with all tracked changes accepted (requires LibreOffice):

```bash
python ${CLAUDE_SKILL_DIR}[[/scripts/accept_changes.py]] input.docx output.docx
```

---

## Brand Integration

When a brand skill is active or the user names a brand (bbva, rl3, codi, etc.), use the brand skill's generators instead of building the document manually.

1. **If the brand skill is already active** in this session, its generator commands are in its content with paths already resolved — use them directly.
2. **If the brand skill is not active**, tell the user to enable it (e.g., `codi-brand`) and re-run.
3. Write `content.json` using the schema from the brand skill, then run its TypeScript generator (DEFAULT) or Python fallback.

**content.json schema:**

```json
{
  "title": "Document Title",
  "subtitle": "Optional subtitle",
  "author": "Author",
  "sections": [
    {
      "number": "01",
      "label": "Section Label",
      "heading": "Section Heading",
      "body": "Body paragraph.",
      "items": ["Bullet 1", "Bullet 2"],
      "callout": "Optional callout quote"
    }
  ]
}
```

---

## Creating Branded Output

When the user asks to create a branded DOCX, ask two questions if not already stated:

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
  npx tsx ${CLAUDE_SKILL_DIR}[[/scripts/ts/generate_docx.ts]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.docx
elif command -v uv &>/dev/null; then
  # Python via uv (ephemeral isolated env — no system pollution)
  uv run --with python-docx python3 ${CLAUDE_SKILL_DIR}[[/scripts/python/generate_docx.py]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.docx
else
  # Python via venv fallback
  SKILL_VENV="/tmp/codi-skill-venv" && python3 -m venv "$SKILL_VENV" 2>/dev/null || true
  "$SKILL_VENV/bin/pip" install -q python-docx
  "$SKILL_VENV/bin/python3" ${CLAUDE_SKILL_DIR}[[/scripts/python/generate_docx.py]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.docx
fi
```

Omit `--tokens` to use Codi default brand. Replace `dark` with `light` for the light theme.

---

## Creating New Documents

Read `${CLAUDE_SKILL_DIR}[[/references/docx-api.md]]` for the full JavaScript API reference: page size, styles, lists, tables, images, hyperlinks, footnotes, tab stops, multi-column layouts, TOC, headers/footers, and critical rules.

---

## Editing Existing Documents

**Follow all 3 steps in order.**

### Step 1: Unpack
```bash
python ${CLAUDE_SKILL_DIR}[[/scripts/office/unpack.py]] document.docx unpacked/
```
Extracts XML, pretty-prints, merges adjacent runs, and converts smart quotes to XML entities (`&#x201C;` etc.) so they survive editing. Use `--merge-runs false` to skip run merging.

### Step 2: Edit XML

Edit files in `unpacked/word/`. See XML Reference below for patterns.

**Use "Claude" as the author** for tracked changes and comments, unless the user explicitly requests use of a different name.

**Use the Edit tool directly for string replacement. Do not write Python scripts.** Scripts introduce unnecessary complexity. The Edit tool shows exactly what is being replaced.

**CRITICAL: Use smart quotes for new content.** When adding text with apostrophes or quotes, use XML entities to produce smart quotes:
```xml
<!-- Use these entities for professional typography -->
<w:t>Here&#x2019;s a quote: &#x201C;Hello&#x201D;</w:t>
```
| Entity | Character |
|--------|-----------|
| `&#x2018;` | ' (left single) |
| `&#x2019;` | ' (right single / apostrophe) |
| `&#x201C;` | " (left double) |
| `&#x201D;` | " (right double) |

**Adding comments:** Use `comment.py` to handle boilerplate across multiple XML files (text must be pre-escaped XML):
```bash
python ${CLAUDE_SKILL_DIR}[[/scripts/comment.py]] unpacked/ 0 "Comment text with &amp; and &#x2019;"
python ${CLAUDE_SKILL_DIR}[[/scripts/comment.py]] unpacked/ 1 "Reply text" --parent 0  # reply to comment 0
python ${CLAUDE_SKILL_DIR}[[/scripts/comment.py]] unpacked/ 0 "Text" --author "Custom Author"  # custom author name
```
Then add markers to document.xml (see Comments in XML Reference).

### Step 3: Pack
```bash
python ${CLAUDE_SKILL_DIR}[[/scripts/office/pack.py]] unpacked/ output.docx --original document.docx
```
Validates with auto-repair, condenses XML, and creates DOCX. Use `--validate false` to skip.

**Auto-repair will fix:**
- `durableId` >= 0x7FFFFFFF (regenerates valid ID)
- Missing `xml:space="preserve"` on `<w:t>` with whitespace

**Auto-repair won't fix:**
- Malformed XML, invalid element nesting, missing relationships, schema violations

### Common Pitfalls

- **Replace entire `<w:r>` elements**: When adding tracked changes, replace the whole `<w:r>...</w:r>` block with `<w:del>...<w:ins>...` as siblings. Don't inject tracked change tags inside a run.
- **Preserve `<w:rPr>` formatting**: Copy the original run's `<w:rPr>` block into your tracked change runs to maintain bold, font size, etc.

---

## XML Reference

### Schema Compliance

- **Element order in `<w:pPr>`**: `<w:pStyle>`, `<w:numPr>`, `<w:spacing>`, `<w:ind>`, `<w:jc>`, `<w:rPr>` last
- **Whitespace**: Add `xml:space="preserve"` to `<w:t>` with leading/trailing spaces
- **RSIDs**: Must be 8-digit hex (e.g., `00AB1234`)

### Tracked Changes

**Insertion:**
```xml
<w:ins w:id="1" w:author="Claude" w:date="2025-01-01T00:00:00Z">
  <w:r><w:t>inserted text</w:t></w:r>
</w:ins>
```

**Deletion:**
```xml
<w:del w:id="2" w:author="Claude" w:date="2025-01-01T00:00:00Z">
  <w:r><w:delText>deleted text</w:delText></w:r>
</w:del>
```

**Inside `<w:del>`**: Use `<w:delText>` instead of `<w:t>`, and `<w:delInstrText>` instead of `<w:instrText>`.

**Minimal edits** - only mark what changes:
```xml
<!-- Change "30 days" to "60 days" -->
<w:r><w:t>The term is </w:t></w:r>
<w:del w:id="1" w:author="Claude" w:date="...">
  <w:r><w:delText>30</w:delText></w:r>
</w:del>
<w:ins w:id="2" w:author="Claude" w:date="...">
  <w:r><w:t>60</w:t></w:r>
</w:ins>
<w:r><w:t> days.</w:t></w:r>
```

**Deleting entire paragraphs/list items** - when removing ALL content from a paragraph, also mark the paragraph mark as deleted so it merges with the next paragraph. Add `<w:del/>` inside `<w:pPr><w:rPr>`:
```xml
<w:p>
  <w:pPr>
    <w:numPr>...</w:numPr>  <!-- list numbering if present -->
    <w:rPr>
      <w:del w:id="1" w:author="Claude" w:date="2025-01-01T00:00:00Z"/>
    </w:rPr>
  </w:pPr>
  <w:del w:id="2" w:author="Claude" w:date="2025-01-01T00:00:00Z">
    <w:r><w:delText>Entire paragraph content being deleted...</w:delText></w:r>
  </w:del>
</w:p>
```
Without the `<w:del/>` in `<w:pPr><w:rPr>`, accepting changes leaves an empty paragraph/list item.

**Rejecting another author's insertion** - nest deletion inside their insertion:
```xml
<w:ins w:author="Jane" w:id="5">
  <w:del w:author="Claude" w:id="10">
    <w:r><w:delText>their inserted text</w:delText></w:r>
  </w:del>
</w:ins>
```

**Restoring another author's deletion** - add insertion after (don't modify their deletion):
```xml
<w:del w:author="Jane" w:id="5">
  <w:r><w:delText>deleted text</w:delText></w:r>
</w:del>
<w:ins w:author="Claude" w:id="10">
  <w:r><w:t>deleted text</w:t></w:r>
</w:ins>
```

### Comments

After running `comment.py` (see Step 2), add markers to document.xml. For replies, use `--parent` flag and nest markers inside the parent's.

**CRITICAL: `<w:commentRangeStart>` and `<w:commentRangeEnd>` are siblings of `<w:r>`, never inside `<w:r>`.**

```xml
<!-- Comment markers are direct children of w:p, never inside w:r -->
<w:commentRangeStart w:id="0"/>
<w:del w:id="1" w:author="Claude" w:date="2025-01-01T00:00:00Z">
  <w:r><w:delText>deleted</w:delText></w:r>
</w:del>
<w:r><w:t> more text</w:t></w:r>
<w:commentRangeEnd w:id="0"/>
<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r>

<!-- Comment 0 with reply 1 nested inside -->
<w:commentRangeStart w:id="0"/>
  <w:commentRangeStart w:id="1"/>
  <w:r><w:t>text</w:t></w:r>
  <w:commentRangeEnd w:id="1"/>
<w:commentRangeEnd w:id="0"/>
<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r>
<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="1"/></w:r>
```

### Images

1. Add image file to `word/media/`
2. Add relationship to `word/_rels/document.xml.rels`:
```xml
<Relationship Id="rId5" Type=".../image" Target="media/image1.png"/>
```
3. Add content type to `[Content_Types].xml`:
```xml
<Default Extension="png" ContentType="image/png"/>
```
4. Reference in document.xml:
```xml
<w:drawing>
  <wp:inline>
    <wp:extent cx="914400" cy="914400"/>  <!-- EMUs: 914400 = 1 inch -->
    <a:graphic>
      <a:graphicData uri=".../picture">
        <pic:pic>
          <pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing>
```

---

## Dependencies

- **pandoc**: Text extraction
- **docx**: `npm install -g docx` (new documents)
- **LibreOffice**: PDF conversion (auto-configured for sandboxed environments via `${CLAUDE_SKILL_DIR}[[/scripts/office/soffice.py]]`)
- **Poppler**: `pdftoppm` for images
