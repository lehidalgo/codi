# Phase: data-validation

<!-- BEGIN auto-generated chain — DO NOT EDIT -->

## Chain skills

- You **MUST** invoke `codi:verify-evidence` (pre/post metrics, row counts, schema diff).
- Optionally, invoke `codi:code-review` when auto_review flag enabled — migrations are highest-leverage place for review.

<!-- END auto-generated chain -->

The safety net. Schema migrations look clean in tests but fail on production data shape. This phase exists to catch what static tests cannot.

## Use `codi:verify-evidence`

Invoke `codi:verify-evidence` (5-step gate). Migration claims of "data integrity preserved" must be backed by actual measured counts and sample diffs, never by assertion. Without evidence, do NOT transition to `done`.

## Procedure

1. **Capture pre-migration counts and samples.** For every table/collection touched, record:
   - Total row count
   - Distribution of values in modified columns
   - A representative sample of rows (5–20)

2. **Run the migration in a representative environment** (staging, ideally a snapshot of production).

3. **Capture post-migration counts and samples.**

4. **Diff systematically:**
   - Row counts: should match unless the migration is intentional data deletion.
   - Distribution: should match, modulo the intended transformation.
   - Sample rows: each pre-row should map to a post-row per the migration's transformation function.

5. **Check downstream consumers:**
   - Run any consumer tests.
   - If the schema is exported via API, hit smoke endpoints and confirm shape.

6. **Document the evidence** as a `decision_recorded` event with the pre/post stats.

## Exit criteria

- [ ] Row count delta is explained (zero, or matches intended deletion).
- [ ] Sample of rows transformed correctly per migration logic.
- [ ] Downstream consumers pass health checks.
- [ ] Rollback procedure tested (if reversible).
- [ ] Evidence attached as `decision_recorded` events with the actual metrics.

## Optional: code review on the migration diff

Migrations are the highest-leverage place for `code-review`. When `.codi/config.yaml` declares `auto_review: true`, invoke `codi:code-review` mode `request` after verify-evidence and before proposing `done`. The reviewer subagent gets the migration script(s), the rollback path, and the pre/post metrics. It checks for common migration footguns (missing indexes added pre-backfill, NOT NULL on populated tables, schema/code drift). Critical or Important issues block the transition to `done`.

## When data-validation fails

- **Mismatch in counts** — stop. The migration either lost data or duplicated it. Do NOT transition to done. Either roll back (if reversible) or surface as a data integrity incident.
- **Mismatch in sampled transformation** — the migration logic is wrong. Roll back if possible. Re-enter `plan`.
- **Downstream consumer fails** — the contract change was undocumented. Either fix the consumer or revert.
