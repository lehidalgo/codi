import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Soft-delete all brain notes that were auto-extracted from a specific session
  (tagged auto-extract-<session-id>). Activates on /codi-brain-undo-session and
  phrases "undo last session's auto-captures", "that extraction was noisy",
  "roll back session X".
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Undo Brain Session

## When to Activate

- User invokes \\\`/codi-brain-undo-session <id>\\\`
- User says "undo last session's auto-captures" / "that extraction was noisy" / "roll back session X"

## Workflow

1. Ask for the session ID if not supplied (recent session IDs are in \\\`.codi/brain-logs/redaction-*.jsonl\\\` filenames).
2. Run:
   \\\`\\\`\\\`bash
   codi brain undo-session <id>
   \\\`\\\`\\\`
3. Report: "Tombstoned N notes from session <id>."

## Rules

- This is a destructive action — confirm with the user before running.
- Only notes tagged \\\`auto-extract-<id>\\\` are affected; manually-written decisions are never touched.
- Tombstone is soft by default (brain's \\\`deleted_at\\\` timestamp); the note remains on disk for manual recovery.
`;
