# Distillation Principles

How to compress an anchor into a specific visual format. Creative
compression, not schema transformation. Two agents distilling the same
anchor into the same format should produce distinct but both-valid
outputs — same substance, different interpretation. Like two designers
handed the same brief.

Read this alongside `methodology.md` (why anchor-first),
`anchor-authoring.md` (what the source looks like), and the
format-specific references (`slide-deck-engine.md` for decks,
`visual-density.md` for visual quality, `docx-export.md` for document
export).

---

## 1. What compression with intent means

Distillation is not "map anchor section X to slot Y, anchor section Z
to slot W". It's a series of creative decisions about what to keep,
what to fold, what to cut, and what to visualize.

Every decision is guided by three questions:

1. **What does this platform reward?** Each format rewards different
   things — swipe rate, dwell time, screenshot-ability, reading speed,
   search ranking, comprehension depth. Write for what the platform
   rewards.
2. **What does this audience already know?** Compress less for novice
   audiences; compress more for expert audiences. Evidence is
   lightweight for an audience that trusts you; evidence is heavy when
   you're earning trust.
3. **Where does the brand sit on this platform?** A playful brand
   leans into a platform's energy; a formal brand pushes back against
   it. Voice is constant; register adapts.

The anchor's thesis and CTA always make it through. Everything else is
on the table.

---

## 2. Core compression moves

Five techniques you combine for any target format:

### 2.1 Keep

A section survives intact, often with tightened prose. Use when the
section is load-bearing and the target format has room for it.

### 2.2 Fold

Two or more sections merge into one. Use when two anchor sections
share evidence, share a visual treatment, or overlap in the target
format's slot structure. Fold `point` + `evidence` into one slide
when the evidence is the argument's best punch.

### 2.3 Cut

A section disappears. Use when the target format can't fit it, when
the section was a supporting aside, or when compression for this
audience doesn't need it. Cutting is honest. Keeping everything and
shrinking type size is dishonest — the result is unreadable.

### 2.4 Visualize

A section becomes a figure — a chart, a code block, a diagram, a
stat card — rather than prose. Use when the point lands harder as an
image. Numbers almost always visualize better than their sentences.

### 2.5 Invent

The target format has a slot the anchor doesn't carry — a hero image,
a cover slide with a hook, a closing share-prompt. You invent content
that fits the anchor's spirit without inventing substance not in the
source.

Use moves in combination. A typical compression: keep the thesis,
visualize the hero metric, fold two related points, cut the caveats
section, invent a CTA slot that works for this platform.

---

## 3. Platform norms

What each common format rewards, punishes, and typically contains.
These are backgrounds the agent uses, not mechanical recipes.

### 3.1 Slide deck (16:9, 1280×720)

**What it rewards.** A clear argument that moves forward. Visual
rhythm between slides. Room for breathing — one idea per slide, not
five.

**What it punishes.** Wall-of-text slides. Inconsistent type scale
between slides. Bullet lists longer than 5 items. Cover slides with no
thesis.

**Typical compression.** 5-7 slides for a short anchor, 8-12 for
standard, 15-20 for deep. Cover with thesis → one slide per point →
metrics or quote slides for evidence → closing slide with CTA. Speaker
notes aren't shown in the preview but can carry the detail that got
cut.

**Format-specific references.** Structural contract in
`slide-deck-engine.md`. Design rules in `design-system.md`. Per-slide
verification in both.

### 3.2 LinkedIn carousel (4:5, 1080×1350)

**What it rewards.** A contrarian hook on frame 1. Serial
argumentation that pulls the viewer through. Visual density — the
carousel is viewed at thumbnail size in a feed before it earns a
full-screen swipe.

**What it punishes.** A warm-up frame 1 (kills swipe rate). Frames
that could have been combined. Low contrast between frame elements.
More than 3 font sizes across the carousel.

**Typical compression.** 6-10 frames. Frame 1 is the hook — a
contrarian claim, a surprising stat, a crisp one-liner. Middle
frames advance the argument one step each. Last frame is the CTA and
a share prompt.

**Copy ceilings.** Headline ≤ 60 chars. Subhead ≤ 120 chars. Body ≤
180 chars. At most 1 emoji per frame. No hashtags in-frame (hashtags
go in the post copy around the carousel).

### 3.3 Instagram feed (1:1, 1080×1080)

