import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when about to claim work is complete, fixed, or passing, before
  committing or creating PRs. Requires running verification commands and
  confirming output before making any success claims; evidence before
  assertions always.
category: ${SKILL_CATEGORY.TESTING}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
---

# {{name}}

Claiming work is complete without verification is dishonesty, not efficiency. Evidence before claims, always.

## When to use

- About to claim a feature is done, a bug is fixed, or a test is passing.
- About to commit, push, or open a PR.
- About to express satisfaction ("Great!", "Done!", "Perfect!") about work state.
- About to delegate to a subagent on the assumption that current state is good.

## The Iron Law

> NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

If the verification command has not been run in this message, completion cannot be claimed. Violating the letter of this rule is violating the spirit.

## Core principle / Process — the 5-step gate

\\\`\\\`\\\`
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY — what command proves this claim?
2. RUN     — execute the FULL command (fresh, complete)
3. READ    — full output, check exit code, count failures
4. VERIFY  — does output confirm the claim?
5. CLAIM   — only now, with evidence in hand

Skip any step = lying, not verifying.
\\\`\\\`\\\`

## Quick reference

| Claim                 | Requires                        | Not sufficient                 |
| --------------------- | ------------------------------- | ------------------------------ |
| Tests pass            | Test command output: 0 failures | Previous run, "should pass"    |
| Linter clean          | Linter output: 0 errors         | Partial check, extrapolation   |
| Build succeeds        | Build command: exit 0           | Linter passing, logs look good |
| Bug fixed             | Test original symptom: passes   | Code changed, assumed fixed    |
| Regression test works | Red-green-revert-restore cycle  | Test passes once               |
| Agent completed       | VCS diff shows changes          | Agent reports "success"        |
| Requirements met      | Line-by-line checklist          | Tests passing                  |

Full pattern catalog in \\\`references/patterns.md\\\`.

## Red flags — STOP

- Using "should", "probably", "seems to".
- Expressing satisfaction before verification.
- About to commit/push/PR without running the command in this message.
- Trusting agent success reports.
- Thinking "just this once" or "I'm tired".
- ANY wording implying success without having run verification.

## Anti-patterns

- "Should work now" — run the verification.
- "Linter passed" — linter ≠ compiler.
- "Agent reported success" — verify independently from VCS diff.
- "Partial check is enough" — partial proves nothing.
- "Different words so the rule does not apply" — spirit over letter.

Full rationalization table in \\\`references/rationalizations.md\\\`.

## Termination

- Verification runs → output read → claim made WITH evidence (e.g., "All tests pass: 34/34 ✓").
- If verification fails → claim actual state, not "should pass".
- Emit \\\`validation_run\\\` event with exit code captured.

## Boundaries

- Verifies work-vs-claims. Does NOT do code-quality review (use \\\`code-review\\\`).
- Does NOT replace test-first discipline (use \\\`tdd\\\` for that).
- Applies at workflow phase verify and at any completion claim.
`;
