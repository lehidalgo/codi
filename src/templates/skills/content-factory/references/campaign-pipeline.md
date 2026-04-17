# Campaign Pipeline — Anchor → Distill

> **This reference is a redirect.** The anchor-first flow is the default
> methodology; there is no separate "campaign pipeline" to opt in to. The
> original multi-phase prescription was retired because it mixed substance
> (the anchor-first decision) with mechanics (field names, file-naming
> conventions) and produced more confusion than scaffolding. Read the four
> methodology references below — together they cover everything the old
> pipeline did, and nothing more.

## Where the former content lives now

| Former section | New home |
|----------------|----------|
| Intake questions and when to ask them | `[[/references/methodology.md]]` §3-4 and `[[/references/intent-detection.md]]` |
| Authoring the anchor (shapes, semantic tagging, worked examples) | `[[/references/anchor-authoring.md]]` |
| Distilling anchors into platform variants | `[[/references/distillation-principles.md]]` (philosophy) + `[[/references/platform-rules.md]]` (per-platform recipes) |
| Revision tracking and propagation prompts | `[[/references/methodology.md]]` §6 and the `/api/distill-status`, `/api/anchor/revise`, `/api/anchor/approve` endpoints in SKILL.md |
| Quality gates (thesis / CTA / voice / validator) | `[[/references/methodology.md]]` §7 and `[[/references/distillation-principles.md]]` §9 |

## Field-name cheat sheet

The new flow uses camelCase throughout (matches the server API):

- `brief.anchor.revision`
- `brief.anchor.status` — `draft` / `approved`
- `brief.anchor.approvedAt`
- `brief.variants[].derivedFrom`
- `brief.variants[].derivedFromRevision`
- `brief.variants[].status` — `fresh` / `stale` / `manual`

If you encounter references to snake_case (`derived_from_revision`,
`anchor.revision` in older docs), treat the camelCase form as authoritative
and update in place.

## File naming

Numeric prefixes are a **convention** that gives natural sort order — they
are not enforced by the app or validator:

- `00-anchor.html` — master
- `10-19` — LinkedIn
- `20-29` — Instagram
- `30-39` — TikTok
- `40-49` — Twitter
- `50-59` — decks
- `60-69` — email / ads / other

Use descriptive names (`10-linkedin-carousel.html`,
`30-tiktok-cover.html`). Agents should preserve existing names when editing.

## When this file will be removed

This redirect will be deleted in a future release once the methodology
references have fully replaced it in agent workflows. If you are writing
new guidance, link directly to the targets in the table above — do not
add content here.
