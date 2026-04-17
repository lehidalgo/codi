# LinkedIn — Platform Playbook

Two variants live under `content/linkedin/`:

| Plan (Markdown) | Rendered HTML | Format | Card count | Canvas |
|-----------------|---------------|--------|------------|--------|
| `carousel.md` | `carousel.html` | Carousel | 6–10 cards | 1080×1350 (4:5) |
| `post.md` | `post.html` | Single image | 1 card | 1080×1080 (1:1) |

Card wrapper (HTML render): `<article class="social-card">` for both.
**Never write the `.html` until the user has approved the `.md` plan.**
See `[[/references/plan-authoring.md]]` for the plan contract.

## Plan shape — LinkedIn carousel (`carousel.md`)

| Plan section | Content |
|--------------|---------|
| Frontmatter | `variant: linkedin-carousel · platform: linkedin · anchor: 00-anchor.md · derivedFromRevision: N · status: planned` |
| Pitch | One paragraph — the carousel's single promise to the scrolling reader |
| Structure | 6–10 `## Slide NN — <role>` blocks: Cover · Problem · Points 03–08 · Penultimate Synthesis · Final CTA |
| Caption | ~150–220 words for the LinkedIn post body |
| Hashtags | 3–5, will live in the post caption (never on slides) |

## Plan shape — LinkedIn single post (`post.md`)

| Plan section | Content |
|--------------|---------|
| Frontmatter | `variant: linkedin-post · platform: linkedin · …` |
| Pitch | One sentence — the single claim the image carries |
| Structure | One `## Card` block: headline + supporting fact + brand mark direction |
| Caption | 60–90 words |
| Hashtags | 3 in the caption |

---

## carousel.html — LinkedIn carousel (6–10 slides)

**Audience mode:** Professional, credentialed, skimmable.

### Structure

| Slide | Role | Content |
|-------|------|---------|
| 01 | Cover | The anchor's hook blockquote as the slide headline + "Swipe for the fix →" micro-CTA |
| 02 | Problem | One-sentence restating of the thesis. No body copy beyond it |
| 03–08 | Points | One H2 per slide. Title = the H2 verbatim. Body = one concrete piece of evidence (number, example, before/after). Max 25 words body copy |
| N−1 | Synthesis | "Here's what this means for you" — one paragraph pulling the points together |
| N | CTA | Author/brand mark + handle + one-line CTA. Link points to the anchor. No hashtags on slides |

### Density rules

- Each card fills ≥85% of canvas (see `[[/references/visual-density.md]]`)
- Page indicator (`01 / 08`) in one corner on every slide
- Author/brand mark in the opposite corner on every slide
- Max 3 type scales per slide (title, body, micro-label)

### Caption (user pastes into LinkedIn post)

Derive from the anchor's hook + synthesis + CTA. ~150–220 words.
3–5 hashtags at the end. Hashtags go in the caption, never on slides.

### Distillation recipe (shortcut)

```
Cover        ← anchor.hook
Problem      ← anchor.thesis (last line of "## The problem")
Point 01     ← anchor.## point 1 → title + 1 evidence unit
Point 02     ← anchor.## point 2 → title + 1 evidence unit
...
Synthesis    ← anchor.## What this means (first paragraph only)
CTA          ← anchor.cta (frontmatter) → imperative form
```

---

## post.html — LinkedIn single image post

**Audience mode:** Same as carousel, but condensed for feed display.

### Structure

| Region | Content |
|--------|---------|
| Top third | The anchor's hook, max 12 words |
| Middle | One number or concrete claim from the anchor body |
| Bottom strip | Brand mark + "Full breakdown: codi.dev/post" |

Ships as a single square card. No hashtags on the image. The
accompanying LinkedIn caption pulls from the anchor's synthesis — 60–90
words, 3 hashtags.

### When to pick single-post over carousel

- The anchor is a single punchy observation (not 5–7 points)
- The user says "quick LinkedIn image", "one post", "no carousel"
- The anchor is a `short` length class
