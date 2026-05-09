# Plan template

The structure of `docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md` for mode `plan`.

```markdown
# Plan: <Feature name>

| Field    | Value                |
| -------- | -------------------- |
| Status   | draft                |
| Workflow | <workflow-id>        |
| Created  | YYYY-MM-DD HH:MM UTC |
| Author   | <author-id>          |

## Context

<1-2 paragraphs: why this plan exists, what discover surfaced, links to relevant ADRs and CONTEXT.md terms. Keep it short — the plan is the artifact, not the narrative.>

## Scope

### In scope

- <bullet>
- <bullet>

### Out of scope

- <bullet>
- <bullet>

## Files to be modified

| File                        | Action | Why               |
| --------------------------- | ------ | ----------------- |
| `src/path/to/new.ts`        | Create | <one-line reason> |
| `src/path/to/existing.ts`   | Modify | <one-line reason> |
| `tests/path/to/new.test.ts` | Create | <one-line reason> |

Each row maps 1:1 to a `scope_expansion_proposed` event the agent emits during this phase. After the user approves each, `manifest.scope.files_in_plan` will contain every file listed.

## Modules and contracts

### `<ModuleName>` (new)

- **Export shape**: `<signature>`
- **Props/inputs**: <list>
- **Outputs**: <list>
- **Internal state** (if applicable): <description>
- **Behavior**:
  1. <what it does, step 1>
  2. <step 2>
- **Error modes**: <how it fails, what it returns/throws>
- **Why this shape**: <deep module rationale — what does the interface let callers ignore?>
- **Deletion test**: <if removed, would complexity vanish or scatter? — should be the latter>

### `<ModuleName>` (existing, modified)

Same structure. Note explicitly what changes vs the existing version.

## Test strategy

- **Seam**: <where the tests attach — unit, integration, e2e>
- **Behaviors covered**: <list>
- **Test runner**: <which command runs them, e.g., `pnpm test`>
- **Existing test changes**: <which existing tests need updating, why>

## Tasks

Detailed task list with bite-sized steps (2-5 min each). See `references/mode-plan.md` for the per-task structure.

### Task 1: <name>

[Files block, steps with code blocks, run commands with expected output, commit step]

### Task 2: <name>

[same structure]

[...]

## Success criteria

Copied from intent and reaffirmed. Each criterion is testable.

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Risks

| Risk   | Detection         | Mitigation        |
| ------ | ----------------- | ----------------- |
| <risk> | <how it surfaces> | <what reduces it> |

## Open questions

None should remain at gate time. If any survive, run `codi:discover` (mode sharpen) before transitioning.

## Self-review

Run the self-review checklist (`references/self-review.md`) before claiming this plan is ready. Fix issues inline; do not transition with placeholders, contradictions, or open questions.
```
