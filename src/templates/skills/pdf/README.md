# codi-pdf

Handles all PDF operations: reading, extracting text/tables, merging, splitting, rotating, watermarking, creating, filling forms, encrypting, extracting images, and OCR on scanned documents.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Python 3.9+ | required | core runtime |
| pypdf | `pip install pypdf` | read, merge, split, rotate, encrypt |
| pdfplumber | `pip install pdfplumber` | table extraction |
| camelot-py | `pip install camelot-py[cv]` | complex table extraction |
| reportlab | `pip install reportlab` | create PDFs from scratch |
| pytesseract | `pip install pytesseract` | OCR on scanned PDFs |
| tesseract-ocr | `brew install tesseract` | OCR engine (required by pytesseract) |
| Node.js + pnpm | optional | TypeScript PDF utilities |

Install the most common packages at once:

```bash
pip install pypdf pdfplumber reportlab
```

## Scripts

| Directory | Runtime | Purpose |
|-----------|---------|---------|
| `scripts/python/` | Python | PDF read, merge, split, extract, OCR |
| `scripts/ts/` | TypeScript (npx tsx) | PDF utilities, pdf-lib wrapper |

## Usage Notes

- Run scripts with `--help` first before reading source code — they expose parameters directly.
- TypeScript scripts run via `npx tsx scripts/ts/<script>.ts`.
- Python scripts run via `python3 scripts/python/<script>.py`.
- OCR requires both `pytesseract` and the system `tesseract` binary in PATH.
- For advanced operations (form filling, JavaScript, complex layouts) see `references/` for extended guides.
