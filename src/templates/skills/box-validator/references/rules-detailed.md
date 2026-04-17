# Box Layout Theory — Detailed Rules

Read this when a violation is unclear or you need concrete examples.

---

## Scaling model — how thresholds adapt to canvas size

Every numeric threshold in the validator is computed from the canvas
dimensions and tree complexity. There are no hardcoded px values
specific to 1920×1080 or any other size. The validator runs identically
on mobile stories (300×600), Instagram posts (1080×1350), HD slides
(1920×1080), and 4K decks (3840×2160).

The thresholds live in \`lib/context.mjs\` as a single \`computeContext\`
function. Rule files read from this context; they never define their
own constants.

| Threshold | Formula | 300×600 | 1920×1080 | 3840×2160 |
|---|---|---|---|---|
| \`tolerance\` (R2/R3/R4/R8 px delta) | \`max(2, min_dim × 0.002)\` | 2.0 | 2.16 | 4.32 |
| \`errorTolerance\` (R8 escalation) | \`tolerance × 4\` | 8.0 | 8.64 | 17.3 |
| \`underfillMinBoxWidth\` (R10 eligibility) | \`canvasW × 0.3\` | 90 | 576 | 1152 |
| \`underfillErrorRatio\` (R10 error) | \`0.15\` (const) | 0.15 | 0.15 | 0.15 |
| \`underfillWarnRatio\` (R10 warning) | \`0.30\` (const) | 0.30 | 0.30 | 0.30 |
| \`compoundCohesionMaxFillRatio\` | \`0.50\` (const) | 0.50 | 0.50 | 0.50 |
| \`scoreNormalizer\` (complexity decay) | \`max(0.5, √(nodes ÷ 45))\` | 0.5 → 1.5 | 0.5 → 1.5 | 0.5 → 1.5 |

### Why each is computed that way

- **Tolerance proportional to canvas dimension.** Browser subpixel
  rounding varies with rendered DPI. A 2px tolerance is correct for a
  300px canvas but too tight for a 4K slide where subpixel drift can
  legitimately reach 3-4px. Scaling with canvas keeps R2/R3/R4 honest
  at every DPI without false-flagging legitimate layouts.

- **Underfill eligibility proportional to canvas width.** R10 underfill
  should only fire on "structurally meaningful" boxes — boxes big
  enough that sparse content is visually obvious. A 300px box with a
  50px word looks fine (small label) but a 2000px box with a 300px
  headline looks broken (unbalanced hero). The 30% rule captures both
  intuitions across every canvas size.

- **Underfill ratios are dimensionless constants.** Fill ratio is
  already scale-invariant. 15% fill looks equally sparse whether the
  box is 300px or 3000px wide, so the ratio thresholds don't need to
  scale.

- **Scoring normalizer based on node count.** A 15-node design with
  3 errors is in worse shape than a 200-node design with 3 errors —
  error density is higher. The \`√(nodes ÷ 45)\` normalizer makes
  penalties per error smaller as the tree grows, so complex designs
  aren't punished for having proportionally more opportunities to
  fail. The floor of 0.5 prevents trivially small designs from
  scoring artificially high.

### Presets

The CLI accepts \`--preset strict\` and \`--preset lenient\` to shift all
thresholds in a coordinated way. Strict halves the tolerance floor and
tightens underfill ratios to 0.2/0.4. Lenient doubles the tolerance
floor and relaxes underfill ratios to 0.1/0.2. Both preserve the
scaling model — they just move the baseline.

### Custom overrides

\`--tolerance <px>\` overrides the computed tolerance with an absolute
value (also updates the error-band tolerance to 4× that). Use this
when you need exact cross-run determinism or when browser rendering
produces unexpected drift at your target size.

---

---

## Rule 1: Boxes Only

**Statement.** Layout is defined purely as nested boxes. Text lives only in
leaf elements.

**Why.** Mixing structure and content in the same node makes spacing
unpredictable and breaks recursion. A box that both holds children AND its
own text has no clean spacing contract.

**Bad**
```html
<div class="card">
  Welcome!
  <div class="button">Click</div>
</div>
```

**Good**
```html
<div class="card">
  <div class="title">Welcome!</div>
  <div class="button">Click</div>
</div>
```

---

## Rule 2: Full Coverage

**Statement.** Children + spacing must fill the parent completely along the
main axis. No dead space. On the cross axis, each child spans the parent
minus its padding.

**Why.** Dead space means one of: missing `flex: 1`, fixed child sizes that
don't add up, or hidden/absolute-positioned ghosts. All are bugs.

**Formula (column flow, inside-padding-box):**
```
parentHeight = paddingTop + paddingBottom + sum(childHeights) + gap * (N - 1)
```

**Bad**
```html
<div style="display:flex; flex-direction:column; padding:10px; gap:10px; height:400px">
  <div style="height:100px">A</div>
  <div style="height:100px">B</div>
  <!-- leaves 160px of dead space -->
