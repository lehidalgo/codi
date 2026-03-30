import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Summarize the current session and prepare a handoff prompt for a new chat
managed_by: ${PROJECT_NAME}
---

Produce a concise session handoff so a new Claude Code session can continue immediately without context loss.

## Steps

1. **Read memory** — check \`.claude/projects/*/memory/MEMORY.md\` and any recent memory files for persistent context about this project and user preferences.

2. **Summarize completed work** — run \`git log --oneline -10\` and \`git diff HEAD~5..HEAD --stat\` to identify what changed in this session. Describe each change in one sentence.

3. **Capture current state** — run \`git status\` and note any uncommitted work, open PRs, or in-progress tasks.

4. **List open issues** — note any known bugs, failing tests, deferred tasks, or TODOs introduced this session.

5. **Output the handoff prompt** — write a ready-to-paste block the user can open a new chat with:

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
