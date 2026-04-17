# Campaign Pipeline — Anchor → Distill

> **Superseded — read `[[/references/methodology.md]]`, `[[/references/anchor-authoring.md]]`,
> `[[/references/distillation-principles.md]]`, and `[[/references/intent-detection.md]]` instead.**
>
> The anchor-first flow is no longer an opt-in "campaign pipeline";
> it's the default methodology for any non-trivial content request,
> with an explicit fast-path for one-off work. The new references
> reframe the flow as principles the agent applies with judgment,
> rather than a fixed pipeline. This file remains for one release
> cycle as a pointer and will be deleted in a subsequent commit.

The campaign pipeline turns a single topic into a coordinated set of content
formats. It runs as an **opt-in** alternative to the one-off single-file flow,
triggered when the user's request signals that they want to publish across
platforms.

```
[1 Intake]  →  [2 Anchor]  →  [3 Distill]  →  [4 Iterate]  →  [5 Export]
  chat Q&A     one long file   N platform      per-file       bundle
                               variants        feedback
```

**Project layout after the pipeline has run:**

```
<projectDir>/
  brief.json                    # intake answers + variants + pipeline state
  content/
    00-anchor-<type>.html       # the master (document or slides)
    10-linkedin-carousel.html   # variant (social, 4:5)
    11-linkedin-post.html       # variant (social, 1:1)
    20-instagram-feed.html      # variant (social, 4:5)
    21-instagram-story.html     # variant (social, 9:16)
    30-tiktok-cover.html        # variant (social, 9:16)
    40-twitter-card.html        # variant (social, OG)
    50-summary-deck.html        # optional (slides, 16:9)
  state/
  exports/
```

Numeric prefixes give natural sort order in the app's file list — the anchor
always lands first.

---

## Trigger phrases

Switch to campaign mode when the user's initial request contains any of:

- "campaign" / "content campaign" / "marketing campaign"
- "blog post and [platforms]" / "post this across platforms"
- "launch" / "product launch" / "launch post"
- "repurpose this across …"
- "I want to publish about X on LinkedIn / Instagram / TikTok / Twitter"
- "create content about X for social"
- "turn this into a blog, LinkedIn post, and Instagram carousel"

If the user's request is a single-format one-off ("just make me a quick
Instagram post"), **skip the campaign pipeline** and use the standard workflow.

---

## Phase 1 — Intake

Run a short chat Q&A before creating any files. Do not batch the questions —
ask them one or two at a time, using the user's previous answers to inform the
next question. Target 6 answers, all after the first two are optional with
sensible defaults.

### Question script

1. **Topic / core message** — *required*
   > "What's the core topic or message for this campaign? A sentence or two is
   > enough — I'll expand it into the anchor."

2. **Anchor type** — *required, with default*
   Propose a default based on how the user phrased the request:
   - "blog" / "article" / "post" / "write-up" → **blog**
   - "docs" / "guide" / "tutorial" / "readme" / "technical" → **docs**
   - "deck" / "slides" / "presentation" / "pitch" / "talk" → **deck**

   > "I'll use a **blog post** as the anchor — one long-form piece we'll distill
   > into the variants. Sound right, or would you rather start from docs or a
   > slide deck?"

3. **Audience** — *optional*
   > "Who's this for? (e.g. backend engineers at mid-size SaaS, founders in
   > ed-tech, marketing ops leads)"

4. **Voice / tone** — *optional, inherits from active brand if present*
   If a brand is active and has `voice.tone` set, use that as the default.
   > "Voice-wise I'll use [brand voice / technical direct / conversational] —
   > say the word if you want something different."

5. **Platforms** — *optional, with smart defaults*
   Show a checklist. Default to **LinkedIn carousel + Instagram feed** if the
   user does not say otherwise.
   > "Which platforms should I distill this into? Pick any combination:
   > - LinkedIn carousel
   > - LinkedIn single post
   > - Instagram feed (carousel or single)
   > - Instagram story
   > - TikTok cover + script
   > - Twitter/X card + thread
   > - Summary deck
   >
   > Default: LinkedIn carousel + Instagram feed. Say 'all' to generate every
   > variant."

