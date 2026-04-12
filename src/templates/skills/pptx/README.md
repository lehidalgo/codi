# codi-pptx

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
