import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when the user needs to change persisted state, schema, or external
  system contracts in a way that affects existing data or downstream
  consumers. Manages a structured workflow through intent, plan, execute,
  verify, data-validation, done — with a mandatory data-validation phase that
  proves data integrity post-migration. Triggers on "migrate", "schema
  change", "alter table", "drop column", "rename field", "data backfill",
  "schema migration". Not for new features (use feature-workflow), bug fixes
  (use bug-fix-workflow), or refactors that preserve schema (use
  refactor-workflow).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 2
maintainers: ["@lehidalgo"]
---

# {{name}}

Structured schema and data migrations with a mandatory \\\`data-validation\\\` phase that proves integrity before the workflow can be marked done.

## When to use

User is changing persisted state, schema, or external system contracts. Start the workflow:

\\\`\\\`\\\`bash
${PROJECT_NAME} run migration "<one-line description>"
${PROJECT_NAME} run migration --from-story US-NNN "<one-line>"
\\\`\\\`\\\`

\\\`--from-story\\\`: migration scoped to an existing Requirement/Goal. Without it: standalone Story with \\\`as_a="system"\\\`. Detail in \\\`references/phase-intent.md\\\`.

If \\\`${PROJECT_NAME} run\\\` fails with \\\`KnowledgeBaseMissingError\\\`: agent invokes \\\`${PROJECT_NAME}:init-knowledge-base\\\` directly, then re-runs.

## When to skip

- New functionality with no schema impact → \\\`feature-workflow\\\`.
- Bug fix → \\\`bug-fix-workflow\\\`.
- Refactor that preserves schema → \\\`refactor-workflow\\\`.

## Phase order

| Phase             | Purpose                                                 | Detail                                |
| ----------------- | ------------------------------------------------------- | ------------------------------------- |
| \\\`intent\\\`          | Migration goal, source/target schema, downstream impact | \\\`references/phase-intent.md\\\`          |
| \\\`plan\\\`            | Sequence, rollback path, validation strategy            | \\\`references/phase-plan.md\\\`            |
| \\\`execute\\\`         | Apply in committed steps with metrics                   | \\\`references/phase-execute.md\\\`         |
| \\\`verify\\\`          | Static validation — types, tests, schema                | \\\`references/phase-verify.md\\\`          |
| \\\`data-validation\\\` | Live data integrity check                               | \\\`references/phase-data-validation.md\\\` |
| \\\`done\\\`            | Migration committed, evidence attached                  | terminal                              |

## Core principle

**Evidence-based data integrity.** Migration claims of "data integrity preserved" must be backed by actual measured counts and sample diffs, never by assertion. The \\\`data-validation\\\` phase is mandatory; it catches what static tests cannot.

Migration steps NEVER run in parallel — order matters and partial state is unsafe.

## Anti-patterns

- Skipping \\\`data-validation\\\` because "tests passed".
- Running migration steps in parallel.
- Proposing transition to \\\`execute\\\` without an explicit rollback path.
- Rationalizing a row-count delta ("probably bots") instead of investigating.
- NOT NULL on a populated table without a backfill step first.
- Missing index added AFTER backfill (the backfill is then unindexed and slow).
- Schema change without checking downstream consumers.

## References

- \\\`references/phase-intent.md\\\` — discover-driven goal confirmation, downstream-impact mapping.
- \\\`references/phase-plan.md\\\` — plan template requirements: rollback path, validation strategy, exact DDL paths.
- \\\`references/phase-execute.md\\\` — worktree isolation, sequential subagent orchestration, footgun catalog.
- \\\`references/phase-verify.md\\\` — static validation criteria.
- \\\`references/phase-data-validation.md\\\` — pre/post counts and samples, systematic diff, downstream consumer health, code-review chain.

## Termination

- Phase \\\`done\\\` reached only after data-validation passes.
- Evidence attached as \\\`decision_recorded\\\` events with the actual pre/post metrics.
- Abandoned via \\\`${PROJECT_NAME} abandon --reason "<text>"\\\` (preserve audit trail; data-validation findings are part of the abandonment record).

## Boundaries

- Schema and data migrations. Does NOT add features (feature-workflow) or fix bugs (bug-fix-workflow).
- Does NOT execute the migration directly — chains into \\\`worktrees\\\`, \\\`subagent-orchestration\\\`, \\\`verify-evidence\\\`, optionally \\\`code-review\\\`.
- Does NOT bypass data-validation — that phase is mandatory.

## Operator commands

Same as feature-workflow (\\\`${PROJECT_NAME} status\\\`, \\\`${PROJECT_NAME} transition\\\`, \\\`${PROJECT_NAME} scope propose-expansion\\\`, \\\`${PROJECT_NAME} abandon\\\`).
`;
