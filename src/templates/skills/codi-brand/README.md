# codi-codi-brand

Codi brand content studio. Generates branded slides, documents, social cards, reports, and PPTX/DOCX files that carry Codi visual identity. Brand tokens (colors, fonts, layout, voice) drive all output.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Node.js 18+ | required | TypeScript brand token adapter + server |
| LibreOffice | `brew install --cask libreoffice` | PPTX/DOCX export from HTML |
| pandoc | `brew install pandoc` | DOCX export from HTML |

No Python dependencies needed for HTML/CSS output. LibreOffice is required only when exporting to `.pptx` or `.docx`.

## Brand Assets (read before generating)

| File | Read when | Purpose |
|------|-----------|---------|
| `brand/tokens.json` | Always | Colors, fonts, layout, voice rules |
| `brand/tokens.css` | HTML generation | CSS custom properties to inline |
| `brand/tokens.ts` | PPTX/DOCX generation | Typed brand values adapter |
| `references/design-tokens.md` | Always | Color palette, typography, and logo rules |
| `references/tone-and-copy.md` | Always | Brand positioning and copy rules |

## Scripts

| File | Purpose |
|------|---------|
| `scripts/frame-template.html` | Preview shell for rendered HTML output |
| `scripts/preview-shell.js` | Live preview toolbar (injected by server) |
| `scripts/helper.js` | Live-reload client (injected by server) |
| `scripts/export/` | Export utilities for PDF, PPTX, DOCX |

## Generators

| File | Purpose |
|------|---------|
| `generators/slides-base.html` | 16:9 slide HTML structure |
| `generators/document-base.html` | A4 document HTML structure |
| `generators/social-base.html` | Social card HTML structure |

**Do not read** `scripts/vendor/html2canvas.min.js` or `scripts/preview-shell.js` — these are large bundles injected automatically by the server.

## Output Formats

| Format | How |
|--------|-----|
| HTML | Generated directly from brand tokens |
| PDF | Browser print or LibreOffice conversion |
| PPTX | `pptxgenjs` + `brand/tokens.ts` |
| DOCX | `python-docx` + `brand/tokens.json` |
| Social PNG | html2canvas export via the preview server |
