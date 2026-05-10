# Phase: plan

<!-- BEGIN auto-generated chain — DO NOT EDIT -->

## Chain skills

- You **MUST** invoke `codi:plan-writing`.
- Alternatively, invoke `codi:discover` if plan needs sharpening — mode sharpen.
- Optionally, invoke `codi:gate-plan-coverage` when before proposing transition to decompose.
- Optionally, invoke `codi:gate-deep-modules` when structural concerns surface in plan review.

<!-- END auto-generated chain -->

Goal: design the feature concretely. End the phase with a written plan that any teammate (human or agent) can pick up and execute.

## How to run this phase (chained skills)

The phase order is strict — each step depends on the previous:

1. **`codi:plan-writing`** (mode `plan`) writes `docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md` with atomic 2-5min tasks, complete code blocks, and no placeholders. This is the artifact phase plan produces. Do NOT improvise the plan structure — the skill prescribes it (see `references/plan-template.md` inside the skill).
2. **`codi:discover`** (mode `sharpen` if `docs/CONTEXT.md` is sparse; mode `domain` if it has ≥5 terms or `docs/adr/` has approved ADRs in the area). The skill walks the decision tree of the just-written plan branch by branch, surfaces ambiguities and contradictions against the codebase, and updates `CONTEXT.md` inline if it is in mode `domain`.
3. **Run the gate**: `codi gate run plan-complete`. Address any failed checks per the structured feedback format.
4. Propose transition to `decompose` only after all three: plan markdown exists, discover dialogue ends with explicit user approval, gate passes.

For each file the plan declares in "Files to be modified", emit a `scope_expansion_proposed` event via `codi scope propose-expansion` so `manifest.scope.files_in_plan` is populated before phase execute begins.

## What you produce

- `docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md` — the plan, committed to the repo
- `design_doc_authored` event with `payload.design_doc_path` and `payload.story_id` (if `from_story_id` was set on init) — emitted at the moment the plan markdown is written
- `manifest.scope.files_in_plan` populated via `scope_expansion_approved` events
- `decision_recorded` events for any architectural choice taken
- ADR proposals for choices that pass the triple test (see below)
- Updated `CONTEXT.md` if new domain terms appeared

After emitting `design_doc_authored`, sync the path to the Sheet so the Story row carries the design doc reference:

```bash
codi sheets upsert UserStory '{"id":"US-NNN","design_doc_path":"docs/<ts>_[PLAN]_<slug>.md"}'
```

If the workflow had no `--from-story` (free-running mode), the Story id is the one auto-created at end of intent.

## Plan document structure

Write the plan in the categorized doc style: `docs/YYYYMMDD_HHMMSS_[PLAN]_<feature-slug>.md`. The plan must include:

```markdown
# Plan: <feature name>

| Field    | Value         |
| -------- | ------------- |
| Status   | draft         |
| Workflow | <workflow_id> |

## Context

Why this feature exists. Reference the intent summary.

## Scope

### In scope

- <bullet>

### Out of scope

- <bullet>

## Files to be modified

List every file that will change, with a one-line description of why.
This becomes manifest.scope.files_in_plan.

## Modules and contracts

For each module being added or changed, describe:

- The interface (signatures, invariants, error modes)
- Why this shape (deep module rationale — what does the interface let callers ignore?)
- Whether it is a new seam or an existing one

## Test strategy

Which behaviors will be tested, at what seam (unit, integration, e2e),
and which existing tests need to change.

## Success criteria

Copy from intent. Reaffirm now that planning is concrete.

## Risks

Each risk: what could break, how we detect it, what mitigates it.

## Open questions

List any unresolved decisions. None should remain by gate time.
```

## Deep module thinking

Before finalizing the plan, ask for each new module:

- **Depth check**: is the interface much smaller than the implementation? If interface ≈ implementation, the module is shallow — usually a sign the abstraction is not earning its keep.
- **Deletion test**: imagine deleting this module. If complexity vanishes (no callers were really benefiting), it was a pass-through. If complexity reappears across N call sites, it was deep enough to keep.
- **Locality check**: does this module concentrate concerns or spread them? Concentrated > spread.

When you find shallow modules in the plan, propose deepening them. The `gate-deep-modules` agent gate will look for this in M3.

## When to propose an ADR

Apply the triple test. All three must hold:

1. **Hard to reverse** — changing this later costs real work
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **Result of a real trade-off** — there were genuine alternatives with their own merits

If yes to all three, propose an ADR via:

```bash
codi adr propose --title "<title>" --rationale "..."
```

(In M1, this is a manifest CLI append. M3 wraps it.)

Wait for human approval. On approve, write `docs/adr/NNNN-<slug>.md` and append `adr_approved` event with the path.

## Populating files_in_plan

For each file you decide will change:

```bash
codi scope propose-expansion --reason "<why> — phase plan"
```

Wait for human approval. The file gets added to `manifest.scope.files_in_plan`. Repeat per file.

In M3 this can be batched per file list. In M1, per-file is the rule.

## When to transition to decompose

You are ready when:

- [ ] Plan markdown is committed at `docs/[PLAN]_*.md`
- [ ] `manifest.scope.files_in_plan` is populated with every file the plan declares
- [ ] All ADR triple-test decisions have approved ADRs
- [ ] No open questions remain
- [ ] Success criteria are unchanged or reaffirmed
- [ ] CONTEXT.md updates done inline

Then propose:

```bash
codi transition --to decompose
```

## Common mistakes

- Writing the plan as prose without listing files. The system cannot enforce scope without an explicit file list.
- Listing files but not committing the markdown plan. The reviewer cannot read your reasoning months later.
- Skipping the ADR triple test. Hidden trade-offs become "why on earth" surprises in PR review.
- Designing implementation details. The plan is about contracts and modules, not loops and conditions.
- Mixing planning and coding. Stay out of `Edit` and `Write` for source files until phase `execute`.
