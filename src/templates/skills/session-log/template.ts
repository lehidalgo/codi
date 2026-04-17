import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Session log and handoff — unified markdown work journal in \\\`docs/sessions/\\\`.
  Three modes. HANDOFF: user is switching to a new chat or context is near
  limit; writes a dense ready-to-paste handoff markdown file. LOG (close-day):
  end-of-day summary appended to today's log markdown. RESUME (open-day):
  start-of-day recap reading the latest session files. Activates on phrases
  like "context is full", "switch conversation", "handoff to next session",
  "wrap up the session", "end of day summary", "what did I do yesterday",
  "pick up where we left off", "/session-handoff", "/open_day", "/close_day".
  Do NOT activate for recovery from repeated in-session agent mistakes (use
  ${PROJECT_NAME}-session-recovery), commit messages (use ${PROJECT_NAME}-commit),
  architecture decision records (use ${PROJECT_NAME}-project-documentation),
  or PR descriptions.
category: ${SKILL_CATEGORY.WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Session Log

A unified work journal. All output is markdown written to \\\`docs/sessions/\\\`.

## Mode Selection

| Mode | Trigger phrases | Reads | Writes |
|------|-----------------|-------|--------|
| **HANDOFF** | "context full", "new chat", "handoff", "continue in another conversation", /session-handoff | git log/diff/status + MEMORY.md | \\\`docs/sessions/YYYYMMDD_HHMMSS_handoff.md\\\` + stdout copy-paste block |
| **LOG** (close-day) | "wrap up", "log today's work", "end of day", /close_day | Current session | \\\`docs/sessions/YYYYMMDD_log.md\\\` (append if exists) |
| **RESUME** (open-day) | "what did I do yesterday", "catch me up", "pick up where we left off", /open_day | Latest 3-5 files in \\\`docs/sessions/\\\` | Nothing — verbal recap only |

## Skip When

- Recovering from repeated in-session mistakes — use ${PROJECT_NAME}-session-recovery
- Writing a commit message — use ${PROJECT_NAME}-commit
- Architecture decision record — use ${PROJECT_NAME}-project-documentation
- PR description or release notes — those belong in the PR body
- Exploring raw git history — use \\\`git log\\\` directly

---

## Directory Setup

**[CODING AGENT]** On first invocation in a project, ensure \\\`docs/sessions/\\\` exists:

\\\`\\\`\\\`bash
mkdir -p docs/sessions
\\\`\\\`\\\`

All session artifacts live in this directory. One markdown file per entry.

**Filename conventions:**

| Kind | Format | Example |
|------|--------|---------|
| Handoff | \\\`YYYYMMDD_HHMMSS_handoff.md\\\` | \\\`20260417_183012_handoff.md\\\` |
| Daily log | \\\`YYYYMMDD_log.md\\\` | \\\`20260417_log.md\\\` |

---

## Mode: HANDOFF

Use when the user is ending a session, switching to a new chat, or approaching the context window limit.

### Step 1 — Read Context

**[SYSTEM]** Check persistent memory and recent git state:

\\\`\\\`\\\`bash
# Memory (if present)
ls .claude/projects/*/memory/MEMORY.md 2>/dev/null

# Git state
git log --oneline -10
git diff HEAD~5..HEAD --stat
git status
\\\`\\\`\\\`

### Step 2 — Compose the Handoff Block

**[CODING AGENT]** Compose a dense, under-400-words handoff:

\\\`\\\`\\\`markdown
# Session Handoff — YYYY-MM-DD HH:MM

## What was done
- <one sentence per completed task>

## Current state
- Branch: <branch>
- Version: <version>
- Uncommitted: <yes/no — what>

## Open items
- <deferred tasks, known issues, next steps>

## Key decisions
- <architecture or design decisions with rationale>

## How to continue
<exact next step the new session should take>
\`\`\`
\\\`\\\`\\\`

### Step 3 — Write File and Emit Copy-Paste Block

**[SYSTEM]** Save the handoff to \\\`docs/sessions/YYYYMMDD_HHMMSS_handoff.md\\\` AND print the same content to the user's stdout (fenced) so it can be pasted directly into a new chat.

---

## Mode: LOG (close-day)

Use when the user is wrapping up the day's work.

### Step 1 — Summarize the Session

**[CODING AGENT]** Write a concise summary (under 300 words) of what was accomplished:
- Tasks completed
- Decisions made
- Files or PRs touched
- Blockers or deferred items for tomorrow

### Step 2 — Append to Today's Log

**[SYSTEM]** Write (or append, if today's file already exists) to \\\`docs/sessions/YYYYMMDD_log.md\\\`:

\\\`\\\`\\\`markdown
# Work Log — YYYY-MM-DD

## Session HH:MM — HH:MM

### Done
- <bullet>

### Decisions
- <bullet>

### Next
- <bullet>
\\\`\\\`\\\`

If the file already exists for today, append a new \\\`## Session\\\` block rather than overwriting.

---

## Mode: RESUME (open-day)

Use at the start of a session when the user wants to pick up where they left off.

### Step 1 — List Recent Sessions

**[SYSTEM]** Read the latest 3-5 markdown files in \\\`docs/sessions/\\\` (sorted by filename, newest first).

### Step 2 — Recap

**[CODING AGENT]** Produce a concise verbal recap covering:
- What was last in progress
- Any blockers or open items
- Where to resume (branch, file, task)

Do NOT write a new file in this mode — this is a read-only recap.

---

## Related Skills

- **${PROJECT_NAME}-session-recovery** — Agent self-diagnosis after repeated in-session mistakes
- **${PROJECT_NAME}-commit** — Conventional commit messages for git
- **${PROJECT_NAME}-branch-finish** — Merge / PR / discard a completed branch
`;