6. **CTA / goal** — *optional*
   > "What should readers do after consuming this? (e.g. read the full post,
   > sign up for the beta, DM you, book a call)"

### Writing `brief.json`

After the user answers, write `brief.json` and show a one-paragraph summary.
Wait for explicit confirmation before generating any HTML.

```bash
# POST to /api/brief after creating a project via /api/create-project
curl -s -X POST <url>/api/brief \
  -H "Content-Type: application/json" \
  -d @brief.json
```

Minimum required fields for v1:

```jsonc
{
  "version": 1,
  "created_at": "2026-04-12T18:00:00Z",
  "intent": "campaign",
  "anchor": {
    "type": "blog",                             // blog | docs | deck
    "file": "00-anchor-blog.html",
    "status": "draft",
    "revision": 0
  },
  "topic": "...",
  "audience": "...",
  "voice": "...",
  "brand": "codi-codi-brand",                   // or null
  "goal": "...",
  "cta": "...",
  "key_points": ["..."],
  "variants": [
    {
      "platform": "linkedin-carousel",
      "file": "10-linkedin-carousel.html",
      "format": "4:5",
      "type": "social",
      "status": "pending",
      "derived_from_revision": null
    }
  ]
}
```

### Confirmation prompt

After writing `brief.json`, tell the user:

> "Here's what I'll build:
> - **Anchor**: [type] about [topic]
> - **Variants**: [list of platform files]
> - **Voice**: [voice] / **Brand**: [brand or 'none']
> - **Goal**: [goal]
>
> I'll start with the anchor. Reply 'go' to continue, or tell me what to change."

Do NOT proceed to Phase 2 without explicit confirmation.

---

## Phase 2 — Anchor generation

Generate **only** the anchor file. This is the longest iteration loop — the
user reviews, edits, and approves the master before any variants are produced.

### Anchor rules by type

| Anchor type | Content Factory `type` | Format | Page count |
|-------------|------------------------|--------|------------|
| `blog` | `document` | A4 (794×1123) | 3-6 pages typical |
| `docs` | `document` | A4 (794×1123) | 4-10 pages typical |
| `deck` | `slides` | 16:9 (1280×720) | 8-15 slides typical |

### Generation steps

1. **Detect marketing-skills.** Check whether the following skills are
   installed (scan `~/.claude/skills/` and `~/.claude/plugins/marketing-skills/`):
   - `content-strategy` — topic outlining
   - `copywriting` — long-form copy
   - `launch-strategy` — launch-specific angles
   - `humanizer` — remove AI patterns

   Soft dependency: fall back to inline generation if the plugin is absent.
   See *Marketing-skills soft invocation* below.

2. **Read the brand** if one is active. Follow `[[/references/brand-integration.md]]` to
   inline tokens, fonts, and logo.

3. **Plan pages / slides.** Before writing HTML, produce a plain-text outline:
   - For `blog` / `docs`: list sections with estimated height per page; confirm
     each page fits in ~950px of body (see `[[/references/docx-export.md]]` and the document
     page discipline section of the main skill).
   - For `deck`: list slide titles and their card type (cover / content / stat /
     quote / cta / closing).

4. **Write the HTML** as `content/00-anchor-<type>.html`:
   - Apply `[[/references/visual-density.md]]` rules — every page/slide ≥85% occupied
   - Include `<meta name="codi:template">` with type, format, and title from
     the brief
   - Include `<meta name="codi:anchor">` with the brief's topic and revision
     (`{"topic":"...","revision":0}`)
   - Apply brand CSS, fonts, logo if active

5. **Set `anchor.revision = 1`** in `brief.json` after the first write. POST
   the updated brief back to `/api/brief`.

