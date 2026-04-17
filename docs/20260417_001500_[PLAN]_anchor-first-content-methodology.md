# Anchor-First Content Methodology

- **Date**: 2026-04-17 00:15 (rev. 00:45 — reframed as principles + tools, not pipeline)
- **Document**: 20260417_001500_[PLAN]_anchor-first-content-methodology.md
- **Category**: PLAN
- **Branch**: feat/box-validator
- **Related**:
  - `20260416_173000_[PLAN]_slide-deck-single-file-migration.md`
  - `src/templates/skills/content-factory/references/campaign-pipeline.md` (existing — merges into `methodology.md`)
  - `src/templates/skills/content-factory/references/slide-deck-engine.md`

---

## 1. Framing

The skill gives the coding agent three things, in this order of importance:

1. **Principles** — what great content looks like, why anchor-first improves consistency, how substance and format relate, what role brand voice and design rules play.
2. **Tools** — server APIs for project state, brief persistence, revision tracking, validation, and export; plus access to brand tokens and the box-validator.
3. **Quality gates** — design-system rules, brand voice rules, platform norms, box-validator thresholds. Non-negotiables that wrap whatever the agent produces.

The skill does **not** prescribe:

- How many intake questions to ask (the agent judges by reading the request).
- An exact anchor schema, role taxonomy, or section ordering (the agent structures the content in whatever shape serves this topic best).
- Mechanical "anchor section → visual slot" compression rules (distillation is a creative decision informed by platform norms, audience, and brand).
- A phrase table for intent detection (the agent classifies by reading).
- File-naming conventions as hard rules (they are conventions, not enforcement).
- A default multi-format bundle (the agent asks or infers from the request).

**The agent is the senior content strategist + designer.** The skill provides the principles it draws on, the capabilities it uses, and the quality floor it cannot drop below. Every content creation is adapted to the specific topic, audience, format mix, and brand in play.

---

## 2. The core insight

**Content is information; format is presentation.** The substance of what the user wants to communicate lives in an anchor — a long-form piece that can stand alone as a blog post or article. Every visual format (slide deck, social carousel, document, single-card, story, thread) is a specialized view of that anchor produced by compression with intent.

Four benefits compound:

1. **Consistency across formats** — multi-format campaigns share a single thesis, point set, and CTA.
2. **Prose-first quality** — the argument is built in long form before compression; ideas get tested before they're turned into bullets.
3. **Revision economy** — the user edits the idea once; derived formats regenerate on demand.
4. **Separation of concerns** — substance (anchor) vs. presentation (variant) vs. layout (validator) each has one authoritative home.

The anchor itself is shippable as a blog post. No wasted work; the first output is already valuable.

---

## 3. What the agent does (behavioral, not procedural)

### 3.1 Read the intent

On the user's first message, the agent decides:

- Is this a one-off or does it justify an anchor?
- Which formats does the user want, and with what level of polish?
- Does the user already have substance (pasted content, linked article), or is the agent generating both substance and format?
- Are there constraints on audience, voice, brand, platform, or timeline that should shape the work?

No fixed phrase table and no forced clarifying question. The agent asks for what it actually needs. When the request is clear, it proceeds. When it's ambiguous enough to risk wrong-direction effort, it asks — briefly, only what matters.

### 3.2 Author the substance (anchor) when warranted

For anything beyond a trivial one-off, the agent writes an anchor first. The anchor is:

- A **standalone, shippable long-form piece** — valid HTML, readable on its own.
- **Structured in whatever shape serves this content best** — a narrative essay, a listicle, a case study, a technical explainer, a manifesto. The agent picks the shape to fit the topic.
- **Semantically self-describing** — the agent tags sections with roles that make downstream distillation possible. Which roles, and what they mean, is the agent's call. The skill documents the *purpose* of semantic tagging, not a closed taxonomy.
- **Brand-aligned** — voice from `voice.phrasesUse` / `voice.phrasesAvoid`, typography from brand tokens, logo placement per brand rules.

Iteration: the user reviews, gives feedback, the agent rewrites. The anchor carries a monotonic revision counter. Approval is explicit — the agent doesn't start distilling until the user is satisfied with the substance.

### 3.3 Distill with intent

For each requested format, the agent:

