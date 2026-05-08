---
name: feature-workflow
description: Use when the user wants to build a new feature, add functionality, or implement something that does not exist yet. Manages a structured workflow through intent, plan, decompose, execute, and verify phases with manifest audit trail and human approval at every phase transition. Triggers on "build a feature", "add functionality", "implement feature", "build dark mode", "add login", "create a new", "develop", "ship a feature". Not for bug fixes (use bug-fix-workflow), refactoring without behavior change (use refactor-workflow), or schema and data migrations (use migration-workflow).
---

# feature-workflow

Run a feature from idea to ready-to-merge using devloop's phase-locked process. The human decides; the agent executes and registers; the manifest captures every step.

## When to use

User said "build a feature for X", "add Y", "implement Z". Before any code, start the workflow:

```bash
devloop run feature "<one-line task description>"
devloop run feature --from-story US-NNN "<one-line>"   # Story already in the Sheet
```

This writes the `init` event and enters phase `intent`. With `--from-story`, the Story is the seed for `intent`; without it, intent auto-creates a Story row at end of phase. Detail in `references/phase-intent.md`.

If `devloop run` fails with `KnowledgeBaseMissingError`: the agent invokes `devloop:init-knowledge-base` directly via the Skill tool — do NOT ask the user to invoke it. Re-run after the subagent completes.

## When to skip

- Bug or regression → `bug-fix-workflow`.
- Refactor with no behavior change → `refactor-workflow`.
- Schema or data migration → `migration-workflow`.

## Phase order

| Phase       | Purpose                                            | Detail                          |
| ----------- | -------------------------------------------------- | ------------------------------- |
| `intent`    | Understand what to build, confirm success criteria | `references/phase-intent.md`    |
| `plan`      | Design files, modules, contracts, test strategy    | `references/phase-plan.md`      |
| `decompose` | Split into vertical tracer-bullet slices           | `references/phase-decompose.md` |
| `execute`   | Implement slices, observe scope rules              | `references/phase-execute.md`   |
| `verify`    | Run validation, behavior checks, integrate review  | `references/phase-verify.md`    |
| `done`      | Ready to PR                                        | terminal                        |

Phase transitions require explicit human approval. Full advancement procedure in `references/phase-transitions.md`.

## Core principle

Scope discipline + audit trail + per-phase reference. The agent reads `references/phase-<current>.md` at every phase boundary. Out-of-scope edits require `devloop scope propose-expansion`. Knowledge base (`docs/CONTEXT.md`, `docs/adr/`) updates inline, never batched.

## Anti-patterns

- Auto-approving transitions.
- Editing files outside scope without `propose-expansion`.
- Skipping phases — every feature uses all five.
- Deleting tests to make validation pass — gate fraud.
- Absorbing a scope expansion as incidental. The classifier draws the line.
- Starting without `devloop run feature "..."` — no manifest, no audit trail.

## References

- `references/phase-intent.md` / `phase-plan.md` / `phase-decompose.md` / `phase-execute.md` / `phase-verify.md` — per-phase flow.
- `references/phase-transitions.md` — propose / approve / reject mechanics.
- `references/tracer-bullets.md` — slice format for `decompose`.
- `references/gate-feedback-format.md` — interpreting gate failure verdicts.

## Termination

- Phase `done` reached → `workflow_completed` event auto-emitted → branch ready for PR.
- Abandoned via `devloop abandon --reason "<text>"` → manifest preserved.

## Boundaries

- Manages the feature workflow. Does NOT do bug fixes, refactors, or migrations (sibling workflows).
- Does NOT execute the implementation directly — chains into `tdd`, `subagent-orchestration`, `verify-evidence`, `code-review` per phase.
- Does NOT skip the manifest — every action is logged for audit.

## Operator commands

```bash
devloop status                                  # current phase + scope
devloop transition --to <phase>                 # propose transition
devloop transition --approve                    # human only
devloop transition --reject --reason "<text>"   # human only
devloop scope propose-expansion --reason "..."  # request scope change
devloop abandon --reason "<text>"               # cancel, preserve audit
devloop recover                                 # rebuild from archive
```
