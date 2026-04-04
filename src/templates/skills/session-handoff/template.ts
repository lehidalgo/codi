import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Summarize the current session and prepare a handoff prompt for a new chat. Use when the context window is filling up, switching to a new conversation, or handing off work. Also activate on /session-handoff.
category: Workflow
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 1
---

# {{name}}

## When to Activate

- User is ending a session and wants to continue in a new chat
- User asks for a session summary to hand off to another agent
- Context window is approaching its limit

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
