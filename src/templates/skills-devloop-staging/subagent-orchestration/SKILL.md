---
name: subagent-orchestration
description: Use when ≥2 problems are independent and parallelism saves wall-clock time, or when executing a structured plan with discrete tasks that need quality gates after each. Triggers on "dispatch agents", "fan out", "execute the plan with subagents", "delegate this task", "multiple unrelated bugs", "run these in parallel". Replaces ad-hoc Task tool use and prevents context-pollution between coordinator and worker. Body documents the two modes and the implementer status protocol. Phase execute of any workflow when the plan has ≥3 discrete tasks, or when ≥2 unrelated investigations can run concurrently. Standalone via `/devloop:subagent-orchestration` for ad-hoc fan-out or plan execution outside the workflow phases.
---

# subagent-orchestration

Subagents scale beyond a single context window without polluting the main session.

## Pick a mode

| Mode         | Shape                     | Use when                                                              |
| ------------ | ------------------------- | --------------------------------------------------------------------- |
| `parallel`   | fan-out / fan-in          | N independent problems and parallelism saves wall-clock time          |
| `sequential` | task-by-task with reviews | Executing a plan; tasks may share state; quality gate after each task |

## Core principle

Subagents NEVER inherit the session's context. The orchestrator constructs exactly what they need: specific scope, clear goal, constraints, expected output schema.

## Universal rules

1. No shared session history.
2. Specific scope — one file, one bug, one task.
3. Structured expected-output schema.
4. Status handling — DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED. Each gets a different response. Never silently retry the same dispatch.
5. Never dispatch parallel implementers in mode `sequential`.
6. Verify the integrated result after fan-in or final task.

Full status protocol and model-selection guidance: `references/protocol.md`.

## References

- `references/mode-parallel.md` — fan-out pattern, scope partitioning, integration discipline.
- `references/mode-sequential.md` — implementer-dispatch loop, two-stage review, status handling per task.
- `references/protocol.md` — full status table, model selection by task complexity.
- `references/implementer-prompt.md` — template for implementer subagent dispatch.
- `references/spec-reviewer-prompt.md` — template for spec-compliance review (stage 1).
- `references/code-quality-reviewer-prompt.md` — template for code-quality review (stage 2).

## Anti-patterns

- "Fix all the tests" — scope too broad.
- Multiple implementers in parallel on related code (mode sequential).
- Skipping the review loop in mode sequential.
- Letting the implementer read the plan file (provide full text).
- Accepting "close enough" on spec compliance.
- Re-dispatching a BLOCKED task to the same model without changing anything.
- Forgetting to run the full integrated test suite after fan-in.

## Termination and events

- `subagent_dispatched` per dispatch
- `subagent_completed` per return (status, model, tokens)
- `subagent_failed` for BLOCKED or schema-validation failures
- Mode parallel terminates when all returned and integrated tests pass.
- Mode sequential terminates when the last task is DONE and both reviewers approve.

## Boundaries

- Mode `sequential` stage-2 review can defer to `devloop:code-review` mode `request` — same JSON verdict schema. Mutually exclusive; pick one path per task.
- Does NOT replace `verify-evidence`. Verify-evidence is phase verify; this skill is phase execute.
- For solo investigations, use the Task tool directly — orchestration overhead is not justified.
- Pairs with `devloop:worktrees` so per-task commits land on an isolated branch.
