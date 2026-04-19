# Content-fit validation

Canvas overflow is treated exactly like any other box-layout defect: it is
emitted by the validator as rule **R11 "Canvas Fit"** alongside the R1–R10
sibling and coverage rules. The agent's normal validate-before-done loop
catches and fixes it automatically.

## The principle

There is one validation API. Call it. Fix every violation. Ship.

```bash
GET /api/validate-cards?project=<dir>&file=<file>
```

The response shape is the same for every rule:

```json
{
  "valid": false,
  "violations": [
    {
      "rule": "R11",
      "severity": "error",
      "path": "body > div.doc-container > section.doc-page[0]",
      "message": "Canvas overflow on .doc-page — content is 287px larger than 794x1123 (25.6%)",
      "fix": "paginate: Page exceeds 794x1123 by 287px (25.6%). Add a new .doc-page sibling after this one and move overflow content into it. Preserve the existing header and footer on every page.",
      "remediation": "paginate",
      "overflowPx": 287,
      "overflowPct": 25.6,
      "canvasType": "document"
    }
  ]
}
```

Follow the same loop you already run for R1–R10: read the `fix` field, patch
the HTML, re-validate, repeat until `valid: true`.

## What R11 checks

R11 walks the rendered DOM for every canvas-root element — `.doc-page`,
`.slide`, `.social-card` — and compares:

```
overflowH = scrollHeight - clientHeight
overflowW = scrollWidth  - clientWidth
```

If either exceeds the 2px tolerance, R11 emits a violation. The `overflowPx`
and `overflowPct` fields carry the measurement; `remediation` carries the
prescribed action; `fix` carries the human-readable directive that begins
with the remediation name (`paginate:`, `split:`, or `tighten:`).

## The remediation matrix

| Canvas type      | Overflow > 15% | Overflow ≤ 15% |
|------------------|----------------|----------------|
| `.doc-page`      | `paginate`     | `tighten`      |
| `.slide`         | `split`        | `tighten`      |
| `.social-card`   | `tighten`      | `tighten`      |

The 15% threshold and matrix live in
`scripts/lib/box-layout/rules/r11-canvas-fit.cjs` (`HIGH_OVERFLOW_PCT`,
`REMEDIATION_MATRIX`). Social cards never split or paginate — they are
single-canvas content by definition.

## What each remediation means

### `paginate` (document only)

The document exceeds one page by more than 15%. Add a new `.doc-page`
sibling after the offending page inside `.doc-container` and move the
overflow content into it. Every `.doc-page` is its own canvas — R11
re-measures per page on the next validation call.

Preserve the existing header and footer on every page. Keep the header's
eyebrow/title consistent; the footer may carry a page number.

```html
<div class="doc-container">
  <section class="doc-page">  <!-- page 1 -->
    <header class="hdr">...</header>
    ... first chunk of content ...
    <footer class="ftr">1/2</footer>
  </section>
  <section class="doc-page">  <!-- page 2 — NEW -->
    <header class="hdr">...</header>
    ... overflow content ...
    <footer class="ftr">2/2</footer>
  </section>
</div>
```

### `split` (slides only)

One slide holds too much. Cut at the next natural section break — an `h2`,
`hr`, or list boundary — and turn the second half into a new `.slide`.
Keep visual parity (same palette, font sizes, padding). Update slide
numbering if the template shows it.

### `tighten` (any type)

Overflow is small enough to fix in place, or the canvas type does not
support splitting. In order of preference:

1. Reduce horizontal or vertical padding on the offending element
2. Condense copy — cut filler words, merge bullets, shorten headings
3. Drop one line-height notch (`1.5` → `1.4`)
4. Reduce body font size by one notch (e.g. `15px` → `14px`) — last resort

Never shrink headings below the brand's defined scale. Never rewrite in a
different voice to squeeze words in — rewrite only to sharpen.

## Agent workflow

This is the same loop as every other box-layout rule. No special case.

1. Write the HTML
2. `GET /api/validate-cards?project=<dir>&file=<file>`
3. For each violation, read `violations[].fix` and patch the HTML
   - If `rule === "R11"`, the `remediation` field tells you which action
     to take (`paginate` / `split` / `tighten`); the `path` field names
     the overflowing canvas element
4. Re-validate — loop up to `config.iterateLimit` times (default 3)
5. When `valid: true`, the work is done

## What does NOT trigger R11

- Export flows (PNG, PDF, PPTX, DOCX) — exports use the template's original
  CSS (which typically clips with `overflow: hidden`). Validation runs on
  authoring, not export.
- Canvases that fit within the 2px tolerance.
- Non-canvas content (tooltips, overlays, modals).
- Leaf text overflow inside a fitting canvas — that is R10's job.

## R10 vs R11

Both rules detect overflow, at different scopes:

- **R10 Content Fit** — a leaf element (text, image, table) overflows its
  parent box. The parent and canvas may still fit.
- **R11 Canvas Fit** — the canvas root itself overflows the declared
  format (A4, 1280×720, 1080×1080). The whole page is too big.

R10 fires when a table column is too narrow; R11 fires when the page is
too long. Both show up in the same `violations[]` array.

## Seeing overflow in the browser

The preview relaxes `overflow: hidden` on slides and social cards so
overflowing content is visible at authoring time — no red banner is
needed. The agent confirms fit by calling `/api/validate-cards` and
reading the `violations[]` array. That is the single source of truth.

## Relationship to `html-clipping.md`

`html-clipping.md` explains per-type overflow policy from a CSS authoring
perspective. This document explains the validator that catches when
authoring policy is violated. Both are required reading for any agent
producing content:

- Use `html-clipping.md` to write layouts that fit.
- Use this file to interpret R11 when they don't.
