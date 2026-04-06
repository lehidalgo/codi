# Typed Slide Schema for PPTX/DOCX Generators
- **Date**: 2026-04-06 20:37
- **Document**: 20260406_203703_[PLAN]_pptx-typed-slide-schema.md
- **Category**: PLAN

## Goal

Replace the flat `sections[]` schema in `generate_pptx.ts` with a `slides[]` array where each entry has a `type` discriminator. The generator dispatches to a dedicated layout function per type. The coding agent controls only content. The script guarantees layout, logo position, and brand styling.

## Slide Types

| Type | Agent provides | Generator guarantees |
|------|---------------|---------------------|
| `title` | title, subtitle, author (fall back to top-level) | Logo top-right, large centered title |
| `section` | heading, body?, items?, callout?, number?, label? | Accent bar, logo bottom-right watermark |
| `quote` | quote, attribution? | Decorative quote mark, italic text, attribution right |
| `metrics` | heading?, metrics[]{value, label} (max 4) | Evenly spaced boxes, large value + label |
| `closing` | message, contact? | Logo centered top, message centered |

## Content Schema

```json
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle",
  "author": "Author Name",
  "slides": [
    { "type": "title" },
    { "type": "section", "number": "01", "label": "INTRO", "heading": "...", "body": "...", "items": ["..."], "callout": "..." },
    { "type": "quote", "quote": "...", "attribution": "..." },
    { "type": "metrics", "heading": "KEY NUMBERS", "metrics": [{ "value": "€12M", "label": "Revenue" }] },
    { "type": "closing", "message": "Thank you", "contact": "team@example.com" }
  ]
}
```

## Files to Change

| File | Change |
|------|--------|
| `src/templates/skills/pptx/scripts/ts/generate_pptx.ts` | Full rewrite: typed Slide union, dispatch function, 5 layout builders |
| `src/templates/skills/docx/scripts/ts/generate_docx.ts` | Add `type` to Section; add `buildQuoteSection`, `buildClosingSection` |
| `src/templates/skills/pptx/template.ts` | Update content.json schema docs in SKILL.md output |
| `.codi/skills/codi-pptx/scripts/ts/generate_pptx.ts` | Copy from template |
| `.codi/skills/codi-docx/scripts/ts/generate_docx.ts` | Copy from template |
| `.codi/skills/codi-pptx/SKILL.md` | Update content.json schema section |

## Steps

1. Rewrite `generate_pptx.ts` with typed dispatch
2. Update `generate_docx.ts` with section types
3. Update SKILL.md schema docs in `pptx/template.ts`
4. Copy to `.codi/skills/`
5. Run end-to-end test with a multi-type content.json
