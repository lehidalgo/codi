# Content Methodology

How to create content with Content Factory: principles, not a pipeline.

You are a senior content strategist and designer. The skill gives you
tools (server APIs, brand tokens, validators) and quality gates (brand
voice, design rules, validator thresholds). It does not hand you a
script. Read this file before any non-trivial content request, then
apply the principles with judgment.

---

## 1. The core insight

**Content is information; format is presentation.** The substance of what
the user wants to say — the thesis, the argument, the evidence, the
call-to-action — lives in one long-form piece called the **anchor**.
Every visual format (slide deck, social carousel, document, single-card
post, story, thread) is a specialized view of that anchor, produced by
compressing it with intent for a specific platform and audience.

The anchor is shippable on its own as a blog post or article. The first
thing you write is already valuable.

### Why anchor-first

1. **Consistency across formats.** A blog post plus a deck plus a
   LinkedIn carousel about the same topic share identical thesis, point
   set, and CTA. Users who read the blog and then see the deck feel like
   they're hearing one voice, not three.
2. **Prose-first quality.** You reason best in long-form natural
   language. Build the argument as prose first — compress into visuals
   second, with explicit constraints. Bullets written from a flowing
   draft are tighter than bullets written from scratch.
3. **Revision economy.** The user edits the idea once, in the anchor.
   Derived formats are re-distilled on demand rather than rewritten
   independently. Ten files stay aligned because nine are derived from
   one.
4. **Separation of concerns.** Substance (anchor), presentation (format
   variant), layout (validator) each have one authoritative home. When
   something is wrong, you know where to fix it.

Users who ask for a blog, a deck, and a carousel about the same topic
get three artifacts that tell the same story. Users who ask for a single
deck benefit from the prose-first discipline. Users who ask for a quick
tweet skip the flow entirely (see §5 on fast-path).

---

## 2. What great content looks like

Before worrying about format, know what you're aiming for.

- **A single clear thesis.** One sentence the whole piece defends. If
  the user can't articulate it, ask. If they articulate a platitude,
  push them toward something sharper. Content without a thesis is noise.
- **An argument that earns the read.** Each section does work toward
  the thesis. Sections that add nothing get cut, not kept for balance.
- **Evidence, not decoration.** Numbers, quotes, examples that support
  the argument. Decorative screenshots and stock photos pad the word
  count without moving the reader.
- **A CTA that names the next step.** "Learn more" is not a CTA.
  "Install the CLI with `npm i -g codi-cli`" is. The reader should know
  exactly what to do when they finish.
- **Voice consistent with the brand.** Voice rules from the active
  brand's `tokens.json` apply to every word you write. Phrases to use,
  phrases to avoid — honored across the anchor and every variant.

These apply whether you're writing a ten-minute whitepaper or a
five-frame Instagram carousel. Compression changes the surface; the
standards don't.

---

## 3. When to use an anchor

Anchor-first is the default for anything beyond a trivial one-off.

### Anchor warranted

- The request involves substance the agent needs to construct (topic,
  argument, evidence) rather than just formatting.
- The user wants multiple formats about the same topic.
- The content will be iterated on (user will give feedback, revise,
  re-share).
- The content needs to be consistent with other recent content from the
  same user or brand.
- The user is uncertain what they want — an anchor gives them something
  to react to.

### Fast-path warranted

- The user explicitly signals a one-off ("quick", "just", "simple",
  "one-off", "real fast").
- The request is a single small artifact (one tweet, one Instagram
  story, one share card).
- The user provides full substance; the work is pure formatting.
- Time pressure signals — the user is in a hurry and the content is
  low-stakes.

When the signal is ambiguous, default to anchor-first but offer the
alternative:

> "I can draft a quick outline/article first so every format tells the
> same story, or skip straight to the [requested format]. Which?"

Ask this once, at the start. Don't re-prompt on every iteration.

---

## 4. The flow

A typical anchor-first session, at a high level:

1. **Read the request.** Classify intent (see `[[/references/intent-detection.md]]`).
   Decide anchor vs. fast-path. Infer the format set.
2. **Intake (optional, adaptive).** Ask the user only what you actually
   need — topic, audience, voice, points, CTA. Skip what's obvious from
   context. Persist answers to `brief.json` via `POST /api/brief`.
3. **Author the anchor.** Write one self-contained HTML article. Read
   `[[/references/anchor-authoring.md]]` for shape and semantic tagging. Iterate with
   the user until they approve.
4. **Distill each requested format.** For each variant, read
   `[[/references/distillation-principles.md]]` for the format's nature and compression
   philosophy. Make creative decisions. Write one HTML file per variant,
   tag it with the anchor revision it derives from.
5. **Validate.** Run the box-validator against every card. Apply
   brand-voice checks. Fix violations up to four iterations. Only ship
   once gates pass.
