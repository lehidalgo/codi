import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when starting a feature with no plan, when an existing plan needs
  sharpening branch by branch, or when a design must be stress-tested against
  the project's domain glossary and ADRs. Triggers on "build a feature",
  "design X", "grill the design", "stress-test plan", "challenge the design",
  "explore options", "what should be built", "help think through this".
  Replaces ad-hoc Q&A at workflow phase boundaries (intent for new work, plan
  for convergence and domain cross-check) and runs standalone via
  \`/${PROJECT_NAME}:{{name}}\`. Body documents the three modes and the hard gate.
category: ${SKILL_CATEGORY.PLANNING}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
---

# {{name}}

Structured dialogue. Three modes; same core principles. Replaces improvised open-ended questioning.

## Hard gate

Do NOT take any implementation action — write code, scaffold, propose a phase transition, invoke another skill that implements — until the user explicitly approves the design (mode \\\`wide\\\`) or the sharpened plan (modes \\\`sharpen\\\` and \\\`domain\\\`). This applies even to "simple" tasks.

## Pick a mode

| Mode      | When                                                                                        | Read                         |
| --------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| \\\`wide\\\`    | New feature, no plan exists yet, design needs to be created from scratch                    | \\\`references/mode-wide.md\\\`    |
| \\\`sharpen\\\` | A plan markdown exists; resolve ambiguities and coupled decisions                           | \\\`references/mode-sharpen.md\\\` |
| \\\`domain\\\`  | Plan exists AND \\\`docs/CONTEXT.md\\\` has ≥5 terms or \\\`docs/adr/\\\` has approved ADRs in the area | \\\`references/mode-domain.md\\\`  |

Default routing: empty state → \\\`wide\\\`; plan + rich knowledge base → \\\`domain\\\`; otherwise \\\`sharpen\\\`.

## Universal principles (all modes)

1. **ONE question per turn.** Never bundle two questions in one message.
2. **ALWAYS provide a recommended answer.** The user grades or overrides.
3. **Multiple choice when natural; open-ended when needed.**
4. **Explore the codebase before asking.** Read code, \\\`docs/CONTEXT.md\\\`, or \\\`git log\\\` first.
5. **Token economy.** Questions ≤2 lines, recommendation ≤1 line, no preamble, no restatements.
6. **Scope first, detail second.** Decompose multi-subsystem requests into separate \\\`discover\\\` cycles.

## Response format

\\\`\\\`\\\`
[short context if needed — 1 line max]

Q: <question>
Recommended: <one-line recommendation>

[optional: A/B/C/D options if multiple choice]
\\\`\\\`\\\`

No "great question", no restatement, no preamble.

## Anti-patterns

- "Too simple to need a design" — still need agreement on success criteria and scope.
- Bundling multiple questions per turn.
- Asking what the codebase already answers.
- Asking without a recommendation.
- Long restatements of the user's previous answer.
- Sliding into implementation before approval (hard gate).

## References

- \\\`references/mode-wide.md\\\` — discovery flow with 2-3 approaches, scope decomposition, spec self-review.
- \\\`references/mode-sharpen.md\\\` — interrogate-existing-plan flow, branch-by-branch resolution.
- \\\`references/mode-domain.md\\\` — sharpen + CONTEXT.md / ADR awareness, inline glossary updates, ADR triple test.

## Termination

After approval:

- Workflow intent phase (mode \\\`wide\\\`): record decisions via \\\`decision_recorded\\\` events, propose phase transition. Do NOT auto-write the plan markdown (that is \\\`plan-writing\\\`'s job).
- Workflow plan phase (mode \\\`sharpen\\\` or \\\`domain\\\`): record resolutions, update the plan markdown inline if needed, propose transition to next phase.
- Standalone: write a design summary to \\\`docs/YYYYMMDD_HHMMSS_[RESEARCH]_<topic>.md\\\`. Stop.

## Boundaries

- Runs the dialogue. Does NOT write the plan artifact (use \\\`plan-writing\\\`).
- Does NOT execute the plan (use the workflow's execute phase).
- Does NOT replace \\\`architecture-review\\\` for surfacing structural friction.
`;
