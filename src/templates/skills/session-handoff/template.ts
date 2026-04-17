import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Summarize the current session and prepare a handoff prompt for a new
  chat. Use when the context window is filling up, the user is switching
  to a new conversation, handing off work to another session, or cloning
  session state. Also activate for phrases like "context is full",
  "create a new chat", "new conversation", "handoff to next session",
  "session summary for handoff", "context window limit",
  "continue in another conversation", and on /session-handoff. Produces
  a dense, ready-to-paste handoff block (<400 words). Do NOT activate
  for end-of-day progress logs (use ${PROJECT_NAME}-daily-log), resuming
  from yesterday (use ${PROJECT_NAME}-daily-log /open_day), or recovery
  from in-session mistakes (use ${PROJECT_NAME}-session-recovery).
category: ${SKILL_CATEGORY.WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Session Handoff

## When to Activate

- User is ending a session and wants to continue in a new chat
- User asks for a session summary to hand off to another agent
- Context window is approaching its limit
- User invokes /session-handoff

## Skip When

- User wants an end-of-day progress log — use ${PROJECT_NAME}-daily-log /close_day
- User wants to resume yesterday's work — use ${PROJECT_NAME}-daily-log /open_day
- User wants to recover from repeated in-session mistakes — use ${PROJECT_NAME}-session-recovery
- User wants a PR description or release notes — use ${PROJECT_NAME}-commit / ${PROJECT_NAME}-branch-finish

## Workflow

### Step 1: Read Memory

**[SYSTEM]** Check \`.claude/projects/*/memory/MEMORY.md\` and any recent memory files for persistent context about this project and user preferences.

### Step 2: Summarize Completed Work

**[SYSTEM]** Run \`git log --oneline -10\` and \`git diff HEAD~5..HEAD --stat\` to identify what changed in this session. Describe each change in one sentence.

### Step 3: Capture Current State

**[SYSTEM]** Run \`git status\` and note any uncommitted work, open PRs, or in-progress tasks.

### Step 4: List Open Issues

**[CODING AGENT]** Note any known bugs, failing tests, deferred tasks, or TODOs introduced this session.

### Step 5: Output the Handoff Prompt

**[CODING AGENT]** Write a ready-to-paste block the user can open a new chat with:

\`\`\`
## Session Handoff — {{project}} — {{date}}

### What was done
- <one sentence per completed task>

### Current state
- Branch: <branch>
- Version: <version>
- Uncommitted: <yes/no — what>

### Open items
- <deferred tasks, known issues, next steps>

### Key decisions made
- <architecture or design decisions with rationale>

### How to continue
<exact next step the new session should take>
\`\`\`

Keep the handoff under 400 words — dense and actionable, not exhaustive.
`;
