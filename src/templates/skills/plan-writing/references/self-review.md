# Self-review checklist

Run this checklist on the artifact you just wrote, before claiming it is done. Fix issues inline; do not ask the user for permission to fix obvious mistakes.

## 1. Spec / discover coverage

Skim each section or requirement in the source (the discover output, the parent PRD, the user's stated success criteria). For each:

- Can you point to a task (mode `plan`), a user story (mode `prd`), or a slice (mode `issues`) that addresses it?
- If yes, continue.
- If no, you have a gap. Add the missing task / story / slice. Do not move on.

## 2. Placeholder scan

Search the artifact for these patterns. They are plan failures; replace each with actual content:

- `TBD`, `TODO`, `FIXME`
- "implement later", "fill in details", "to be determined"
- "add appropriate error handling" (without saying which errors)
- "add validation" (without saying which constraints)
- "handle edge cases" (without saying which)
- "write tests for the above" (without showing the tests)
- "similar to Task N" (the engineer may read tasks out of order; repeat the code)
- Any sentence that describes WHAT to do without showing HOW

If you find any, fix inline.

## 3. Type consistency

Cross-task consistency check:

- Function names: a function `clearLayers()` in task 3 must not become `clearFullLayers()` in task 7.
- Type names: an interface `UserSettings` in task 2 must not be `Settings` in task 5.
- Property names on objects: `submittedAt` in one task must not be `createdAt` in the next.
- Method signatures: arity and parameter order must match across all tasks that mention the method.

If you find drift, fix all references inline so the plan is internally consistent.

## 4. Internal contradictions

Read the document end-to-end with fresh eyes:

- Does the architecture section match the task descriptions?
- Does the test strategy mention modules that the modules section actually defines?
- Are the success criteria attainable from the proposed tasks?
- Do any two sections give different answers to the same question?

If yes, reconcile. The plan must be internally consistent.

## 5. Scope check

- Is this artifact focused enough for a single workflow / single PRD / single decomposition?
- If you find yourself describing two unrelated subsystems, the artifact should split into two.

If split is needed, surface that to the user before publishing:

> "This plan covers two independent subsystems (A and B). Recommend splitting into two plans, run separately. Confirm?"

## 6. Ambiguity check

For each requirement, ask: could it be interpreted two ways?

- "The form should be responsive" — responsive how? Mobile breakpoint? Server-side responsive?
- "Save the data" — to where? With what serialization? With what error handling?
- "Validate the input" — against what schema?

Pick one interpretation and make it explicit. Ambiguity in the plan becomes bugs in the implementation.

## After the review

Fix every issue you found. Do NOT re-run the review; the goal is to fix and move on, not to oscillate.

If any of the gaps cannot be fixed by you alone (e.g., a requirement was never resolved by `discover` and you cannot recommend a default), stop and tell the user:

> "Self-review surfaced N gaps that need a decision. Run `codi:discover` (mode sharpen) on these specific items before this artifact can be marked ready."

Do NOT proceed past unresolved gaps.