- Loads the anchor and the brief.
- Reads the format's principle reference (a short doc about what that format excels at and where it fails) — **not a mechanical mapping table**.
- Makes creative decisions: which anchor section gets a slide, which gets folded into another, which moves to speaker notes, which gets a visual treatment.
- Writes the distilled file with a meta tag recording the source anchor and its revision.
- Runs the box-validator and the design-system gates.
- Reports what it did and any choices that might surprise the user ("I merged points 3 and 4 into one slide because they share evidence — say if you'd rather split them").

Distillation is creative compression, not schema transformation. Two agents distilling the same anchor into the same format should produce distinct but both-valid decks. Same substance, different interpretation — like two designers handed the same brief.

### 3.4 Track revisions and propagate on demand

The anchor has a revision number. Every distilled variant carries the revision it was derived from. When the anchor changes, variants become stale.

Staleness is **informational, not enforcing**. The agent surfaces it at the start of the next iteration turn:

> "The anchor changed since these were distilled — re-distill which?"

The user chooses. Agent never auto-propagates.

### 3.5 Fast-path for trivial requests

Some requests don't warrant the full flow. "Quick tweet about X", "just one Instagram story", "one slide explaining Y" — the agent writes a single file and skips anchor authoring entirely.

No fixed rule for when to fast-path. The agent judges. Heuristics include: explicit modifiers ("quick", "just", "one"); single format; minimal substance required; user energy signals (time pressure, tone). If the agent fast-paths when an anchor would have helped, the user can say so on iteration — no lock-in.

### 3.6 Respect the quality gates

Four gates apply to everything the agent ships:

- **Brand tokens inlined** in every HTML file (tokens.css verbatim).
- **Voice rules honored** — `phrases_avoid` never appears in generated copy.
- **Design-system rules** in `design-system.md` applied per-card (the 13 rules, with the box-validator catching a subset mechanically).
- **Box-validator score** meets the session's threshold for every card/slide/page.

The agent does not ship content that fails these gates. Iteration until they pass, then present.

---

## 4. Principle references — what the agent reads

The skill's references directory gains **four new principle documents**, plus updates to existing ones. The total is smaller, not larger, than my first-draft plan. These are conceptual references, not pipelines.

### 4.1 `references/methodology.md` (new — supersedes `campaign-pipeline.md`)

The content strategist's playbook.

- **What makes content good** — substance before form, single thesis, argument-that-earns-the-read, evidence-not-decoration, CTA-as-next-step.
- **Why anchor-first** — the four benefits in §2, illustrated with before/after contrasts.
- **How to decide** whether a request warrants an anchor, fast-path, or something in between.
- **How to iterate** — revision discipline, propagation mechanics, surface-not-enforce.
- **What the skill provides** — pointer to the tools (§5) and quality gates.

~200 lines. Written in the voice of a seasoned practitioner. No pipeline diagrams, no phrase tables, no forced-question lists.

### 4.2 `references/anchor-authoring.md` (new)

What a great anchor looks like.

- **Structure shapes that work** — narrative essay, listicle, case study, technical explainer, manifesto, retrospective. Each described briefly. Not a closed list.
- **Semantic tagging for downstream distillation** — the agent adds `data-role` or similar markers to sections so variants can reference them. The reference documents common role names (hook, point, evidence, synthesis, cta) as conventions that work well but are not mandatory. Agents can invent roles when content needs them.
- **Length classes and what they distill into** — short anchor fits one carousel or one 5-slide deck; standard anchor fits a document or a 10-slide deck; deep anchor fits a whitepaper or a long-form content series.
- **Brand-aware authoring** — voice, logo, reference materials.
- **Two or three worked examples** — a manifesto anchor, a case study anchor, a technical explainer anchor. Each shown with the source and a resulting distilled variant (deck for one, LinkedIn carousel for another, document for the third).

~250 lines. Examples take most of the space. Principles are short.

### 4.3 `references/distillation-principles.md` (new)

The compression art.

Replaces the eight `distill-to-*.md` references from my first draft. One principle document covers the shared craft:

