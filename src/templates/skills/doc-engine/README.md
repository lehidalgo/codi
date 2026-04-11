# codi-doc-engine

Generates branded reports, proposals, one-pagers, and case studies as self-contained HTML files with print CSS for PDF export. Optionally converts to DOCX via pandoc.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Web browser | any modern browser | view and print documents |
| pandoc | `brew install pandoc` (optional) | convert HTML to DOCX |

No build tools, no npm install, no Python required for HTML output.

## Output Formats

| Format | How |
|--------|-----|
| HTML | Generated directly — open in browser |
| PDF | Browser print: `File → Print → Save as PDF` |
| DOCX | `pandoc output.html -o output.docx` (requires pandoc) |

## Brand Integration

If a skill with `category: brand` is active in the project, the document uses its design tokens (CSS variables, fonts, logo, tone of voice). Otherwise, neutral professional defaults apply.

## Document Types

| Type | Structure |
|------|-----------|
| Report | Cover, Executive Summary, TOC, Sections, Conclusions, Next Steps, Appendix |
| Proposal | Cover, Problem Statement, Solution, Scope, Timeline, Investment, About |
| One-Pager | Header, Problem, Solution, Key Metrics, Call to Action |
| Case Study | Header, Challenge, Solution, Results, Testimonial |

## Print CSS

Generated documents include `@media print` CSS that:

- Hides navigation and interactive elements
- Sets page margins to 2cm
- Adds page-break hints at section boundaries
- Preserves brand colors in print output

To verify print output before sending, use Chrome's print preview (`Cmd+P` / `Ctrl+P`).
