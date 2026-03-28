export const template = `---
name: {{name}}
description: Continuous artifact improvement — observe patterns, propose rule/skill improvements with evidence, write to .codi/ with user approval
priority: low
alwaysApply: true
managed_by: codi
---

# Continuous Artifact Improvement

## Core Principle
As you work with this codebase, you are both a consumer and an improver of the rules,
skills, and agents installed by Codi. When you observe patterns that the current
configuration does not address, propose improvements to the user.

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
5. **If approved**: Write the change to the appropriate \`.codi/\` file
6. **Regenerate**: Remind the user to run \`codi generate\` to propagate changes

## Where to Write Improvements

| Artifact Type | Write Location | Ownership |
|---------------|---------------|-----------|
| Rules (built-in) | \`.codi/rules/<name>.md\` (new custom rule) | managed_by: user |
| Rules (custom) | \`.codi/rules/<name>.md\` (edit in place) | managed_by: user |
| Skills | \`.codi/skills/<name>/SKILL.md\` (project-specific copy) | managed_by: user |
| Agents | \`.codi/agents/<name>.md\` (project-specific copy) | managed_by: user |

**IMPORTANT**: Never overwrite \`managed_by: codi\` artifacts directly. Instead:
- For rule improvements: create a new custom rule that extends or refines the built-in
- For skill/agent improvements: create a project-specific version with \`managed_by: user\`
- The user can later contribute improvements upstream via \`codi contribute\`

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
