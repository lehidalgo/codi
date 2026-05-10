import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Adaptive bug-fix workflow. Compresses or expands per dev answers (severity,
  reproducer state, root cause, scope, exec mode, grill toggle). Use when the
  user reports a bug, regression, or unexpected behavior. Triggers on "fix
  bug", "fix issue", "broken", "throwing error", "regression", "not working
  as expected", "diagnose this". Four profiles cover common shapes: \\\`quick\\\`
  (1-line obvious fix), \\\`standard\\\` (full discipline), \\\`deep\\\` (multi-system
  + parallel + grill), \\\`incident\\\` (P0 production, plan replaced by
  post-mortem). Not for new features (use feature-workflow), refactoring
  without behavior change (use refactor-workflow), or migrations (use
  migration-workflow).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}}

Adaptive bug-fix workflow. The skeleton has six phases (intent → reproduce → plan → execute → verify → done) but **phases compress** based on the dev's answers. The discipline is preserved; the ceremony is not.

## When to use

User reported a bug, regression, or unexpected behavior. Start the workflow:

\\\`\\\`\\\`bash
${PROJECT_NAME} workflow run bug-fix "<one-line description>"
${PROJECT_NAME} workflow run bug-fix "<task>" --profile <name>
${PROJECT_NAME} workflow run bug-fix "<task>" --interactive
${PROJECT_NAME} workflow run bug-fix --from-story US-NNN "<one-line>"
\\\`\\\`\\\`

\\\`--from-story\\\`: child Story with \\\`parent_story=US-NNN\\\`. Without: standalone bug Story.

## When to skip

- New functionality → \\\`feature-workflow\\\`.
- Structural change without behavior change → \\\`refactor-workflow\\\`.
- Schema/data change → \\\`migration-workflow\\\`.
- Trivial fix (typo / comment / format / dep-bump / doc-tweak) → \\\`${PROJECT_NAME} quick "<task>" --category <cat>\\\`.

## Profiles (fast path)

| Profile      | Use when                          | Phases                          | Required skills                                  |
| ------------ | --------------------------------- | ------------------------------- | ------------------------------------------------ |
| \\\`quick\\\`    | Bug obvio 1-line                  | intent → execute → verify       | tdd, verify-evidence, plan-execution INLINE      |
| \\\`standard\\\` | Bug típico (default)              | full 6 phases                   | full chain                                       |
| \\\`deep\\\`     | Bug regression / multi-system     | full + parallel + grill         | full chain + subagent-orchestration + discover   |
| \\\`incident\\\` | P0 production                     | intent → execute → verify       | tdd, verify-evidence + post-mortem replaces plan |

\\\`\\\`\\\`bash
${PROJECT_NAME} workflow run bug-fix "..." --profile quick
${PROJECT_NAME} workflow run bug-fix "..." --profile deep
\\\`\\\`\\\`

## Adaptive intake (when no profile or --interactive)

The agent asks **one question per turn** and stores answers in \\\`workflow_runs.metadata.adaptation\\\`. Each answer compresses the path.

| # | Question                                                | Recommended | Effect                                                                |
| - | ------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| 1 | Severity? (P0 / P1 / P2 / P3)                           | P2          | P0 + Q3=yes → skip plan; P3 + Q4=single → suggest \\\`${PROJECT_NAME} quick\\\`         |
| 2 | Is a reproducer already available?                      | no          | yes → skip reproduce phase                                            |
| 3 | Is the root cause known?                                | no          | yes → skip 3-hypothesis ranking inside reproduce/plan                 |
| 4 | Scope: single file or multi-file?                       | multi       | single → skip subagent-orchestration; INLINE exec mode default        |
| 5 | Type: bug / feature / refactor?                         | bug         | non-bug → offer cross-workflow conversion (abandon + run new)         |
| 6 | Execute mode: INLINE or SUBAGENT?                       | per Q4      | activates plan-execution with the chosen mode                         |
| 7 | Grill at intent? (failure mode ambiguous)               | no          | yes → required \\\`discover\\\` mode sharpen (or domain if ADRs are rich)  |

After all 7 answers, announce the compressed path:

> "Based on your answers, this run will use:
>  - Phases: intent → execute → verify (skip reproduce + plan)
>  - Skills: tdd, plan-execution INLINE, verify-evidence
>  - Estimated transitions: 3 (vs 5 standard)"

Then propose transition to the first non-skipped phase. The dev can override with \\\`--severity\\\`, \\\`--reproducer-exists\\\`, \\\`--root-cause-known\\\`, \\\`--scope <single|multi>\\\`, \\\`--execute-mode <inline|subagent>\\\`, \\\`--grill\\\`.

## Phase summary

| Phase       | Purpose                                         | Detail                          |
| ----------- | ----------------------------------------------- | ------------------------------- |
| \\\`intent\\\`    | Adaptive intake + confirm failure mode          | inline above + \\\`references/phase-intent.md\\\`    |
| \\\`reproduce\\\` | Build a feedback loop that turns red on the bug | \\\`references/phase-reproduce.md\\\` |
| \\\`plan\\\`      | Hypothesize cause, design the fix               | \\\`references/phase-plan.md\\\`      |
| \\\`execute\\\`   | Apply the fix via plan-execution; loop turns green | \\\`references/phase-execute.md\\\`   |
| \\\`verify\\\`    | Run validation, confirm regression test exists  | \\\`references/phase-verify.md\\\`    |
| \\\`done\\\`      | PR ready                                        | terminal                        |

## Core principle

**Reproduce before planning** (when a reproducer doesn't already exist). A flaky 30-second loop is barely better than none; a 2-second deterministic loop is a debugging superpower. Generate 3-5 ranked hypotheses (anti-anchoring); falsifiable format. Write the regression test BEFORE the fix.

## Skill chain by phase (full standard profile)

| Phase       | Required                          | Optional / alt-entry                                                  |
| ----------- | --------------------------------- | --------------------------------------------------------------------- |
| \\\`intent\\\`    | —                                 | discover (Q7=yes), step-documenter, architecture-review (alt-entry, 3-strikes) |
| \\\`reproduce\\\` | diagnose                          | subagent-orchestration (Q4=multi + ≥2 failures)                       |
| \\\`plan\\\`      | plan-writing (with Hypothesis)    | discover (sharpen, hypotheses compete)                                |
| \\\`execute\\\`   | plan-execution, tdd               | worktrees, diagnose, code-review                                      |
| \\\`verify\\\`    | verify-evidence                   | code-review (auto_review)                                             |

## Cross-workflow conversion

When Q5 returns \\\`feature\\\` or \\\`refactor\\\`, offer:

> "Detected reclassification.
>  Options:
>    1. Convert: abandon bug-fix, start <feature|refactor> with this context
>    2. Stay: continue as bug-fix
>    3. Cancel"

If 1: \\\`${PROJECT_NAME} workflow abandon --reason "reclassified to <type>"\\\` then \\\`${PROJECT_NAME} workflow run <type> "<task>" --carryover-from <prev-id>\\\` (preserves init payload + decisions).

## Anti-patterns

- Skipping \\\`reproduce\\\` because "the bug is obvious" — answer Q2 honestly; if you genuinely have a reproducer, set Q2=yes and skip officially.
- Single-hypothesis anchoring at \\\`plan\\\` — diagnose enforces 3+ ranked hypotheses unless Q3=yes.
- Applying the fix before the regression test (when a seam exists) — \\\`tdd_first_test_exists\\\` gate enforces this.
- Untagged debug logs that survive cleanup.
- Ignoring 3-strikes rule — 3 failed hypotheses ⇒ \\\`architecture-review\\\` (alt-entry at intent).
- Blocking the fix on architectural rework — narrowest fix; refactor as follow-up via cross-workflow conversion.
- Lying on adaptive intake to skip phases — gates still validate; lying just shifts the work to gate-rejection time.

## References

- \\\`references/phase-intent.md\\\` — adaptive intake mechanics.
- \\\`references/phase-reproduce.md\\\` — feedback-loop technique ladder, loop-quality iteration.
- \\\`references/phase-plan.md\\\` — ranked hypotheses, falsifiable format, plan template with \\\`## Hypothesis\\\`.
- \\\`references/phase-execute.md\\\` — plan-execution INLINE vs SUBAGENT, regression-test-first, debug-log tagging.
- \\\`references/phase-verify.md\\\` — exit criteria, optional code-review chain.

## Termination

- Phase \\\`done\\\` with regression test, fix committed, debug logs cleaned up, hypothesis recorded in commit message.
- Abandoned via \\\`${PROJECT_NAME} workflow abandon --reason "<text>"\\\`.
- Cross-workflow converted via \\\`--carryover-from <prev-id>\\\` on the new run.

## Boundaries

- Fixes bugs. Does NOT add new functionality (feature-workflow) or refactor without behavior change (refactor-workflow).
- Does NOT execute the diagnosis directly — chains into \\\`diagnose\\\`, \\\`tdd\\\`, \\\`plan-execution\\\`, \\\`verify-evidence\\\`.
- Does NOT block on architectural rework — surfaces follow-ups to \\\`architecture-review\\\` (alt-entry at intent) or cross-workflow conversion.

## Operator commands

\\\`\\\`\\\`bash
${PROJECT_NAME} workflow status [--slim]
${PROJECT_NAME} workflow transition --to <phase>
${PROJECT_NAME} workflow transition --approve
${PROJECT_NAME} workflow transition --reject --reason "<text>"
${PROJECT_NAME} workflow scope propose-expansion --file <path> --reason "<text>"
${PROJECT_NAME} workflow abandon --reason "<text>"
${PROJECT_NAME} workflow recover
\\\`\\\`\\\`
`;
