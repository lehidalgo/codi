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
version: 1
---

# {{name}}

Run a feature from idea to ready-to-merge using ${PROJECT_NAME}'s phase-locked process. The human decides; the agent executes and registers; the manifest captures every step.

## When to use

User said "build a feature for X", "add Y", "implement Z". Before any code, start the workflow:

\\\`\\\`\\\`bash
${PROJECT_NAME} run feature "<one-line task description>"
${PROJECT_NAME} run feature --from-story US-NNN "<one-line>"   # Story already in the Sheet
\\\`\\\`\\\`

This writes the \\\`init\\\` event and enters phase \\\`intent\\\`. With \\\`--from-story\\\`, the Story is the seed for \\\`intent\\\`; without it, intent auto-creates a Story row at end of phase. Detail in \\\`references/phase-intent.md\\\`.

If \\\`${PROJECT_NAME} run\\\` fails with \\\`KnowledgeBaseMissingError\\\`: the agent invokes \\\`${PROJECT_NAME}:init-knowledge-base\\\` directly via the Skill tool — do NOT ask the user to invoke it. Re-run after the subagent completes.

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
