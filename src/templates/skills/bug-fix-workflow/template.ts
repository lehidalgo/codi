import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when the user reports a bug, regression, or unexpected behavior. Manages
  a structured workflow through intent, reproduce, plan, execute, verify, done
  — with a mandatory reproduce phase that builds a feedback loop before any
  planning. Triggers on "fix bug", "fix issue", "broken", "throwing error",
  "regression", "not working as expected", "diagnose this". Not for new
  features (use feature-workflow), refactoring without behavior change (use
  refactor-workflow), or migrations (use migration-workflow).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
---

# {{name}}

Structured bug fixing with a mandatory \\\`reproduce\\\` phase before planning. **Build the feedback loop first.** Without a deterministic, agent-runnable pass/fail signal for the bug, no amount of staring at code will produce a reliable fix.

## When to use

User reported a bug, regression, or unexpected behavior. Start the workflow:

\\\`\\\`\\\`bash
${PROJECT_NAME} run bug-fix "<one-line description>"
${PROJECT_NAME} run bug-fix --from-story US-NNN "<one-line>"
\\\`\\\`\\\`

\\\`--from-story\\\`: child Story with \\\`parent_story=US-NNN\\\`. Without: standalone bug Story. Detail in \\\`references/phase-reproduce.md\\\`.

## When to skip

- New functionality → \\\`feature-workflow\\\`.
- Structural change without behavior change → \\\`refactor-workflow\\\`.
- Schema/data change → \\\`migration-workflow\\\`.

## Phase order

| Phase       | Purpose                                         | Detail                          |
| ----------- | ----------------------------------------------- | ------------------------------- |
| \\\`intent\\\`    | Confirm the failure mode the user describes     | inline below                    |
| \\\`reproduce\\\` | Build a feedback loop that turns red on the bug | \\\`references/phase-reproduce.md\\\` |
| \\\`plan\\\`      | Hypothesize cause, design the fix               | \\\`references/phase-plan.md\\\`      |
| \\\`execute\\\`   | Apply the fix; the loop turns green             | \\\`references/phase-execute.md\\\`   |
| \\\`verify\\\`    | Run validation, confirm regression test exists  | \\\`references/phase-verify.md\\\`    |
| \\\`done\\\`      | PR ready                                        | terminal                        |

## Core principle

**Reproduce before planning.** A flaky 30-second loop is barely better than none; a 2-second deterministic loop is a debugging superpower. Generate 3-5 ranked hypotheses (anti-anchoring); falsifiable format. Write the regression test BEFORE the fix.

## Phase summary

- \\\`intent\\\` — \\\`discover\\\` mode wide if ambiguous.
- \\\`reproduce\\\` — \\\`diagnose\\\` 4-phase flow; \\\`subagent-orchestration\\\` parallel if ≥2 unrelated failures.
- \\\`plan\\\` — \\\`plan-writing\\\` (with \\\`## Hypothesis\\\`); \\\`discover\\\` mode sharpen if hypotheses compete.
- \\\`execute\\\` — \\\`worktrees\\\` if ≥3 files; regression test FIRST; tag debug logs \\\`[DEBUG-a4f2]\\\`.
- \\\`verify\\\` — \\\`verify-evidence\\\`; original repro must turn green; debug logs removed; optional \\\`code-review\\\`.

Per-phase detail in \\\`references/phase-*.md\\\`.

## Anti-patterns

- Skipping \\\`reproduce\\\` because "the bug is obvious".
- Single-hypothesis anchoring at \\\`plan\\\`.
- Applying the fix before the regression test (when a seam exists).
- Untagged debug logs that survive cleanup.
- Ignoring 3-strikes rule — 3 failed hypotheses ⇒ architecture review.
- Blocking the fix on architectural rework — narrowest fix; refactor as follow-up.

## References

- \\\`references/phase-reproduce.md\\\` — feedback-loop technique ladder, loop-quality iteration, non-deterministic-bug discipline.
- \\\`references/phase-plan.md\\\` — ranked hypotheses, falsifiable format, plan template with \\\`## Hypothesis\\\` section.
- \\\`references/phase-execute.md\\\` — regression-test-first, debug-log tagging, no-seam handoff to \\\`architecture-review\\\`.
- \\\`references/phase-verify.md\\\` — exit criteria, optional code-review chain.

## Termination

- Phase \\\`done\\\` with regression test, fix committed, debug logs cleaned up, hypothesis recorded in commit message.
- Abandoned via \\\`${PROJECT_NAME} abandon --reason "<text>"\\\`.

## Boundaries

- Fixes bugs. Does NOT add new functionality (feature-workflow) or refactor without behavior change (refactor-workflow).
- Does NOT execute the diagnosis directly — chains into \\\`diagnose\\\`, \\\`tdd\\\`, \\\`verify-evidence\\\`.
- Does NOT block on architectural rework — surfaces follow-ups to \\\`architecture-review\\\` instead.

## Operator commands

\\\`\\\`\\\`bash
${PROJECT_NAME} status
${PROJECT_NAME} transition --to <phase>
${PROJECT_NAME} transition --approve
${PROJECT_NAME} transition --reject --reason "<text>"
${PROJECT_NAME} scope propose-expansion --file <path> --reason "<text>"
${PROJECT_NAME} abandon --reason "<text>"
\\\`\\\`\\\`
`;
