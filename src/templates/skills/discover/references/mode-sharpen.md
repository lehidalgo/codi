# Mode: sharpen

Convergence. A plan or design already exists. Walk down each branch of the decision tree, resolve ambiguities, surface contradictions.

## Pre-conditions

A plan markdown exists (`docs/[PLAN]_*.md`) or a design summary exists. If neither, switch to `mode-wide` instead — `sharpen` has nothing to sharpen.

## Order of operations

1. **Read the plan in full.** Build a tree in your head: top-level goals, sub-decisions, dependencies between decisions.

2. **Read the relevant code.** For every claim in the plan that mentions a file, module, or behavior, verify against the actual code. Surface contradictions immediately:

   > "Plan says X is unchanged, but I see X exports Y which the new code uses. Which is right?"

3. **Walk the decision tree branch by branch.** Resolve dependencies one at a time:
   - Parent decision before child decision
   - Cross-cutting decision before local decisions

4. **For each ambiguity, surface and grill.** Pattern:

   ```
   Plan says: "<quote from plan>"
   Ambiguity: <what could be interpreted two ways>

   Q: <which interpretation is correct>?
   Recommended: <one of them, with one-line reason>
   ```

   ONE branch per turn. Wait for resolution before moving on.

5. **Stress-test with concrete scenarios.** When the plan describes behavior, invent specific scenarios that probe edges. Example: "Plan says theme persists across reloads. What if localStorage is full? What if it's disabled? What if a different tab changed it?"

6. **Surface implicit decisions.** Plans always have hidden assumptions. Examples:
   - "What happens if the input is empty?"
   - "What happens if the user hits submit twice?"
   - "What is the rollback path if step 3 fails?"
     ONE per turn.

7. **Stop when the tree is resolved.** Signs:
   - No remaining "TBD" or vague phrases in the plan
   - You can describe the implementation without making any decisions yourself
   - The user agrees there are no more open questions
     When stopped, summarize the resolutions and ask:
     > "Tree resolved. <N> decisions recorded. Ready to transition?"

## Universal principles (recap)

- ONE question per turn
- ALWAYS recommend an answer
- Explore the codebase before asking
- Multiple choice when option set is clear
- Token economy — questions ≤2 lines, no preamble

## Termination

- Inside workflow `plan` phase: record each resolution as a `decision_recorded` event in the manifest. Update the plan markdown inline only if a decision changes file scope or interfaces. Propose `codi transition --to <next-phase>` when done.
- Standalone: append the resolutions to the existing plan markdown; do not start a workflow without explicit user request.

## What you do NOT do in this mode

- Generate alternatives. The plan exists; sharpen it, do not replace it. If the plan is fundamentally wrong, switch to `mode-wide` instead.
- Add features. Sharpening is removing ambiguity, not adding scope.
- Walk multiple branches in parallel. ONE per turn. The user cannot answer two coupled questions correctly without first answering one.