6. **Track revisions.** When the anchor changes, bump the revision via
   `POST /api/anchor/revise`. Variants become stale. Surface staleness
   to the user at the start of the next turn; let them choose what to
   re-distill.
7. **Export.** User clicks export buttons in the UI. Content Factory
   produces PNG/PDF/PPTX/DOCX/HTML per format.

Steps 3-6 loop until the user is satisfied. The agent drives the files;
the user drives feedback. Sequence and cadence are the agent's to
choose.

---

## 5. Fast-path

Some requests don't justify the full flow. When the user signals a
one-off, skip anchor authoring entirely.

- Create the project as usual (`POST /api/create-project`).
- Write a single HTML file in `contentDir/` of the requested type.
- Validate, report, done.

No `brief.json`, no anchor file, no revision tracking. Same behavior as
before anchor-first existed. If the user iterates and the request grows
(adds formats, expands scope), you can retroactively promote to
anchor-first by writing an anchor that captures what's in the
fast-path file. But don't do this preemptively.

---

## 6. Iteration and revisions

### Two kinds of edits

- **Anchor edit** — the user asks you to change substance (thesis,
  points, evidence, CTA, voice). You rewrite the anchor and call
  `POST /api/anchor/revise` to bump its revision counter. The server
  marks every derived variant as stale.
- **Variant edit** — the user asks you to change something
  format-specific (a slide's layout, a card's imagery, a frame's copy
  length for a platform). You edit only that variant file. The anchor
  stays untouched.

The distinction is judgment. If the user says "this slide's headline
is too long", that's a variant edit. If they say "the core argument is
wrong", that's an anchor edit.

### Staleness

At the start of every iteration turn, check staleness:

```bash
curl -s <url>/api/distill-status
```

If any variants are stale, surface it:

> "The anchor has changed since these were distilled — re-distill which?
> (all / [named files] / skip)"

Never auto-propagate. The user decides. Staleness is informational, not
enforcing; users who want to edit a stale variant directly can.

### What "non-trivial" means for the anchor

You decide whether an edit is substantive enough to bump the revision.
Cosmetic edits (typography, logo placement, section reordering without
content change) might not warrant a bump. Content changes (new point,
removed evidence, changed CTA, new thesis) do. When in doubt, bump —
the cost of a spurious staleness flag is lower than the cost of a
silent drift between anchor and variants.

---

## 7. Quality gates

Four non-negotiables wrap everything you ship:

1. **Brand tokens inlined** in every HTML file (`tokens.css` verbatim
   in a `<style>` block). No `<link>` to external CSS.
2. **Voice rules honored** — no `voice.phrases_avoid` entries appear in
   generated copy. Use `voice.phrases_use` phrases where natural.
3. **Design-system rules** in `references/design-system.md` applied
   per-card (the 13 rules). Read them, hold them as a checklist.
4. **Box-validator score** meets the session's threshold
   (default 0.85) for every card, slide, or page.

Don't ship content that fails these gates. Iterate until they pass.
Report final scores to the user when you present.

See `references/brand-integration.md` for how to apply brand tokens and
`references/design-system.md` for the 13 design rules.

---

## 8. What the skill provides

You have access to:

- **Server APIs** — project creation, active state, brief persistence,
  revision tracking, style persistence, exports. See the Server API
  table in SKILL.md.
- **Brand tokens** — colors, fonts, assets, voice rules. See
  `[[/references/brand-integration.md]]`.
- **Design system** — the 13 rules. See `[[/references/design-system.md]]`.
- **Box-validator** — layout quality check. See SKILL.md Step 3b.
- **Slide-deck engine** — the single-file slide structural contract.
  See `[[/references/slide-deck-engine.md]]` when distilling to decks.
- **Format principles** — what makes each format excel or fail. See
  `[[/references/distillation-principles.md]]`.
- **Intent detection signals** — how to read user requests. See
  `[[/references/intent-detection.md]]`.

You do not have a script, a fixed questionnaire, a role taxonomy, or a
file-naming policy. You have principles, tools, and gates. Make
judgment calls. When you make a surprising one, say so in your
iteration report: "I merged points 2 and 3 into one slide because they
share evidence — say if you'd rather split them."

---

## 9. What this methodology is not

- **Not a pipeline.** Two agents reading the same references produce
  distinct, both-valid outputs. Style varies; substance and gates do
  not.
- **Not a questionnaire.** You ask what you need to ask. The intake in
  §4 is a set of topics that matter, not a list of required questions.
- **Not a schema enforcer.** The `brief.json` persists whatever you
  write; no server rejection of unknown fields. Add metadata when it
  helps you; skip it when it doesn't.
- **Not a taxonomy.** The semantic tags you add to anchor sections are
  the agent's convention for this piece, not a closed ontology.
- **Not a replacement for fast-path.** Trivial requests still flow
  straight through. Anchor-first is the default for non-trivial work,
  not an obligation.

The methodology trusts the agent's judgment. Use it.
