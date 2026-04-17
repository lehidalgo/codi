# Instagram — Platform Playbook

Three variants live under `content/instagram/`:

| Plan (Markdown) | Rendered HTML | Format | Canvas | Card wrapper |
|-----------------|---------------|--------|--------|--------------|
| `feed.md` | `feed.html` | Feed post (single or carousel) | 1080×1350 (4:5) | `<article class="social-card">` |
| `story.md` | `story.html` | Story | 1080×1920 (9:16) | `<article class="social-card">` |
| `reel-cover.md` | `reel-cover.html` | Reel cover frame | 1080×1920 (9:16) | `<article class="social-card">` |

**Plan-first pipeline.** Author the `.md` plan first, iterate with the
user, get explicit approval before rendering the matching `.html`.
See `[[/references/plan-authoring.md]]` for the shared plan contract.

---

## feed.html — Instagram feed

**Audience mode:** Visual-first, hook-forward, lifestyle-adjacent.

### Single post (1 card)

| Region | Content |
|--------|---------|
| Top ⅔ | Big type headline — the anchor's hook condensed to 6–10 words, visual emphasis on a verb |
| Bottom ⅓ | One supporting fact/number + brand mark + handle |

### Carousel (2–10 cards)

| Slide | Role | Content |
|-------|------|---------|
| 01 | Cover | Promise-laden hook ("3 things that cut our latency 60%") |
| 02–N−1 | Points | One idea per slide — more visual than LinkedIn: bigger type, more color, less body copy. Max 15 words body |
| N | CTA | "Save this post" or "Share with a friend" + handle + brand mark |

Feed captions:

- Hook in first line (before the "more" cutoff at ~125 chars)
- 3–5 paragraph breaks for scannability on mobile
- 8–15 hashtags in the first comment, not the caption (avoids visual clutter)
- One CTA max — link in bio only, no clickable link in caption

### Distillation differences vs LinkedIn

- Less body copy per card; more reliance on the headline carrying meaning
- No "swipe for fix" prompt — IG users already know the gesture
- Visual density still ≥85%, but lean toward 1 big element per card

---

## story.html — Instagram story

**Audience mode:** Ephemeral, conversational, single-idea.

### Structure

One card only. No carousel. If the anchor has multiple points, pick ONE
for the story.

| Region | Content |
|--------|---------|
| Top 20% | Brand mark + date + optional context tag |
| Middle 60% | The single idea — hook or key point, max 10 words of text |
| Bottom 20% | CTA with swipe-up arrow or "Link in bio" + handle |

### Rules specific to stories

- 9:16 canvas (full phone screen)
- Assume no sound, no autoplay of the next story
- If using a question sticker / poll / quiz, position it in the lower
  third so it doesn't collide with the top-bar UI
- Do not put critical copy in the top 15% (covered by username overlay)
  or bottom 15% (covered by reply bar)

---

## reel-cover.html — Reel cover frame

**Audience mode:** Grid-driven — the cover is what appears in the
profile grid and search results, not what plays during the video.

### Structure

Single card. Designed to stop the scroll in the profile grid.

| Region | Content |
|--------|---------|
| Top 30% | Short punchy phrase (2–5 words) — often a number or noun phrase |
| Middle 40% | One visual element or one bold statement |
| Bottom 30% | Reserve this zone — UI overlay crops it in the grid preview |

### Grid-safe zone

- Critical text lives in the middle vertical third only
- If your cover phrase would split across the bottom 30%, redesign it to fit the upper 70%
- Test in a 3-up grid mockup before shipping — if the cover doesn't read in a 300×400 thumbnail, it won't read on IG

### Typical pairing

A reel cover almost always pairs with a `feed.html` carousel (same
topic, same DNA). Generate both from the same anchor and share the
palette/type system.
