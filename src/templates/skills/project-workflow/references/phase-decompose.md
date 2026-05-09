# Phase: decompose

Refine candidate Stories from `discover` into PR-sized units with concrete acceptance criteria. Add Requirements where needed. HARD GATE at exit — engineering-readiness sign-off before Sheet writes.

## Inputs

- Approved BusinessGoals + Requirements + draft UserStories from `discover`.
- The repo's existing code (for engineering judgment on slice size).

## The canvas rule for this phase

Same as `discover`: **draft locally, sync once, review in Sheet**. Refined Stories go through a `.codi/draft/decompose.json` file synced via `codi sheets sync-draft`. NO per-row upsert calls — that's the token-burning anti-pattern.

## Token-efficient draft+sync flow

```bash
# 1. Read existing Sheet state (Goals + Reqs + draft Stories from discover).
codi sheets list UserStory --json > /tmp/_existing.json    # or use Read on tab range

# 2. Refine Stories internally.

# 3. Write .codi/draft/decompose.json with the refined Stories. Each row:
#    {
#      "id": "US-001",                          # reuse the discover-phase id if applicable
#      "as_a": "...",
#      "i_want": "...",
#      "so_that": "...",
#      "acceptance_criteria": "AC1: ...\nAC2: ...",
#      "priority": "P0",
#      "assigned_to": "unassigned",
#      "elaborated_from": "REQ-NNN",
#      "parent_story": "US-NNN",                # only for splits
#      "status": "ready"                        # bumped from backlog
#    }
#    New rows added during refinement have no "id" → CLI mints US-NNN sequentially.

# 4. Sync in one shot:
codi sheets sync-draft .codi/draft/decompose.json
```

`sync-draft` is idempotent on `id` — refined Stories with the same id just update; new ones get fresh IDs.

## What stays in chat

- ONE summary line: _"Refined N stories → Sheet [URL]. M splits / K merges. Priority: P0=3, P1=5, P2=2. Draft at `.codi/draft/decompose.json`. Approve / redirect / edit-and-resync."_
- Brief one-liners for non-obvious decisions (split US-1.1 → US-1.1a + US-1.1b; merged US-2.1 + US-2.2 because identical seam).
- Clarifying questions (one per turn).
- HARD GATE approval ack.

## Steps

1. **Story-by-story refinement (internally).** For each candidate Story:
   - Sharpen `acceptance_criteria` (testable, observable).
   - Estimate engineering size; split if >1 PR (~500 LOC / ~3 days).
   - Set `priority`. One P0 max per Goal.
   - Wire `elaborated_from` and `parent_story` for splits.
2. **Write `.codi/draft/decompose.json`** in ONE Write tool call.
3. **Run `codi sheets sync-draft .codi/draft/decompose.json`** — ONE Bash call.
4. **Add Requirements lazily** — if a gap surfaces during refinement and needs a new REQ, append it to the draft and re-sync (still one command).
5. **Chain `plan-writing`** for any Story complex enough to warrant a stand-alone planning document. The plan-writing skill writes `docs/<ts>_[PLAN]_<slug>.md`. The Story carries `design_doc_path` later (populated by `feature-workflow.plan`).
6. **Surface ONE summary line.** Don't dump the Story list in chat.

## Exit criteria (gate: decompose-complete)

- Every Story has non-empty `acceptance_criteria`.
- Every Story has `priority` set.
- Every Story has `elaborated_from` set OR an explicit `parent_story`.
- **HARD GATE — engineering-readiness approval.** Human explicitly approves the Story list (with any final edits applied). Generic "looks good" is insufficient — the human acknowledges they understand the breakdown well enough to commit to delivering it.

## Anti-patterns

- Letting Stories stay vague ("improve auth flow") — every Story must point to a concrete acceptance criterion.
- Splitting Stories into sub-tasks instead of into Stories — sub-tasks belong inside `feature-workflow.decompose`, not here.
- Skipping the `priority` field with "we'll figure it out later" — forced prioritization surfaces the project's real shape.
- Auto-merging Stories across Requirements without explicit approval — N:1 (Stories per Requirement) is fine; M:N is a smell.

## Events emitted

- `phase_started phase=decompose`.
- `subagent_dispatched` — for `plan-writing` chains.
- `decision_recorded` — per Story split/merge/refinement.
- `artifact_linked` — for any planning docs written in `docs/`.
- `phase_completed phase=decompose`.
- `phase_transition_proposed decompose → sync`.
- `phase_transition_approved` (human-authored, HARD GATE).
