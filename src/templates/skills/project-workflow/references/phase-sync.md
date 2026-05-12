# Phase: sync

<!-- BEGIN auto-generated chain — DO NOT EDIT -->

## Chain skills

- You **MUST** invoke `codi:dev-sheets-sync` (caller=bootstrap — push Goals/Stories to Sheet).

<!-- END auto-generated chain -->

Push the approved BusinessGoals, Requirements, and UserStories to the project Sheet. This is the only phase authorized to write planning columns.

## Inputs

- Approved strategic layer (Goals + Requirements) from `discover`.
- Approved decomposition (Stories) from `decompose`.
- Configured Sheet ID + credentials from `intent`.

## Steps

1. **Open `sheets-sync` with `caller=bootstrap`.** This is the only caller scope authorized to write planning columns.
2. **Upsert Goals** — one row per BusinessGoal. IDs assigned monotonically (`BG-001`, `BG-002`, ...).
3. **Upsert Requirements** — one row per Requirement, with `satisfies` pointing to the Goal ID.
4. **Upsert Stories** — one row per UserStory, with `elaborated_from` pointing to the Requirement ID and (optionally) `parent_story` for follow-on work.
5. **Idempotent on `--update` mode.** Existing rows whose written columns match the proposed values are no-ops (the sheets-sync diff check handles this). New rows are appended.
6. **Audit row per write.** Every write also appends to the `Audit` tab via the same atomic batch.

## Exit criteria (gate: sync-complete)

- Every approved Goal / Requirement / Story has a corresponding `sheet_row_upserted` event in the manifest.
- No `zone_violation` errors emitted.
- No `schema_invalid` errors emitted.
- If any `sheet_sync_queued` events remain (Sheet was unreachable mid-write), the daemon is running OR `codi sheets reconcile` has been executed.

## Anti-patterns

- Calling `sheets-sync` with `caller=execution-only` from this phase — planning columns would be refused. ALWAYS `caller=bootstrap` here.
- Hand-writing rows in the Sheet UI before `sync` runs — the agent then proposes the same content, creating duplicates if IDs differ.
- Skipping `sync` because "we already filled the Sheet manually" — the manifest event log won't reflect the rows; later workflows can't trace.

## Events emitted

- `phase_started phase=sync`.
- `sheet_row_upserted` — one per Goal / Requirement / Story written.
- `sheet_sync_queued` — on transient Sheet unavailability.
- `sheet_sync_failed` — on schema or zone violations (should not happen in a well-formed flow).
- `phase_completed phase=sync`.
- `phase_transition_proposed sync → done`.
- `phase_transition_approved` (auto-approved if all writes succeeded; human only if errors occurred).
- `workflow_completed`.
