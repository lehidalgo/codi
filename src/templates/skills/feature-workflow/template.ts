import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when the user wants to build a new feature, add functionality, or
  implement something that does not exist yet. Manages a structured workflow
  through intent, plan, decompose, execute, and verify phases with manifest
  audit trail and human approval at every phase transition. Triggers on
  "build a feature", "add functionality", "implement feature", "build dark
  mode", "add login", "create a new", "develop", "ship a feature". Not for
  bug fixes (use bug-fix-workflow), refactoring without behavior change (use
  refactor-workflow), or schema and data migrations (use migration-workflow).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 2
---

# {{name}}

Adaptive feature workflow. Six phases (intent → plan → decompose → execute → verify → done) but **phases compress** based on the dev's answers. The discipline is preserved; the ceremony is not.

## When to use

User said "build a feature for X", "add Y", "implement Z". Before any code, start the workflow:

\\\`\\\`\\\`bash
${PROJECT_NAME} workflow run feature "<task>"
${PROJECT_NAME} workflow run feature "<task>" --profile <name>
${PROJECT_NAME} workflow run feature --from-story US-NNN "<task>"
\\\`\\\`\\\`

This writes the \\\`init\\\` event and enters phase \\\`intent\\\`. With \\\`--from-story\\\`, the Story is the seed for \\\`intent\\\`; without it, intent auto-creates a Story row at end of phase. Detail in \\\`references/phase-intent.md\\\`.

If \\\`${PROJECT_NAME} run\\\` fails with \\\`KnowledgeBaseMissingError\\\`: the agent invokes \\\`${PROJECT_NAME}:init-knowledge-base\\\` directly via the Skill tool — do NOT ask the user to invoke it. Re-run after the subagent completes.

## Profiles (fast path)

| Profile      | Use when                                        | Phases                          | Required skills                                        |
| ------------ | ----------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| \\\`prototype\\\`  | Trivial / single-file / design already approved | intent → execute → verify       | tdd, plan-execution INLINE, verify-evidence            |
| \\\`standard\\\`   | Typical multi-file feature (default)            | full 6 phases                   | full chain                                             |
| \\\`deep\\\`       | Large / multi-system / structural concern       | full 6 + parallel + grill       | full chain + subagent-orchestration + grilled discover |

\\\`\\\`\\\`bash
${PROJECT_NAME} workflow run feature "..." --profile prototype
${PROJECT_NAME} workflow run feature "..." --profile deep
\\\`\\\`\\\`

## Adaptive intake (when no profile)

The agent asks **one question per turn** and stores answers in the init payload's \\\`feature_adaptation\\\` field.

| # | Question                                          | Recommended | Effect                                          |
| - | ------------------------------------------------- | ----------- | ----------------------------------------------- |
| 1 | Complexity? (trivial / standard / large)          | standard    | trivial → skip decompose                        |
| 2 | Is an approved design spec already present?       | no          | yes → discover at intent becomes optional       |
| 3 | Scope: single file or multi-file?                 | multi       | single → skip decompose, INLINE exec mode       |
| 4 | Execute mode: INLINE or SUBAGENT?                 | per Q3      | activates plan-execution mode                   |
| 5 | TDD strict? (regression test required for new behaviour) | true | false → tdd advisory only                       |
| 6 | Grill at intent? (failure when story is vague)    | no          | yes → discover required (no skip)               |
| 7 | Cross-workflow? (bug-fix or refactor in disguise) | feature     | non-feature → \\\`--carryover-from\\\` conversion path |

## When to skip

- Bug or regression → \\\`bug-fix-workflow\\\`.
- Refactor with no behavior change → \\\`refactor-workflow\\\`.
- Schema or data migration → \\\`migration-workflow\\\`.

## Phase order

| Phase       | Purpose                                            | Detail                          |
| ----------- | -------------------------------------------------- | ------------------------------- |
| \\\`intent\\\`    | Understand what to build, confirm success criteria | \\\`references/phase-intent.md\\\`    |
| \\\`plan\\\`      | Design files, modules, contracts, test strategy    | \\\`references/phase-plan.md\\\`      |
| \\\`decompose\\\` | Split into vertical tracer-bullet slices           | \\\`references/phase-decompose.md\\\` |
| \\\`execute\\\`   | Implement slices, observe scope rules              | \\\`references/phase-execute.md\\\`   |
| \\\`verify\\\`    | Run validation, behavior checks, integrate review  | \\\`references/phase-verify.md\\\`    |
| \\\`done\\\`      | Ready to PR                                        | terminal                        |

Phase transitions require explicit human approval. Full advancement procedure in \\\`references/phase-transitions.md\\\`.

## Core principle

Scope discipline + audit trail + per-phase reference. The agent reads \\\`references/phase-<current>.md\\\` at every phase boundary. Out-of-scope edits require \\\`${PROJECT_NAME} scope propose-expansion\\\`. Knowledge base (\\\`docs/CONTEXT.md\\\`, \\\`docs/adr/\\\`) updates inline, never batched.

## Anti-patterns

- Auto-approving transitions.
- Editing files outside scope without \\\`propose-expansion\\\`.
- Skipping phases — every feature uses all five.
- Deleting tests to make validation pass — gate fraud.
- Absorbing a scope expansion as incidental. The classifier draws the line.
- Starting without \\\`${PROJECT_NAME} run feature "..."\\\` — no manifest, no audit trail.

## References

- \\\`references/phase-intent.md\\\` / \\\`phase-plan.md\\\` / \\\`phase-decompose.md\\\` / \\\`phase-execute.md\\\` / \\\`phase-verify.md\\\` — per-phase flow.
- \\\`references/phase-transitions.md\\\` — propose / approve / reject mechanics.
- \\\`references/tracer-bullets.md\\\` — slice format for \\\`decompose\\\`.
- \\\`references/gate-feedback-format.md\\\` — interpreting gate failure verdicts.

## Termination

- Phase \\\`done\\\` reached → \\\`workflow_completed\\\` event auto-emitted → branch ready for PR.
- Abandoned via \\\`${PROJECT_NAME} abandon --reason "<text>"\\\` → manifest preserved.

## Boundaries

- Manages the feature workflow. Does NOT do bug fixes, refactors, or migrations (sibling workflows).
- Does NOT execute the implementation directly — chains into \\\`tdd\\\`, \\\`subagent-orchestration\\\`, \\\`verify-evidence\\\`, \\\`code-review\\\` per phase.
- Does NOT skip the manifest — every action is logged for audit.

## Operator commands

\\\`\\\`\\\`bash
${PROJECT_NAME} status                                  # current phase + scope
${PROJECT_NAME} transition --to <phase>                 # propose transition
${PROJECT_NAME} transition --approve                    # human only
${PROJECT_NAME} transition --reject --reason "<text>"   # human only
${PROJECT_NAME} scope propose-expansion --reason "..."  # request scope change
${PROJECT_NAME} abandon --reason "<text>"               # cancel, preserve audit
${PROJECT_NAME} recover                                 # rebuild from archive
\\\`\\\`\\\`
`;
