# Platform Distillation Rules

> **Read `[[/references/distillation-principles.md]]` first.** That reference
> is the source of truth for the compression philosophy — it explicitly
> states these are principles, not a recipe. This file is a **convenience
> appendix**: one possible concrete recipe per platform. Treat every rule
> below as a starting point, not a contract. Two agents can distill the
> same anchor to the same platform and produce distinct, both-valid
> outputs. File names, slot counts, and hashtag patterns are conventions —
> not structural requirements enforced by the app or validator.

How to adapt an approved anchor (blog, docs, or deck) into platform-specific
variants. Each section defines suggested hook, length, format, density,
hashtag, and CTA patterns for one platform.

**Universal distillation principles:**

1. **Compress, do not rewrite.** Extract key points from the anchor verbatim
   when possible. Rephrase only to fit the platform's idiom (tone, length, hook).
2. **Lead with the payoff.** Every variant must open with the single most
   valuable takeaway from the anchor — not a setup, not a question, not context.
3. **One CTA per variant.** Platform norms differ, but every variant ends with
   exactly one call to action. Do not stack CTAs.
4. **Preserve key numbers.** Statistics, quotes, and specific figures from the
   anchor must appear verbatim — these are what people remember and share.
5. **Apply visual density rules.** See `[[/references/visual-density.md]]` — every card must
   occupy ≥85% of its canvas regardless of platform.
6. **Run through humanizer.** If the `humanizer` skill is installed, pass every
   variant through it before saving. Social platforms punish AI-sounding copy.

---

## LinkedIn carousel

**File:** `10-linkedin-carousel.html`
**Meta:** `{"id":"linkedin-carousel","name":"<topic> — LinkedIn Carousel","type":"social","format":{"w":1080,"h":1350}}`
**Format:** 4:5 (1080×1350)
**Slides:** 6-10 cards (cover + 4-8 content + CTA)
**Audience mode:** Professional, credentialed, skimmable

**Structure:**
- **Slide 01 — cover:** Hook headline (≤60 chars) + eyebrow (topic/category) +
  "swipe" indicator in the corner. No body copy.
- **Slide 02 — context:** One sentence framing the problem. Large type, minimal
  supporting elements. This is the only "setup" slide allowed.
- **Slides 03-08 — key points:** One takeaway per slide. Each slide gets a
  numbered indicator (e.g. "01 / 06"), a short header (≤40 chars), and 2-4
  lines of body copy OR a stat + caption.
- **Penultimate slide — synthesis:** "Here's what this means for you" — one
  actionable takeaway.
- **Final slide — CTA:** Author photo/logo + name + handle + one-line CTA
  (e.g. "Read the full breakdown → codi.dev/docs"). No hashtags on slides.

**Hook rules:**
- Cover hook must be ≤60 characters and promise a specific benefit
- Do not start with a question ("Ever wondered…?" is banned)
- Do not use "In this post" or "Today I want to share"

**Hashtags:**
- 3-5 hashtags, placed in the LinkedIn post caption **outside** the carousel,
  not on the slides themselves. List them at the bottom of the generated HTML
  as a `<meta name="codi:caption">` block for the user to copy.

**CTA placement:** Final slide only. Must reference the anchor (blog/docs URL).

**Density checks:**
- Every slide needs the page number indicator ("01 / 06") in a corner
- Every slide needs the author/brand mark in the opposite corner
- Never leave more than ~15% of the canvas empty

---

## LinkedIn single post (image card)

**File:** `11-linkedin-post.html`
**Meta:** `{"id":"linkedin-post","name":"<topic> — LinkedIn Post","type":"social","format":{"w":1080,"h":1080}}`
**Format:** 1:1 (1080×1080)
**Slides:** 1 card

**Structure:**
- Large headline (≤80 chars) pulling the strongest insight from the anchor
- Supporting stat or quote as a visual anchor (oversized number + caption)
- Brand mark + handle + CTA arrow in the bottom corners

**Use this variant** when the anchor is dense enough for a headline but the
user does not want a multi-slide carousel. It functions as a standalone
LinkedIn image post; the accompanying caption comes from the anchor's
introduction.

**Caption block** (for the user to copy into LinkedIn):
- 3-5 sentences paraphrasing the anchor's intro
- 3-5 hashtags
- Link to the anchor source (blog/docs)

Emit the caption as `<meta name="codi:caption" content="...">` so the agent can
also expose it through the app later.

---

## Instagram feed post

**File:** `20-instagram-feed.html`
**Meta:** `{"id":"instagram-feed","name":"<topic> — Instagram Feed","type":"social","format":{"w":1080,"h":1350}}`
**Format:** 4:5 (1080×1350)
**Slides:** 1-10 cards (carousel-eligible)

**Structure when 1 slide (single post):**
- Strong visual hook — either an oversized stat, a quote, or a bold headline
- Instagram feed posts live or die on visual weight — lean into decorative
  accents, bold color blocks, and oversized typography
- Handle in bottom corner; no URL (Instagram kills link-in-bio unless the user
  has it configured)

**Structure when 2-10 slides (carousel):**
- Cover slide with a hook that promises value ("3 things that cut our latency")
- Content slides follow the LinkedIn carousel structure but **more visual**:
  bigger type, more color, less body copy per slide, one idea per slide
- Final slide: "Save this post" or "Share with a friend" + handle

