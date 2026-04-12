# Content Factory — Campaign Pipeline
- **Date**: 2026-04-12 18:00
- **Document**: 20260412_180000_[PLAN]_content-factory-campaign-pipeline.md
- **Category**: PLAN
- **Target skill**: `src/templates/skills/content-factory`
- **Starting version**: 42

## Goal

Add an opt-in **campaign pipeline** to the Content Factory skill that turns a
single topic into a coordinated set of content formats. The pipeline follows a
classic marketing funnel: **intake → anchor → distill → iterate → export**.

The user describes the topic once, the agent asks a handful of clarifying
questions, generates one long-form "anchor" (blog, docs, or deck), then distills
that anchor into platform-specific variants (LinkedIn carousel, Instagram feed,
Instagram story, TikTok cover, Twitter card, optional summary deck). Each
artifact lives as its own HTML file in the same project so the existing browser
app, file list, preview, and export pipeline work unchanged.

## Non-goals

- Replacing the current single-file "quick one-off" workflow. The campaign
  pipeline is **opt-in**, triggered by intake phrasing ("campaign", "blog post",
  "launch", "publish across platforms"). Quick one-offs skip intake entirely.
- Building a new browser-side intake form. Intake runs in chat (agent ↔ user).
- Hard-depending on the `marketing-skills` plugin. Soft dependency only.
- Automatic re-distillation on every anchor edit. Re-distillation is proposed to
  the user on the next skill invocation after an anchor edit.

## Design summary

### Phases

```
[1 Intake]  →  [2 Anchor]  →  [3 Distill]  →  [4 Iterate]  →  [5 Export]
  chat         one file        N files         per file        ZIP bundle
```

### Anchor types

| Anchor | Content Factory `type` | Format | Default use |
|--------|------------------------|--------|-------------|
| `blog` | `document` | A4 pages | Article, thought-leadership, launch post |
| `docs` | `document` | A4 pages (multi-section) | Technical docs, guides, tutorials |
| `deck` | `slides` | 16:9 | Pitches, webinars, talks |

All three ship in v1 — intake already has to ask, and mechanics are identical.

### Project layout

```
<projectDir>/
  brief.json                    # intake + variants + pipeline state
  content/
    00-anchor-<type>.html       # the master
    10-linkedin-carousel.html   # variant
    11-linkedin-post.html       # variant
    20-instagram-feed.html      # variant
    21-instagram-story.html     # variant
    30-tiktok-cover.html        # variant
    40-twitter-card.html        # variant
    50-summary-deck.html        # optional variant
  state/
  exports/
```

Numeric prefixes give natural sort order in the app's file list. No UI change
needed — the anchor lands first automatically.

### brief.json schema (v1)

```jsonc
{
  "version": 1,
  "created_at": "ISO timestamp",
  "intent": "campaign",
  "anchor": {
    "type": "blog",                    // blog | docs | deck
    "file": "00-anchor-blog.html",
    "status": "draft",                 // draft | approved
    "revision": 1                      // increments on each anchor rewrite
  },
  "topic": "string",
  "audience": "string",
  "voice": "string",                   // inherited from active brand if present
  "brand": "codi-codi-brand | null",
  "goal": "string",
  "cta": "string",
  "key_points": ["string", "..."],
  "variants": [
    {
      "platform": "linkedin-carousel",
      "file": "10-linkedin-carousel.html",
      "format": "4:5",
      "type": "social",
      "status": "pending",             // pending | distilled | approved
      "derived_from_revision": null    // matches anchor.revision at distillation time
    }
  ]
}
```

### Edit propagation

When the user edits the anchor, increment `anchor.revision`. On the next skill
invocation, the agent scans variants where `derived_from_revision < anchor.revision`
and asks: *"The anchor changed since these variants were distilled — re-distill?"*
The user can re-distill all, some, or none. Variants the user edited manually
remain flagged until explicitly approved or re-distilled.

### Marketing-skills integration — SOFT DEPENDENCY

At the start of Phase 2 and Phase 3, the agent checks whether the
`marketing-skills` plugin is installed (scan for skills named
`content-strategy`, `copywriting`, `social-content`, etc.). If installed:

| Phase | Skills invoked |
|-------|----------------|
| Intake | `content-strategy` — validate topic + audience fit (optional) |
| Anchor (blog/docs) | `copywriting` → `humanizer` |
| Anchor (deck) | `launch-strategy` (if present) → `humanizer` |
| Distillation | `social-content` (one call per platform) → `humanizer` |
| Optional | `ad-creative`, `email-sequence` for paid/email extensions |

If not installed, fall back to **inline generation** using the brief as the
only context. The workflow, file outputs, and user experience are identical —
the only difference is whether extra LLM passes refine the copy.

**Future note**: Codi will eventually ship its own first-party marketing skills
to replace the external `marketing-skills` plugin dependency. The soft-detect
pattern used here means swapping them in requires no workflow changes — the
agent just discovers a different set of skill names.

## Server changes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/brief` | GET | Return current project's `brief.json` (or `null`) |
| `/api/brief` | POST | Write `brief.json` — intake and updates |
| `/api/state` | GET | Add `brief` field (parsed) alongside `activeCard` |

