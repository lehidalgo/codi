# Hybrid Box Layout Model
- **Date**: 2026-04-16 16:52
- **Document**: 20260416_165258_[PLAN]_hybrid-box-layout-model.md
- **Category**: PLAN

## Summary

Redesign the content factory's layout approach to use a two-layer model:
- **Layer 1 (Structure)**: Box Layout Theory - every parent is subdivided by its children, spacing is uniform, siblings are balanced
- **Layer 2 (Placement)**: CSS Positioning - content within each box is placed freely via text-align, justify-content, align-items

The skill's design rules teach the agent to generate structured HTML from the start. The validator confirms the structure without penalizing intentional CSS placement.

## Problem

The current validator enforces "fill every pixel" box theory. Real social card designs use CSS positioning (`justify-content: space-between`, `text-align: right`) to place content. This creates an unresolvable conflict:
- R2 requires children to fill parent width -> add `flex:1` to fix
- R10 penalizes text that doesn't fill its box -> remove `flex:1` to fix
- Fixing one triggers the other in an infinite loop

## Design Model

```
Layer 1 (Structure) — Validator enforces
+-------------------------------------+
|  +----------+  +------------------+ |  Children subdivide parent
|  |  BOX A   |  |     BOX B        | |  Proportions explicit
|  |  30%     |  |     70%          | |  Spacing uniform
|  +----------+  +------------------+ |  No leftover space
+-------------------------------------+

Layer 2 (Placement) — CSS handles, validator allows
+-------------------------------------+
|  +----------+  +------------------+ |
|  |       01 |  |  HEADLINE        | |  Content positioned within box
|  |   right->|  |  <-centered      | |  text-align, align-items, etc.
|  +----------+  +------------------+ |  Underfill is OK
+-------------------------------------+
```

## Changes

### Part 1: Validator Rule Changes (box-validator)

**R2 (Full Coverage)** - Add `justify-content` awareness
- When a row/column uses `justify-content` (space-between, space-around, space-evenly, center, flex-end), the distributed space counts as "filled"
- Check: `sum(childSizes) + gaps + justifySpace == parentSize`
- If `justify-content` is set and children are positioned correctly, R2 passes
- Severity stays error for containers WITHOUT justify-content that have unfilled space

**R10 (Content Fit)** - Remove underfill checks
- Keep overflow check (content spilling out of box) as error
- Remove underfill error (content fills < 15% of box)
- Remove underfill warning (content fills < 30% of box)
- Rationale: Layer 2 allows content to be smaller than its box

**R7 (No Empty Nodes)** - Exempt visual decorative elements
- Skip nodes that have `background`, `background-color`, `border`, or `box-shadow` CSS properties with non-transparent values
- Skip nodes with classes matching common decorative patterns: accent, divider, separator, line, bar, spacer
- These serve visual purposes even without text content

**R1 (Boxes Only)** - Exempt heading elements
- Skip R1 check on `h1`-`h6` and `p` elements
- Headings commonly mix text with inline formatting elements (`<span>`, `<em>`, `<strong>`)
- This is standard HTML, not a structural violation

**R3 (Shared Dimension)** - Skip non-box inline elements
- Skip `<br>` tags (0px width, not a real flex child)
- Skip elements with `display: inline` or `display: contents`
- Only compare elements that participate in the flex/grid layout

**Scoring** - Adjust weights
- No scoring changes needed if R10 underfill and R2 justify-content are addressed
- The score formula already normalizes by node count

### Part 2: Content Factory Skill Design Rules

Update the skill's HTML generation guidelines to enforce the hybrid model. These rules go in the content factory skill template and the design-system reference.

**Rule: Structural Grid First**
Every card starts with a column container subdivided into structural rows. Every row is subdivided into structural cells. No floating elements.

```html
<!-- GOOD: structural grid -->
<article class="social-card" data-index="01">
  <div class="card-header">...</div>    <!-- flex-shrink: 0 -->
  <div class="card-body">...</div>      <!-- flex: 1 -->
  <div class="card-footer">...</div>    <!-- flex-shrink: 0 -->
</article>

<!-- BAD: floating content -->
<article class="social-card" data-index="01">
  <div style="position:absolute;top:20px;right:20px;">01</div>
  <h1>HEADLINE</h1>
</article>
```

