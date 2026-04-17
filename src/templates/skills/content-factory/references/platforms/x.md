# X / Twitter — Platform Playbook

One variant lives under `content/x/`:

| Plan (Markdown) | Rendered HTML | Format | Canvas | Card wrapper |
|-----------------|---------------|--------|--------|--------------|
| `card.md` | `card.html` | Tweet card image | 1200×630 (OG) | `<article class="social-card">` |

**Plan-first pipeline.** Author the `.md` plan first (include BOTH the
single-tweet draft AND the thread draft — users often can't decide
which they want until they see both). Iterate, get explicit approval,
then render `card.html`. See `[[/references/plan-authoring.md]]`.

---

## card.html — Twitter/X card

**Audience mode:** Tech-literate, quip-friendly, context-dependent.

### Structure

Single card. Designed for the `twitter:card` image that renders inline
in a tweet and on link previews.

| Region | Content |
|--------|---------|
| Top half | The anchor's thesis or headline, 8–15 words, high contrast |
| Bottom half | One supporting fact + brand mark + handle |

### Format specifics

- 1200×630 (same as OG banner) is the canonical tweet card dimension
- Must be legible at 506×254 (the compressed inline size in feed)
- Maximum 2 type scales
- No hashtags on the image; they go in the tweet text

### Tweet copy (the text that goes alongside)

Produce two variants: a **single tweet** and a **thread**.

**Single tweet:**
- 1 tweet, ≤260 characters (leaves room for a URL + user-level retweet comment)
- Structure: hook sentence → one punchy supporting line → link to anchor
- No hashtags in single tweets — they reduce engagement on X

**Thread:**
- 5–9 tweets total
- Tweet 01: hook + "🧵 on [topic]" or similar thread marker
- Tweets 02–N−1: one point per tweet, each a self-contained thought
- Final tweet: synthesis + link + one-line CTA
- Threads can carry 1–2 hashtags on the final tweet only

### Distillation recipe

Single tweet: anchor.hook + anchor.cta compressed to ≤260 chars.
Thread: one tweet per anchor H2, preserving imperative phrasing. The
synthesis tweet mirrors `## What this means` in the anchor.
