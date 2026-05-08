---
name: code-review
description: Use when code needs review or when external review feedback has just arrived. Triggers on "request review", "review the code", "review feedback came in", "PR review came back", "process this feedback", after a major feature lands, before merge to main. Also runs when feedback arrives from a teammate, GitHub PR comment, or external reviewer. Replaces ad-hoc review handling and prevents the performative-agreement failure mode. Standalone via `/devloop:code-review`. Body documents both review directions and the severity ladder.
---

# code-review

Code review is technical evaluation, not emotional performance. Two modes for the two halves of the process.

## Pick a mode

| Mode      | Side                            | Use when                                                                                                        |
| --------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `request` | Code was written, review needed | After a major feature lands, before merge to main, after subagent-driven tasks, fresh perspective on stuck work |
| `receive` | Someone reviewed the code       | A teammate, GitHub PR comment, or external reviewer left feedback to process                                    |

## Core principle

Technical correctness over social comfort. Verify before implementing. Reasoned pushback is required when feedback is wrong; performative agreement is forbidden.

## Universal rules

1. Verify against the codebase before acting (subagents hallucinate, humans miss context).
2. One item at a time.
3. No performative agreement — actions speak. State the fix, not the gratitude.
4. Push back with technical reasoning when feedback is wrong.
5. Context preservation — mode `request` never passes session history to the reviewer subagent.

## Severity ladder

- **Critical** — breaks build, security risk, data loss. Fix immediately.
- **Important** — significant bug, missing requirement, contract violation. Fix before continuing.
- **Minor** — style, naming, optional. Note for later.

## Anti-patterns

- "You're absolutely right" or any gratitude expression.
- Implementing before verifying against the codebase.
- Implementing partial feedback while other items are unclear.
- Skipping review because "it's simple".
- Ignoring Critical issues.

## References

- `references/mode-request.md` — package context, dispatch reviewer subagent, parse structured response, act per severity.
- `references/mode-receive.md` — read feedback, verify, respond without sycophancy, push back when wrong.
- `references/reviewer-prompt.md` — subagent prompt template (forked context, structured output schema).
- `references/feedback-patterns.md` — concrete bad-vs-good response examples.

## Termination

- Mode `request` emits `subagent_dispatched` and `subagent_completed`; verdict summary recorded. Critical or Important issues block the workflow transition.
- Mode `receive` emits no manifest events. Implement per severity ladder; commit each fix separately.

## Boundaries

- Does NOT replace `verify-evidence`. Verify-evidence checks behavior vs plan; code-review checks code quality vs reviewer eyes.
- Mode `request` pairs with `subagent-orchestration` (per-implementer review).
- Mode `receive` pairs with `gh pr` flow (in-thread replies via `gh api ...comments/replies` for inline comments).