**What it rewards.** Single-image visual punch. Branded recognition
(the third time someone sees your feed, they should know it's you).
A clear hook if the post is a carousel.

**What it punishes.** Text-heavy designs. Off-brand colors.
Cropping that clips chrome when Instagram re-renders.

**Typical compression.** Single card or 6-10 card carousel. Copy
density lower than LinkedIn. Image-forward treatments. Caption
carries longer prose; the image carries the hook.

### 3.4 Instagram story (9:16, 1080×1920)

**What it rewards.** Full-bleed visuals. One idea per story frame.
Stickers and interactive elements (polls, quizzes).

**What it punishes.** Text on the bottom 20% (covered by reply UI).
Small type (users view from hand-held distance, mobile screens).
Multiple stats on one story.

**Typical compression.** 3-7 stories, each carrying one beat of the
anchor. First story is the hook; last story is the CTA (swipe-up or
link-sticker). Carry only the thesis and the most striking evidence.

### 3.5 TikTok cover (9:16, 1080×1920)

**What it rewards.** A hook that works without audio. Text-on-image
that works at feed-scroll speed. Strong brand recognition at small
size.

**What it punishes.** Text-heavy covers. Branding that reads as
boring corporate in a platform that rewards energy.

**Typical compression.** A cover image only (the video content is
separate). Carry the thesis as a question or a contrarian claim.
Often a single frame; sometimes a 2-3 frame title sequence.

### 3.6 Twitter / X thread or card

**What it rewards.** One tweet = one punch. Threads that build
momentum. Quote-tweetable lines (the "ratio-proof" sentences that work
out of context).

**What it punishes.** Tweets that don't stand alone. Threads that
lose steam midway. Screenshots of prose (except when the screenshot IS
the point).

**Typical compression.** 5-10 tweets for a short anchor, more for
deeper pieces. First tweet carries the thesis or hook. Each subsequent
tweet advances one point. Final tweet is the CTA. Reply-thread for
caveats, references, corrections.

Alternative: a single tweet with a quote-image card (1200×675) that
carries the thesis visually.

### 3.7 A4 document (794×1123, multi-page)

**What it rewards.** Professional polish. Charts, tables, citations.
Print-readiness (the reader may print it or view as PDF).

**What it punishes.** Overflow at page boundaries. Inconsistent
headers/footers across pages. Decorative chrome that hides content.

**Typical compression.** The anchor often IS the document, or nearly
so. Add a cover page, a TOC for longer documents, page numbers,
header/footer chrome per brand. Map anchor sections to
`<article class="doc-page">` elements — one page per section, or
multiple sections per page when they're short.

**Format-specific references.** `docx-export.md` for DOCX mapping.
`html-clipping.md` for multi-page boundaries.

### 3.8 Blog post (HTML article)

**What it rewards.** Readable typography. Scannable structure
(headers, lists, pull quotes). SEO-friendly metadata. Share-friendly
hero image.

**What it punishes.** Long unbroken paragraphs. Missing meta
description. Slow-loading hero images. Stock-photo padding.

**Typical compression.** Minimal. The blog post often IS the anchor
with a hero image and SEO polish added. For longer anchors, may
split into a short landing article with a "read the full piece"
link to the whitepaper.

---

## 4. How brand affects distillation

The brand's voice and visual density rules carry into every variant.

- **Playful brands** lean into the platform's native tone. A playful
  brand's LinkedIn carousel can be more casual than a formal brand's.
- **Formal brands** push back against platform tone. A formal brand's
  Instagram post still reads formal, even if the platform rewards
  casual.
- **Technical brands** tolerate density. A technical audience reads a
  dense deck and is fine. A general audience wants airier compression.
- **Opinionated brands** pick fights. The hook frame or slide 1 is
  more contrarian than for brands that prefer consensus.

Voice rules (`phrases_use`, `phrases_avoid`) apply identically across
every variant. Compression changes the surface; the voice does not.

---

## 5. How audience affects distillation

Same anchor, different audience, different compression:

- **Executive audience.** High signal-to-noise. Hero metrics. One-line
  thesis. 5-slide deck, not 15. Short carousel. No deep evidence —
  they'll ask if they want more.
- **Technical audience.** Tolerates density. Will read code blocks,
  architecture diagrams, specific numbers. Deeper deck, richer
  carousel, fuller document. Trust is earned through detail.
- **General audience.** Needs the most airiness. Concrete examples
  beat abstract claims. Evidence is simple and immediate (a single
  stat, a relatable quote).
- **Internal audience.** Context can be implicit. Voice is more
  candid. Jargon is fine.
- **External audience.** Context has to be explicit. Voice is more
  measured. Jargon gets defined.

If the brief doesn't specify audience, the agent picks one (usually
the likely default for the format — executive for pitch decks,
technical for engineering blog posts, general for consumer social
posts) and mentions the choice in the iteration report.

