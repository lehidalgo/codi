# Mode: sequential

Execute a plan task-by-task. Per task: fresh implementer subagent → spec-compliance review → code-quality review → mark complete → next task.

## Preconditions

- A plan exists (from `codi:plan-writing` mode `plan`) with discrete tasks listed
- Tasks are mostly independent — they may build on each other but do not require simultaneous editing
- The user approved the plan (no work begins on an unapproved plan)
- Strongly recommended: invoke `codi:worktrees` first to land per-task commits on an isolated branch. Without it, every task's commits land on the orchestrator's current branch, and a single bad task pollutes the whole sequence with no clean rollback boundary.

## Setup (once)

1. **Read the plan file once.** Extract every task with full text and the section's surrounding context. Do not make subagents read the plan; pass them only what they need.
2. **Create a TodoWrite list** with every task. This is the orchestrator's progress tracker.
3. **Confirm working branch.** Do not start on `main`/`master` without explicit user consent.

## Per-task loop

### A. Dispatch implementer

Use the template in `implementer-prompt.md`. Fill in:

- TASK_NAME, TASK_TEXT (from plan, full)
- CONTEXT (where this task fits, dependencies, architectural notes)
- WORKING_DIRECTORY

The implementer follows TDD per its prompt and self-reviews before reporting.

### B. Handle implementer status

| Status               | Action                                                                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DONE`               | Proceed to spec review                                                                                                                                                                                                            |
| `DONE_WITH_CONCERNS` | Read concerns. Correctness/scope concerns → address before reviewing. Observations → note, proceed.                                                                                                                               |
| `NEEDS_CONTEXT`      | Provide the missing context. Re-dispatch with same model.                                                                                                                                                                         |
| `BLOCKED`            | Diagnose: context gap → re-dispatch with more context. Reasoning gap → re-dispatch with more capable model. Task too large → break into pieces and update the plan. Plan wrong → escalate to user. NEVER re-dispatch identically. |

### C. Stage 1 — Spec-compliance review

Dispatch a fresh spec reviewer subagent (template in `spec-reviewer-prompt.md`). The reviewer checks: does the implementation match what the spec asked for, no more and no less.

- ✅ Pass → proceed to stage 2
- ❌ Issues found → re-dispatch the same implementer to fix; re-review until ✅

Spec compliance comes BEFORE code quality. Wrong order wastes review effort: code-quality review on code that does not match the spec is review of the wrong thing.

### D. Stage 2 — Code-quality review

Two options for stage 2:

**Option A — inline review.** Dispatch using `code-quality-reviewer-prompt.md`. Cheaper, single skill.

**Option B — chain to `code-review` mode `request`.** Recommended when the project has `auto_review: true` configured, or for high-stakes tasks. Same prompt structure, same JSON verdict schema. Sets up the integration so phase verify's `code-review` is consistent with stage-2 reviews here.

- ✅ Pass → mark task complete in TodoWrite
- ❌ Issues found → implementer fixes; re-review until ✅

### E. Mark task complete

Update TodoWrite. Commit if not already committed. Move to next task.

## After all tasks

1. **Final review.** Dispatch a holistic code reviewer over the integrated branch (use `code-review` mode `request` with `WHAT_WAS_IMPLEMENTED` covering the whole feature).
2. **Run validation.** `pnpm run validate` (or equivalent). Fail = enter remediation loop on the failing piece.
3. **Hand back to the orchestrating workflow.** This skill terminates; the calling workflow's phase execute is complete.

## Anti-patterns specific to mode sequential

- **Parallel implementers** — never. Two implementers editing overlapping code corrupts commits. If you need parallelism, use mode `parallel` on independent failures, not on plan tasks.
- **Skipping stage 1.** Code-quality review on non-compliant code wastes both the reviewer and the implementer.
- **Self-review replacing reviewer review.** Implementer self-review is one signal; reviewer review is independent verification. Both required.
- **Letting reviewer become implementer.** Reviewers report; they do not fix. The implementer fixes. Keeps roles clean.
- **Loading subagents with session history.** Pass the task text + context. They do not need to know what you and the user discussed last week.
- **Continuing to next task with open review issues.** A failing review = task not done. Period.

## Cost-benefit

Mode sequential costs more per task than direct implementation:

- 1 implementer dispatch + 1 spec review + 1 code-quality review = 3 subagent invocations minimum
- Re-review loops add iterations

But it catches issues earlier (cheaper than debugging after merge), provides per-task quality gates, and preserves the orchestrator's context for higher-level coordination.

## When this mode is overkill

- Plan has 1-2 tasks → run them in the orchestrator session directly
- Tasks are trivial (renames, comments) → direct edits, no subagent
- The user is iterating fast on design and the plan is unstable → discover/plan-writing first, then come here when stable

## Manifest events

- `subagent_dispatched` per implementer / per reviewer
- `subagent_completed` with status + role (implementer | spec-reviewer | quality-reviewer)
- `subagent_failed` for BLOCKED or schema-invalid responses
- `decision_recorded` when controller pushes back on a reviewer (e.g., reviewer hallucinated)

## Integration with workflow phase execute

When invoked from `feature-workflow` phase execute (or any workflow with discrete tasks in the plan):

1. Workflow's phase execute reference says "use `subagent-orchestration` mode `sequential` if the plan has ≥3 independent tasks; otherwise direct implementation".
2. This skill runs the implementer → reviewer loop per task.
3. On termination, control returns to the workflow, which transitions to phase verify.
