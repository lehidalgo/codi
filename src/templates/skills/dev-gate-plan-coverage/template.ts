import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Use when the gate runner dispatches this check during phase transition from
  plan to decompose. Validates that the plan covers every success criterion
  stated in the workflow's intent. Triggers on "gate plan coverage",
  "validate plan covers intent", "check plan completeness". Internal use by
  the gate runner; not invoked directly by users. Returns structured JSON
  verdict — never prose.
category: ${SKILL_CATEGORY.PLANNING}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: false
disable-model-invocation: false
version: 2
maintainers: ["@lehidalgo"]
---

# {{name}}

Runs as a forked subagent to evaluate whether the plan markdown addresses every success criterion in the workflow intent. Output is strictly JSON conforming to \\\`schemas/gate-result.schema.json\\\`.

## When to use

Internal — invoked by the gate runner during plan→decompose transition. Not invoked directly by users.

## Core principle

Every success criterion from intent must map to a section, task, or explicit out-of-scope declaration in the plan. Anything else is a gap.

## Inputs (provided via context)

- \\\`plan_artifact_path\\\`: path to the plan markdown
- \\\`workflow_id\\\`: the workflow being evaluated
- \\\`intent_summary\\\`: success criteria from intent phase

## Procedure

1. Read the plan markdown at \\\`plan_artifact_path\\\`.
2. Read the manifest events for the workflow to extract intent decisions and success criteria.
3. For each success criterion: confirm the plan addresses it (mentions the file or module that implements it, declares a test for it, or marks it explicitly out-of-scope with rationale).
4. Compute the verdict:
   - \\\`pass\\\` if every success criterion is addressed
   - \\\`fail\\\` otherwise

## Output (strict JSON)

\\\`\\\`\\\`json
{
  "check_id": "plan_addresses_intent",
  "verdict": "pass" | "fail",
  "summary": "<one-sentence summary>",
  "evidence": {
    "covered_criteria": ["criterion 1", "criterion 2"],
    "missing_criteria": ["criterion 3"]
  },
  "suggested_action": "<actionable guidance for the agent to fix the plan>",
  "tokens_consumed": <integer>
}
\\\`\\\`\\\`

No prose outside the JSON. The output is parsed directly. If you cannot determine coverage with confidence, return \\\`verdict: fail\\\` with \\\`evidence.missing_criteria\\\` listing what could not be confirmed and \\\`suggested_action\\\` instructing the human to clarify.

## Constraints

- Do not edit any file. Read-only tools only.
- Do not propose code changes. The verdict guides the agent; the agent edits the plan.
- Do not call other skills. Stay within this fork.

## Anti-patterns

- Returning prose instead of strict JSON.
- Marking pass when criteria are addressed only superficially (mentioned but not actually planned for).
- Editing the plan directly — verdict guides; agent edits.

## Termination

- JSON written to the gate-result location.
- Verdict \\\`pass\\\` or \\\`fail\\\` consumed by the gate runner.

## Boundaries

- Verifies plan covers intent. Does NOT verify implementation covers plan (that is verify-evidence).
- Does NOT modify the plan — read-only.
`;
