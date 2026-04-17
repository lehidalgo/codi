# Plan Authoring

A **plan** is a Markdown file that describes what a variant will be,
before any visual HTML is rendered. Plans are the user-facing contract
between "I want a LinkedIn carousel about X" and the final 1080×1350
card deck. The user reviews the plan, iterates with you on prose and
structure, and then — only then — explicitly approves you to render the
HTML.

Rule: one plan per variant. Plans live next to where the rendered HTML
will eventually live, in the matching platform subfolder:

```
content/
├── 00-anchor.md                      # anchor (Markdown)
├── linkedin/
│   ├── carousel.md                   # ← plan
│   └── carousel.html                 # ← generated AFTER plan approval
├── instagram/
│   ├── feed.md                       # plan
│   └── feed.html                     # rendered
```

The plan and the rendered file share a base name; the `.md` is the
source of truth for copy + intent, the `.html` is the visual render.

---

## Why plan in Markdown

- **Cheap to iterate.** A prose plan takes seconds to edit. A rendered
  HTML card takes real compute and real user review time. Fix intent at
  the plan stage; design comes later.
- **Focuses the conversation.** When the artifact is HTML, the user
  comments on fonts and colors. When it is Markdown, they comment on the
  argument, the hook, the CTA — which is what actually matters for
  platform performance.
- **No wasted renders.** Every rendered `.html` in the project is a
  deliberate choice the user made. Nothing shows up in the preview that
  the user didn't approve.
- **Portable.** A plan can feed other tools: SEO review (`/seo content`),
  blog authoring (`/blog write`), marketing copy polish (`/copywriting`),
  without round-tripping through HTML.

---

## Required frontmatter

```markdown
---
variant: linkedin-carousel
platform: linkedin
anchor: 00-anchor.md
derivedFromRevision: 1
status: planned
---
```

| Field | Purpose |
|-------|---------|
| `variant` | Human-readable variant id (e.g. `linkedin-carousel`, `instagram-reel-cover`) |
| `platform` | Top-level platform folder (e.g. `linkedin`, `instagram`, `facebook`, `tiktok`, `x`, `blog`, `deck`) |
| `anchor` | The anchor this plan derives from. Always `00-anchor.md` unless the project has a non-default anchor |
| `derivedFromRevision` | Integer — the anchor revision this plan was written against. If the anchor bumps, this plan becomes stale |
| `status` | `planned` · `approved` · `rendered` · `stale`. You set this; the user doesn't edit it |

Status values:
- `planned` — plan exists, user has NOT approved. No HTML rendered.
- `approved` — user gave green light. Render HTML.
- `rendered` — HTML has been generated. Preview shows the visual variant.
- `stale` — the anchor was edited after this plan. Re-align before re-rendering.

---

## Plan body contract

Every plan must contain four sections, in order:

### 1. Pitch (one paragraph)

What the variant is, for whom, and what the user walks away feeling or
doing. Keeps you honest about the point of the variant — if you can't
write the pitch in 3 sentences, the variant is unfocused.

### 2. Structure — the slide / frame / section breakdown

For every visual unit (slide in a carousel, page in a document, frame
in a story), write one `## Slide NN — <role>` block containing:

- **Role:** what this unit is for (hook, problem, point, synthesis, CTA)
- **Headline:** the exact text that will appear at the largest type scale
- **Body / supporting text:** exact copy — NOT a description of what you'll write, the actual draft
- **Visual direction:** one line describing the layout intent
  (two-column, full-bleed type, chart-lead, etc.) — no CSS, no color codes,
  just the compositional intent

Example slide block:

```markdown
## Slide 03 — Point 1: Keep your rules in one file

**Role:** First takeaway after problem framing.
**Headline:** One source. Every agent.
**Body:** Write each rule once in `.codi/rules/`. Codi fans it out
into every agent's native format — CLAUDE.md, .cursorrules,
AGENTS.md, and more. No sync scripts. No drift.
**Visual direction:** Bold headline top-third, thin horizontal
divider, body paragraph centered below. Single accent color line.
```

