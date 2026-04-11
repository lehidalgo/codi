# codi-docx

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