6. **Iterate with the user** using the normal preview/feedback loop. Each
   rewrite increments `anchor.revision`.

7. **Mark approval.** When the user says "approve" / "ship it" / "looks good" /
   "move on", set `anchor.status = "approved"` in `brief.json`. Phase 3 is
   blocked until this flag flips.

### Anchor quality bar

- **Blog**: headline + intro hook + 3-5 key sections + conclusion + CTA. Each
  section is ≥1 full A4 page with visual density applied.
- **Docs**: title page + overview + step-by-step sections + reference / FAQ +
  contact/feedback. Code blocks follow `[[/references/docx-export.md]]` rules.
- **Deck**: cover slide + agenda + 6-12 content slides + takeaway slide + CTA
  slide. Every slide has a title, body, and footer strip.

---

## Phase 3 — Distillation

After the anchor is approved, loop over `brief.variants` and generate one HTML
file per platform.

### Distillation loop

For each variant in `brief.variants` where `status === "pending"` or
`derived_from_revision < anchor.revision`:

1. **Read the approved anchor HTML** from `content/00-anchor-<type>.html`.
2. **Extract structure:** topic, audience, key points, stats, quotes, CTA.
   Use the `brief.json` fields as the canonical source — they were approved in
   Phase 1 — and pull any additional stats or quotes from the anchor HTML.
3. **Read platform rules** from `[[/references/platform-rules.md]]` for the target platform.
4. **Invoke `social-content`** (marketing-skills, if installed) with the
   platform + anchor + brief as context. Otherwise draft inline from the rules.
5. **Invoke `humanizer`** (if installed) on the generated copy.
6. **Write the variant HTML** as `content/<prefix>-<platform>.html`:
   - Apply visual density rules
   - Apply the active brand
   - Include `<meta name="codi:template">` with the platform's format
   - Include `<meta name="codi:variant">` with provenance:
     ```html
     <meta name="codi:variant" content='{"platform":"linkedin-carousel","derived_from":"00-anchor-blog.html","derived_from_revision":1}'>
     ```
   - Include `<meta name="codi:caption">`, `codi:script`, or `codi:thread`
     blocks where the platform rules require them
7. **Update `brief.json`:** set the variant's `status = "distilled"` and
   `derived_from_revision = anchor.revision`. POST the updated brief.

**Generate variants serially, not in parallel.** Each variant may reference
previously generated variants (e.g. the LinkedIn single post caption may pull
from the carousel cover headline), and the user can interrupt the loop at any
point to iterate on a specific file.

### After all variants are written

Tell the user:

> "Distilled [N] variants from the anchor. Open any file in the Preview tab to
> iterate — I'll update just that file when you give feedback. The anchor is
> the source of truth; if you edit it, I'll offer to re-distill the variants
> that drift out of sync."

---

## Phase 4 — Per-file iteration

Unchanged from the standard workflow. The user opens any file in the Preview
tab; the agent reads `/api/state` to know which file and which card are
active (see the targeted-card-edit workflow in the main skill); feedback
applies to the currently selected file.

**Important**: edits to a variant do NOT propagate back to the anchor. The
anchor is the source of truth — variants derive from it, not the other way
around. If the user wants to change the anchor based on variant feedback,
ask them explicitly.

---

## Phase 5 — Edit propagation

When the user edits the **anchor** file, increment `anchor.revision` in
`brief.json` on every rewrite. Do NOT auto-propose re-distillation mid-edit.

On the **next** skill invocation after an anchor edit, before doing anything
else, read `brief.json` and compare each variant's `derived_from_revision`
against `anchor.revision`. If any variant is stale:

> "The anchor changed since I distilled:
> - `10-linkedin-carousel.html` (was rev 1, now rev 3)
> - `20-instagram-feed.html` (was rev 1, now rev 3)
>
> Should I re-distill them? Options:
> - **all** — re-distill every stale variant
> - **[file]** — re-distill only the file you name
> - **skip** — leave them; I'll track them as manually edited
>
> Your choice?"

