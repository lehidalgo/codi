# Visual Density — MANDATORY for all card types

Cards and pages MUST feel **full**. Large empty regions, a single centered
headline floating on a blank canvas, or vast unused margins read as unfinished
work. Treat every card as a **composed layout**, not a text slot.

## The rule

Every card must visibly occupy **≥85% of its canvas** with purposeful content
and supporting visual elements. If you can drag a 200×200px box across the card
and hit only background, the card is underfilled — add content.

## Fill techniques — use 2 or more per card

1. **Grid / multi-column layouts** — split the canvas into columns (2-col, 3-col,
   asymmetric 60/40, bento grid). A centered single-column headline leaves ~60%
   of the canvas empty.
2. **Supporting visual elements** — eyebrow label, stat row, icon row, numbered
   list, tag pills, meta strip (date · category · author), progress bar, divider
   rule, kicker.
3. **Decorative accents** — gradient orbs, blurred shapes, grid/dot patterns,
   diagonal stripes, large outlined numerals, oversized background glyphs, SVG
   line art. Keep them `opacity: 0.08–0.25` behind content so they add texture
   without competing.
4. **Code / data mockups** — for technical content, render a small faux terminal,
   code block with syntax highlighting, JSON snippet, table row, or chart. These
   fill space AND reinforce the topic.
5. **Edge-anchored chrome** — push elements to the corners: brand mark top-left,
   page number top-right, handle bottom-left, CTA arrow bottom-right. Corners
   that are empty create the "blank canvas" feel.
6. **Oversized typography** — when copy is short, scale the headline larger
   (clamp up to ~12% of the card's shorter dimension) and add a longer
   sub-headline or kicker below. Empty space is usually a sign the headline is
   too small for the available area.
7. **Background imagery or gradient fills** — full-bleed gradient, photo
   treatment, or color-block half-and-half split. Never leave the background as
   flat white unless the preset explicitly requires it.

## Required minimums per card type

| Type | Minimum elements on every card |
|------|-------------------------------|
| `social` cover | Headline + sub-headline + eyebrow/kicker + brand mark + handle + 1 decorative accent |
| `social` content | Headline + body (3+ lines OR list/stats) + index indicator (e.g. "02 / 07") + brand mark + 1 accent |
| `social` stat | Large stat number + label + supporting body + comparison/context + brand mark + accent |
| `social` cta | CTA headline + action line + handle + arrow/icon + brand mark + accent |
| `slides` cover | Title + subtitle + eyebrow + author/date strip + brand mark + page number + accent |
| `slides` content | Title + 2-column OR grid body + footer strip (title · page · brand) + 1 accent |
| `document` page | Header (title + page #) + body with ≥3 sections + footer (brand · date · page) — never a single paragraph page |

## Anti-patterns — do not do this

- A single centered `<h1>` on an otherwise empty card
- A content card with only a headline and one short paragraph
- A stat card with a number and nothing else
- Document pages with one heading + 2 lines of text and 800px of whitespace below
- Slides where the title is in the top-left and the rest of the canvas is blank
- Footers/headers that are empty strips — always populate them with brand · page · date

## Verification before writing each card

Mentally draw the card as a 3×3 grid. At least 7 of the 9 cells must contain
content or a purposeful decorative element. If 3+ cells are empty, add content
before generating.

## When content truly is short

For example, a one-sentence quote card: fill the canvas with an oversized
pull-quote treatment, giant open/close quote marks as a decorative accent, an
author attribution block, and a thick accent rule — never leave the space flat.
