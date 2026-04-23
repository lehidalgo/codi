import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Review pending auto-extracted notes sitting in .codi/pending-notes/*.jsonl.
  Activates on /codi-brain-review and phrases "review pending notes",
  "what did the brain auto-capture", "approve pending decisions".
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Review Pending Brain Notes

## When to Activate

- User invokes \\\`/codi-brain-review\\\`
- User says "review pending notes" / "what did the brain auto-capture" / "approve pending"
- At SessionStart, if \\\`.codi/pending-notes/\\\` has entries (surface a reminder)

## Workflow

1. List files in \\\`.codi/pending-notes/*.jsonl\\\`. If empty, tell user "no pending notes" and stop.
2. For each JSON line, present:
   - Title, confidence score, evidence_quote
3. Ask the user to approve / edit / discard each (or approve all).
4. For approved (possibly edited) candidates, run:
   \\\`\\\`\\\`bash
   codi brain decide "<title>" --body "<body>" --tags <tags>
   \\\`\\\`\\\`
5. For discarded, move the entry to \\\`.codi/rejected-notes/<session-id>.jsonl\\\` (append-only).
6. Delete the processed pending file once all entries are handled.

## Rules

- Never auto-approve without explicit user consent — this skill is the user's gatekeeper on L3 extractions.
- If confidence < 0.7, warn the user before approval.
- Preserve evidence_quote in the approved decision's body as an audit trail.
`;
