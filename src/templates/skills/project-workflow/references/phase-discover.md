# Phase: discover

Read the source material, extract the strategic layer (BusinessGoals, Requirements), draft candidate Stories. HARD GATE at exit — stakeholder sign-off before decomposition.

## Inputs

- `docs/sources/*.md` — agent-ready stakeholder material.
- `.codi/project.json` — for project context.
- (`--update` mode only) existing Sheet rows — to avoid re-proposing what already exists.

## The canvas rule for this phase

Once `.codi/project.json` is bound, **the Sheet is the review surface**. The agent extracts spec content from the sources, writes a single LOCAL JSON DRAFT, then syncs to the Sheet in ONE command. The user reviews in the Sheet (its native format is the better review surface) and approves with one word — OR edits the local JSON draft and asks for a re-sync.

## Token-efficient draft+sync flow

ANTI-PATTERN: issuing 13+ separate `codi sheets upsert` calls in a loop. Each call is ~500 tokens of CLI args + output → ~6,500 tokens for one batch. Don't.

CANONICAL pattern: write a single local JSON draft, sync in ONE command.

```bash
# 1. Agent writes the draft (one Write tool call, cheap)
.codi/draft/discover.json:
{
  "BusinessGoal": [
    {"title": "...", "outcome": "...", "metric": "...", "priority": "P0", "source_link": "docs/sources/...", "status": "proposed"},
    ...
  ],
  "Requirement": [
    {"type": "functional", "title": "...", "behavior_or_threshold": "...", "satisfies": "BG-001", "priority": "P0", "status": "proposed"},
    ...
  ],
  "UserStory": [
    {"as_a": "...", "i_want": "...", "so_that": "...", "elaborated_from": "REQ-001", "status": "backlog"},
    ...
  ]
}

# 2. Agent syncs in ONE shot (one Bash call):
codi sheets sync-draft .codi/draft/discover.json
```

The `sync-draft` CLI:

- Validates each row's schema.
- Upserts every row with `caller=bootstrap` (planning columns allowed).
- Auto-assigns `BG-NNN`, `REQ-NNN`, `US-NNN` IDs in monotonic order.
- Reports per-row outcomes (written / no-op / failed).
- Leaves the draft intact — re-runs are idempotent.

If the user edits the draft (any text editor / `vim` / etc.) and asks to resync, the agent just re-runs `codi sheets sync-draft .codi/draft/discover.json`.

## What stays in chat

- ONE short summary line after sync: _"Wrote 3 BusinessGoals (BG-001..003), 10 Requirements (REQ-001..010), 12 draft UserStories (US-001..012) → Sheet [URL]. Draft at `.codi/draft/discover.json`. Review in Sheet, approve / redirect / edit-and-resync."_
- Any clarifying questions (one per turn).
- The HARD GATE approval ack.

## Steps

1. **Invoke `ingest-material`.** v0.1 placeholder: enumerates `docs/sources/*.md` and emits `material_ingested`.
2. **Read the sources.** Each markdown file in full.
3. **`--update` mode — load existing Sheet state.** Read existing rows. Diff against new sources. The draft only includes deltas.
4. **Extract Goals + Requirements + draft Stories internally** from the source material. Use the YAML frontmatter (`raw_link`, `stakeholder`) for `source_link` values where applicable.
5. **Write `.codi/draft/discover.json`** in one Write tool call. Use the schema above.
6. **Run `codi sheets sync-draft .codi/draft/discover.json`** — one Bash call. Capture per-row outcome.
7. **Surface ONE summary line** with row counts, ID ranges, Sheet URL, and the draft path. Ask for `ok` / redirect / edit-and-resync.

If `sync-draft` reports failures, surface the failed row indices + error messages, ask the user to fix the draft (or describe the fix to make in chat) and re-run. Do NOT issue per-row upsert retries.

## Exit criteria (gate: discover-complete)

- ≥1 BusinessGoal proposed (most projects have 3–8).
- Each BusinessGoal has ≥1 Requirement proposed.
- Each Requirement has ≥1 candidate Story (Stories may be refined in `decompose`).
- **HARD GATE — stakeholder approval.** Human explicitly approves the strategic layer (Goals + Requirements). Phrasings like "looks fine, continue" / "okay" / "yeah" do NOT count — the human must type the literal two-character `ok` (case-insensitive — `ok`, `OK`, or `Ok`) or use `codi transition --approve`.

## `--update` mode specifics

- Load existing rows BEFORE proposing.
- Compute the diff: which sources are new (no `source_link` match in any existing Goal).
- Propose deltas only.
- Existing rows' planning columns are NEVER touched.
- HARD GATE still applies — if no new strategic content, the workflow can short-circuit through `decompose` to `sync` (which is a no-op for existing rows).

## Anti-patterns

- Proposing Goals from generic "best practices" rather than from the source material.
- Folding "I'll review at the end" into a single approval — Goals/Requirements approval is separate from Stories approval.
- Auto-merging similar Goals across sources without surfacing the merge for review.
- Fabricating source content when sources are sparse.

## Events emitted

- `phase_started phase=discover`.
- `material_ingested` — list of source files.
- `subagent_dispatched` — for the `discover` skill chain.
- `decision_recorded` — for each accepted/rejected Goal or Requirement.
- `phase_completed phase=discover`.
- `phase_transition_proposed discover → decompose`.
- `phase_transition_approved` (human-authored, HARD GATE).
