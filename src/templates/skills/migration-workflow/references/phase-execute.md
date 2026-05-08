# Phase: execute

Apply the migration in committed steps. NEVER in parallel.

## Setup

**Required:** invoke `devloop:worktrees` at the start of this phase for any migration with staging side-effects. The worktree keeps the migration script commits separate from main and gives a clean rollback boundary if the migration must be backed out.

## Sequential orchestration

For multi-step migration scripts (≥3 distinct DDL or backfill steps), invoke `devloop:subagent-orchestration` mode `sequential`. Each step gets a fresh implementer with the rollback path as context, and the two-stage review loop catches common footguns before the next step builds on top.

Single-step migrations: implement directly in the orchestrator session.

## Parallel forbidden

Migration steps NEVER run in parallel:

- Order matters: NOT NULL after backfill, indexes before backfill, etc.
- Partial state is unsafe: if step 2 fails halfway, step 3 must not have already started.
- Rollback boundaries are linear.

If the user pushes for parallelism, refuse and explain.

## Per-step capture

For each step, capture:

- Pre-step row count and a sample.
- The DDL or migration command run.
- Post-step row count and a sample.
- Exit code and any warnings.

These metrics feed the data-validation phase.

## Migration footgun catalog

Common issues the two-stage review catches:

- **NOT NULL on populated table** — must backfill first.
- **Missing index pre-backfill** — backfill runs full-scan.
- **Missing rollback statement** — no path back if step fails.
- **Schema/code drift** — application code expects old shape.
- **Data deletion without explicit user consent** — irreversible loss.
- **Forgetting to update materialized views or stored procedures** that depend on the changed schema.