</div>
```

**Good**
```html
<div style="display:flex; flex-direction:column; padding:10px; gap:10px; height:400px">
  <div style="flex:1">A</div>
  <div style="flex:1">B</div>
</div>
```

---

## Rule 3: Shared Dimension

**Statement.** Siblings in the same container share at least one dimension.
Column siblings share width. Row siblings share height.

**Why.** Unmatched cross-axis sizes read as misalignment and break visual
rhythm. The only exception: text leaves in a row container can have different
heights because their content dictates them.

**Bad (row)**
```html
<div style="display:flex; flex-direction:row">
  <div style="height:100px">A</div>
  <div style="height:140px">B</div>  <!-- ❌ height mismatch -->
</div>
```

**Good**
```html
<div style="display:flex; flex-direction:row; align-items:stretch">
  <div>A</div>
  <div>B</div>
</div>
```

---

## Rule 4: Uniform Spacing

**Statement.** `padding` equals `gap` at every level. All four padding sides
are equal.

**Why.** When the edge inset matches the inter-child gap, spacing reads as a
single rhythm. The eye does not notice spacing — it notices inconsistency.

**Bad**
```html
<div style="padding: 20px 12px; gap: 8px">...</div>
```

**Good**
```html
<div style="padding: 12px; gap: 12px">...</div>
```

**Depths can have different S values.** What must match is padding and gap at
the SAME level. A card at depth 2 can use `S=12`, its inner content at depth 3
can use `S=8`. They just must each be internally consistent.

---

## Rule 5: Recursive

**Statement.** Rules 2–4 apply at every depth.

**Why.** Box Theory is fractal. A layout that passes at the root but fails at
depth 3 still looks broken to the reader. The validator walks the full tree
and reports at every depth.

---

## Rule 6: Leaf Rule

**Statement.** Nodes with no children are leaves. They are exempt from box
validation (R1–R4) because they hold content, not structure.

**What counts as a leaf.**
- `<div>` with no child elements, holding only text
- `<img>`, `<svg>`, `<video>` — self-rendering content
- Any element where `children.length === 0`

---

## Rule 7: No Empty Nodes

**Statement.** Every node is either a parent (has children) or a leaf (has
content). A childless, contentless node is invalid.

**Why.** Empty nodes usually indicate structural bugs (forgot to render, lost
a component) or decorative spacers (use padding/margin instead).

**Exemptions.** Self-rendering tags (`img`, `svg`, `video`, `canvas`,
`iframe`, `hr`) and zero-area nodes are skipped.

---

## Rule 8: Sibling Consistency

**Statement.** When two or more sibling boxes share orientation and child
count, their children must occupy the same relative positions with matching
dimensions.

**Why.** Imagine three cards in a row. Each has a number column and a content
column. If the content columns are 200, 210, and 198 pixels wide, it reads as
sloppy — users notice the variance even when they can't name it.

**How groups are detected.**
- **Explicit**: `data-box-group="name"` attribute on the sibling parents
- **Implicit**: same structural fingerprint (`row:2:CC` = row with 2 column
  children)

Use the explicit form when you want to force grouping across dissimilar
structures, or to be robust against content variations.

**Bad**
```html
<div class="row">
  <div class="card"><div style="width:100px">A</div><div style="flex:1">body</div></div>
  <div class="card"><div style="width:110px">B</div><div style="flex:1">body</div></div>
  <!-- ❌ number columns are 100 and 110 — should match -->
</div>
```

**Good**
```html
<div class="row">
  <div class="card" data-box-group="card"><div class="num">A</div><div class="body">body</div></div>
  <div class="card" data-box-group="card"><div class="num">B</div><div class="body">body</div></div>