No new browser UI. `app.js` gets a 5-line change to badge the anchor file in the
file list.

## Atomic build order

### Step 1 — `brief.json` schema + `/api/brief` endpoints (server)

**Files:**
- `src/templates/skills/content-factory/scripts/server.cjs` — add GET/POST
  `/api/brief`, include `brief` in `/api/state`
- `src/templates/skills/content-factory/tests/integration/server.test.*` —
  extend server tests for the new endpoint

**Verification:**
- `pnpm test` for content-factory server tests passes
- Manual: `curl -s <url>/api/brief` returns `null` before any brief exists;
  `curl -s -X POST <url>/api/brief -d @brief.json` writes correctly; `/api/state`
  now includes `brief` field

### Step 2 — Platform distillation rules reference

**Files:**
- `src/templates/skills/content-factory/references/platform-rules.md` — one
  section per platform (LinkedIn carousel/post, Instagram feed/story, TikTok
  cover, Twitter/X card, summary deck). Each section covers hook length, slide
  count, visual density, hashtag strategy, CTA placement, and a sample
  `<meta name="codi:template">` block

**Verification:**
- File exists, lints clean, has one H2 per platform, examples use the existing
  card HTML contract

### Step 3 — Campaign pipeline reference (the main workflow doc)

**Files:**
- `src/templates/skills/content-factory/references/campaign-pipeline.md` — full
  3-phase workflow: intake Q&A script, anchor generation rules per type,
  distillation loop, edit propagation, marketing-skills soft detection, trigger
  phrases

**Verification:**
- File exists with sections: Intake · Anchor · Distill · Propagate · Detect
  marketing skills · File naming conventions
- Covers all three anchor types (blog, docs, deck)

### Step 4 — `template.ts` wiring (trigger + pointer)

**Files:**
- `src/templates/skills/content-factory/template.ts` — add a short "Step 1b.ii —
  Campaign intake (optional)" section after Step 1b that lists trigger phrases
  and points to `campaign-pipeline.md`. Document `/api/brief` in the Server API
  table. Bump version to 43.

**Verification:**
- `pnpm build` green
- `template.ts` line count still under 700; ideally under 600
- Generated SKILL.md (after `codi generate` in a test project) mentions the
  campaign pipeline trigger phrases

### Step 5 — `app.js` anchor badge

**Files:**
- `src/templates/skills/content-factory/generators/app.js` — when rendering the
  content files list, read `state.brief` (populated from `/api/state`) and add a
  small "anchor" badge next to the file that matches `brief.anchor.file`. Pure
  cosmetic, ~10-15 lines.
- `src/templates/skills/content-factory/generators/app.css` — one small rule
  for the badge.

**Verification:**
- Syntax check both files
- `pnpm build` green
- Manual browser test: when `brief.json` exists with an anchor file, that file
  shows an "anchor" badge in the sidebar file list

### Step 6 — Edit propagation check in template.ts

**Files:**
- `src/templates/skills/content-factory/references/campaign-pipeline.md` — add
  the propagation prompt script (already in draft from Step 3, formalize here)
- `src/templates/skills/content-factory/template.ts` — small note in Step 4
  (Iterate) pointing to the propagation check

**Verification:**
- `pnpm build` green
- Template still under line budget

### Step 7 — End-to-end manual test

Run in a test project:
1. `pnpm build && codi generate`
2. Start the skill server
3. Trigger a campaign: *"Create a campaign about edge caching — blog post plus
   LinkedIn carousel and Instagram story"*
4. Agent runs intake, writes `brief.json`, generates anchor, distills variants
5. User opens the browser app, confirms file list shows all variants with
   anchor badge
6. User edits the anchor; agent offers re-distillation on next message

## Open decisions captured

| Decision | Resolution |
|----------|------------|
| Anchor types for v1 | All three (blog, docs, deck) |
| Marketing-skills dependency | Soft; fallback to inline; future Codi-native replacement planned |
| Quick one-off flow | Preserved — campaign pipeline is opt-in |
| Re-distillation UX | Only on next skill invocation (no auto-popups) |
| Intake UI | Chat-first; no browser-side form |

## Risks

1. **Template.ts line budget** — Step 4 adds content. Pointer-style integration
   keeps the inline addition to ~20 lines. If budget is tight, move the
   "Step 1b.ii" summary into a deeper subsection.
2. **brief.json schema migration** — v1 ships as stable, `version: 1` field
   reserved for future migration logic. Do not change schema without a bump.
3. **Anchor badge rendering** — `app.js` file list renderer must not crash when
   `brief` is null or `brief.anchor.file` does not match any listed file. Guard
   both cases.
4. **Distillation drift** — variants may diverge from the anchor after manual
   edits. Edit propagation prompt must distinguish "anchor changed" from "user
   edited variant manually". Track via `derived_from_revision` only.

## Out of scope for this plan

- Export bundle as ZIP (`/api/export-bundle`) — can be added later as a small
  follow-up once the pipeline is validated
- Gallery "Campaigns" filter — UX nice-to-have, not required for the pipeline
  to function
- Automatic marketing-skills invocation wiring beyond documentation — v1
  documents how to invoke, v2 can add an orchestration helper if needed
