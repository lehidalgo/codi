# Subagent protocol — status handling and model selection

## Status protocol

Every subagent returns one of four statuses. Each gets a different response.

| Status               | Meaning                      | Orchestrator response                                                                                                                                                                                                             |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DONE`               | Work complete, self-reviewed | Proceed. Mode sequential: dispatch reviewer. Mode parallel: tally and reconcile.                                                                                                                                                  |
| `DONE_WITH_CONCERNS` | Done but flagged doubts      | Read concerns. Correctness/scope concern → address before reviewing. Observation → note, proceed.                                                                                                                                 |
| `NEEDS_CONTEXT`      | Information missing          | Provide the missing context. Re-dispatch with the same model.                                                                                                                                                                     |
| `BLOCKED`            | Cannot complete              | Diagnose: context gap → re-dispatch with more context. Reasoning gap → re-dispatch with more capable model. Task too large → break into pieces and update the plan. Plan wrong → escalate to user. NEVER re-dispatch identically. |

Rule: never ignore an escalation. If the subagent said it is stuck, something must change.

## Model selection

Use the least powerful model that can handle each role. Token economy applies to subagents too.

| Task complexity       | Signals                                                    | Model tier   |
| --------------------- | ---------------------------------------------------------- | ------------ |
| Mechanical            | 1-2 files, complete spec, isolated function                | Fast / cheap |
| Integration           | Multi-file coordination, pattern matching, debugging       | Standard     |
| Architecture / review | Design judgment, broad codebase understanding, review work | Most capable |

Mode `sequential` reviewers (spec-compliance and code-quality) should generally use a capable model — review is judgment work. Implementers can often use cheaper models when the plan is well-specified.

## Verification after orchestration

Mode parallel terminates only after:

- All dispatched subagents return
- No file-level conflicts between agents
- The full test suite passes (not just per-agent targeted tests)

Mode sequential terminates only after:

- The last task in the plan is DONE
- Both reviewers (spec-compliance, code-quality) approve
- The full test suite passes
- Optional: holistic review across the entire branch via `code-review` mode `request`
