# Phase: plan

<!-- BEGIN auto-generated chain — DO NOT EDIT -->

## Chain skills

- You **MUST** invoke `codi:plan-writing`.
- Alternatively, invoke `codi:discover` if plan needs sharpening — mode sharpen.
- Optionally, invoke `codi:dev-gate-deep-modules` when validate the new shape matches the deepening rationale.
- Optionally, invoke `codi:dev-gate-plan-coverage` when before transition to execute.

<!-- END auto-generated chain -->

Extended plan template specific to refactors.

## Phase chain

1. **`codi:plan-writing`** (mode `plan`) writes the refactor plan markdown.
2. **`codi:discover`** (mode `domain` when the refactor touches existing ADRs in `docs/adr/` or terms in `docs/CONTEXT.md`; otherwise mode `sharpen`). Cross-references the plan against documented decisions and surfaces contradictions.
3. Propose transition to `execute` after both complete.

## Refactor plan template additions

Same as feature-workflow plan plus these three sections:

```markdown
## Behavior preservation

List behaviors that MUST NOT change. These map directly to baseline tests.

## Module depth analysis

For each module in scope:

- Current state: shallow / deep
- Target state: shallow / deep
- Deepening rationale: <why this concentrates complexity, what callers gain>

## Seams introduced or removed

- New seams: <list>
- Old seams removed: <list>
- Why each change in seams is justified
```

## Deletion test on each module

Apply the deletion test as part of `Module depth analysis`:

- Imagine deleting the module.
- If complexity vanishes → it was a pass-through (target shallow, merge into caller).
- If complexity reappears across N callers → it was earning its keep (target deep, keep).

## ADR cross-check

If the plan contradicts an existing ADR, surface the contradiction to the user before writing more. Either the ADR is outdated (propose a new ADR superseding) or the plan is wrong (revise).