- **What compression with intent means** — choosing what to keep, what to fold, what to cut, what to visualize.
- **Platform norms for the common formats** — slide deck, LinkedIn carousel, Instagram feed/story, TikTok cover, Twitter card/thread, A4 document. Each gets a paragraph or two: what the platform rewards, what it punishes, typical slide/frame counts, hero-slide conventions, CTA placement, copy length ceilings. These are the platform's "nature", not a mechanical recipe.
- **How brand affects distillation** — voice and visual density rules vary by audience.
- **How audience affects distillation** — technical audience tolerates density; executive audience needs high signal-to-noise.
- **How to preserve thesis across variants** — every variant's opening restates the thesis in the format's native vocabulary.
- **How to handle format-specific slots the anchor doesn't have** — hero images, opening hooks, animated moments; when to invent, when to skip.

~300 lines. Platform-norm paragraphs are the bulk. The format-specific *knowledge* is here, but it's described as background the agent uses, not as mechanical rules it applies.

### 4.4 `references/intent-detection.md` (new, short)

How the agent reads user requests.

- **Signals, not phrases** — what the user said, what they omitted, the complexity of the topic, the number of formats implied, explicit modifiers, brand context, prior project state.
- **Judgment calls the agent makes** — anchor vs. fast-path, single vs. multi-format, agent-initiated clarification vs. proceed with a reasonable default.
- **How to clarify without friction** — when to ask a single crisp question, when to proceed with an assumption and make it reversible, when to just start writing.

~80 lines. No tables, no closed phrase lists. The agent uses the same reading skills it uses for any other coding task.

### 4.5 Existing references — no rewrite

These are already well-scoped; the methodology references above point at them where relevant.

- `slide-deck-engine.md` — unchanged. Single-file slide engine brief.
- `brand-integration.md` — small rewrite to mention anchor-aware brand application; otherwise unchanged.
- `design-system.md` — unchanged. The 13 rules.
- `docx-export.md` / `html-clipping.md` / `visual-density.md` / `promote-template.md` — unchanged.

### 4.6 Retire

- `campaign-pipeline.md` — content folds into `methodology.md`. Keep as a redirect banner for one release cycle, then delete.

---

## 5. Tools the skill provides

Infrastructure the agent relies on. Mechanical, not principle-based.

### 5.1 Server endpoints (new or extended)

Minimal additions. Each earns its keep by removing a bookkeeping burden from the agent.

- **`GET /api/distill-status`** — returns `{ anchor: {revision, status}, variants: [{file, derivedFromRevision, status}], stale: [...] }`. The agent calls this at the start of every iteration turn to detect staleness without re-reading every file.
- **`POST /api/anchor/revise`** — bumps the anchor's revision counter, marks all variants as stale where `derivedFromRevision < new revision`. The agent calls this after a non-trivial anchor rewrite.
- **`POST /api/anchor/approve`** — marks the anchor as user-approved; used to gate distillation.
- **`POST /api/brief`** (existing, extended) — accepts a free-form JSON blob; no schema enforcement beyond the top-level shape. Agents and brands can add fields. The server persists; no validator rejects "unknown" fields.

The brief is **deliberately schema-loose**. The skill suggests a shape (topic, thesis, audience, voice, points, cta, anchor, variants) but the server accepts whatever the agent writes. This supports future content types, new formats, and agent-specific metadata without server changes.

### 5.2 New content type: `anchor`

Infrastructure-level addition.

- `CONTENT_TYPES.anchor = { cardClass: 'anchor', canvas: { w: 794 }, label: 'Article' }` in both server and client registries.
- Height is content-driven (scrollable preview).
- Preview renders as a readable article column.
- Exports: HTML (byte-identical source), PDF (multi-page paginated), DOCX (where structure maps).
- Card extractor adds `.anchor` to its selector list.

The agent uses this content type when creating anchors. Nothing else changes in the content-type system.

### 5.3 Preview-strip hierarchy (client UI, optional)

When the project has an anchor plus variants, the preview strip groups them visually: anchor on top, variants below, with stale badges where `derivedFromRevision < anchor.revision`. Fallback when there's no anchor: flat list, as today.

This is a UX affordance, not a requirement. The server doesn't enforce structure. The client reads the brief and groups accordingly.

### 5.4 Unchanged infrastructure

No changes to:

- Box-validator or design-system rules.
- Brand integration (`/api/brands`, `/api/active-brand`, `/api/brand/<name>/assets/*`).
- Export endpoints or formats.
- Existing content types (`social`, `slides`, `document`).

---

## 6. SKILL.md changes

`template.ts` becomes **shorter**, not longer. The workflow section is a router pointing the agent at the right references for the task at hand.

### 6.1 Current shape (711 lines)

