# TikTok — Platform Playbook

One variant lives under `content/tiktok/`:

| Plan (Markdown) | Rendered HTML | Format | Canvas | Card wrapper |
|-----------------|---------------|--------|--------|--------------|
| `cover.md` | `cover.html` | Reel/video cover frame | 1080×1920 (9:16) | `<article class="social-card">` |

**Plan-first pipeline.** Author the `.md` plan first, iterate with the
user, get explicit approval before rendering the matching `.html`.
See `[[/references/plan-authoring.md]]` for the shared plan contract.

---

## cover.html — TikTok video cover

Content Factory produces the **cover frame** only — the static image
users see before the video plays in profile grids and search. Video
authoring itself is not in scope.

### Audience mode

Grabby, native-to-TikTok, low-production-value-but-high-signal. The cover
competes with millions of others; a polished designer cover often
underperforms a rougher, more authentic one.

### Structure

| Region | Content |
|--------|---------|
| Top 25% | Hook text — 3–6 words, big, informal typeface. Questions and "POV:" openers work |
| Middle 50% | One supporting visual element or handwritten annotation |
| Bottom 25% | Reserve — TikTok UI overlays crop this zone on profile grids |

### Rules specific to TikTok

- Do not replicate LinkedIn/Instagram polish. TikTok covers that look
  "designed" get ignored. Slight asymmetry, visible cursor marks,
  text-over-screenshot compositions all perform better
- Avoid brand watermarks — TikTok punishes reposts from other platforms
  algorithmically, and a prominent brand mark signals "repost"
- The cover is the video thumbnail; assume it will be shown at 300px
  wide in a 3-column grid. Text must read at that size

### Caption (user pastes into TikTok)

- Short hook (first 80 characters visible without expansion)
- 1 line break
- Body: 2–3 sentences of context
- CTA: a low-friction one — "Follow for more", "Save this", not "Link in bio"
- 3–5 hashtags at the end, mix of specific (#softwareengineering) and discovery (#fyp, #techtok)

### Distillation recipe

The anchor's hook drives the cover text. The specific point most likely
to stop the scroll — usually the most counterintuitive claim — becomes
the cover focus. Unlike LinkedIn/Instagram, there is no faithfulness
requirement to the anchor's ordering; TikTok is allowed to lead with
whatever point is most clip-worthy.
