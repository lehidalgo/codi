# Operations — write / read / reconcile

Step-by-step for the three primitives. The skill body summarizes; this document is the contract implementations follow.

## `upsert(entity, row)`

Idempotent upsert. Returns the upserted row (with assigned ID if new).

1. **Read config.** Load `.codi/project.json`. If `sheet_id` is missing, ELICIT — surface the prompt to the user, never invent. Recommended path: run `project-workflow` first.
2. **Load credentials.** Read `~/.config/codi/credentials.json` (or path from config). If missing, ELICIT.
3. **Validate row.** Run AJV-style validation against the entity schema. Reject with `schema_invalid` on failure.
4. **Zone check.** Compare written columns against the caller's allowed zone (`project-workflow.sync` → all; everyone else → execution only). Reject with `zone_violation` on failure.
5. **Diff against current.** Read the current row (if it exists). If every written column matches existing values, return the existing row unchanged — no API call, no event.
6. **Atomic batch write.** Issue a single Sheets `batchUpdate` request that:
   - Updates the entity row (creates if `row.id` is absent — assign next monotonic ID).
   - Appends a row to `Audit` (`event_type`, `entity_id`, `actor=git config user.email`, `timestamp`, `payload_json`).
7. **Emit event.** `sheet_row_upserted` with `{ entity, row_id, columns_written }`.
8. **On API failure (5xx / network):** emit `sheet_sync_queued` and return; daemon retries.

## `read(entity, id)`

Read a row, validate, return parsed.

1. Read config + credentials (ELICIT if missing).
2. Fetch row from `<entity>` tab WHERE `id = <id>`.
3. If not found, return `null`.
4. Validate against entity schema. If invalid, raise — Sheet has been corrupted.
5. Return parsed row object.

## `reconcile()`

Rebuilds the Sheet's execution columns from the manifest event log. Manual command, idempotent.

1. Read config + credentials.
2. Stream `.codi/manifest/events.jsonl` from the start.
3. For each Story-mutating event, replay into an in-memory state map keyed by `story_id`.
4. For each story id in the map, **upsert execution columns only** to the Sheet — bypass diff (force-write to overwrite any divergence).
5. Do NOT touch planning columns. Hand-edits to `as_a`, `acceptance_criteria`, etc. are preserved.
6. Append a single `Audit` row with `event_type=sheet_reconciled` and `payload_json={ rows_reconciled: N }`.
7. Emit `sheet_reconciled` event with the count.

## ID assignment

When `upsert` is called with `row.id` absent, the implementation assigns the next ID:

1. Fetch the entity tab's `id` column.
2. Parse the highest existing numeric suffix (`US-001` → `1`, `US-014` → `14`).
3. Assign `<prefix>-<max + 1>` zero-padded to 3 digits (or the existing pad width if larger).
4. Never reuse IDs — even if a row was deleted.

## Atomicity notes

Google Sheets `batchUpdate` IS atomic — all included writes commit together or fail together. Audit-row + entity-row writes are bundled into one `batchUpdate` so a successful entity write always has a matching audit row.

If the batch fails partway (rare; usually rate-limit), Sheets rolls back. The caller sees a 5xx and queues.
