# Anchor Authoring

How to write a great anchor — the long-form piece that captures the
substance before any visual format distills from it.

The anchor is a standalone, shippable article. It should read well on
its own (a user who only reads the anchor should feel they got
something valuable) and it should carry enough semantic structure that
distillation to visual formats is unambiguous.

Read this alongside `[[/references/methodology.md]]` (why anchor-first) and
`[[/references/distillation-principles.md]]` (how the anchor feeds downstream
variants).

---

## 1. Shapes that work

Pick the shape that fits the topic. Don't force a narrative essay onto
a listicle topic, and don't force a listicle onto a narrative essay
topic. The shape is a judgment call — there's no closed list, but
these are the patterns that recur.

### 1.1 Narrative essay

A continuous argument with a strong voice. Opens with a scene or a
provocation, develops a claim, returns to the scene at the end. Best
for: opinion pieces, manifestos, strategic writing, philosophy-adjacent
topics.

### 1.2 Listicle

N ordered points on a theme. Each point stands alone but the set
compounds. Best for: "5 lessons from X", "The 7 mistakes teams make",
rapid-fire tactical content.

### 1.3 Case study

Context → challenge → approach → result → takeaway. Best for:
customer stories, project retrospectives, postmortems, "here's what
worked" content.

### 1.4 Technical explainer

Assumes a specific technical audience. Opens with the problem, builds
the mental model, applies it, caveats at the end. Best for: engineering
blog posts, architecture explanations, deep dives on a specific tool or
technique.

### 1.5 Comparison / decision piece

Option A vs. B vs. C, evaluated against explicit criteria, with a
recommendation. Best for: build-vs-buy, tool selection, platform
choices.

### 1.6 Manifesto

A position piece staking out a view on how things should be. Opens with
the status quo, names what's wrong, proposes the alternative. Best
for: category creation, brand positioning, ideological content.

### 1.7 Retrospective

Chronological or thematic look-back. Best for: "What we learned
shipping X", annual reviews, "The first year of Y".

Hybrid shapes are fine. A case study can lead into a manifesto. A
technical explainer can end with a listicle of practical tips. The
shape serves the content, not the other way round.

---

## 2. Length classes

Pick one at the intake stage. The class sets reader expectations and
shapes what the anchor can distill into.

### Short anchor — 1-2 min read, ~400-600 words

- 3 key points, 1 piece of evidence each.
- One figure, one quote, one stat at most.
- Reads like a tight LinkedIn post with headers.
- Distills cleanly to 5-7 slides, 6-8 carousel frames, a one-page
  summary document.

### Standard anchor — 3-5 min read, ~1000-1500 words

- 5 key points, 1-2 pieces of evidence each.
- Multiple figures, quotes, stats as needed.
- Reads like a typical blog post with sub-headers.
- Distills to 8-12 slides, 8-10 carousel frames, a 2-3 page document.

### Deep anchor — 8-12 min read, ~2500-4000 words

- 7+ key points, often grouped into sections with their own
  sub-structure.
- Rich evidence: charts, extended quotes, code blocks, diagrams.
- Reads like a long-form blog post, whitepaper, or chapter.
- Distills to 15-20 slides, multi-part carousel series, full
  whitepaper document.

When the user's intent is ambiguous about depth, default to standard
and mention it: "I'll aim for a 3-5 minute read — say if you want it
shorter or deeper."

---

## 3. Semantic tagging

Distillation reads the anchor by walking its sections and deciding
what each contributes to the target format. Consistent section
annotation makes this reliable without forcing a rigid taxonomy.

### 3.1 Conventions that work

Wrap each meaningful section in a `<section>` with a `data-role`
attribute:

```html
<section data-role="hook">...</section>
<section data-role="point" data-point-ix="1">...</section>
<section data-role="evidence">...</section>
<section data-role="synthesis">...</section>
<section data-role="cta">...</section>
```

Common roles and what they typically carry:

| Role | What's inside | Distillation use |
|---|---|---|
| `hook` | Opening paragraph or scene earning the read | Title slide, carousel frame 1, story cover |
| `point` | One key argument or section (numbered with `data-point-ix`) | One slide / carousel frame / card per point |
| `evidence` | Data, quote, example, code, diagram supporting a point | Metrics slide, quote slide, or folded into its parent point |
| `synthesis` | "What this means" pull-together, implications, consequences | Insight slide near the end |
| `cta` | What the reader should do next | Closing slide, final carousel frame, share prompt |