Heavy per-format content embedded in the workflow: required HTML structure, content identity, card rules, clipping rules, DOCX conventions, visual density, design-system summary, slide-deck pointer, document discipline.

### 6.2 Target shape (~550 lines)

- Overview, asset map, server API, validation, templates — unchanged.
- **Workflow** becomes: "Read `methodology.md`. Decide the work. Apply the principles. Use the tools. Respect the gates." With pointers to the four principle references and the existing format-specific ones.
- Per-format sections (card rules, DOCX conventions, visual density, slide-deck pointer, document discipline) collapse to one-line pointers at their references.
- Campaign Pipeline section — deleted (folds into methodology.md).
- Fast-path section — one short paragraph with "when to skip the anchor".

The agent reading the skill learns: there's a methodology, here's when to apply which reference, here are the tools, here are the gates. It doesn't learn a script.

### 6.3 Skill description update

Replace:

```
description: Use when the user wants to create blog posts or repurpose
content across platforms (LinkedIn, Instagram, TikTok, Medium, Substack)…
```

With something like:

```
description: Use when the user wants to create content — articles, blog
posts, slide decks, social carousels, documents, single-format social
posts, or multi-format campaigns. Authors substance first (an anchor
article) and distills into every requested visual format. Fast path for
one-off requests.
```

Adjust wording when committing; the intent is: mention anchors, mention the full format range, mention both campaigns and fast-path.

---

## 7. What this is not

To keep the methodology general and agent-driven, the plan **deliberately excludes**:

- A closed role taxonomy. The agent invents role markers that fit the content. Common ones (`hook`, `point`, `evidence`, `cta`) are documented as conventions, not requirements.
- A fixed intake questionnaire. The agent asks what it actually needs to ask, skipping questions whose answers are obvious from context.
- An anchor schema JSON contract. The anchor is HTML with semantic markers; the server doesn't validate shape.
- Per-format distillation rules as pipelines. Format knowledge lives in one principles reference; agents apply it with judgment.
- A default multi-format bundle. The agent either asks or infers from the specific request.
- Mechanical revision semantics ("cosmetic edits don't bump"). The agent decides whether an edit changed substance; the tool just records what the agent tells it.
- File-naming enforcement. Numeric prefixes are a convention that helps sort order; agents use them or don't.

These things being undefined is the point. Fixing them would turn the agent into a script interpreter.

---

## 8. Blast radius

| Area | Impact |
|---|---|
| Existing `social`, `slides`, `document` types | No change. Fast-path flows exactly as today. |
| Existing `/api/export-*` endpoints | No change. Anchor exports use the same pipeline as document. |
| Existing `/api/brief` | Accepts a looser JSON (no schema rejection). Agents writing legacy briefs continue to work. |
| Existing 14 gallery templates | No change. They remain fast-path starting points. |
| Brand integration | No change. Anchors inherit brand tokens like any content type. |
| Box validator | No change. Validates anchor `.anchor` cards like any other class. |
| SKILL.md length | 711 → ~550 (reduction via principle-reference extraction). |
| References directory | +4 new principle docs (methodology, anchor-authoring, distillation-principles, intent-detection); −1 (campaign-pipeline; redirect then delete). |
| Client preview strip | Grouping added for anchor+variants projects; flat fallback when no anchor. |

Nothing breaks. Nothing forces the agent into a script. The fast path is exactly today's flow.

---

## 9. Phased execution

Six phases. Phases 1-2 are pure documentation (zero code, zero schema, zero test changes). Phase 3 adds three server endpoints (each ≤ 40 lines). Phase 4 adds a content type. Phase 5 is UI. Phase 6 is SKILL.md restructure.

### Phase 1 · Principle references

Four new markdown files:

- `references/methodology.md`
- `references/anchor-authoring.md`
- `references/distillation-principles.md`
- `references/intent-detection.md`

Plus: `campaign-pipeline.md` gets a redirect banner.

Zero code. A capable agent reading these four files can run the methodology manually today, writing static files in `contentDir/`. This phase is shippable in isolation.

### Phase 2 · Existing-reference nudges

Small additions to `brand-integration.md` (mention anchor), `slide-deck-engine.md` (brief nod to distillation upstream). No structural changes.

### Phase 3 · Server endpoints + looser brief

