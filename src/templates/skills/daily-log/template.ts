import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Resume daily work context or log today's session summary. Use when the user
  is starting a new session, wants a recap of previous work, or wants to
  record end-of-day progress. Also activate for phrases like "what did I do
  yesterday", "what were we working on", "pick up where we left off", "catch
  me up", "wrap up the session", "end-of-day summary", "context handoff from
  yesterday", or on /open_day and /close_day. Reads and writes
  \\\`docs/CONTROL.json\\\` — latest entry on top, max 300 chars per entry.
  Do NOT activate for writing commit messages (use ${PROJECT_NAME}-commit),
  architecture decision records (use ${PROJECT_NAME}-project-documentation),
  or PR descriptions.
category: ${SKILL_CATEGORY.WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Daily Log

## When to Activate

- User is starting a new session and wants to resume previous context
- User is ending a session and wants to log what was done
- User asks what was worked on recently
- User invokes /open_day or /close_day

## Skip When

- User wants a commit message — use ${PROJECT_NAME}-commit
- User wants an ADR or architecture doc — use ${PROJECT_NAME}-project-documentation
- User wants a PR description or release notes — those live in the PR body, not in CONTROL.json
- User wants to explore git log history — use git directly

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