Other roles that make sense for specific shapes:

- `context` — setup for a case study or retrospective
- `contrarian` — the counter-view you're pushing back against
- `definition` — terminology a technical explainer needs the reader to
  hold
- `caveat` — edge cases, limitations, counter-arguments
- `aside` — interesting but off the critical path

Invent roles when the content calls for them. The downstream
distillation references document how common roles map to format slots;
uncommon roles get the agent's creative decision.

### 3.2 Why tag

Without roles, distillation has to guess what each section is. With
roles, distillation is deterministic: "this point becomes a slide, this
evidence becomes a metric, this synthesis becomes the closing insight."

Tagging also makes the anchor self-documenting. A user reading the HTML
source sees the structure immediately.

### 3.3 Skip tagging when it hurts

If a section's role is already obvious from its content and position
(the `<header>` of an article is clearly the hook; the last `<section>`
is clearly the close), explicit tagging adds noise. Tag where it helps
distillation; skip where it's redundant.

---

## 4. Structural skeleton

A common skeleton for the standard anchor length class:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="codi:template"
        content='{"id":"kebab-id","name":"Human Readable","type":"document","format":{"w":794,"h":1123}}'>
  <meta name="codi:anchor"
        content='{"revision":1,"status":"draft"}'>
  <title>Title</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/...">
  <style>/* tokens.css inlined + anchor styles */</style>
</head>
<body>
  <!-- The anchor is a `document` content type. Long anchors span multiple
       `.doc-page` elements — split at natural section breaks. The skeleton
       below shows a short anchor on a single page; expand to multiple
       `<article class="doc-page">` blocks for standard and deep classes. -->
  <article class="doc-page" data-type="article" data-index="01">
    <header class="page-header anchor-cover">
      <p class="anchor-eyebrow">Category · date</p>
      <h1>Title</h1>
      <p class="anchor-dek">Thesis in one sentence.</p>
      <p class="anchor-meta">Author · est. read time</p>
    </header>

    <div class="page-body">
      <section data-role="hook">
        <p>Opening paragraph or scene that earns the read.</p>
      </section>

      <section data-role="point" data-point-ix="1">
        <h2>Point 1 title</h2>
        <p>Argument prose — several paragraphs.</p>
        <aside data-role="evidence">
          <blockquote>Supporting quote or stat.</blockquote>
          <cite>Attribution.</cite>
        </aside>
      </section>

      <section data-role="point" data-point-ix="2">...</section>
      <section data-role="point" data-point-ix="3">...</section>
      <!-- 3-7 points typical -->

      <section data-role="synthesis">
        <h2>What this means</h2>
        <p>Pull the threads together.</p>
      </section>

      <section data-role="cta">
        <h2>Your turn</h2>
        <p>What should the reader do next?</p>
      </section>
    </div>

    <footer class="page-footer">
      <p>Author · codi.dev</p>
    </footer>
  </article>
