# Event-to-column mapping

The full projection from manifest events to Sheet writes. `sheets-sync` consults this table per event and writes only the listed columns.

## Mapping table

| Event                                           | Target row          | Columns updated                                                                                  | Status set to                                      |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `workflow_started` (with `--from-story US-NNN`) | `UserStory[US-NNN]` | `workflow_type`, `branch`, `started_at`, `assigned_to`, `status`                                 | `in-progress`                                      |
| `workflow_started` (no `--from-story`)          | New `UserStory` row | All execution + minimal planning (`as_a=null`, `i_want=<workflow description>`, `workflow_type`) | `in-progress`                                      |
| `phase_transitioned` (`plan` → `decompose`)     | `UserStory[US-NNN]` | `status`                                                                                         | (unchanged unless terminal)                        |
| `phase_transitioned` (`verify` → `done`)        | `UserStory[US-NNN]` | `status`, `completed_at`                                                                         | `delivered` if PR already merged, else `in-review` |
| `commit_landed`                                 | `UserStory[US-NNN]` | `commit_shas` (append)                                                                           | (unchanged)                                        |
| `design_doc_authored` (during `plan` phase)     | `UserStory[US-NNN]` | `design_doc_path`                                                                                | (unchanged)                                        |
| `pr_opened`                                     | `UserStory[US-NNN]` | `pr_url`, `pr_state`                                                                             | `in-review`                                        |
| `pr_merged` (CI / webhook)                      | `UserStory[US-NNN]` | `pr_state`, `merged_sha`, `merged_at`, `completed_at`                                            | `delivered`                                        |
| `workflow_abandoned`                            | `UserStory[US-NNN]` | `completed_at`, `status`                                                                         | `abandoned`                                        |
| `material_ingested` (from `ingest-material`)    | none directly       | (project-workflow consumes this in `discover` phase)                                             | —                                                  |
| `sheet_reconciled` (emitted by `reconcile`)     | `Audit` only        | row count in payload                                                                             | —                                                  |

## Audit row (emitted on every Sheet write)

Every successful upsert / append also writes one row to the `Audit` tab:

| Column         | Source                              |
| -------------- | ----------------------------------- |
| `event_id`     | manifest event UUID                 |
| `event_type`   | name from manifest                  |
| `entity_id`    | target row id (`US-NNN` etc.)       |
| `actor`        | `git config user.email`             |
| `timestamp`    | ISO 8601, captured at write time    |
| `payload_json` | the event payload, JSON-stringified |

## Zone enforcement

Caller-aware rules:

- `project-workflow.sync` may write **planning + execution** columns. It is the only caller authorized for planning columns.
- All other callers (`feature-workflow`, `bug-fix-workflow`, `refactor-workflow`, `migration-workflow`, `sheets daemon`) may write **execution columns only**. Attempts to write planning columns raise an error and emit `sheet_sync_failed` with reason `zone_violation`.

## Failure modes

| Symptom                                                    | Action                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sheets API 4xx (auth / quota)                              | Log + emit `sheet_sync_failed`. Do NOT queue. Surface to user.                                              |
| Sheets API 5xx (transient)                                 | Emit `sheet_sync_queued`. Daemon retries with exponential backoff.                                          |
| Network unreachable                                        | Emit `sheet_sync_queued`.                                                                                   |
| Schema validation failed (bad row data)                    | Hard error, refuse the write, emit `sheet_sync_failed` with reason `schema_invalid`.                        |
| Zone violation (planning column from non-bootstrap caller) | Hard error, refuse, emit `sheet_sync_failed` with reason `zone_violation`.                                  |
| Row not found (read / reconcile against deleted row)       | Soft error: emit `sheet_sync_failed` with reason `row_missing`; pause writes for that row pending operator. |
