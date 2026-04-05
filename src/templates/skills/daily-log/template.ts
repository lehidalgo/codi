import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Resume daily work context or log today's work summary. Use when starting a new session, checking what was worked on, or recording end-of-day progress. Also activate on /open_day or /close_day.
category: Workflow
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}}

## When to Activate

- User is starting a new session and wants to resume previous context
- User is ending a session and wants to log what was done
- User asks what was worked on recently

## Operations

### Resume Context (Open Day)

**[SYSTEM]** Read \`docs/CONTROL.json\`:
- Read only the latest 5 entries — do NOT read the entire file
- Iteratively read more entries only if needed for additional context

**[CODING AGENT]** Summarize:
- Current state of the project from recent entries
- What was last being worked on
- Any pending tasks or blockers from previous sessions

### Log Work Summary (Close Day)

**[CODING AGENT]** Write a concise summary of the current session's work.

**[SYSTEM]** Update \`docs/CONTROL.json\`:
- Add a new entry at the **beginning** of the file (latest entry on top)
- Be concise and summarized — maximum 300 characters per entry
- Include details about roadmap progress or decisions made
- Reference any relevant files, PRs, or decisions
`;
