import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Search the Codi Brain for prior decisions related to the current work.
  Activates on /codi-brain-recall and phrases "what did we decide about",
  "did we already choose", "have we discussed X before", "search prior decisions".
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Recall Brain Decisions

## When to Activate

- User invokes \\\`/codi-brain-recall "<query>"\\\`
- User says "what did we decide about X" / "did we already choose" / "have we discussed X before"
- Before proposing a technology choice, architecture, or library — check if a prior decision exists

## Workflow

1. Derive a 1-5 word query from the user's question.
2. Run:
   \\\`\\\`\\\`bash
   codi brain search "<query>" --limit 5
   \\\`\\\`\\\`
3. For each hit, format as:
   \\\`- [<created_at>] **<title>** — <body excerpt, 1 line>\\\`
4. If no hits: tell the user "No prior decisions found for: <query>".

## Rules

- Show the user the formatted results inline — do not just dump raw JSON.
- If the user is about to re-decide something already decided, surface the prior decision and ask whether to override.
- Do not invoke multiple searches unless the first returned zero results — one query per activation.
`;
