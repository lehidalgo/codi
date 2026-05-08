# Phase: plan

Migration plans MUST include a rollback path and a validation strategy.

## Phase chain

1. **`devloop:plan-writing`** (mode `plan`) writes the migration plan. Migration plans extend the standard template with the sections below.
2. **`devloop:discover`** (mode `domain` when the migration touches schema-related ADRs or domain terms; otherwise mode `sharpen`). Cross-references the plan against existing decisions about the data model and surfaces contradictions before any DDL runs.
3. Propose transition to `execute` only after the plan exists, the dialogue ends with approval, and the rollback path is explicit.

## Migration plan template additions

```markdown
## Migration sequence

Step-by-step DDL / data manipulation. Each step is independently committable.

## Rollback path

For each step: how to undo it. If a step is irreversible, mark it explicitly and explain why.

## Validation strategy

What pre/post measurements will prove integrity. Names tables, sample size, distribution checks, downstream-consumer smoke endpoints.

## Files to be modified

Exact DDL file paths, migration script paths, and any application code that reads/writes the affected schema.
```

## Common requirement: backfill before NOT NULL

If the migration adds a NOT NULL constraint on an existing column:

1. Add the column nullable.
2. Backfill existing rows with the appropriate default.
3. Apply NOT NULL.

Skipping the backfill step makes the NOT NULL fail on existing rows.

## Common requirement: index before backfill

If a backfill query filters on a column, the index for that column should exist BEFORE the backfill runs. Otherwise the backfill runs full-scan and may take hours on large tables.
