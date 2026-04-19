# Content-fit validation

Every card render is automatically measured against the active canvas. When
content overflows, the factory emits a machine-readable directive the
coding agent MUST act on before declaring the work done.

## What triggers the check

After an iframe loads in preview, `fit-check.js` queries every canvas-root
element inside it — `.doc-page`, `.slide`, `.social-card` — and compares:

```
overflowPx  = max(scrollHeight - canvas.h, scrollWidth - canvas.w, 0)
overflowPct = overflowPx / canvas.h * 100
```

If `overflowPx > 0`, the check:

1. Renders a red notice bottom-right in the preview UI
2. `POST /api/validate/fit-report` → writes `<project>/state/fit-report.json`

If `overflowPx === 0`, no notice, no file write (or the notice is cleared).

## Authoritative source of truth

`<project>/state/fit-report.json` is the canonical location for the latest
fit measurement. It is overwritten on every render — there is no history.

### Schema

```json
{
  "file": "document/onepager.html",
  "canvas":   { "w": 794, "h": 1123 },
  "measured": { "scrollHeight": 1410, "scrollWidth": 794 },
  "overflowPx":  287,
  "overflowPct": 25.6,
  "pageIndex":   1,
  "type":        "document",
  "remediation": "paginate",
  "options":     ["paginate", "tighten"],
  "directive":   "Page 1 exceeds 794x1123 by 287px (25.6%). Add a new .doc-page sibling..."
}
```

| Field | Meaning |
|-------|---------|
| `file` | Path of the content file, relative to `content/` |
| `canvas` | Active format in CSS pixels |
| `measured` | The worst page's `scrollHeight` / `scrollWidth` |
| `overflowPx` | Pixels over the canvas — worst dimension across all pages |
| `overflowPct` | `overflowPx / canvas.h * 100`, rounded to 1 decimal |
| `pageIndex` | 1-indexed; the page that overflowed. `null` when `overflowPx === 0` |
| `type` | `document`, `slides`, or `social` |
| `remediation` | The suggested action: `paginate`, `split`, or `tighten` |
| `options` | All allowed remediations for this content type |
| `directive` | Human + agent-readable instruction |

## The remediation matrix

The suggested remediation depends on content type and severity:

| Type | Overflow > 15% | Overflow ≤ 15% | Always allowed |
|------|----------------|----------------|----------------|
| `document` | `paginate` | `tighten` | `paginate` or `tighten` |
| `slides` | `split` | `tighten` | `split` or `tighten` |
| `social` | `tighten` | `tighten` | `tighten` only (single canvas) |

The 15% threshold lives in `generators/lib/fit-measure.js`
(`HIGH_OVERFLOW_PCT`).

## What each remediation means

### `paginate` (document only)

The document exceeds one page by a lot. Add a new `.doc-page` sibling
after the offending page inside `.doc-container` and move overflow content
into it. Every `.doc-page` is its own canvas — the validator measures
per-page. Adding pages legitimately resolves overflow only when *every*
page fits.

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

Overflow is small enough to fix in place. In order of preference:

1. Reduce horizontal or vertical padding on the offending element
2. Condense copy — cut filler words, merge bullets, shorten headings
3. Drop one line-height notch (`1.5` → `1.4`)
4. Reduce body font size by one notch (e.g. `15px` → `14px`) — last resort

Never shrink headings below the brand's defined scale. Never rewrite in a
different voice to squeeze words in — rewrite only to sharpen.

## Pagination contract

When the remediation is `paginate`:

- A multi-page document is a sequence of sibling `.doc-page` elements
  inside `.doc-container`.
- Each `.doc-page` is its own canvas (`794×1123` for A4).
- The validator measures *per page*, not document-total.
- `pageIndex` names the offending page — fix that page first; then re-run
  the preview; the validator re-measures the new page layout automatically.

## Agent workflow

Before declaring content work complete:

1. Read `<project>/state/fit-report.json`
2. If it does not exist OR `overflowPx === 0` → content fits, you are done
3. Otherwise, apply `remediation`:
   - `paginate` → add a `.doc-page` sibling
   - `split` → cut the slide at the next section break
   - `tighten` → reduce padding / copy / font sizes in place
4. Save the file and let the preview re-render
5. Re-read `fit-report.json`; loop until `overflowPx === 0`

A stale `fit-report.json` (from a pre-fix render) is still valid on disk.
Only the *latest* render is authoritative — re-open the preview to force
a new measurement.

## What does NOT trigger the check

- Export flows (PNG, PDF, PPTX, DOCX) — exports use the template's original
  CSS (which typically clips with `overflow: hidden`). The check runs on
  authoring, not export.
- Cards that fit exactly. Edge-case equality (`scrollHeight === canvas.h`)
  is treated as fitting.
- Non-canvas content (tooltips, overlays, modals).

## Relationship to `html-clipping.md`

`html-clipping.md` explains per-type overflow policy from a CSS authoring
perspective. This document explains the runtime validation that catches
when authoring policy is violated. Both are required reading for any
agent producing content:

- Use `html-clipping.md` to write layouts that fit.
- Use this file to interpret the validator when they don't.