**Hook rules:**
- Instagram rewards specificity over cleverness
- Lead with numbers when possible ("We dropped p95 by 340ms")
- Avoid question hooks — they underperform on Instagram feeds

**Hashtags:**
- 8-15 hashtags in the caption (Instagram supports up to 30 but 8-15 is the
  current best-practice band)
- Mix of broad, medium, and niche tags
- Emit in `<meta name="codi:caption">` block

**CTA placement:** Bottom corner of final slide, short form. Link in bio.

---

## Instagram story

**File:** `21-instagram-story.html`
**Meta:** `{"id":"instagram-story","name":"<topic> — Instagram Story","type":"social","format":{"w":1080,"h":1920}}`
**Format:** 9:16 (1080×1920)
**Slides:** 3-5 cards

**Structure:**
- **Card 01 — hook:** Bold oversized hook, 3-6 words. Full-bleed background.
- **Card 02-04 — stat or point:** One big stat/quote per card. Oversized
  numerals. Minimal text.
- **Card 05 — CTA:** "Swipe up" / "Link in bio" / "DM me" — single action.

**Safe areas:**
- Top 250px of the 1920px canvas is reserved for Instagram's profile chrome
- Bottom 250px is reserved for reply/reaction UI
- Place all meaningful content between y=250 and y=1670
- Mark the safe area with CSS comments in the generated HTML so the agent
  remembers on re-edits

**Hook rules:**
- Stories are consumed in <3 seconds per card
- No paragraphs — only phrases and single sentences
- Use one dominant visual element per card (stat, quote, icon) — no lists

**Hashtags:** None on-card. Stories do not surface hashtags meaningfully.

**CTA:** One per story, on the final card.

---

## TikTok cover / static frame

**File:** `30-tiktok-cover.html`
**Meta:** `{"id":"tiktok-cover","name":"<topic> — TikTok Cover","type":"social","format":{"w":1080,"h":1920}}`
**Format:** 9:16 (1080×1920)
**Slides:** 1 card (TikTok cover frame only)

**Purpose:** Content Factory does not generate videos. It generates the static
cover frame the user will upload as the TikTok thumbnail, plus a scripted hook
for the video itself.

**Structure:**
- Oversized hook text (6-10 words max) as the dominant visual element
- Topic badge in the top-left
- "Watch until end" indicator in the bottom-right
- Full-bleed background — gradient, photo treatment, or bold color block

**Safe areas:**
- TikTok covers the bottom ~20% of the frame with UI overlays (username,
  caption, icons). Keep all text in the top 75% of the canvas.

**Script block** (for the video itself, emitted as `<meta name="codi:script">`):
- Hook (0-3s): one sentence the user says on camera
- Body (3-30s): 3-5 bullet points distilled from the anchor
- CTA (30-45s): "Link in bio" or "Comment [keyword] for the full breakdown"

**Hashtags:**
- 3-5 hashtags in `<meta name="codi:caption">`, mix of niche and broad
- Include one trending hashtag if the anchor topic fits

---

## Twitter/X card

**File:** `40-twitter-card.html`
**Meta:** `{"id":"twitter-card","name":"<topic> — Twitter/X Card","type":"social","format":{"w":1200,"h":630}}`
**Format:** OG (1200×630)
**Slides:** 1 card

**Structure:**
- Large headline (≤90 chars) — the sharpest sentence from the anchor
- Optional: one stat or quote as a visual anchor
- Brand mark + handle in one corner
- No CTA on the card — the CTA lives in the tweet text

**Thread block** (for the tweet text, emitted as `<meta name="codi:thread">`):
- Tweet 1: Hook (≤250 chars) + image (this card)
- Tweets 2-5: Key points from the anchor, one per tweet, ≤250 chars each
- Final tweet: Link to the anchor source

**Hashtags:** 1-2 only, in the final tweet. Twitter disfavors hashtag stuffing.

**CTA placement:** Final tweet of the thread — the card itself is a hook, not
a destination.

---

## Summary deck (optional)

**File:** `50-summary-deck.html`
**Meta:** `{"id":"summary-deck","name":"<topic> — Summary Deck","type":"slides","format":{"w":1280,"h":720}}`
**Format:** 16:9 (1280×720)
**Slides:** 5-8 cards

**Purpose:** A short-form slide deck for webinars, internal sharing, or
embedding in a blog post. Not the same as the `deck` **anchor** type — this is
a distilled summary of any anchor into slide form.

**Structure:**
- Cover: topic + author + date
- Slides 2-6: one key point per slide, title + 2-column body or title + chart
- Takeaway slide: "3 things to remember"
- CTA slide: link to anchor source + author contact

**Density:** Apply slides content rules from `[[/references/visual-density.md]]` — every slide
needs a title, body, footer strip (brand · page · date), and one decorative
accent.

**Hashtags/CTA:** Not applicable — this is an internal/embed deck.

---

## Reference meta block

Every generated variant file must include a `<meta name="codi:variant">` tag
linking it back to the brief. This lets the agent locate the variant's
provenance without reading `brief.json`:

```html
<meta name="codi:variant" content='{"platform":"linkedin-carousel","derivedFrom":"00-anchor-blog.html","derivedFromRevision":3}'>
```

Update `derivedFromRevision` whenever the variant is re-distilled. The agent
reads this tag on re-open to verify the variant is still in sync with the
anchor. Field names use camelCase (matches the server API and `brief.json`
schema).
