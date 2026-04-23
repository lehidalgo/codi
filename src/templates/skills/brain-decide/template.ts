import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Record a durable decision into the Codi Brain. Use when the user makes a
  technology choice, architecture decision, or root-cause conclusion worth
  remembering across sessions. Activates on /codi-brain-decide and phrases
  "remember this", "save this decision", "record this choice", "let's go with".
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Record Brain Decision

## When to Activate

- User invokes \\\`/codi-brain-decide "<text>"\\\`
- User says "remember this" / "save this decision" / "log this choice"
- After codi-brainstorming approves a design — emit one decision per major choice

## Workflow

1. Confirm the decision text with the user if not explicit.
2. Emit an inline marker (this is what the Stop hook captures):
   \\\`\\\`\\\`
   <CODI-DECISION@v1>
   {"title": "<concise, <200 chars>", "reason": "<1 sentence>", "tags": ["<tag1>", "<tag2>"]}
   </CODI-DECISION@v1>
   \\\`\\\`\\\`
3. Also invoke the CLI (brain dedups — duplicate is safe):
   \\\`\\\`\\\`bash
   codi brain decide "<title>" --body "<reason>" --tags <comma-separated>
   \\\`\\\`\\\`
4. Confirm to user: "Recorded. Brain ID: <n-xxxx>". If CLI returns \\\`"id": "queued"\\\`, the decision is in the local outbox and will sync on next SessionStart.

## Rules

- Title <200 chars.
- Tags: 1-5 lowercase kebab-case.
- Only durable decisions — not exploratory ideas or rejected options.
- If \\\`codi brain status\\\` fails, still emit the marker (it will be captured at Stop).
`;
