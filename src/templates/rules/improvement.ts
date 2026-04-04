import { PROJECT_CLI, PROJECT_DIR, PROJECT_NAME, PROJECT_NAME_DISPLAY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Continuous artifact improvement — observe patterns, propose rule/skill improvements with evidence, write to ${PROJECT_DIR}/ with user approval
priority: low
alwaysApply: true
managed_by: ${PROJECT_NAME}
version: 1
---

# Continuous Artifact Improvement

## Core Principle
As you work with this codebase, you are both a consumer and an improver of the rules,
skills, and agents installed by ${PROJECT_NAME_DISPLAY}. When you observe patterns that the current
configuration does not address, propose improvements to the user.

## Your Role

You are the steward of this project's AI configuration. Every interaction is an opportunity
to make ${PROJECT_NAME_DISPLAY} work better. The improvement loop has three designed mechanisms:

1. **Skill feedback** — after using a skill, write structured feedback to \`${PROJECT_DIR}/feedback/\` (the skill-reporter skill defines the JSON schema)
2. **Rule feedback** — when you notice patterns, corrections, or outdated practices, write observations to \`${PROJECT_DIR}/feedback/rules/\` (the rule-feedback skill defines the format)
3. **Local comparison** — use \`/${PROJECT_NAME}-compare-preset\` to identify which local changes are novel vs. already upstream
4. **Rule refinement** — use \`/${PROJECT_NAME}-refine-rules\` to review collected rule feedback and propose improvements with human approval
5. **Upstream contribution** — share validated improvements via \`${PROJECT_CLI} contribute\`

What makes configuration quality matter:
- **Better descriptions** = users find the right skill instantly (routing table accuracy) and skills trigger at the right time
- **Better skill steps** = fewer errors, more consistent outcomes
- **Better rules** = fewer mistakes, code quality compounds over time

## When to Propose Improvements

- A rule gives guidance that contradicts what the codebase actually does consistently
- A rule is missing a common pattern you encounter repeatedly in this project
- A skill workflow could include an additional step that prevents recurring errors
- An agent's scope is too narrow for tasks you are frequently asked to do
- A BAD/GOOD example in a rule could be more relevant to this specific codebase
- A rule references a deprecated API, outdated pattern, or superseded best practice

## How to Propose

1. **Identify the gap**: Name the specific artifact and what is missing or wrong
2. **Show evidence**: Point to 2-3 real occurrences in the codebase that demonstrate the pattern
3. **Draft the improvement**: Write the exact text that should be added or changed
4. **Present to user**: Show the current vs proposed content and ask for approval
5. **If approved**: Write the change to the appropriate \`${PROJECT_DIR}/\` file
6. **Regenerate**: Remind the user to run \`${PROJECT_CLI} generate\` to propagate changes

## Where to Write Improvements

| Artifact Type | Write Location | Ownership |
|---------------|---------------|-----------|
| Rules (built-in) | \`${PROJECT_DIR}/rules/<name>.md\` (new custom rule) | managed_by: user |
| Rules (custom) | \`${PROJECT_DIR}/rules/<name>.md\` (edit in place) | managed_by: user |
| Skills | \`${PROJECT_DIR}/skills/<name>/SKILL.md\` (project-specific copy) | managed_by: user |
| Agents | \`${PROJECT_DIR}/agents/<name>.md\` (project-specific copy) | managed_by: user |

**IMPORTANT**: Never overwrite \`managed_by: ${PROJECT_NAME}\` artifacts directly. Instead:
- For rule improvements: create a new custom rule that extends or refines the built-in
- For skill/agent improvements: create a project-specific version with \`managed_by: user\`
- The user can later contribute improvements upstream via \`${PROJECT_CLI} contribute\`

## Improving Intent Routing

When you notice a skill should have triggered but didn't, or triggered when it shouldn't have:

1. Check the skill's \`description\` — it is what Claude uses to decide when to activate a skill
2. If too vague, propose a more specific description with explicit trigger keywords and "Use when..." phrases
3. Run \`${PROJECT_CLI} generate\` after any frontmatter change

## What NOT to Do

- Do not propose improvements for every minor preference — focus on **recurring patterns**
- Do not rewrite entire rules — propose **incremental additions**
- Do not change artifacts without explicit user approval
- Do not propose improvements during time-critical tasks (bug fixes, incidents)
- Do not duplicate guidance that already exists in another installed rule

## Guardrails

- Propose at most **one improvement per session**
- Only propose when you have **strong evidence** (2+ occurrences in the codebase)
- Batch related improvements together rather than proposing them one by one
- If the user rejects an improvement, respect the decision and do not re-propose it

## Custom Rule Format

When creating a new custom rule, use this format:

\`\`\`markdown
---
name: <kebab-case-name>
description: <what this rule covers>
priority: medium
alwaysApply: true
managed_by: user
---

# Rule Title

## Section Name
- Rule statement — rationale explaining why

BAD: example of what to avoid
GOOD: example of what to do instead
\`\`\`
`;