**Rule: Rows Fill Width**
Every row container has children that fill its width. Use `flex: 1` on the growing child, explicit widths on fixed children.

```html
<!-- GOOD: children fill the row -->
<div class="card-header" style="display:flex;">
  <span class="handle">@user</span>       <!-- auto width -->
  <span class="spacer" style="flex:1;"></span>  <!-- fills remaining -->
  <span class="num">01</span>             <!-- auto width -->
</div>

<!-- BAD: space-between with unfilled gap -->
<div style="display:flex; justify-content:space-between;">
  <span>@user</span>
  <span>01</span>
</div>
```

**Rule: Content Placement via CSS**
Within each structural box, position content using CSS properties, not extra wrapper divs.

```css
/* GOOD: text positioned in its structural box */
.num { text-align: right; }
.handle { text-align: left; }
.headline span { display: block; }  /* line breaks via block spans, not <br> */

/* BAD: extra div just for alignment */
<div style="display:flex;justify-content:flex-end;">
  <span>01</span>
</div>
```

**Rule: No `<br>` in Flex Containers**
Use `display: block` spans for line breaks inside flex/grid containers. `<br>` creates 0px-wide inline elements that break sibling consistency.

```html
<!-- GOOD -->
<h1 class="headline">
  <span>YOUR</span>
  <span>CONTENT</span>
  <span class="accent">FINALLY</span>
  <span>WORKS</span>
</h1>

<!-- BAD -->
<h1>YOUR<br>CONTENT<br>FINALLY<br>WORKS</h1>
```

**Rule: Uniform Padding = Gap**
Every flex container with children uses the same value for padding and gap.

```css
/* GOOD */
.card-body { padding: 48px; gap: 48px; }

/* BAD */
.card-body { padding: 64px 64px 48px 80px; gap: 20px; }
```

**Rule: Decorative Elements Use CSS, Not Empty Divs**
Accent bars, lines, and dividers use `border`, `box-shadow`, or `background` on structural elements rather than separate empty elements.

```css
/* GOOD: accent via box-shadow on the card body */
.cover-body { box-shadow: inset 4px 0 0 var(--teal); }

/* BAD: separate empty div for accent */
<div class="accent" style="width:4px;height:100%;background:teal;"></div>
```

### Part 3: Template Updates

Update existing templates to follow the hybrid model. Priority order:
1. minimal-mono (simplest, good reference)
2. minimal-carousel (tested in this session)
3. dark-editorial, earthy-bold (popular presets)
4. Remaining templates

Each template update follows this checklist:
- [ ] Replace `<br>` with block `<span>` in headlines
- [ ] Replace `justify-content: space-between` with flex children
- [ ] Replace absolute-positioned decorative elements with CSS properties
- [ ] Set `padding = gap` on all flex containers
- [ ] Wrap all text in leaf elements (no bare text in flex containers)
- [ ] Validate with updated validator, score >= 0.80

## Implementation Order

1. **Validator rule changes** (R10, R2, R7, R1, R3) - modify box-validator scripts
2. **Skill design rules** - update content factory references
3. **Template updates** - one template at a time, validate each
4. **Test** - run validation on all updated templates, confirm scores >= 0.80

## Files to Modify

### Validator (src/templates/skills/box-validator/scripts/lib/)
- `rules/r10-content-fit.mjs` - remove underfill checks
- `rules/r2-full-coverage.mjs` - add justify-content awareness
- `rules/r7-no-empty.mjs` - add decorative element exemption
- `rules/r1-boxes-only.mjs` - add heading exemption
- `rules/r3-shared-dimension.mjs` - skip inline/br elements

### Content Factory Skill
- `src/templates/skills/content-factory/references/design-system.md` - add hybrid model rules
- `src/templates/skills/content-factory/references/html-clipping.md` - update structural patterns

### Templates (src/templates/skills/content-factory/generators/templates/)
- All 12 template HTML files - apply structural grid pattern

## Success Criteria

- Updated validator passes existing well-structured templates (score >= 0.80)
- Agent-generated content follows structural grid from the start
- No R2/R10 oscillation when fixing cards
- Templates serve as visual reference AND structural reference
