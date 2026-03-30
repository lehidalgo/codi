import {
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PROJECT_URL,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Compare local ${PROJECT_NAME_DISPLAY} artifacts against upstream templates. Use when the user wants
  to see what they have customized, check for upstream updates, or prepare to
  contribute improvements back to ${PROJECT_NAME_DISPLAY}. Also activate on /${PROJECT_NAME}-compare-preset.
category: ${PROJECT_NAME_DISPLAY} Platform
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Preset Comparison
  examples:
    - "Compare my config to upstream"
    - "What changed in my preset"
---

# {{name}}

## When to Activate

- User asks to compare their local ${PROJECT_NAME_DISPLAY} setup against the latest version
- User wants to see what they have customized vs what is upstream
- User is preparing to contribute improvements back to ${PROJECT_NAME_DISPLAY}
- User asks about upgrading or updating ${PROJECT_NAME_DISPLAY} artifacts
- User runs \`/${PROJECT_NAME}-compare-preset\`

## Step 1: Identify Local State

**[CODING AGENT]** Read the local configuration:

\\\`\\\`\\\`bash
# Read manifest to get preset name and artifact lists
cat ${PROJECT_DIR}/${PROJECT_NAME}.yaml
\\\`\\\`\\\`

Then inventory local customizations:

\\\`\\\`\\\`bash
# List custom rules (user-created or improved)
ls ${PROJECT_DIR}/rules/ 2>/dev/null

# List skills (check for managed_by: user in frontmatter)
grep -rl "managed_by: user" ${PROJECT_DIR}/skills/ 2>/dev/null

# List agents
ls ${PROJECT_DIR}/agents/ 2>/dev/null
\\\`\\\`\\\`

Record:
- The installed preset name
- All custom rules in \`${PROJECT_DIR}/rules/\`
- Any skills or agents with \`managed_by: user\` (project-specific versions)
- The ${PROJECT_NAME_DISPLAY} version from \`${PROJECT_NAME}.yaml\`

## Step 2: Fetch Upstream State

**[CODING AGENT]** Get the latest ${PROJECT_NAME_DISPLAY} templates:

\\\`\\\`\\\`bash
TEMP_DIR=$(mktemp -d)
git clone --depth 1 ${PROJECT_URL}.git "$TEMP_DIR/${PROJECT_NAME}-upstream" 2>/dev/null
\\\`\\\`\\\`

If the clone fails (offline, network error), skip upstream comparison and show only the local customization report.

Read the corresponding preset definition:

\\\`\\\`\\\`bash
# Find the preset file (preset name from Step 1)
ls "$TEMP_DIR/${PROJECT_NAME}-upstream/src/templates/presets/"
\\\`\\\`\\\`

## Step 3: Compare Artifacts

**[CODING AGENT]** For each artifact type, compare local vs upstream:

### Rules Comparison
For each rule in the installed preset:
1. Read local version from \`${PROJECT_DIR}/rules/<name>.md\` (if customized) or the generated output
2. Read upstream version from \`$TEMP_DIR/${PROJECT_NAME}-upstream/src/templates/rules/<name>.ts\`
3. Extract the template string content from the TypeScript file
4. Identify: added sections, removed sections, modified guidance

### Custom Rules (local-only)
List rules in \`${PROJECT_DIR}/rules/\` that have no upstream equivalent — these are **contribution candidates**.

### Skills Comparison
For skills with \`managed_by: user\`:
1. Read local \`${PROJECT_DIR}/skills/<name>/SKILL.md\`
2. Read upstream \`$TEMP_DIR/${PROJECT_NAME}-upstream/src/templates/skills/<name>.ts\`
3. Identify added steps, modified workflows, expanded scope

### Agents Comparison
Same approach: diff local agent files against upstream template strings.

## Step 4: Present Report

**[CODING AGENT]** Format the comparison as:

\\\`\\\`\\\`markdown
## Preset Comparison: [preset-name]

### Your Improvements (contribution candidates)
- **[artifact-name]** ([type]): [what was added/changed] — [why it is better]

### Upstream Updates Available
- **[artifact-name]**: upstream added [new section] — [should we pull it in?]

### Conflicts
- **[artifact-name]**: local and upstream both changed [section] — needs manual resolution

### Summary
- X local improvements ready to contribute
- Y upstream updates available to pull
- Recommendation: [contribute first / pull first / both / nothing needed]
\\\`\\\`\\\`

## Step 5: Action

**[CODING AGENT]** Based on the user's choice:

### Contribute Local Improvements
Guide the user through the \`${PROJECT_CLI} contribute\` workflow:
\\\`\\\`\\\`bash
${PROJECT_CLI} contribute
\\\`\\\`\\\`
Or use the contribute skill for the full workflow (fork, branch, PR).

### Pull Upstream Updates
\\\`\\\`\\\`bash
${PROJECT_CLI} update
\\\`\\\`\\\`
This only updates \`managed_by: ${PROJECT_NAME}\` artifacts — user customizations are preserved.

### Both
Contribute first (so improvements are not overwritten), then pull updates.

## Step 6: Cleanup

\\\`\\\`\\\`bash
rm -rf "$TEMP_DIR"
\\\`\\\`\\\`

## Offline Mode

If upstream clone fails, present a local-only report:
- List all custom rules with their descriptions
- List all \`managed_by: user\` skills and agents
- Note that upstream comparison is unavailable
- Suggest retrying when network is available
`;