</body>
</html>
```

Adapt freely. A narrative essay might skip the explicit `point`
sections and use paragraph-level structure. A listicle might have
eight `point` sections and no `synthesis`. A case study might add
`context`, `challenge`, `approach`, `result` sections with their own
roles.

---

## 5. Brand alignment

The anchor is where brand voice gets set. Every downstream variant
inherits from it.

- **Inline brand tokens** in `<style>`. Read `tokens.css` from the
  active brand and paste verbatim.
- **Respect voice rules.** Read `voice.tone`, `voice.phrases_use`,
  `voice.phrases_avoid` from `tokens.json`. Write in the tone. Use
  phrases-use where natural. Never write phrases-avoid.
- **Apply typography tokens.** Headings in the brand's heading font;
  body in the brand's body font; code and metadata in the brand's
  monospace font.
- **Honor the logo rules.** Place the logo per brand guidance. For
  Codi: the CSS gradient wordmark, not a raster image. For other
  brands: follow their logo rules.
- **Read the brand references.** Every brand ships a `references/`
  directory with visual style guides. Skim them before writing — they
  tell you what the brand's existing content looks like.

See `[[/references/brand-integration.md]]` for the full procedure.

---

## 6. Worked examples

### Example 1 — Short anchor, manifesto shape

Topic: "Why Codi uses anchor-first content."

```html
<article class="anchor" data-type="article">
  <header class="anchor-cover">
    <p class="anchor-eyebrow">Codi · methodology</p>
    <h1>One idea, every format</h1>
    <p class="anchor-dek">Content is information; format is presentation. The anchor is the source of truth — visuals are specialized views.</p>
  </header>

  <section data-role="hook">
    <p>Teams ship three versions of the same idea — a blog, a deck, a carousel — and each one says something slightly different. By the time feedback comes back, the thesis has drifted. The fix isn't more coordination; it's one source of truth.</p>
  </section>

  <section data-role="point" data-point-ix="1">
    <h2>Substance before form</h2>
    <p>Write the argument as prose first. Every visual format compresses from there — with constraints, with platform awareness, but always from the same substance.</p>
  </section>

  <section data-role="point" data-point-ix="2">
    <h2>Revision economy</h2>
    <p>Edit the idea once. Derived formats re-distill on demand. Nine files stay aligned because eight are derived from one.</p>
  </section>

  <section data-role="point" data-point-ix="3">
    <h2>Separation of concerns</h2>
    <p>Substance lives in the anchor. Presentation lives in the variant. Layout lives in the validator. When something is wrong, you know where to fix it.</p>
  </section>

  <section data-role="cta">
    <h2>Start with the anchor</h2>
    <p>Next time a content request comes in, write the article first. Everything else follows.</p>
  </section>
</article>
```

Three points. One thesis. Distills cleanly to: a 5-slide deck (title,
point 1, point 2, point 3, CTA) or a 6-frame carousel (hook, 3 points,
synthesis, CTA) or a one-page document.

### Example 2 — Standard anchor, case study shape

Topic: "How we migrated slide decks from 3-file to single-file."

Section roles: `context` (what the problem was), `challenge` (why it
was hard), `approach` (what we did), `result` (what changed),
`takeaway` (what's transferable). Five points, each with 1-2 pieces of
evidence (before/after numbers, code snippets, validation scores).

Distillation targets:

- **Deck (8-12 slides)**: title → context → challenge → 3 approach
  slides → result metrics → takeaway → CTA.
- **LinkedIn carousel (8 frames)**: hook (contrarian), 3 approach
  frames, result frame, takeaway, CTA, share-back.
- **Blog post**: the anchor itself, maybe with an added hero image and
  SEO metadata.

### Example 3 — Deep anchor, technical explainer shape

Topic: "Why LLM coding agents produce better content with anchor-first
methodology."

Length: 3500 words. Structure: `hook` (the failure mode), `context`
(how agents approach content today), `definition` (what anchor-first
means), 4 `point` sections (benefits), `evidence` nested in each point
(experiments, before/after outputs), `caveat` (when it doesn't apply),
`synthesis` (what this implies for skill design), `cta` (try it, report
back).

Distillation targets:

- **Whitepaper document (4-5 pages)**: near-identical to the anchor,
  added TOC and cover.
- **Deck (15-20 slides)**: expanded with speaker-note-quality detail
  on each point.
- **LinkedIn carousel (10 frames)**: tight compression — one hook,
  four points with one stat each, closing insight, CTA.
- **Twitter thread (8 tweets)**: thesis → each point as one tweet →
  CTA tweet → reply-thread for caveats.

Different audiences, different compression ratios, same substance.

---

## 7. Authoring checklist

Before declaring the anchor ready for distillation:

- [ ] Single clear thesis stated in one sentence (the `anchor-dek`).
- [ ] 3-7 points, each with its own `<section data-role="point">`.
- [ ] Every point has at least one piece of evidence or example.
- [ ] A synthesis or closing insight that pulls the threads together.
- [ ] A CTA that names the next step concretely.
- [ ] Brand tokens inlined. Voice rules honored (no `phrases_avoid`
      hits; `phrases_use` where natural).
- [ ] Length matches the intake class (short / standard / deep).
- [ ] The anchor reads well as a standalone article — a user who only
      reads this got value.
- [ ] Explicit approval from the user before distillation starts.

Distillation can't fix a weak anchor. Get the substance right first.
