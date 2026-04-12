# DOCX Export — Document Template Conventions

Document pages (`.doc-page`) support DOCX export via the **Export → DOCX** button.
The exporter runs Playwright `getComputedStyle()` on each element to extract actual CSS values —
font family, size, weight, color, background — so brand colors and typography transfer
automatically to any template regardless of its theme.

Class names are structural signals to the DOCX builder. Templates that follow these conventions
produce faithful, well-structured DOCX output. Templates that do not will produce plain paragraphs
with no structure.

---

## Standard HTML tags — mapped automatically

| Tag | DOCX output | Notes |
|-----|-------------|-------|
| `h1` | Large heading paragraph | Bold, extra space before |
| `h2` | Section heading with bottom border | Bold, border color = computed text color |
| `h3` | Sub-heading paragraph | Normal weight, tighter spacing |
| `p` | Body paragraph | `getComputedStyle` font/color/size applied |
| `ul` / `ol` + `li` | Bulleted list items | One paragraph per `<li>`, inline runs preserved |
| `strong` | Bold TextRun | Inline — works inside any paragraph |
| `em` | Italic TextRun | Inline |
| `code` / `kbd` | Courier New with background fill | Inline; fill from `getComputedStyle` |

---

## Required class names for document pages

| Class | DOCX output | Requirements |
|-------|-------------|--------------|
| `.page-header` | Header paragraph with bottom border | Two `<span>` children: left = brand/logo, right = meta text |
| `.page-footer` | Footer paragraph with top border | Two `<span>` children: left = handle, right = page number |
| `.callout` | Italic paragraph with left border | `border-left-color` extracted for the DOCX border; `background-color` extracted for shading |
| `.page-tag`, `.doc-label`, `.eyebrow` | Small uppercase label paragraph | Rendered in caps, size −2pt |
| `.doc-subtitle` (on `p`) | Subtitle paragraph | Same as body but with subtitle spacing |
| `.doc-meta` | Meta text paragraph | Raw `innerText`, preserves whitespace |
| `.cover-accent`, `.brand-bar` | *Skipped* | Decorative only — never put readable text inside these |

---

## Tables — use `.data-table` class

```html
<table class="data-table">
  <thead><tr><th>Column A</th><th>Column B</th></tr></thead>
  <tbody>
    <tr><td>Value 1</td><td>Value 2</td></tr>
  </tbody>
</table>
```

- The DOCX exporter builds a full-width `docx.Table` for any `<table>` element
- Header cells (`<th>`) use their computed `backgroundColor` and `color` for shading — point the CSS at your brand accent color
- Body rows alternate background shading automatically (zebra rows) based on computed `backgroundColor`
- Column widths are distributed equally across the page width
- `overflow: visible` is required — `overflow: hidden` silently clips rows

---

## Code blocks — use `.code-block` class

```html
<div class="code-block">
  <div class="code-block-header">
    <span class="code-lang">TypeScript — example.ts</span>
    <div class="code-dots">
      <div class="code-dot r"></div>
      <div class="code-dot y"></div>
      <div class="code-dot g"></div>
    </div>
  </div>
  <pre>/* syntax-highlighted code */</pre>
</div>
```

- The entire `.code-block` is **captured as a PNG screenshot** via Playwright and embedded as an image in DOCX
- This preserves syntax highlighting colors exactly — no color information is lost
- The `.code-lang` / `.code-title` / `.code-label` span is extracted as the image caption in DOCX
- `overflow: visible` is required on both `.code-block` and `pre` — `overflow: hidden` clips code that extends past the container boundary

---

## Diagrams and SVG figures — use `.diagram-wrap`

```html
<div class="diagram-wrap">
  <svg width="580" height="200" viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg">
    <!-- inline SVG content -->
  </svg>
  <div class="diagram-caption">Figure 1 — Caption text</div>
</div>
```

