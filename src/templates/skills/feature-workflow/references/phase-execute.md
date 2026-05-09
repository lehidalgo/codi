# Phase: execute

Goal: implement the slices in order, observing scope rules and recording every change.

## How to run this phase (chained skills)

If the work is ≥1 hour or ≥3 commits, invoke `codi:worktrees` first to create an isolated worktree on the workflow's branch. This keeps the main working tree clean and gives `subagent-orchestration` a stable place to land per-task commits.

For each slice you implement, follow `codi:tdd` (Iron Law: no production code without a failing test first). The TDD cycle is Red → Green → Refactor:

1. Write a test that exercises the slice's acceptance criterion.
2. Run it; confirm it fails for the right reason.
3. Write the minimum code to make it pass.
4. Refactor without changing behavior; tests stay green.

If the slices are independent (no shared state, no sequential dependencies), invoke `codi:subagent-orchestration` mode `parallel` to fan out to subagents instead of running them serially.

If the plan has ≥3 discrete tasks that share state or build on each other (most multi-slice features), invoke `codi:subagent-orchestration` mode `sequential` instead — fresh implementer per task with two-stage review (spec compliance → code quality) before each task is marked complete. Stage-2 review may chain to `codi:code-review` mode `request` when `auto_review: true` is set.

When a test fails unexpectedly during execute, invoke `codi:diagnose` (4-phase systematic debugging) — do not start guessing fixes.

## What you produce

- Real code changes in files declared in `scope.files_in_plan`
- Tests for each slice as it lands
- Validation runs that pass before proposing transition to verify
- Inline updates to `CONTEXT.md` and ADRs as new domain terms or decisions emerge
- Recorded `incidental_change_recorded` events for trivial cross-file fixes
- Recorded `scope_expansion_*` events for any non-trivial scope changes

## How to execute one slice

1. Re-read the slice definition from the manifest.
2. Read the relevant files. Do not assume they look the same as last time.
3. Implement the change. Stay within `scope.files_in_plan`.
4. Run validation locally:
   ```bash
   pnpm run validate
   ```
5. Append a `validation_run` event with the exit code.
6. If green, move to the next slice. If red, fix and re-run before continuing.

## Scope rules during execute

The hook layer (M2) blocks edits outside `scope.files_in_plan`. Until M2 ships, follow the discipline manually:

- **In-scope edit**: proceed normally.
- **Out-of-scope, but trivially incidental** (single import, single type assertion, single typo): the system records an `incidental_change_recorded` event. Proceed.
- **Out-of-scope, real logic change**: stop. Run:

  ```bash
  codi scope propose-expansion --reason "<why>"
  ```

  Wait for human approval. Only proceed when approved.

If the proposed expansion is structural (touches public interfaces in multiple files, requires a refactor), the classifier may suggest **elevation** to a child workflow. See "Elevation" below.

## Elevation to child workflow

When a scope expansion is too big for the current workflow type, the system proposes elevation:

```
elevation_proposed: refactor
trigger: public_interface_change_in_multiple_files
```

The agent presents this to the human:

> The scope expansion you proposed crosses a structural threshold. The system recommends elevating to a child `refactor` workflow. This pauses the current feature workflow on its own branch. Approve?

On approve:

1. The system creates a child workflow on a separate branch (`codi/<parent-id>/<child-id>`).
2. The current workflow pauses with `workflow_paused_for_child`.
3. The agent works the child workflow to completion.
4. Once the child is merged, the parent resumes — but **forced back to phase `plan`** so the plan can be revalidated against the new codebase state.

This flow ships in M4. Until then, document the decision and abandon the workflow if structural elevation is required.

## Knowledge updates inline

If during execute you discover:

- A domain term that should be canonical: add to `CONTEXT.md` immediately. Append `context_term_added`.
- A previously unknown decision that meets the triple test: propose ADR. Wait for approval. Append `adr_approved`.

Do not batch these for "after the workflow". They must be recorded in the same session where the discovery happened.

## When to transition to verify

You are ready when:

- [ ] Every slice from `decompose` is implemented
- [ ] Tests for each slice exist and pass
- [ ] `pnpm run validate` exits 0
- [ ] Every file in `scope.files_in_plan` has at least one recorded edit
- [ ] No scope expansion proposal is pending resolution
- [ ] CONTEXT.md and ADRs reflect any new terms or decisions

Then propose:

```bash
codi transition --to verify
```

## Common mistakes

- Editing files outside scope without proposing expansion. The hook layer (M2) blocks this; until then it is dishonest.
- "Fixing" a failing test by deleting it or changing its assertion. That is gate fraud.
- Skipping `validation_run` events. The verify gate looks at the last one.
- Implementing slices out of dependency order.
- Bundling multiple slices into one diff. The slice boundary is the audit unit.