---

## 6. Preserving the thesis

Every variant's opening element restates the anchor's thesis in the
format's native vocabulary. This is non-negotiable.

- **Deck.** Title slide carries the thesis (maybe as a subtitle or
  eyebrow, maybe as the h1 itself).
- **LinkedIn carousel.** Frame 1 carries the thesis as a contrarian
  hook or one-liner claim.
- **Instagram feed single card.** The card IS the thesis with a visual
  treatment.
- **Instagram story.** First story frame has the thesis as the hook.
- **TikTok cover.** The cover carries the thesis as a question or
  claim.
- **Twitter thread.** Tweet 1 is the thesis. Often verbatim from the
  anchor's `anchor-dek`.
- **A4 document.** Title page + executive summary carry the thesis.
- **Blog post.** The `<h1>` + dek carry the thesis.

If a variant's opening doesn't land the thesis within two seconds of
attention, rework it. The reader may never see anything else.

---

## 7. Preserving the CTA

Every variant ends with a CTA that maps to the anchor's CTA in a
format-appropriate way.

- **Deck.** Closing slide with the CTA.
- **LinkedIn carousel.** Last frame is the CTA + handle.
- **Instagram story.** Last story has the CTA (swipe-up sticker, link
  sticker, "DM me", etc.).
- **Twitter thread.** Last tweet is the CTA.
- **A4 document.** Closing section + appendix with contact info.
- **Blog post.** Closing section + explicit next step (subscribe,
  install, share).

A variant without a CTA is an unfinished variant. Always end with a
concrete next step.

---

## 8. Handling format-specific slots

Some formats have slots the anchor doesn't carry. You either invent
content that fits, or skip the slot.

- **Hero image or cover visual.** Anchor carries text; the visual
  format wants a visual hook. Invent per the brand — gradient fill,
  typographic treatment, decorative shape, or a figure drawn from the
  anchor's strongest evidence.
- **Opening hook for serial formats.** LinkedIn carousel frame 1 and
  Twitter thread tweet 1 want a contrarian or surprising opener. If
  the anchor opens warm, rework the opener for the variant — the
  anchor stays warm, the variant hooks hard.
- **Animated moments.** Slide decks reward entry animations on each
  slide. The anchor has none. Invent per the motion principles in
  `slide-deck-engine.md`.
- **Platform-native chrome.** Handle, slide counter, logo, progress
  indicator. Invent per the format's native conventions.
- **Share prompts.** "Swipe to comment," "DM me," "Retweet if useful"
  — social formats want explicit interaction prompts. Invent.

Never invent substance the anchor doesn't carry. Hero images, hooks,
and chrome are formatting; new claims are not.

---

## 9. Validating a distilled variant

Four gates apply to every variant:

1. **Thesis preserved.** Variant's opening element restates the
   anchor's thesis.
2. **CTA preserved.** Variant ends with a concrete next step that
   maps to the anchor's CTA.
3. **Voice rules honored.** No `phrases_avoid` hits. `phrases_use`
   where natural.
4. **Box-validator score.** ≥ 0.85 on every card/slide/frame/page at
   the target canvas size.

Grep the variant for `phrases_avoid` as a fast check before running
the validator. Cheap and catches most voice violations.

---

## 10. Iteration reports

When you distill, tell the user what you chose. Especially when you
folded, cut, or invented — those are decisions they might want to
revisit.

Examples:

> "Distilled 50-deck.html · 8 slides · validator 0.91. I folded points
> 2 and 3 into one slide because they share the same evidence — say if
> you'd rather split them. The closing CTA is a direct quote from the
> anchor's `cta` section."

> "Distilled 10-linkedin.html · 7 frames · validator 0.89. Frame 1 is
> a contrarian version of the anchor's hook ("most teams do X, but…")
> because LinkedIn rewards a sharper opener than the anchor's warmer
> tone. The anchor's caveat section didn't make it — say if you want
> it in."

This gives the user a clear review surface. They either accept the
choices or ask for a different compression.

---

## 11. What this reference is not

- **Not a mapping table** from anchor role to format slot. You decide
  per piece.
- **Not a recipe.** Platform norms are backgrounds. Compression moves
  are tools. You combine them for the specific anchor in front of you.
- **Not exhaustive.** Formats not listed here (email, ads, podcast
  show notes, video scripts) get the same treatment — pick the
  platform norms that matter, apply the compression moves, validate.

Two agents distilling the same anchor to the same format produce
distinct, both-valid outputs. That's correct. Style varies; substance
and gates do not.