- Any `.diagram-wrap`, `.diagram-container`, `<figure>`, or `<div>` with a **direct child `<svg>`** is captured as a PNG screenshot via Playwright
- The `.diagram-caption` / `figcaption` / `caption` text is used as the DOCX image caption
- The SVG must be a **direct child** of the wrapper element — the exporter checks `el.children`, not `el.querySelector('svg')`. A deeply nested SVG inside a wrapper div will not be detected.

### Image dimensions and aspect ratio

The DOCX exporter reads the **PNG IHDR header** (bytes 16–23) to get the exact pixel dimensions of each captured screenshot. It does **not** use `getBoundingClientRect()` for the `ImageRun` dimensions. This matters because:

- `getBoundingClientRect()` returns unreliable heights for elements inside `display: flex; flex-direction: column` containers — the element may report a smaller height than what Playwright actually captures
- Reading from the PNG header is always accurate — what was captured is exactly what gets embedded

The browser captures screenshots at `deviceScaleFactor: 2` (retina quality). The DOCX dimensions are derived by dividing PNG pixel dimensions by 2 to get CSS pixels, then scaling to fit the page width:

```
PNG pixel dims / 2  → CSS dims
CSS dims * scale    → DOCX ImageRun width/height (at 96 DPI)
scale = min(1, 600 / cssWidth)   // never upscale; fit to 600 CSS px max
```

**Consequence for template authors**: the DOCX image reflects the actual rendered size of the `.diagram-wrap` element (including its padding and caption). If the wrapper stretches to fill the full page body width (normal flex behavior), the diagram will embed at full text-area width in the DOCX. To make a diagram narrower, constrain the wrapper width:

```css
/* Limit diagram width so it doesn't stretch to full page body */
.diagram-wrap {
  max-width: 500px;
  align-self: center;
}
```

---

## Inline images — standard `<img>` tags

- `<img src="data:image/...">` — the base64 payload is decoded and embedded directly
- `<img src="file:///abs/path/image.png">` — read from disk and embedded
- Remote `https://` URLs are not fetched during DOCX export — use data URIs or `file://` paths
- Dimensions are derived from the PNG IHDR header (same as diagrams) — `getBoundingClientRect()` is only used as a fallback when PNG header parsing fails

---

## Gradient text (brand colors)

Apply gradient text with `-webkit-text-fill-color: transparent` + `background-clip: text`. The DOCX
exporter detects this pattern and extracts the first color stop from the `background-image` gradient
as the text color. Works on any `linear-gradient`.

```css
/* Gradient text — DOCX uses the first stop (#56b6c2) as text color */
.page-logo {
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## Inline formatting

All inline formatting is handled automatically via `extractRuns()`:

- `<strong>` → bold TextRun
- `<em>` → italic TextRun
- `<code>` / `<kbd>` → Courier New with background fill color from `getComputedStyle`
- Mixed inline formatting (bold + code + colored span in one paragraph) is preserved per text node

---

## What NOT to do

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| `overflow: hidden` on `.code-block`, `pre`, `table` | Clips content in browser preview; breaks screenshot capture | Use `overflow: visible` |
| SVG nested deep inside a wrapper div | Not detected as a diagram — parent div consumed instead | Make SVG a direct child of `.diagram-wrap` |
| `<img src="https://...">` | Remote URLs not fetched during DOCX export | Use data URI or `file://` path |
| Text inside `.cover-accent` or `.brand-bar` | Silently skipped by exporter | Move text to a supported container |
| `position: absolute` for body text | Not parsed by document flow walker | Use normal flow layout |
| CSS `::before`/`::after` pseudo-elements for content | Not in DOM — invisible to exporter | Inline the content as real DOM nodes |
| Relying on `getBoundingClientRect()` for DOCX image sizing | Returns unreliable height inside flex columns; image appears clipped in Word | Exporter now reads PNG IHDR — no action needed, but do not revert this pattern |
| Using `deviceScaleFactor: 1` (default) for DOCX Playwright browser | Diagrams and code blocks appear blurry in Word because the PNG is too small relative to the DOCX display size | DOCX browser must use `deviceScaleFactor: 2` — do not change this in `exports.cjs` |
