import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when the gate runner dispatches this check during phase transition from
  plan to decompose. Identifies shallow modules in the plan and suggests
  deepening opportunities (Ousterhout-style depth analysis). Triggers on
  "gate deep modules", "check shallow modules", "validate module depth".
  Internal use by the gate runner during plan-complete validation. Returns
  structured JSON verdict — never prose.
category: ${SKILL_CATEGORY.CODE_QUALITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: false
disable-model-invocation: false
version: 2
maintainers: ["@lehidalgo"]
---

# {{name}}

Runs as a forked subagent to identify shallow module proposals in the plan. A shallow module has an interface nearly as complex as its implementation — usually a sign the abstraction is not earning its keep.

## When to use

Internal — invoked by the gate runner during plan→decompose transition. Not invoked directly by users or the orchestrator.

## Core principle

Apply the deletion test to every proposed module. Shallow = pass-through (delete it). Deep = concentrates complexity behind a small interface (keep it).

## Procedure

1. Read the plan markdown.
2. For each module the plan proposes (in the "Modules and contracts" section), evaluate:
   - **Depth**: is the interface much smaller than the implementation?
   - **Deletion test**: would deleting the module concentrate complexity (deep) or spread it across N callers (shallow pass-through)?
   - **Locality**: does the module concentrate change, knowledge, and bug locality?
3. Produce a list of shallow candidates with a one-line reason and a suggested deepening.

## Output (strict JSON)

\\\`\\\`\\\`json
{
  "check_id": "deep_module_opportunities_considered",
  "verdict": "pass" | "fail",
  "summary": "<count> shallow module(s) detected" | "All proposed modules are deep enough.",
  "evidence": {
    "shallow_modules": [
      {
        "name": "<module name>",
        "reason": "<why it is shallow>",
        "suggested_deepening": "<what would make it deep>"
      }
    ]
  },
  "suggested_action": "<guidance for the agent to deepen the plan or document the rationale>",
  "tokens_consumed": <integer>
}
\\\`\\\`\\\`

The verdict is \\\`fail\\\` only when the agent should reconsider the plan; if shallow modules are intentional and rationale is documented, return \\\`pass\\\` with \\\`evidence.shallow_modules\\\` annotating each.

## Constraints

- Read-only tools only.
- This gate is advisory (\\\`max_retries: 1\\\`). After one retry, escalate to human.
- Do not invoke other skills.

## Anti-patterns

- Returning prose instead of strict JSON.
- Using "component", "service", "API", "boundary" instead of architecture vocabulary.
- Flagging deep modules as shallow (interface complexity ≠ implementation complexity).
- Suggesting deepening for already-deep modules.

## Termination

- JSON written to the gate-result location.
- Verdict \\\`pass\\\` or \\\`fail\\\`.
- No manifest events emitted directly.

## Boundaries

- Identifies shallow modules in the plan. Does NOT execute deepening (refactor-workflow does that).
- Does NOT propose new modules — only evaluates existing ones in the plan.
- Read-only — never modifies plan or codebase.
`;
