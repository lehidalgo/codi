import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Read the Codi Brain's current hot state. Activates on /codi-brain-hot-get and
  phrases "what's the current focus", "what were we working on",
  "what's the hot state".
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Read Brain Hot State

## When to Activate

- User invokes \\\`/codi-brain-hot-get\\\`
- User says "what's the current focus" / "what were we working on" / "what's the hot state"

## Workflow

1. Run:
   \\\`\\\`\\\`bash
   codi brain hot
   \\\`\\\`\\\`
2. If the response body is non-empty, show:
   "Current focus: <body> (updated <updated_at>)"
3. If empty, tell the user "No hot state set — use /codi-brain-hot-set to record one."

## Rules

- Read-only — do not mutate the hot state in this skill.
`;
