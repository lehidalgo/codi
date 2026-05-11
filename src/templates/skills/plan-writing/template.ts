import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when an approved design needs to be written down as a planning artifact —
  a detailed implementation plan, a stakeholder PRD, or a decomposition into
  tracer-bullet issues. Triggers on "write the plan", "draft a PRD", "break
  this into issues", "decompose to tickets", "create the plan markdown",
  "document the implementation". Outputs are deterministic from inputs; the
  skill does not interview the user (use \`discover\` for that). Skip when
  the input is a standalone brainstorming session needing post-hoc TDD
  breakdown — use ${PROJECT_NAME}-plan-writer instead. Body documents the
  three modes and the no-placeholders rule.
category: ${SKILL_CATEGORY.PLANNING}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}}

Produce planning artifacts. Three modes, same discipline.

## Pick a mode

| Mode     | Output                                                                                           | When                                            |
| -------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| \\\`plan\\\`   | \\\`docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md\\\` with atomic tasks (2-5min each) and complete code blocks | Phase plan of any workflow (default)            |
| \\\`prd\\\`    | High-level PRD doc (problem, user stories, decisions); optionally published to tracker           | Pre-workflow standalone for stakeholder PRD     |
| \\\`issues\\\` | N tracer-bullet issues with HITL/AFK marking and blocked-by graph; published to tracker          | Phase decompose, when team has an issue tracker |

Default routing: \\\`plan\\\` unless the caller explicitly requests \\\`prd\\\` or \\\`issues\\\`.

## Core principle

Synthesize from existing context. The skill does NOT interview — that is \\\`${PROJECT_NAME}:discover\\\`'s job. Inputs: the approved design, the conversation, the codebase, \\\`docs/CONTEXT.md\\\`, \\\`docs/adr/\\\`. Output: the artifact, deterministically.

## Universal principles (all modes)

1. **Synthesize, do not interview.** If new information is needed, stop and tell the user to invoke \\\`${PROJECT_NAME}:discover\\\` first.
2. **Use the domain glossary.** Every term must match \\\`docs/CONTEXT.md\\\`. Define inline (mode \\\`plan\\\`) or flag for the user (modes \\\`prd\\\`, \\\`issues\\\`).
3. **Respect approved ADRs.** Read \\\`docs/adr/\\\` before writing. Surface contradictions before writing the artifact.
4. **Look for deep modules.** Apply the deletion test when proposing components.
5. **No placeholders.** Forbidden: "TBD", "TODO", "implement later", "fill in details", "add validation", "handle edge cases", "similar to N". Each step has actual content. Placeholders are plan failures.
6. **Self-review before claiming done.** Run the checklist in \\\`references/self-review.md\\\`.

## Token economy

Mode \\\`plan\\\` produces a long artifact — write the file, do NOT echo the entire plan into chat. Modes \\\`prd\\\` and \\\`issues\\\` produce shorter artifacts; chat response is just "Written to <path>; review and approve."

## Anti-patterns

- Interviewing the user. Use \\\`${PROJECT_NAME}:discover\\\`.
- Writing plan content into chat instead of the file.
- Placeholders of any kind.
- Listing tasks without exact file paths.
- Code-free steps that say "implement X".
- Renaming a function between tasks (type-consistency check catches this).
- Cross-mode contamination — \\\`plan\\\` writes a [PLAN] markdown, NOT a PRD.

## References

- \\\`references/mode-plan.md\\\` — detailed plan markdown for workflow phase plan.
- \\\`references/mode-prd.md\\\` — high-level PRD synthesis.
- \\\`references/mode-issues.md\\\` — tracer-bullet vertical slices, HITL/AFK, blocked-by graph.
- \\\`references/plan-template.md\\\` — [PLAN] markdown template used by mode \\\`plan\\\`.
- \\\`references/self-review.md\\\` — final checklist before claiming the artifact is done.

## Termination

- Workflow phase plan (mode \\\`plan\\\`) → emit \\\`artifact_linked\\\` event with type \\\`plan\\\` pointing to the new file. Do NOT propose the next phase transition.
- Workflow phase decompose (mode \\\`issues\\\`) → emit one \\\`decision_recorded\\\` per published issue.
- Standalone (mode \\\`prd\\\` or \\\`plan\\\`) → write the file, surface the path, stop. Do not start a workflow.

## Boundaries

- Writes artifacts. Does NOT run dialogue (use \\\`discover\\\`), does NOT execute the plan (use the workflow's execute phase), does NOT auto-transition phases.
- Mode \\\`plan\\\` and mode \\\`prd\\\` are mutually exclusive for a single artifact — pick one.

## Red Flags — STOP and rewrite

These rationalizations mean the plan is not done. Delete the offending content and rewrite.

| If you find yourself thinking…                                | The truth is…                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| "I'll leave a TODO for the file path."                        | TODOs in plans become bugs in code. Resolve before claiming done.            |
| "The implementer can figure out the details."                 | Spec ambiguity at plan time = rework at execute time. Resolve here.          |
| "This task can span multiple files, that's fine."             | Atomic = 1 file ideal, 2-3 max. Split larger tasks into the plan.            |
| "The verify command is obvious from the test names."          | Every task lists the EXACT command + expected exit code. No 'obvious'.       |
| "I'll renumber tasks later if scope grows."                   | Renumbering breaks blocked-by graph. Insert with letters: 5a, 5b.            |
| "This plan is for a refactor, behaviour change is fine."      | Refactor mode FORBIDS behaviour change. If yours has it, switch to feature.  |
| "Renaming the function between tasks is OK if I update both." | Type-consistency review catches this and rejects. Pick the name once.        |
| "The PRD and the plan can share the same file."               | Mode \`prd\` and mode \`plan\` are different artifacts with different audiences. |
| "Self-review is fine, the user will catch issues."            | Self-review IS the contract. No 'just send it'.                              |
| "Tracer-bullet slices are too small, I'll group them."        | Smaller slices = faster integration feedback. Resist grouping.               |

**All of these mean: re-read \`references/self-review.md\` and rewrite the failing section.**
`;
