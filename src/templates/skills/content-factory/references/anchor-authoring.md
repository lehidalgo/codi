# Anchor Authoring

The anchor is the long-form prose every variant distills from. It is
authored in **Markdown** and lives at `content/00-anchor.md` in the project
root. There is exactly one anchor per project.

Markdown is the only supported format for the anchor. HTML is reserved for
rendered variants (social cards, slide decks, A4 documents). The content
factory preview renders the Markdown anchor into a styled A4 document so
you can review it as a finished piece.

---

## Why Markdown

- **Substance separate from presentation.** Markdown forces you to think
  in headings, paragraphs, and lists — the units distillation actually
  consumes. HTML authoring tempts you to micro-design the anchor, which
  distracts from the writing.
- **Diff-friendly revisions.** Line-level diffs on prose changes are the
  atomic unit of anchor revision. A one-sentence edit is a one-line diff.
- **Portable.** The same anchor text can feed `/blog write` in claude-blog,
  `/seo audit` in claude-seo, a newsletter, or a doc repo without
  re-authoring.
- **Platform-agnostic.** Distillation decides what becomes a slide, a
  carousel frame, or a tweet — the anchor never commits to a presentation
  format.

---

## File layout

```
<project>/
├── brief.json                  # intake answers
├── state/manifest.json         # project manifest
└── content/
    ├── 00-anchor.md            # ← the anchor, Markdown
    ├── linkedin/
    ├── instagram/
    ├── facebook/
    ├── tiktok/
    ├── x/
    ├── blog/
    └── deck/
```

The anchor filename is always `00-anchor.md`. The `00-` prefix keeps it
first in alphabetical listings. Platform subfolders are pre-scaffolded
when the project is created.

---

## Required frontmatter

Every anchor begins with a YAML frontmatter block. These fields drive
distillation and appear in the preview header.

```markdown
---
title: Every AI agent speaks a different language
subtitle: And your standards are paying for it
audience: engineering leaders
voice: technical, candid, no filler
length_class: standard
cta: Install codi — one config, every agent
revision: 1
---
```

| Key | Purpose |
|-----|---------|
| `title` | Headline of the anchor; used in variant titles too |
| `subtitle` | One-line expansion on the title |
| `audience` | Who this is written for; distillation uses it to choose voice and examples per platform |
| `voice` | Tone + constraints; variants inherit this unless platform rules override |
| `length_class` | `short` · `standard` · `deep`. **Default is `standard`** — only use `deep` when explicitly asked |
| `cta` | The single call to action — every variant ends with a platform-appropriate form of this |
| `revision` | Integer, bumped via `POST /api/anchor/revise` whenever substance changes |

---

## Length classes — default is standard

Default: **standard** (1000–1500 words, 3–5 min read, 5–7 key points).
Users can request `short` or `deep` explicitly in the intake.

### Short anchor — 400–600 words

- 2–3 key points, each 1–2 sentences
- One example or statistic per point
- Ships when the user says "quick", "brief", "one-pager"

### Standard anchor — 1000–1500 words (DEFAULT)

- 5–7 key points, each with a sub-paragraph of evidence
- 2–3 examples or data points
- A synthesis section summarizing what the points mean together
- This is what ships when length is ambiguous

### Deep anchor — 2500–4000 words

- 7+ key points, grouped into sections with their own H2 headings
- Each point has 2–3 sub-points, evidence, worked examples
- Explicit counter-arguments and caveats
- Ships when the user says "comprehensive", "deep dive", "full report"

Do not pad a short topic to hit a word count. If the idea supports 600
words cleanly, stop at 600. Length is a consequence of depth, not a target.

---

## Structural contract

The renderer uses semantic Markdown — nothing fancy. Distillation reads
your ATX headings and list structure to decide what becomes a hook, a
point, evidence, a synthesis, and a CTA. Use the structure below
consistently so distillation stays lossless.

### The standard skeleton

```markdown
---
title: ...
subtitle: ...
audience: ...
voice: ...
length_class: standard
cta: ...
revision: 1
---

# {{title}}

> {{one-sentence hook that states the payoff — what the reader walks away with}}

## The problem

{{2–3 paragraphs framing why this matters now. Cite a real data point or
observation in the first paragraph. The last sentence of this section must
be the thesis — the single claim the anchor defends.}}

## {{Point 1 — imperative phrasing}}

{{Evidence paragraph. Use a concrete example, a number, or a before/after.
If this point has a sub-move, use a bullet list of 2–4 items. Never more
than 5 bullets — that's a sign the point should split.}}

## {{Point 2 — imperative phrasing}}

…

## {{Point N — imperative phrasing}}

…

## What this means

{{2-paragraph synthesis. First paragraph: what the points add up to.
Second paragraph: what changes in practice if the reader acts on this.}}

## {{CTA heading — the ask}}

{{One paragraph. State the action. Link if relevant. No hashtags.}}
```

