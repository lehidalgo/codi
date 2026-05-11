import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when ≥2 problems are independent and parallelism saves wall-clock time,
  or when executing a structured plan with discrete tasks that need quality
  gates after each. Triggers on "dispatch agents", "fan out", "execute the
  plan with subagents", "delegate this task", "multiple unrelated bugs",
  "run these in parallel", "dispatch parallel agents", "parallel debug",
  "investigate these in parallel", "concurrent investigation", "multiple
  independent failures". Replaces ad-hoc Task tool use and prevents
  context-pollution between coordinator and worker. Body documents the two
  modes (parallel / sequential), the parallel-mode independence iron law
  (independence must be proven before dispatch), and the implementer status
  protocol. Phase execute of any workflow when the plan has ≥3 discrete
  tasks, or when ≥2 unrelated investigations can run concurrently.
  Standalone via \`/${PROJECT_NAME}:{{name}}\` for ad-hoc fan-out or plan
  execution outside the workflow phases.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 2
---

# {{name}}

Subagents scale beyond a single context window without polluting the main session.

## Pick a mode

| Mode         | Shape                     | Use when                                                              |
| ------------ | ------------------------- | --------------------------------------------------------------------- |
| \\\`parallel\\\`   | fan-out / fan-in          | N independent problems and parallelism saves wall-clock time          |
| \\\`sequential\\\` | task-by-task with reviews | Executing a plan; tasks may share state; quality gate after each task |

## Core principle

Subagents NEVER inherit the session's context. The orchestrator constructs exactly what they need: specific scope, clear goal, constraints, expected output schema.

## Universal rules

1. No shared session history.
2. Specific scope — one file, one bug, one task.
3. Structured expected-output schema.
4. Status handling — DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED. Each gets a different response. Never silently retry the same dispatch.
5. Never dispatch parallel implementers in mode \\\`sequential\\\`.
6. Verify the integrated result after fan-in or final task.

Full status protocol and model-selection guidance: \\\`references/protocol.md\\\`.

## Parallel mode — independence iron law

Mode \\\`parallel\\\` only applies when the failure domains are GENUINELY
INDEPENDENT. Independence must be proven before dispatch — a failed
parallel run (agents step on each other, results conflict, you re-do the
diagnosis) costs more than serial work. The cost of getting it wrong is
high; the cost of pausing to prove independence is low.

A domain is independent only if ALL three hold:

1. **No shared state** — agents do not read or write the same files, data
   structures, or database rows during their work.
2. **No sequential dependency** — agent B's input does not depend on agent
   A's output.
3. **No coordination need** — the integration step combines results
   mechanically (concatenate findings, merge reports), not via
   re-diagnosis.

If any one fails, this is not a parallel-dispatch case. Either decouple
the domains first (split shared files, decouple data flow) or stay
sequential.

The 3+ threshold matters: 2 small tasks are usually faster handled
inline. Only escalate to parallel dispatch when serial wall-clock time
clearly dominates the coordination cost of fan-out.

### Pattern (apply in order, never skip)

1. **Identify domains** — write down the N domains by name; for each pair
   confirm the three-part independence test. If any pair fails, STOP and
   either split the work or stay sequential.
2. **Build focused per-agent prompts** — self-contained (full context),
   narrow (one domain per agent, never bundle "and also look at X"),
   output-shaped (state required result schema), token-bounded ("under
   300 words" beats unbounded).
3. **Dispatch concurrently** — send all N Agent tool calls in a SINGLE
   message. Multiple Agent tool uses in one assistant turn run in
   parallel; multiple turns run sequentially. Never dispatch
   one-per-turn.
4. **Integrate mechanically** — combine per-domain reports under
   per-domain headers; cross-check confidence scores; if two reports
   contradict on a shared assumption, that signals Step 1 was wrong (the
   domains were not actually independent). Do not paper over conflicts.
   If integration requires re-investigating any domain, the parallel
   dispatch failed — document why for the next attempt and continue
   serially.

If you catch yourself thinking "I will let agents figure out
coordination", "two agents touched the same file but it should be fine",
or "results came back conflicting and I had to redo the diagnosis", STOP
and re-apply the independence test before proceeding.

## References

- \\\`references/mode-parallel.md\\\` — fan-out pattern, scope partitioning, integration discipline.
- \\\`references/mode-sequential.md\\\` — implementer-dispatch loop, two-stage review, status handling per task.
- \\\`references/protocol.md\\\` — full status table, model selection by task complexity.
- \\\`references/implementer-prompt.md\\\` — template for implementer subagent dispatch.
- \\\`references/spec-reviewer-prompt.md\\\` — template for spec-compliance review (stage 1).
- \\\`references/code-quality-reviewer-prompt.md\\\` — template for code-quality review (stage 2).

## Anti-patterns

- "Fix all the tests" — scope too broad.
- Multiple implementers in parallel on related code (mode sequential).
- Skipping the review loop in mode sequential.
- Letting the implementer read the plan file (provide full text).
- Accepting "close enough" on spec compliance.
- Re-dispatching a BLOCKED task to the same model without changing anything.
- Forgetting to run the full integrated test suite after fan-in.

## Termination and events

- \\\`subagent_dispatched\\\` per dispatch
- \\\`subagent_completed\\\` per return (status, model, tokens)
- \\\`subagent_failed\\\` for BLOCKED or schema-validation failures
- Mode parallel terminates when all returned and integrated tests pass.
- Mode sequential terminates when the last task is DONE and both reviewers approve.

## Boundaries

- Mode \\\`sequential\\\` stage-2 review can defer to \\\`${PROJECT_NAME}:code-review\\\` mode \\\`request\\\` — same JSON verdict schema. Mutually exclusive; pick one path per task.
- Does NOT replace \\\`verify-evidence\\\`. Verify-evidence is phase verify; this skill is phase execute.
- For solo investigations, use the Task tool directly — orchestration overhead is not justified.
- Pairs with \\\`${PROJECT_NAME}:worktrees\\\` so per-task commits land on an isolated branch.
`;