</div>
<style>.num { width: 100px } .body { flex: 1 }</style>
```

---

## Rule 9: Leaf Atomicity

**Statement.** A leaf must contain exactly one content atom. One text run OR
one icon glyph — never a mix. Compound leaves must be promoted to parents
with one child box per atom.

**Why.** When a leaf packs `↑ 34.2% vs Q3` into a single div, you lose
independent control over the arrow's color, size, spacing, and alignment
relative to the number. You cannot apply Rule 4's uniform-spacing rhythm
*between atoms*. You cannot reuse the arrow as a reusable icon component.
Most importantly, the layout becomes content-driven instead of box-driven,
defeating the entire point of Box Theory.

**How atoms are counted.** The validator tokenizes the leaf's trimmed text
content on whitespace, then classifies each token:

- **icon** — entirely composed of characters from arrow, bullet, dingbat,
  geometric, misc-symbol, or emoji Unicode ranges (`←→↑↓↔`, `•·`, `★✓✗`, `➔`, emoji)
- **text** — contains at least one letter or digit
- **punct** — only punctuation, currency, math operators (`$`, `€`, `&`, `%`, `+`) — treated as glue, never counted as an atom

A run of consecutive **text** tokens collapses into one atom. Each **icon** token is its own atom. Punct is invisible to the counter.

| Content | Atoms | Verdict |
|---|---|---|
| `$12.4M` | 1 (text) | pass |
| `+15%` | 1 (text) | pass |
| `Hello world` | 1 (text run) | pass |
| `Terms & Conditions` | 1 (text run, `&` is glue) | pass |
| `↑ 34.2% vs Q3` | 2 (icon + text) | **flag** |
| `2026-04-14 · 14:20 UTC` | 3 (text + icon + text) | **flag** |
| `✓ Done` | 2 (icon + text) | **flag** |
| `A → B` | 3 (text + icon + text) | **flag** |

**Severity.** Warning, not error. Heuristic rules can false-positive on
unusual Unicode — the agent reads the violation and decides whether to
split.

**Bad**
```html
<div class="kpi">
  <div class="label">REVENUE</div>
  <div class="value">$12.4M</div>
  <div class="delta">↑ 34.2% vs Q3</div>  <!-- 2 atoms -->
</div>
```

**Good**
```html
<div class="kpi">
  <div class="label">REVENUE</div>
  <div class="value">$12.4M</div>
  <div class="delta">                      <!-- promoted to parent -->
    <div class="arrow">↑</div>             <!-- atom 1 -->
    <div class="change">34.2% vs Q3</div>  <!-- atom 2 -->
  </div>
</div>
```

Now the arrow and the change can be styled, sized, and spaced
independently, and Rule 4's uniform spacing can apply between them if
they share a parent.

---

## Rule 10: Content Fit

**Statement.** A leaf's natural content size must fit its allocated box.
When the rendered content (measured via `scrollWidth`/`scrollHeight`)
exceeds the leaf's inner box (`clientWidth`/`clientHeight`), the content
overflows.

**Why.** Rule 2 (Full Coverage) verifies the parent's math — children plus
spacing equal the parent's dimensions. But R2 measures `getBoundingClientRect`,
which reflects the *flex-allocated* rect, not the content inside it. A leaf
styled `font-size: 120px` with only 40px of flex-allocated height will
render text glyphs 80px taller than its own rect. Flex is happy. The
reader sees the number bleeding onto whatever sits below. R10 closes
that blind spot.

**How it works.** For every leaf with content (excluding self-rendering
tags like `img`, `svg`, `video`, `iframe`), the validator captures both
`scrollWidth`/`scrollHeight` (content natural size) and `clientWidth`/
`clientHeight` (inner box size). If the difference exceeds the tolerance,
it emits an error with the exact overflow amount.

**Severity.** Error. Visual overflow is always a structural failure — the
agent must fix it before delivering.

**Bad**
```html
<style>
  .hero-col { display: flex; flex-direction: column; padding: 24px; gap: 24px; }
  .hero-col > * { flex: 1; }  /* 3 children × flex:1 → each ~30px tall */
  .hero-value { font-size: 120px; }  /* FOUR TIMES the slot height */
</style>
<div class="hero-col">
  <div class="leaf">TOTAL REVENUE</div>
  <div class="leaf hero-value">$12.4M</div>  <!-- overflows 90px -->
  <div class="leaf">↑ 34.2% vs Q3</div>
</div>
```

**Good** — give the value a real slot:
```html
<style>
  .hero-col { display: flex; flex-direction: column; padding: 24px; gap: 24px; }
  .hero-col > .label { flex: 1; font-size: 20px; }
  .hero-col > .value { flex: 5; font-size: 88px; }  /* big slot for big font */
  .hero-col > .delta { flex: 2; }
</style>
```

**Fix recipes:**
- Content too tall vertically → shrink font, OR increase this leaf's flex ratio, OR reduce sibling count
- Content too wide horizontally → shrink font, OR remove `white-space: nowrap`, OR widen the leaf
- If both dimensions overflow → the layout is fundamentally under-budgeted; restructure the parent hierarchy
