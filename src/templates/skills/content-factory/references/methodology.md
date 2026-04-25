# Content Methodology

> **Read `[[/references/operating-system.md]]` first.** That document is
> the Content Factory operating system — the six-phase validation-first
> workflow (Discovery → Master Document → Validation → Planning →
> Validation → Generation) and the interaction rules you operate under.
> This file is the detailed HOW behind those six phases. Treat the OS
> document as the contract with the user; treat this file as the
> implementation spec for satisfying that contract.

How to create content with Content Factory: principles, not a pipeline.

You are a senior content strategist and designer. The skill gives you
tools (server APIs, brand tokens, validators) and quality gates (brand
voice, design rules, validator thresholds). It does not hand you a
script. Read this file before any non-trivial content request, then
apply the principles with judgment — always inside the six-phase
gated workflow defined in the operating system.

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

## 3. Who chooses the workflow path

**The user chooses. Always.** Anchor-first (the full six-phase workflow) is
the default, but the agent never selects it — or its fast-path exception —
unilaterally. At the start of every new content request, present the Step 1
workflow-choice prompt (see SKILL.md Step 1c) and let the user pick A
(default), B (fast-path), or C (delegate the pick back to the agent, with
confirmation before proceeding).

The lists below are **signals you surface during that conversation** to help
the user pick, or — if the user selected C — to justify the pick you
report back for confirmation. They are never criteria the agent applies
alone.

### Signals that point at anchor-first (likely user pick: A)

- The request involves substance the agent needs to construct (topic,
  argument, evidence) rather than just formatting.
- The user wants multiple formats about the same topic.
- The content will be iterated on (user will give feedback, revise,
  re-share).
- The content needs to be consistent with other recent content from the
  same user or brand.
- The user is uncertain what they want — an anchor gives them something
  to react to.

### Signals that point at fast-path (likely user pick: B)

- The user explicitly signals a one-off ("quick", "just", "simple",
  "one-off", "real fast").
- The request is a single small artifact (one tweet, one Instagram
  story, one share card).
- The user provides full substance; the work is pure formatting.
- Time pressure signals — the user is in a hurry and the content is
  low-stakes.

Ambiguous signals are normal. Present the workflow-choice prompt anyway;
never pick silently. The prompt runs once at the start of a request — don't
re-prompt on every iteration unless the user explicitly expands scope
("actually, let's also make a deck").

---

## 4. The flow

A typical anchor-first session, at a high level:

1. **Read the request.** Classify intent (see `[[/references/intent-detection.md]]`).
   Decide anchor vs. fast-path. Infer the format set.

2. **Campaign intake — always ask which platforms.** For any anchor-first
   request, present the platform checklist to the user before authoring
   anything. Ask explicitly:

   > "Which platforms should I distill this into? Pick any of: LinkedIn
   > (carousel, post), Instagram (feed, story, reel cover), Facebook
   > (post, story, reel), TikTok (cover), X/Twitter (card/thread), blog
   > (long-form post), slide deck. Say 'all' to generate every variant."

   Persist the answer to `brief.json`:

   ```json
   {
     "topic": "...",
     "platforms": ["linkedin/carousel", "instagram/feed", "x/card"],
     "length_class": "standard",
     "audience": "engineering leaders",
     "voice": "technical, candid"
   }
   ```

   Also ask: topic, audience, voice, CTA, anchor `length_class` (default
   `standard`). Skip what's obvious from context. Full per-platform
   playbooks live in `[[/references/platforms/]]` — read the ones you
   intend to distill before authoring.

3. **Project type at creation — always `document` for anchor-first.**
   When you call `POST /api/create-project` to host an anchor, pass
   `type: 'document'`. The anchor is always a Markdown document
   (`00-anchor.md`) at `content/` root. Social, slides, blog, and other
   platform variants distilled later live as separate HTML files under
   platform subfolders (`content/linkedin/`, `content/instagram/`,
   `content/facebook/`, `content/tiktok/`, `content/x/`, `content/blog/`,
   `content/deck/`). The preview header derives each file's type and
   canvas from its own card class at render time.

4. **Author the anchor in Markdown.** Write `content/00-anchor.md`. The
   anchor is Markdown — not HTML. Read `[[/references/anchor-authoring.md]]`
   for the frontmatter contract, length classes, and structural rules.
   Iterate with the user until approved. Call `POST /api/anchor/approve`
   when done.

