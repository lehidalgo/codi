import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when the user wants to restructure code without changing observable
  behavior — extract a module, deepen a shallow abstraction, decouple
  tightly-coupled modules, or improve test seams. Manages a structured
  workflow through intent, baseline, plan, execute, verify, done — with a
  mandatory baseline phase that captures current behavior before any change.
  Triggers on "refactor", "restructure", "decouple", "deepen", "improve
  architecture", "extract", "cleanup". Skip when the change is pure
  dead-code removal, DRY-up, or unused-import cleanup with no structural
  shape change — use ${PROJECT_NAME}-refactoring (lighter, no phase
  machine). Not for new features (use feature-workflow), bug fixes (use
  bug-fix-workflow), or schema migrations (use migration-workflow).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
maintainers: ["@lehidalgo"]
---

# {{name}}

Structured refactoring with a mandatory \\\`baseline\\\` phase. **The only way to refactor safely is to know what to preserve.**

## When to use

User wants to change code structure while preserving behavior. Start the workflow:

\\\`\\\`\\\`bash
${PROJECT_NAME} run refactor "<one-line description>"
${PROJECT_NAME} run refactor --from-story US-NNN "<one-line>"
\\\`\\\`\\\`

\\\`--from-story\\\`: refactor tracks back to a prior delivery; child Story with \\\`parent_story=US-NNN\\\`. Without it: standalone Story with \\\`as_a="developer"\\\`. Detail in \\\`references/phase-baseline.md\\\`.

If \\\`${PROJECT_NAME} run\\\` fails with \\\`KnowledgeBaseMissingError\\\`: agent invokes \\\`${PROJECT_NAME}:init-knowledge-base\\\` directly, then re-runs.

## When to skip

- New behavior wanted → \\\`feature-workflow\\\`.
- Bug fix → \\\`bug-fix-workflow\\\`.
- Schema/data change → \\\`migration-workflow\\\`.
- No specific target yet (just "find opportunities") → invoke \\\`${PROJECT_NAME}:architecture-review\\\` first.

## Phase order

| Phase      | Purpose                                           | Detail                         |
| ---------- | ------------------------------------------------- | ------------------------------ |
| \\\`intent\\\`   | Identify structural friction and deepening goal   | \\\`references/phase-intent.md\\\`   |
| \\\`baseline\\\` | Capture current behavior with tests               | \\\`references/phase-baseline.md\\\` |
| \\\`plan\\\`     | Design the refactor; what moves where             | \\\`references/phase-plan.md\\\`     |
| \\\`execute\\\`  | Apply in small commits; baseline tests stay green | \\\`references/phase-execute.md\\\`  |
| \\\`verify\\\`   | Run validation; behavior is unchanged             | \\\`references/phase-verify.md\\\`   |
| \\\`done\\\`     | PR ready                                          | terminal                       |

## Core principle

**No behavior change.** The refactor success criterion is "tests still pass without modifications". If a baseline test fails mid-refactor, STOP. Either you changed behavior (revert) or the test was implementation-coupled (document; fix in a separate workflow).

Use the deletion test on every module: deleting it concentrates complexity (deep, keep) or spreads it across N callers (shallow, merge).

## Anti-patterns

- Skipping \\\`baseline\\\` because "existing tests look comprehensive". Run them first.
- Mixing bug fixes into the refactor. File a separate \\\`bug-fix-workflow\\\`.
- Big-bang refactor in one commit. Small commits, tests green at every step.
- Renaming things that no caller uses (no callers = no leverage).
- Introducing a port for a single adapter (one adapter = hypothetical seam = indirection).
- Implementation-coupled tests masquerading as behavior tests — surface and fix separately.

## References

- \\\`references/phase-intent.md\\\` — discover/architecture-review chain.
- \\\`references/phase-baseline.md\\\` — characterization-test capture, exit criteria.
- \\\`references/phase-plan.md\\\` — extended plan template (Behavior preservation / Module depth analysis / Seams).
- \\\`references/phase-execute.md\\\` — small-commit discipline, multi-step orchestration via \\\`subagent-orchestration\\\` mode \\\`sequential\\\`.
- \\\`references/phase-verify.md\\\` — verify-evidence chain + optional code-review.

## Termination

- Phase \\\`done\\\`: commit message declares "Refactor: no behavior change". Test diff is near-zero (only import paths change as files move).
- Abandoned via \\\`${PROJECT_NAME} abandon --reason "<text>"\\\`.

## Boundaries

- Refactors with no behavior change. Does NOT add features or fix bugs.
- Does NOT find candidates — that is \\\`architecture-review\\\`'s job.
- Does NOT execute steps directly — chains into \\\`worktrees\\\`, \\\`subagent-orchestration\\\`, \\\`verify-evidence\\\`.

## Operator commands

Same as feature-workflow (\\\`${PROJECT_NAME} status\\\`, \\\`${PROJECT_NAME} transition\\\`, \\\`${PROJECT_NAME} scope propose-expansion\\\`, \\\`${PROJECT_NAME} abandon\\\`).
`;
