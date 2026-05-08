# Rationalization counters for verify-evidence

The Iron Law is "no completion claims without fresh verification evidence". Agents under pressure rationalize around it. Each rationalization gets an explicit counter.

## Rationalization table

| Excuse                                      | Reality                                    |
| ------------------------------------------- | ------------------------------------------ |
| "Should work now"                           | Run the verification.                      |
| "I'm confident"                             | Confidence ≠ evidence.                     |
| "Just this once"                            | No exceptions.                             |
| "Linter passed"                             | Linter ≠ compiler ≠ test.                  |
| "Agent said success"                        | Verify independently from VCS diff.        |
| "I'm tired"                                 | Exhaustion ≠ excuse.                       |
| "Partial check is enough"                   | Partial proves nothing.                    |
| "Different words so the rule doesn't apply" | Spirit over letter.                        |
| "Tests passed earlier today"                | State may have changed. Re-run.            |
| "It's a small change"                       | Small changes break things. Verify.        |
| "I'd notice if something broke"             | You won't. Verify.                         |
| "Revert if it breaks"                       | Means it could break. Verify before claim. |

## Why this matters (institutional memory)

From past failure modes:

- "I don't believe you" — trust broken when claims didn't match reality.
- Undefined functions shipped — would have crashed in production.
- Missing requirements shipped — incomplete features mistaken for done.
- Time wasted on false completion → redirect → rework.

Honesty is a core value. Lying about completion creates technical debt and erodes user trust.

## When the rule applies

ALWAYS before:

- Any variation of success/completion claims.
- Any expression of satisfaction.
- Any positive statement about work state.
- Committing, pushing, opening a PR.
- Moving to the next task.
- Delegating to agents on the assumption current state is good.

## The bottom line

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