5. **Plan each requested variant in Markdown.** For every platform the
   user selected in step 2, write a **plan file** — plain Markdown, not
   HTML — that describes what the variant will be. No rendered cards, no
   inline CSS, no `<article>` elements. Just prose explaining every
   slide / frame / section, copy draft, visual direction, CTA.

   | Platform selection | Plan file (Markdown) |
   |--------------------|----------------------|
   | LinkedIn carousel | `content/linkedin/carousel.md` |
   | LinkedIn post | `content/linkedin/post.md` |
   | Instagram feed | `content/instagram/feed.md` |
   | Instagram story | `content/instagram/story.md` |
   | Instagram reel cover | `content/instagram/reel-cover.md` |
   | Facebook post | `content/facebook/post.md` |
   | Facebook story | `content/facebook/story.md` |
   | Facebook reel | `content/facebook/reel.md` |
   | TikTok cover | `content/tiktok/cover.md` |
   | X/Twitter card | `content/x/card.md` |
   | Blog post | `content/blog/post.md` |
   | Slide deck | `content/deck/slides.md` |

   Read `[[/references/plan-authoring.md]]` for the plan contract (shared
   frontmatter, slide-by-slide structure, copy drafts, hashtag/CTA blocks,
   visual direction). Each per-platform playbook in
   `[[/references/platforms/]]` specifies what a plan must cover for
   that platform.

   **The plan is the checkpoint.** Present each plan to the user, iterate
   on prose / hooks / slide order / CTA. The user has to approve the plan
   before anything visual is rendered. One plan = one approval.

6. **HARD GATE — wait for user approval of each plan.**

   > DO NOT write `.html` for a variant until the user explicitly approves
   > the `.md` plan for that variant. "Approval" means the user says yes,
   > ok, approved, render it, go ahead, or equivalent — not silence,
   > not "looks good so far", not a partial edit. If the user edits the
   > plan, that is continued iteration, not approval. Ask again before
   > rendering.

   Skip this gate and you waste the user's review budget on HTML that
   might not reflect what they wanted. The plan is cheap to iterate; the
   HTML is expensive.

7. **Render HTML from approved plans only.** Once the user has approved
   a plan, generate the matching `.html` file in the SAME folder,
   replacing the `.md` extension:

   | Plan file | Rendered HTML (only after approval) |
   |-----------|--------------------------------------|
   | `content/linkedin/carousel.md` | `content/linkedin/carousel.html` |
   | `content/instagram/feed.md` | `content/instagram/feed.html` |
   | …and so on for every platform | |

   Tag each rendered variant with
   `<meta name="codi:variant" content='{"derivedFromRevision":N,"sourceAnchor":"00-anchor.md","planSource":"<platform>/<name>.md","platform":"..."}'>`.

   **Card class contract.** The HTML card wrapper class MUST match the
   `type` declared in the variant's `codi:template` meta: `type:"social"`
   → `<article class="social-card">`, `type:"slides"` → `<article
   class="slide">`, `type:"document"` → `<article class="doc-page">`.
   See the "Card class contract" table at the top of
   `[[/references/platform-rules.md]]`.

   If the user later edits the `.md` plan, mark the matching `.html` as
   stale and ask before re-rendering.

8. **Validate.** Run the box-validator against every card in each
   rendered `.html`. Apply brand-voice checks. Fix violations up to four
   iterations. Only ship once gates pass.

9. **Track revisions.** When the anchor changes, bump the revision via
   `POST /api/anchor/revise`. Plans AND rendered variants both become
   stale. Surface staleness to the user at the start of the next turn;
   let them choose what to re-plan and re-render.

10. **Export.** User clicks export buttons in the UI. Content Factory
   produces PNG/PDF/PPTX/DOCX/HTML per format.

Steps 3-6 loop until the user is satisfied. The agent drives the files;
the user drives feedback. Sequence and cadence are the agent's to
choose.

---

## 5. Fast-path

Fast-path is the single authorized exception to the full six-phase workflow.
It runs **only when the user has explicitly selected option B** in the
Step 1 workflow-choice prompt (or option C resolved to B with user
confirmation). The agent never picks fast-path on its own, even when intent
signals look strongly one-off — signals inform the conversation, the user
makes the call.

Once the user has authorized fast-path:

- Create the project as usual (`POST /api/create-project`).
- Write a single HTML file in `contentDir/` of the requested type.
- Validate, report, done.

No `brief.json`, no anchor file, no revision tracking. Same behavior as
before anchor-first existed. If the user iterates and the request grows
(adds formats, expands scope), re-present the workflow-choice prompt and
let the user decide whether to promote to anchor-first. Don't auto-promote
and don't auto-stay on fast-path.

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
3. **Design-system rules** in `[[/references/design-system.md]]` applied
   per-card (the 13 rules). Read them, hold them as a checklist.
4. **Box-validator score** meets the session threshold for every card,
   slide, or page. Defaults: slides and documents strict at ≥ 0.9;
   social cards lenient at ≥ 0.8. Override per session or globally via
   `PATCH /api/validation-config`.

Don't ship content that fails these gates. Iterate until they pass.
Report final scores to the user when you present.

See `[[/references/brand-integration.md]]` for how to apply brand tokens and
`[[/references/design-system.md]]` for the 13 design rules.

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
