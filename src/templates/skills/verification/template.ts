import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Verification gate before completion. Use before claiming any task is done,
  fixed, passing, or complete. Requires fresh evidence (a command run in
  this session with its output read) — not assumptions or memory. Also
  activate for phrases like "about to say done", "verify before claim",
  "prove it works", "completion gate", "fresh evidence", "verification
  check", "before marking complete", and whenever you notice weasel words
  ("should pass", "probably works", "seems correct", "looks good"). Do
  NOT activate for initial investigation (use ${PROJECT_NAME}-evidence-gathering),
  debugging a specific failure (use ${PROJECT_NAME}-debugging), or
  design / planning phases where nothing is yet implemented.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Verification

## When to Activate

- Before claiming any task is complete
- Before saying tests pass
- Before saying a bug is fixed
- Before any positive status update
- Before requesting a code review
- Before marking a task done in a plan

## Skip When

- You are in an investigation phase (no completion claim yet) — use ${PROJECT_NAME}-evidence-gathering
- You are debugging a known failure — use ${PROJECT_NAME}-debugging
- You are in a brainstorming / planning phase where nothing is implemented — use ${PROJECT_NAME}-brainstorming / ${PROJECT_NAME}-plan-writer
- You already ran the exact command this turn and have the output in scope — just cite it; no need to re-run

## The Iron Law

> **NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE. Evidence means: you ran the command this session and read the output.**

## The Verification Gate

Follow these 5 steps before claiming completion:

1. **IDENTIFY** — What is the exact proof command? (e.g., \\\`pnpm test\\\`, \\\`cargo test\\\`, \\\`curl -s http://...\\\`)
2. **RUN** — Execute it now, in this session. Do not rely on previous runs.
3. **READ** — Read the complete output including exit codes. Do not skip past errors or warnings.
4. **VERIFY** — Does the output actually support the claim? Yes/No.
5. **CLAIM** — State the result with the specific evidence: "Tests pass: 142 passing, 0 failing" not "tests should pass"

## Weasel Word Detection

If you are about to use any of these words, STOP and run the verification gate first:

- "should work", "should pass", "should be fixed"
- "probably works", "probably passing"
- "seems to work", "seems correct"
- "I believe it passes", "I think it works"
- "likely fixed", "appears to work"
- "looks good", "looks correct" (without running a check)

These words mean you have not verified. Run the command first, then make the claim.

## Evidence Table

| Claim Type | Required Evidence | Not Sufficient |
|------------|-------------------|----------------|
| "Tests pass" | Run test suite, show passing count, 0 failing | Previous run, "should pass" |
| "Bug is fixed" | Reproduce the original bug first, then show it no longer occurs | Code changed, assumed fixed |
| "Feature works" | Run the specific user scenario, show actual output | Code looks correct |
| "Build succeeds" | Run the build command, show 0 errors | Linter passing, logs look good |
| "Linting passes" | Run the linter, show 0 errors/warnings | Partial check, extrapolation |
| "Security scan clean" | Run the scan, show findings count | Assumed clean |
| "Task complete" | Run all verification steps defined in the task | Tests passing |
| "Regression test works" | Red-green cycle verified: write, run (pass), revert fix, run (must fail), restore, run (pass) | Test passes once |
| "Agent completed" | Check VCS diff, verify changes exist | Agent reports "success" |
| "Requirements met" | Re-read plan, create checklist, verify each item | Tests passing |

## Red Flags

These situations signal you are about to make an unverified claim:

- Expressing satisfaction ("Great, that should do it!") before running a check
- Planning the next step before verifying the current step is done
- Citing a test run from earlier in the session as current evidence
- Extrapolating from partial output ("the first 10 tests passed so all must pass")
- Trusting your own code reading over running the actual code
- "I just changed X so Y must work now"

## What Counts as Evidence

Fresh run this session. Complete output read. Exit code confirmed. If the test suite was run 10 messages ago, that is NOT fresh evidence.

## Key Patterns

**Tests:**
\\\`\\\`\\\`
Run test command -> see "34/34 pass" -> then claim "All tests pass"
NOT: "Should pass now" / "Looks correct"
\\\`\\\`\\\`

**Regression tests (TDD Red-Green):**
\\\`\\\`\\\`
Write test -> Run (must pass) -> Revert fix -> Run (MUST FAIL) -> Restore fix -> Run (must pass again)
NOT: "I've written a regression test" without completing the red-green cycle
\\\`\\\`\\\`

**Build:**
\\\`\\\`\\\`
Run build command -> see exit 0 -> then claim "Build passes"
NOT: "Linter passed" (linter does not verify compilation)
\\\`\\\`\\\`

**Requirements:**
\\\`\\\`\\\`
Re-read plan -> create checklist -> verify each item -> report gaps or completion
NOT: "Tests pass, phase complete"
\\\`\\\`\\\`

**Agent delegation:**
\\\`\\\`\\\`
Agent reports success -> check VCS diff -> verify changes exist -> report actual state
NOT: Trust agent report at face value
\\\`\\\`\\\`

## Rule Applies To

This rule applies to ALL of the following, not only exact phrases:
- Any variation of success or completion claims
- Any expression of satisfaction before running a check
- Any positive statement about the state of the work
- Any implication that work is done or correct
- Committing, creating PRs, marking tasks done, moving to the next task
- Delegating to agents and accepting their success reports

The spirit of the rule: no unverified claims, ever.

## Integration

- Use at the end of every \\\`${PROJECT_NAME}-tdd\\\` cycle (Verify RED, Verify GREEN).
- Use in \\\`${PROJECT_NAME}-debugging\\\` Phase 4 before claiming fix is complete.
- Use in \\\`${PROJECT_NAME}-plan-executor\\\` and \\\`${PROJECT_NAME}-subagent-dev\\\` before marking tasks done.
- Use in \\\`${PROJECT_NAME}-branch-finish\\\` before presenting completion options.
`;
