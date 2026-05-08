# Phase: verify

Static validation only. Live data integrity is the next phase (`data-validation`).

## Exit criteria

- [ ] Type-check passes against the new schema.
- [ ] All existing tests pass.
- [ ] New schema definitions are committed alongside the migration scripts.
- [ ] Application code that reads/writes the affected schema is updated.
- [ ] No `[DEBUG-...]` instrumentation remains.

## What this phase does NOT cover

Live data integrity (counts, sample diffs, downstream consumers). That is `data-validation`. Do NOT propose transition to `done` from `verify` — go through `data-validation` first.

## Why both phases exist

`verify` catches:

- Type errors against the new schema.
- Missing application-code updates.
- Test failures from logic changes.

`data-validation` catches:

- Lost data, duplicated data.
- Sample rows transformed incorrectly.
- Downstream consumers reading the new shape and failing.

Static validation cannot prove data integrity. Live validation cannot prove type correctness. Both are required.