### Anchor anatomy, by role

| Section | Heading pattern | Role |
|---------|-----------------|------|
| Title | `# {{title}}` (h1) | Used in variant titles and exports |
| Hook | First `>` blockquote after the title | Distillation's cover-slide source |
| Problem framing | `## The problem` | Slide 02 on carousels; lede on blogs |
| Points | `## {{verb-first phrase}}` (h2) | One per carousel slide / deck point |
| Evidence | Paragraphs + lists under each point | Supporting copy on variants |
| Synthesis | `## What this means` | Penultimate slide; conclusion on blogs |
| CTA | Final `##` section | Final slide; post caption close |

---

## Writing rules

### Lead with the payoff

The title and the hook blockquote together must tell the reader what
they're getting if they keep reading. A hook that sets up a question
("Have you ever wondered…") or asks for attention ("Let me tell you a
story…") loses 60% of readers on mobile platforms.

Good: `> Five AI agents, five config files, five slightly different
interpretations of your standards.`

Bad: `> I've been thinking about AI developer tooling lately.`

### One idea per H2

Every `##` heading represents one point. If you're writing a point that
needs two different arguments, split it into two H2s. Distillation gives
each H2 its own carousel slide — forcing one-per-slide honesty is the
whole reason the structure exists.

### Use imperative phrasing for points

Works: `## Keep your rules in one file` · `## Let agents read the same
source` · `## Stop writing the same code twice`.

Doesn't: `## On the importance of consolidation` · `## Thoughts on AI
configuration`.

Imperative headings read as promises. They distill cleanly into slide
titles because they already ARE slide titles.

### Concrete over abstract

Every point gets at least one of: a specific number, a named tool, a
before/after example, a direct quote. If a point has none of these, it's
a platitude — cut it or find the concrete thing.

### Preserve key numbers verbatim

Statistics, quotes, and specific figures must appear in the anchor exactly
as they'll appear in variants. Distillation cites them by reference; if
they're fuzzy in the anchor, they go wrong everywhere.

---

## Links, images, and code

- **Links**: `[label](url)` syntax. Distillation strips links from social
  variants (platforms don't render inline links) and preserves them in
  blog/deck variants.
- **Images**: `![alt](path)`. Anchors rarely need images — variants pull
  hero images from `banana-claude` if installed, or the brand's image
  library otherwise.
- **Code blocks**: fenced triple-backtick with a language hint.
  Distillation preserves code blocks verbatim in blog variants; social
  variants convert short snippets to screenshotted "terminal cards" and
  skip long blocks entirely.
- **Tables**: GitHub-flavored pipe syntax. Rendered as proper `<table>`
  elements in blog/doc variants; on social/deck variants, 2–3 row tables
  become comparison cards, longer tables are converted to a hero metric
  plus a "see the full data" CTA.

---

## Revisions

When you change substance (a thesis shift, a new point, a revised
statistic), bump the revision:

```
POST /api/anchor/revise { "bump": "minor" }
```

The server:
1. Increments `revision` in the frontmatter.
2. Marks every variant whose `derivedFromRevision` is less than the new
   revision as `stale`.
3. Emits a WebSocket notification; the UI surfaces a "3 variants stale —
   re-distill?" banner.

**Never auto-propagate.** The user decides which variants to re-distill.
Revisions track provenance; the decision to ship is human.

Cosmetic changes (typo fixes, punctuation, rephrasings that don't change
meaning) do not require a revision bump.

---

## What not to do in the anchor

- **Do not embed HTML.** The renderer does not pass HTML through.
  Everything renders via the Markdown parser.
- **Do not use images as content.** An image supporting a point is fine;
  a hero image doing the work of a headline is not. Anchors lead with
  text.
- **Do not write platform-specific copy.** No LinkedIn voice, no Twitter
  voice. Those shifts happen at distillation time. The anchor is the
  substance; voice layers on top.
- **Do not use heading depth beyond H3.** If you're reaching for `####`,
  your point needs to split into its own H2.
- **Do not use footnotes.** They don't distill. Inline the evidence or
  move it to its own paragraph.
