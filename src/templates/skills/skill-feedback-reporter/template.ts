import {
  PROJECT_DIR,
  PROJECT_NAME,
  PLATFORM_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: Review accumulated skill and rule observations collected in .codi/feedback/. Groups findings by artifact, shows the top 3 worth acting on. Use before running /${PROJECT_NAME}-refine-rules to see what has accumulated.
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
user-invocable: true
disable-model-invocation: false
managed_by: ${PROJECT_NAME}
version: 6
---

# Feedback Reviewer

## Purpose

Read the observations collected in \`${PROJECT_DIR}/feedback/\` and show a concise summary grouped by artifact. This is the first step before running \`/${PROJECT_NAME}-refine-rules\`.

Observations are written automatically by the Stop hook — the agent emits a \`[CODI-OBSERVATION: ...]\` marker in its response and the hook structures it into JSON. You do not write feedback files manually.

## What to Do

1. Read all JSON files in \`${PROJECT_DIR}/feedback/\`
2. Group observations by \`skillName\`
3. Within each group, sort by severity (high → medium → low), then by timestamp (newest first)
4. Show the top 3 most actionable observations across all groups
5. For each, show: artifact name, category, observation text, severity, and date

## Output Format

\`\`\`
## Feedback Summary — N observations across M artifacts

### codi-commit (2 observations)
1. [HIGH] trigger-miss — skill did not activate when user typed /codi-commit directly (2026-04-10)
2. [LOW] missing-step — no step to verify staged files are not empty before committing (2026-04-08)

### codi-testing (1 observation)
3. [MEDIUM] outdated-rule — rule says use Jest but project migrated to Vitest (2026-04-09)

---
Run /${PROJECT_NAME}-refine-rules to review these one by one and propose changes.
\`\`\`

## If No Feedback Exists

Report: "No observations in \`${PROJECT_DIR}/feedback/\` yet. The system collects them automatically as you work."

## Related Skills

- **${PROJECT_NAME}-refine-rules** — Review observations one by one and propose rule/skill changes
- **${PROJECT_NAME}-rule-feedback** — Background observation skill (describes the marker format)
`;
