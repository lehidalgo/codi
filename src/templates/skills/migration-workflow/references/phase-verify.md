# Phase: verify

<!-- BEGIN auto-generated chain — DO NOT EDIT -->

## Chain skills

- You **MUST** invoke `codi:verify-evidence`.
- Optionally, invoke `codi:test-suite` when regression-test suite — post-migration sanity.
- Optionally, invoke `codi:pr-review` when before opening PR — end-to-end review with gh CLI.
- Optionally, invoke `codi:security-scan` when post-migration schema audit.
- Optionally, invoke `codi:code-review` when auto_review flag enabled.

<!-- END auto-generated chain -->

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
