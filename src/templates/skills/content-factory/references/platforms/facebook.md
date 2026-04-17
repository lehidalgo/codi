# Facebook — Platform Playbook

Three variants live under `content/facebook/`:

| Plan (Markdown) | Rendered HTML | Format | Canvas | Card wrapper |
|-----------------|---------------|--------|--------|--------------|
| `post.md` | `post.html` | Feed post | 1200×630 (OG) or 1080×1080 | `<article class="social-card">` |
| `story.md` | `story.html` | Story | 1080×1920 (9:16) | `<article class="social-card">` |
| `reel.md` | `reel.html` | Reel cover | 1080×1920 (9:16) | `<article class="social-card">` |

**Plan-first pipeline.** Author the `.md` plan first, iterate with the
user, get explicit approval before rendering the matching `.html`.
See `[[/references/plan-authoring.md]]` for the shared plan contract.

---

## post.html — Facebook feed post

**Audience mode:** Broader, older, less tech-native than LinkedIn or X.
Slower scroll; more willing to read copy under the image.

### Structure

| Region | Content |
|--------|---------|
| Top ⅔ | Hook headline — 8–14 words, plain, declarative |
| Bottom ⅓ | One specific fact or number + brand mark + link-destination hint |

### Caption (pasted into FB post)

- ~150–250 words
- Paragraph breaks every 2–3 sentences
- 0–2 hashtags max (Facebook hashtags have minimal discovery value)
- Links in the caption body, not just at the end — FB doesn't truncate like LinkedIn

### Differences from LinkedIn post

- Less "insider jargon" — if the anchor uses role-specific terms,
  distillation substitutes plain-English equivalents for FB
- Emojis are acceptable (sparingly) where they'd feel forced on LinkedIn
- No second-person-plural framing ("we all know that…") — sounds
  corporate on Facebook

---

## story.html — Facebook story

**Audience mode:** Same constraints as Instagram story. FB stories are
often cross-posted from IG, so identical structure is acceptable.

See `instagram.md § story.html` for structure rules — use the same
template. The only differences:

- FB story view metrics count at ~3s; keep the main message readable in
  the first 2 seconds
- FB story stickers are more limited than IG — avoid depending on polls
  or question stickers that might not render

---

## reel.html — Facebook reel cover

**Audience mode:** FB Reels surface to a broader demographic than IG
Reels (older users, longer dwell time per reel).

### Structure

Same as `instagram/reel-cover.html` but with one adjustment:

- Text can be slightly longer (6–8 words vs. 3–6 on TikTok) because
  Facebook's default audio-off preview means users often read covers in
  full before swiping
- Brand mark is fine here (FB doesn't penalize cross-posts the way
  TikTok does)

### When to generate

Generate `facebook/reel.html` only if the user explicitly mentions
Facebook Reels or says "post this video across all the reel platforms".
By default, Instagram Reel cover + TikTok cover are sufficient for a
short-form video campaign.