If the user chose "skip", mark each stale variant's `status = "manual"` in
`brief.json` so the agent does not ask again for that revision.

**Never re-distill without explicit user confirmation.** The user may have
manually tuned a variant that they do not want overwritten.

---

## Marketing-skills soft invocation

The Content Factory skill **softly depends** on the external `marketing-skills`
plugin. It is not required for any phase — the pipeline falls back to inline
generation when absent.

### Detection

Before Phase 2 (and again before Phase 3), check whether any of these skills
are available. The detection method depends on the runtime — prefer scanning
for skill files in `~/.claude/skills/`, `~/.claude/plugins/marketing-skills/`,
or the project's `.claude/skills/` directory.

| Skill | Purpose in pipeline |
|-------|---------------------|
| `content-strategy` | Validate topic fit + produce outline (Phase 2) |
| `copywriting` | Draft anchor body for blog / docs (Phase 2) |
| `launch-strategy` | Draft anchor outline for deck-type launches (Phase 2) |
| `social-content` | Per-platform distillation copy (Phase 3) |
| `humanizer` | Remove AI patterns from every output (Phases 2, 3) |
| `ad-creative` | Optional — paid-ad variants if user requests them |
| `email-sequence` | Optional — launch-email variant if user requests it |

### Fallback

If the plugin is not installed:
- Generate all copy inline from `brief.json` fields and the anchor HTML
- Still apply `[[/references/platform-rules.md]]` and `[[/references/visual-density.md]]` rigorously
- Do not mention the absence of the plugin to the user — the workflow is the
  same from their perspective

### Future Codi-native replacement

Codi will eventually ship first-party marketing skills to replace the external
`marketing-skills` plugin dependency. The soft-detect pattern used here means
the swap requires zero workflow changes — the agent just discovers a
different set of skill names in the same detection step. When those skills
ship, update the detection table to check for Codi-native names first, then
fall back to the external plugin names.

---

## File naming conventions

| Prefix | Purpose | Examples |
|--------|---------|----------|
| `00-` | Anchor (always first) | `00-anchor-blog.html`, `00-anchor-deck.html` |
| `10-19` | LinkedIn variants | `10-linkedin-carousel.html`, `11-linkedin-post.html` |
| `20-29` | Instagram variants | `20-instagram-feed.html`, `21-instagram-story.html` |
| `30-39` | TikTok variants | `30-tiktok-cover.html` |
| `40-49` | Twitter/X variants | `40-twitter-card.html` |
| `50-59` | Decks / presentations | `50-summary-deck.html` |
| `60-69` | Email / ads / other | `60-launch-email.html`, `61-ad-creative.html` |

**Rules:**
- Numeric prefixes guarantee sort order in the app's file list
- The anchor is ALWAYS `00-anchor-<type>.html` regardless of intended
  distribution
- Each platform gets its own numeric band so new variants slot in without
  renaming existing files
- Variant filenames must match the `file` field in `brief.json.variants[]`
  exactly — the app looks them up by filename

---

## Quick reference — agent checklist

When running the campaign pipeline, verify before each phase:

**Before Phase 1 (Intake):**
- [ ] Trigger phrase detected OR user explicitly asked for a campaign
- [ ] Project has been created via `/api/create-project`

**Before Phase 2 (Anchor):**
- [ ] `brief.json` written and confirmed by user
- [ ] Active brand checked (optional but recommended)
- [ ] Marketing-skills detection complete

**Before Phase 3 (Distill):**
- [ ] `brief.anchor.status === "approved"`
- [ ] Anchor HTML exists and passes visual density check
- [ ] `brief.variants[]` populated with at least one entry

**Before Phase 5 (Propagation):**
- [ ] User just completed a new message (do not interrupt mid-edit)
- [ ] `brief.json` shows at least one variant with
      `derived_from_revision < anchor.revision`
