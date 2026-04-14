# Common Violations & Fixes

Fast lookup from violation type to CSS fix.

---

## R2: Dead space at bottom / right

**Symptom.** `Column height X ≠ children+spacing Y` or `Row width X ≠ ...`.

**Cause.** Children don't stretch to fill the parent's main axis.

**Fix.** Add `flex: 1` to every child, OR set explicit sizes that add up.

```css
.parent > * { flex: 1; min-width: 0; min-height: 0; }
```

---

## R2: Child width ≠ parent inner width

**Symptom.** `Child width X ≠ parent inner width Y`.

**Cause.** Child has a fixed width or `align-self: flex-start`, preventing
cross-axis fill.

**Fix.** Remove width overrides on children. Column parents fill the cross
axis automatically when `align-items` is the default `stretch`.

---

## R3: Sibling width/height mismatch

**Symptom.** `Column sibling width X ≠ group avg Y`.

**Cause.** One child has a different fixed size.

**Fix.** Use shared CSS classes or CSS variables for column widths.

```css
:root { --col-w: 320px; }
.col { width: var(--col-w); }
```

---

## R4: padding ≠ gap

**Symptom.** `padding (X) ≠ gap (Y)`.

**Cause.** Spacing scale was set inconsistently.

**Fix.** Use the same value for both. Prefer an S variable at each depth.

```css
.depth-2 { --s: 12px; padding: var(--s); gap: var(--s); }
.depth-3 { --s: 8px;  padding: var(--s); gap: var(--s); }
```

---

## R4: Asymmetric padding

**Symptom.** `top padding X ≠ average Y`.

**Cause.** Using `padding: 12px 16px` (shorthand with different values).

**Fix.** Use symmetric shorthand: `padding: 12px`. If the layout needs
asymmetric spacing, that's a design smell — reconsider the hierarchy.

---

## R7: Empty node

**Symptom.** `Node has no children and no text content`.

**Cause.** A `<div>` that was used as a decorative spacer, or a conditional
render returned nothing.

**Fix.** Remove the node and express the spacing with padding/margin on
neighbours, OR add content.

---

## R8: Sibling dimension mismatch

**Symptom.** `width X ≠ sibling group avg Y`.

**Cause.** Three "cards" with slightly different internal structure, or
content-driven sizing (e.g. headlines of different length affecting column
widths).

**Fix.**
1. Use shared CSS classes across all group members
2. Use CSS variables for the fixed dimensions
3. Add `data-box-group="cardname"` to make the grouping explicit and get
   better error messages
4. If heights vary because text length varies, either: truncate content,
   set a fixed height, OR accept the warning (R8 heights are warnings when
   delta is small)

---

## R10: Content overflows the leaf's box

**Symptom.** `Content height X > box height Y (overflow Z)` or
`Content width X > box width Y (overflow Z)`.

**Cause.** The leaf's rendered text (or inline content) is larger than the
flex-allocated box. Most common reason: a large font size in a small flex
slot. R2 sees the parent's math as correct because the flex-allocated
rects still sum correctly — the overflow happens INSIDE the leaf.

**Fix (vertical overflow).**
1. Shrink the font to fit the slot
2. Raise this leaf's flex ratio so the parent allocates more height, e.g.
   `flex: 5` instead of `flex: 1` when siblings should stay at `flex: 1`
3. Reduce sibling count in this column so each gets more space
4. If nothing works: the parent is too small — restructure upstream

```css
/* Bad */
.hero-col > * { flex: 1; }
.hero-value { font-size: 120px; }   /* tiny slot, huge font */

/* Good */
.hero-col > .label { flex: 1; }
.hero-col > .value { flex: 5; }     /* value gets 5× more space */
.hero-col > .delta { flex: 2; }
.hero-value { font-size: 88px; }    /* smaller font too */
```

**Fix (horizontal overflow).**
1. Remove `white-space: nowrap` — let text wrap
2. Shrink the font
3. Widen the leaf (bigger `flex` ratio in a row)
4. Shorten the text content

---

## R9: Leaf packs multiple atoms

**Symptom.** `Leaf packs N atoms: "..."`.

**Cause.** You wrote something like `↑ 34%` or `2026-04-14 · 14:20` as a
single leaf — an icon glyph plus a text run in one box.

**Fix.** Promote the leaf to a parent and give each atom its own child box.

```html
<!-- Bad -->
<div class="delta">↑ 34.2% vs Q3</div>

<!-- Good -->
<div class="delta">
  <div class="arrow">↑</div>
  <div class="change">34.2% vs Q3</div>
</div>
```

The new parent needs `display: flex; flex-direction: row; padding: Spx; gap: Spx;` to satisfy Rules 2–4 at the new depth. Pick a spacing value `S` that visually separates the atoms (typically 4–12px for inline glyphs).

**Not flagged** (single atoms): `$12.4M`, `Hello world`, `Terms & Conditions`, `+15%` — currency, punctuation, and ligatures never count as icons.

---

## R1: Text in a non-leaf

**Symptom.** `Non-leaf node contains text: "..."`.

**Cause.** A label or title was written directly inside a container div.

**Fix.** Wrap the text in a child element.

```html
<!-- Bad -->
<div class="card">Title<div class="body">...</div></div>

<!-- Good -->
<div class="card"><div class="title">Title</div><div class="body">...</div></div>
```