### 3. Caption / distribution copy

The text the user will paste into the platform alongside the media.
Format varies per platform — LinkedIn captions run ~150-220 words,
Twitter single tweets ≤260 chars, Instagram captions have separate
hashtags-in-first-comment.

Always include this section even if the variant is a single image —
the caption is half the post.

### 4. Hashtags / distribution footnotes

Final section: hashtag list, distribution notes, scheduling hints.
If the platform doesn't use hashtags (LinkedIn carousels, blog posts),
say so explicitly and leave the section empty.

---

## What NOT to put in a plan

- **No HTML.** Not even one `<div>`. The plan is prose.
- **No CSS.** "Visual direction" describes intent, not implementation
  ("big headline top, supporting caption below" — not `font-size: 64px`).
- **No color codes.** Brand tokens apply at render time.
- **No Figma links / design files.** Text + structure only.
- **No per-slide design mockups.** If the plan has to explain how it
  will look visually in that much detail, you are designing, not
  planning. Stop and ship the plan.

---

## Per-platform plan specifics

Each platform has its own plan shape quirks (slide count, frame
constraints, caption rules, UI-safe zones). Read the matching playbook
before authoring:

- `[[/references/platforms/linkedin.md]]`
- `[[/references/platforms/instagram.md]]`
- `[[/references/platforms/facebook.md]]`
- `[[/references/platforms/tiktok.md]]`
- `[[/references/platforms/x.md]]`
- `[[/references/platforms/blog.md]]`
- `[[/references/platforms/deck.md]]`

Each playbook has a "Plan shape" section that tells you the exact
slide / frame structure, required copy blocks, and what questions the
user typically has for that platform.

---

## Craft references — apply during planning

Three references are MUST-READ during the planning phase. The plan is
how you show the user you understand their reader; the craft refs are
how you ensure every line passes platform-level quality gates:

- `[[/references/copywriting-formulas.md]]` — pick ONE formula per
  variant (AIDA, PAS, BAB, 4Ps, 1-2-3-4, 4Us, FAB). Name the formula in
  the plan's frontmatter (`formula: AIDA`). Every plan section should map
  to a formula slot.
- `[[/references/hooks-and-retention.md]]` — every plan opens with a
  hook; use one of the 10 archetypes. Score the headline on the 4Us
  rubric (target ≥ 6) before presenting the plan to the user.
- `[[/references/humanized-writing.md]]` — flag which banned words must
  be removed and note any platform with low AI tolerance (LinkedIn, X).
  The humanization pass runs after the plan is approved, before the
  `.html` renders.

## Iteration loop

1. Author the plan from the anchor + the platform playbook.
2. Show the plan to the user in a message. Point them to the file
   so the preview can render it as a Markdown document.
3. User comments, edits, rewrites. You iterate on the `.md` — still
   no HTML exists.
4. User approves. Update `status: approved` in the plan's frontmatter.
5. Render `<name>.html` from the approved `<name>.md`. Never render
   before step 4.

If the user says "render all" after seeing multiple plans, that's a
batch approval covering each plan listed — but each plan still needs
to have been individually presented. A silent "yes to everything" is
not a thing.

---

## Revisions

If the anchor's `revision` field bumps after a plan was written:

1. Find all plans with `derivedFromRevision < newRevision`.
2. Set their `status: stale`.
3. Set any rendered `.html` with the stale plan's `planSource` to
   `stale` (via `<meta name="codi:variant">` metadata).
4. Surface staleness to the user: *"The anchor changed. 3 plans need
   re-alignment: linkedin/carousel.md, instagram/feed.md, x/card.md.
   Which should I re-plan?"*
5. Re-plan, re-approve, re-render — same loop as the first pass.

Never silently regenerate downstream variants from a changed anchor.
Revisions are always user-gated.
