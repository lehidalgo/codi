import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Evidence-before-claims gate — gather, then verify. Use before any
  completion claim, when about to commit/push/PR, when about to express
  satisfaction ("done", "fixed", "passing", "looks good"), or when an
  investigation needs structured evidence before proposing a change. Also
  activate for phrases like "verify before claim", "completion gate", "fresh
  evidence", "weasel words", "investigate before fixing", "gather evidence",
  "actual vs intended behavior", "structured investigation". Two phases:
  Phase 0 = investigate (when evidence is missing — collect via tools);
  Phase 1 = verify (when evidence is present — run the proof command in
  this session). Skip when you already ran the proof command this turn and
  have the output in scope; debugging a known failure (use
  ${PROJECT_NAME}-debugging); or design / planning where nothing is
  implemented yet (use ${PROJECT_NAME}-brainstorming or
  ${PROJECT_NAME}-plan-writing).
category: ${SKILL_CATEGORY.TESTING}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}}

Claiming work is complete without verification is dishonesty, not efficiency.
Evidence before claims, always. The skill covers the full evidence loop:
gather first when the answer is unknown, then verify before any completion
claim.

## When to use

- About to claim a feature is done, a bug is fixed, or a test is passing.
- About to commit, push, or open a PR.
- About to express satisfaction ("Great!", "Done!", "Perfect!") about work state.
- About to delegate to a subagent on the assumption that current state is good.
- Need to investigate actual vs intended behaviour before proposing a fix.
- Called by \\\`${PROJECT_NAME}-audit-fix\\\` or \\\`${PROJECT_NAME}-guided-execution\\\`
  for the structured-investigation step.

## The Iron Law

> NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.
> NO PROPOSED CHANGES WITHOUT GATHERED EVIDENCE.

If the verification command has not been run in this message, completion
cannot be claimed. If a fix is being proposed without tool-output evidence
of the actual behaviour, the proposal is a guess. Violating the letter of
this rule is violating the spirit.

## Phase 0 — Investigate (when evidence is missing)

Skip this phase if you already have direct, fresh tool output that answers
the question. Use it before proposing any fix, evaluating an audit item, or
validating a step where the actual behaviour is unknown.

Five steps in order:

1. **FRAME** — write down the exact question being investigated and what a
   definitive answer looks like. If you cannot state the question clearly,
   ask the user before proceeding.
2. **SEARCH** — use tools in priority order until you have sufficient
   evidence: graph-code MCP → Grep / Glob → Read → run existing tests →
   web research (only for external dependencies). State the question each
   tool call answers before running it.
3. **COLLECT** — build an evidence table:

   | Finding | Source (tool + command) | Location (file:line) | Confidence |
   |---------|------------------------|---------------------|------------|

   One row per distinct finding. Findings without a tool source do not
   belong in the table.
4. **ANALYZE** — separate confirmed facts (high confidence, directly proven
   by tool output) from inferences (medium, reasonable deductions) from
   unverified assumptions (low, flag explicitly). Compare actual vs
   intended behaviour and state the gap.
5. **REPORT** — present findings in this structure:
   - **Question investigated:** the question from Step 1
   - **Evidence collected:** the table from Step 3
   - **Analysis:** confirmed facts, inferences (labeled), unverified
     assumptions
   - **Conclusion:** answer to the question with a confidence level
   - **Open questions:** what could not be determined and the next
     tool/action that would resolve it

After Phase 0 you either have enough evidence to propose a change (proceed
to the change), or you have surfaced open questions for the user. Never
fabricate findings to close the loop.

## Phase 1 — Verify (the 5-step gate before any claim)

\\\`\\\`\\\`
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY — what command proves this claim?
2. RUN     — execute the FULL command (fresh, complete)
3. READ    — full output, check exit code, count failures
4. VERIFY  — does output confirm the claim?
5. CLAIM   — only now, with evidence in hand

Skip any step = lying, not verifying.
\\\`\\\`\\\`

## Weasel Word Detection

If you are about to use any of these words, STOP and run Phase 1 first:

- "should work", "should pass", "should be fixed"
- "probably works", "probably passing"
- "seems to work", "seems correct"
- "I believe it passes", "I think it works"
- "likely fixed", "appears to work"
- "looks good", "looks correct" (without running a check)

These words mean you have not verified. Run the command first, then make
the claim.

## Evidence table

| Claim                 | Required evidence                                       | Not sufficient                 |
| --------------------- | ------------------------------------------------------- | ------------------------------ |
| Tests pass            | Test command output: 0 failures (counts shown)          | Previous run, "should pass"    |
| Linter clean          | Linter output: 0 errors / warnings                      | Partial check, extrapolation   |
| Build succeeds        | Build command: exit 0                                   | Linter passing, logs look good |
| Bug fixed             | Reproduce original symptom, then show it no longer occurs | Code changed, assumed fixed    |
| Feature works         | Run the user scenario, show actual output               | Code looks correct             |
| Regression test works | Red-green-revert-restore cycle completed                | Test passes once               |
| Security scan clean   | Run scan, show finding count                            | Assumed clean                  |
| Agent completed       | VCS diff shows changes; verify they exist               | Agent reports "success"        |
| Requirements met      | Re-read plan, line-by-line checklist                    | Tests passing                  |

Full pattern catalog in \\\`references/patterns.md\\\`.

## Red flags — STOP

These thoughts mean you are about to skip evidence:

- Using "should", "probably", "seems to" before claiming.
- Expressing satisfaction before verification.
- About to commit/push/PR without running the proof command this message.
- Trusting agent success reports.
- "Just this once" or "I'm tired".
- "I remember this area, it works like..." — memory is not evidence.
- "The code looks correct so..." — looking ≠ running.
- "Let me just propose the fix" without Phase 0 complete.

## Anti-patterns

- "Should work now" — run the verification.
- "Linter passed" — linter ≠ compiler.
- "Agent reported success" — verify independently from VCS diff.
- "Partial check is enough" — partial proves nothing.
- "Different words so the rule does not apply" — spirit over letter.

Full rationalization table in \\\`references/rationalizations.md\\\`.

## What counts as evidence

**Valid:** tool output from this session (grep results, file content, test
output, MCP responses), test results showing actual pass/fail, file content
confirming actual implementation, git history showing when/why something
changed, documentation confirming intended behaviour.

**Not valid:** memory from previous sessions, "I assume it works because…",
code that looks correct without running it, positive claims from earlier in
this session without re-verification.

## Termination

- Phase 1 runs → output read → claim made WITH evidence (e.g., "All tests
  pass: 34/34 ✓").
- Verification fails → claim actual state, not "should pass".
- Emit \\\`validation_run\\\` event with exit code captured.

## Boundaries

- Verifies work-vs-claims and gathers evidence for proposals.
  Does NOT do code-quality review (use \\\`${PROJECT_NAME}-code-review\\\`).
- Does NOT replace test-first discipline (use \\\`${PROJECT_NAME}-tdd\\\` for that).
- Phase 1 applies at workflow phase verify and at any completion claim.
  Phase 0 applies at workflow phase plan / reproduce when actual behaviour
  is unknown, and inside \\\`${PROJECT_NAME}-audit-fix\\\` and
  \\\`${PROJECT_NAME}-guided-execution\\\` per their references.

## Integration

- Use at the end of every \\\`${PROJECT_NAME}-tdd\\\` cycle (verify RED, verify GREEN).
- Use in \\\`${PROJECT_NAME}-debugging\\\` Phase 1 (Observe — Phase 0 of this
  skill collects evidence) and Phase 4 (claim fix complete — Phase 1 here).
- Use in \\\`${PROJECT_NAME}-plan-execution\\\` before marking tasks done.
- Use in \\\`${PROJECT_NAME}-branch-finish\\\` before presenting completion options.
- Called by \\\`${PROJECT_NAME}-audit-fix\\\` Phase 2 and
  \\\`${PROJECT_NAME}-guided-execution\\\` Step 4 for structured investigation.
`;