- `GET /api/distill-status`
- `POST /api/anchor/revise`
- `POST /api/anchor/approve`
- `POST /api/brief` — remove any strict-shape validation that rejects unknown fields.

Each endpoint ≤ 40 lines with unit tests. Backward-compatible: agents not using them see identical behavior to today.

### Phase 4 · Anchor content type

- Add to `CONTENT_TYPES` (server + client + test).
- Extend card extractor selector list.
- Preview rendering adapter (document-column scroll).
- PDF pagination adapter.

### Phase 5 · Preview-strip grouping

Client UI — anchor-top, variants-below, stale badges. Opt-in: renders only when brief declares an anchor.

### Phase 6 · SKILL.md restructure

Collapse per-format sections into pointers. Update workflow to the router shape in §6.2. Retire `campaign-pipeline.md` (delete the file after its redirect period).

---

## 10. Success criteria

### Content quality

- A multi-format campaign (anchor + deck + carousel) produced by an agent following the methodology tells one consistent story: same thesis, same key points, same CTA voice.
- Variants are distinct, not mechanical copies — each suited to its platform's nature.
- Brand voice respected throughout. No `phrases_avoid` hits.

### Agent ergonomics

- Fast-path requests generate a single file with no intake friction.
- Non-trivial requests default to anchor-first without forcing the user through a fixed questionnaire.
- The agent handles ambiguity by either asking a single crisp question or proceeding with a reversible default.

### Technical

- All existing tests pass.
- New tests for: content-type registry (anchor), staleness calculation, looser brief acceptance.
- SKILL.md ≤ 550 lines.
- Each new reference ≤ 300 lines.
- Brief JSON is accepted with arbitrary extra fields; existing v1 briefs continue to work.

### Documentation

- A capable coding agent, reading only `methodology.md` + `anchor-authoring.md` + `distillation-principles.md` + `intent-detection.md` + the existing brand/design references, can run a complete anchor → deck + carousel + document campaign.
- Two different agents reading the same references produce distinct, both-valid outputs from the same brief. Style should vary; substance and constraints should not.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Agents vary too much — inconsistent UX across sessions | The principle references are explicit about non-negotiables (brand, voice, design-system rules, validator). Creative variation is in interpretation, not in gates. |
| Weak agents produce low-quality anchors | Worked examples in `anchor-authoring.md` set the bar. Design-system validator applies to every card regardless of whether it came from an anchor. |
| "Fast-path" judgment misfires (agent over- or under-applies it) | User can course-correct on iteration. The anchor is cheap to write; the distillation pass is where compute is spent. Reversible defaults beat forced prompts. |
| Schema-loose brief causes data drift | The server persists whatever the agent writes; no enforcement. If drift becomes a problem in practice, we tighten in a follow-up plan. |
| Anchor revision semantics get argued | The agent decides what "non-trivial" means. If users disagree, they edit the anchor and the agent re-bumps. No harm done. |
| Principle references become stale | Documentation drift risk. Mitigated by the pre-commit hook's resource-reference checker and periodic audits. |

---

## 12. Open questions

Before the first commit, confirm:

1. **Anchor as a first-class content type** (the plan assumes yes). Alternative: treat anchor as a `document` subtype. First-class is cleaner but adds a small migration.
2. **Anchor preview width** — 794px (A4) or 1000px (blog column)? Default 794 for symmetry with `document`.
3. **Brief schema looseness** — the plan removes any server-side shape rejection beyond "valid JSON". Confirm this is acceptable for your operational preferences.
4. **Campaign-pipeline.md deprecation** — same commit as the new references, or keep one release cycle as a redirect?

---

## 13. Out of scope

- Image / chart / illustration generation. Variants reference placeholders; users replace.
- Full SEO metadata for blog exports (schema.org, OG tags) — future enhancement.
- Multi-language distillation — separate methodology.
- Real-time collaboration on an anchor — single-user assumption.
- Cross-project anchor reuse — per-project, as today.
- Content-type migration tools — manual.

---

## 14. First concrete step

Phase 1 alone. Four new markdown files:

- `references/methodology.md`
- `references/anchor-authoring.md`
- `references/distillation-principles.md`
- `references/intent-detection.md`

Zero code. Zero schema changes. Zero test impact. A capable agent reading these four files today can run the full methodology manually. Every subsequent phase improves ergonomics.

The commit diff is entirely documentation. Rollback is trivial.
