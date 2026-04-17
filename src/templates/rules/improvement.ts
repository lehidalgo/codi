import { PROJECT_CLI, PROJECT_DIR, PROJECT_NAME, PROJECT_NAME_DISPLAY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Continuous artifact improvement — observe patterns, emit CODI-OBSERVATION markers, propose rule/skill improvements with evidence and user approval
priority: low
alwaysApply: true
managed_by: ${PROJECT_NAME}
version: 3
---

# Continuous Artifact Improvement

## Core Principle
As you work with this codebase, you are both a consumer and an improver of the rules,
skills, and agents installed by ${PROJECT_NAME_DISPLAY}. When you observe patterns that the current
configuration does not address, flag them with a marker. The system collects and structures
these automatically.

## Your Role

You are the steward of this project's AI configuration. Every interaction is an opportunity
to make ${PROJECT_NAME_DISPLAY} work better. The improvement loop has these mechanisms:

1. **Observation markers** — emit \`[CODI-OBSERVATION: ...]\` inline in your response when you notice a gap (the Stop hook collects it automatically — you do not write files)
2. **Local comparison** — use \`/${PROJECT_NAME}-compare-preset\` to identify which local changes are novel vs. already upstream
3. **Rule refinement** — use \`/${PROJECT_NAME}-refine-rules\` to review collected feedback and propose improvements with human approval
4. **Upstream contribution** — share validated improvements via \`${PROJECT_CLI} contribute\`

## Source-layer improvements (${PROJECT_NAME_DISPLAY} repo only)

When editing an artifact at its source in the ${PROJECT_NAME_DISPLAY} source repository
(\`src/templates/rules/\`, \`src/templates/skills/\`, or \`src/templates/agents/\`), plain
\`${PROJECT_CLI} generate\` will NOT propagate the change. \`generate\` reads from
\`${PROJECT_DIR}/\`, not from \`src/templates/\`. Follow the clean + reinstall flow
documented in the \`${PROJECT_NAME}-dev-operations\` skill (and mirrored in CLAUDE.md /
AGENTS.md under **Self-Development Mode → The three-layer pipeline**):

\`\`\`bash
pnpm build
rm -rf ${PROJECT_DIR}/<artifact-type>/${PROJECT_NAME}-<name>
# prune the artifact-manifest entry
${PROJECT_CLI} add <artifact-type> ${PROJECT_NAME}-<name> --template ${PROJECT_NAME}-<name>
${PROJECT_CLI} generate --force
\`\`\`

Bump \`version:\` in the template frontmatter so downstream consumers see the
change on their next update. If you skip the clean + reinstall, your edit will
stay stranded at the source layer and never reach the per-agent output.

What makes configuration quality matter:
- **Better descriptions** = skills trigger at the right time
- **Better skill steps** = fewer errors, more consistent outcomes
- **Better rules** = fewer mistakes, code quality compounds over time

## How to Flag an Observation

When you notice a gap, incorrect trigger, outdated guidance, or missing pattern in a ${PROJECT_NAME_DISPLAY} artifact, emit this marker anywhere in your response:

\`\`\`
[CODI-OBSERVATION: <artifact-name> | <category> | <observation text, max 200 chars>]
\`\`\`

**Categories:** \`trigger-miss\`, \`trigger-false\`, \`missing-step\`, \`outdated-rule\`, \`missing-example\`, \`user-correction\`, \`wrong-output\`

**Example:**
\`\`\`
[CODI-OBSERVATION: ${PROJECT_NAME}-commit | trigger-miss | skill did not activate when user typed /${PROJECT_NAME}-commit directly]
\`\`\`

The Stop hook scans your response, extracts valid markers, and writes structured JSON to \`${PROJECT_DIR}/feedback/\`. You do not touch the file system.

## When to Emit Observations

- A rule gives guidance that contradicts what the codebase actually does consistently
- A rule is missing a common pattern you encounter repeatedly in this project
- A skill workflow is missing a step that would prevent a recurring error
- An agent's scope is too narrow for tasks you are frequently asked to do
- A BAD/GOOD example in a rule could be more relevant to this specific codebase
- A rule references a deprecated API, outdated pattern, or superseded best practice
- A skill should have triggered but did not (or triggered when it should not have)

## How to Propose Approved Changes

For non-trivial improvements that require user review (not just an observation):

1. **Identify the gap**: Name the specific artifact and what is missing or wrong
2. **Show evidence**: Point to 2-3 real occurrences in the codebase that demonstrate the pattern
3. **Draft the improvement**: Write the exact text that should be added or changed
4. **Present to user**: Show the current vs proposed content and ask for approval
5. **If approved**: Write the change to the appropriate \`${PROJECT_DIR}/\` file
6. **Regenerate**: Remind the user to run \`${PROJECT_CLI} generate\` to propagate changes

## Where to Write Approved Improvements

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

## What NOT to Do

- Do not propose improvements for every minor preference — focus on **recurring patterns**
- Do not rewrite entire rules — propose **incremental additions**
- Do not change artifacts without explicit user approval
- Do not propose improvements during time-critical tasks (bug fixes, incidents)
- Do not duplicate guidance that already exists in another installed rule

## Guardrails

- Emit at most **3 observations per session** — avoid noise, focus on the most impactful
- Only propose approved changes when you have **strong evidence** (2+ occurrences in the codebase)
- Batch related improvements together rather than proposing them one by one
- If the user rejects an improvement, respect the decision and do not re-propose it
- **User corrections are always high severity** — always emit them, no evidence threshold

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
