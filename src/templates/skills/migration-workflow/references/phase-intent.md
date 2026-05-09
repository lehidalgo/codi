# Phase: intent

Migrations are high-risk. Confirm goal and downstream impact before any work.

## Story handling at workflow entry

- **`--from-story US-NNN`** — read the parent Story; spawn a child with `parent_story=US-NNN`, `workflow_type=migration`, `as_a="system"` (or the actor named in the parent), `i_want=<schema/data change>`, `acceptance_criteria=<reversibility + integrity expectations>`, `status=in-progress`.
- **No `--from-story`** — standalone Story with `as_a="system"`, `workflow_type=migration`. The parent Requirement is often known after intent (e.g., REQ for compliance retention) — backfill `elaborated_from` once known.

The Story's execution columns (`branch`, `commit_shas`, `pr_url`, `started_at`) populate as the workflow advances.

## Process

Invoke `codi:discover` (mode `wide`) to confirm:

- The migration goal in plain language.
- The source and target schema (current shape → new shape).
- Downstream consumers — anything reading from or writing to the affected tables/columns.
- Whether the migration is reversible. If not, that is the highest-priority constraint.

HARD GATE — no implementation until the user explicitly approves the goal and the downstream impact map.

## Exit criterion

- [ ] Migration goal stated in plain language.
- [ ] Source schema documented (column types, constraints, current row count).
- [ ] Target schema documented (column types, constraints).
- [ ] Downstream consumer list complete.
- [ ] Reversibility flagged (yes / no / partial).
