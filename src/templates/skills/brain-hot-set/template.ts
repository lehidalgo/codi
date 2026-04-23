import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Update the Codi Brain's singleton "hot state" — the one-sentence summary of
  the current session's focus. Activates on /codi-brain-hot-set and phrases
  "update hot state", "set focus to", "switch context to", "working on X now".
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Set Brain Hot State

## When to Activate

- User invokes \\\`/codi-brain-hot-set "<text>"\\\`
- User says "update hot state" / "set focus to X" / "switch context to X"
- At the start of a focused work session — proactively set the hot state to the session's goal

## Workflow

1. Derive a concise one-sentence summary of the session focus.
2. Run:
   \\\`\\\`\\\`bash
   codi brain hot --set "<summary>"
   \\\`\\\`\\\`
3. Also emit an inline marker for audit:
   \\\`\\\`\\\`
   <CODI-HOT@v1>
   {"body": "<summary>"}
   </CODI-HOT@v1>
   \\\`\\\`\\\`
4. Confirm: "Hot state updated."

## Rules

- Hot state is a singleton — setting overwrites the previous value.
- Keep under 200 chars.
- Use present tense: "Working on X", "Investigating Y".
`;
