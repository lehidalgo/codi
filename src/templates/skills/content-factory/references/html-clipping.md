# HTML Clipping and Overflow Rules

## Social cards and slides — `overflow: hidden`

Every pixel beyond the card boundary is clipped — hard, with no warning. This applies to text, decorative elements, absolute-positioned glows, and images. Never assume content will wrap gracefully; test every card at the intended format before declaring it done.

### Large headline text

- Use `line-height: 1.1` minimum on all headlines — lower values clip ascenders and descenders at large font sizes
- Use `letter-spacing` between `-0.03em` and `-0.05em` to control width — heavy weights at 80px+ can overflow the content area
- Keep headline text short enough to fit within the card's padding: content width = card width minus horizontal padding × 2

### Gradient italic text (`background-clip: text`)

- Always add `padding-right: 0.12em` to any element that combines `font-style: italic` with `background-clip: text`
- Italic glyphs overhang their typographic advance width; the gradient stops painting at the advance boundary, making the right edge of trailing characters appear clipped against the dark background
- Apply this to every italic gradient span regardless of font size — it is invisible at small sizes but critical at 60px+

```css
/* CORRECT — covers the italic glyph's right overhang */
em.acc {
  font-style: italic;
  padding-right: 0.12em;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* WRONG — glyph overhang is outside the painted area */
em.acc {
  font-style: italic;
  background: linear-gradient(135deg, #56b6c2, #61afef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Absolute-positioned decorative elements

- Glows and background shapes positioned outside the main layout are intentionally clipped
- Do not let decorative elements overlap critical text — the clip boundary is exact and unforgiving

---

## Document pages (`.doc-page`) — `overflow: visible`

Document pages use `min-height` with no `overflow: hidden`, so content grows vertically without clipping. Horizontal overflow still renders poorly — keep content within the 794px page width.

**CRITICAL — never use `overflow: hidden` on content containers inside `.doc-page`.**

Using `overflow: hidden` on `.code-block`, `.code-block pre`, `table`, or any element that holds readable content will:
- Silently clip text in the browser preview
- Corrupt Playwright screenshot capture used for DOCX export (the screenshot captures only what is rendered; clipped content disappears from the DOCX)

Always use `overflow: visible` (or omit `overflow` entirely) on content containers. `overflow: hidden` is only acceptable on purely decorative containers (`.cover-hero`, `.brand-bar`, `.cover-accent`) where no readable text lives.

```css
/* CORRECT */
.code-block { overflow: visible; }
.code-block pre { overflow: visible; }
.data-table { overflow: visible; }

/* WRONG — silently clips code and table rows */
.code-block { overflow: hidden; }
.code-block pre { overflow: hidden; }
.data-table { overflow: hidden; }
```

---

## `getBoundingClientRect()` unreliability inside flex columns

`getBoundingClientRect()` on elements inside `display: flex; flex-direction: column` containers can return incorrect height values during Playwright headless rendering. The reported height may be smaller than the element's actual rendered height, causing DOCX images to appear clipped at the bottom.

**Do not use `getBoundingClientRect().height` to set `ImageRun` dimensions in the DOCX exporter.** Instead, read dimensions from the PNG IHDR header (bytes 16–23) after capturing the screenshot — the PNG knows its own exact pixel dimensions. Divide by `deviceScaleFactor` to get CSS pixels.

```js
// CORRECT — read from captured PNG header
function pngCssDimensions(buf, deviceScaleFactor) {
  if (!buf || buf.length < 24) return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (!w || !h) return null;
  return { w: w / deviceScaleFactor, h: h / deviceScaleFactor };
}

// WRONG — getBoundingClientRect height is unreliable in flex columns
const rect = el.getBoundingClientRect();
capturedHeight: Math.round(rect.height)  // may be clipped/wrong
```

---

## Tables inside flex column containers

`.page-body` is `display: flex; flex-direction: column`. Tables with `border-collapse: collapse` and `width: 100%` do **not** reliably stretch to the container width in this context — the browser can collapse columns to near-zero width.

**Always use `table-layout: fixed` on `.data-table` and `min-width: 0` on flex children.**

```css
/* CORRECT — fixed layout forces equal column distribution */
.data-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
/* Prevent flex children from expanding beyond page width */
.page-body > * { min-width: 0; }

/* WRONG — auto layout collapses columns inside flex containers */
.data-table {
  width: 100%;
  border-collapse: collapse; /* no table-layout: fixed */
}
```
