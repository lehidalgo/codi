import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Launch or attach to the ${PROJECT_NAME} brain UI — a read-only browser view
  on the local SQLite brain (${PROJECT_NAME} v3 zero mode). Use when the user
  asks to "see captures", "open the brain UI", "show what was recorded",
  "browse session history", or invokes \`/${PROJECT_NAME}:{{name}}\`. Spawns the
  Hono server at http://127.0.0.1:4477 if it's not already running, attaches
  to the existing instance otherwise (one server per machine; multiple
  agent sessions share it). Pages: sessions list, session detail, live
  polling, workflows, findings.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
---

# {{name}}

## Trigger

User asks to:

- "Open the brain UI" / "launch the dashboard" / "ver capturas"
- "Show what's been captured this session"
- "Browse session history" / "ver workflows activos"
- Types \`/${PROJECT_NAME}:{{name}}\`

## Spawn-or-attach

The agent runs:

\\\`\\\`\\\`bash
${PROJECT_NAME} brain ui [--port 4477]
\\\`\\\`\\\`

Behind the scenes (\\\`scripts/runtime/brain-ui-server.ts\\\` + \\\`src/runtime/brain-ui/lifecycle.ts\\\`):

1. Read \\\`~/.${PROJECT_NAME}/brain-ui.pid\\\` if it exists.
2. If the recorded PID is alive AND \\\`GET http://127.0.0.1:<port>/healthz\\\`
   returns ok → **attach**. Print the URL; do not respawn.
3. Otherwise → **spawn** a fresh detached server. Write the new pidfile
   on success.

The server holds a single read-only WAL connection; multiple agent
sessions on the same machine share one server, one SQLite reader.

## What the user sees

- \\\`/\\\`              — recent sessions table (last 20)
- \\\`/session/:id\\\`   — captures for a session, with HTML escaping
- \\\`/live\\\`          — polling view (HTMX every 2s) of the most recent
                       50 markers across all sessions
- \\\`/api/v1/live/stream\\\` — SSE stream of new captures (Sprint 4.b)
- \\\`/workflows\\\`     — workflow_runs table
- \\\`/findings\\\`      — pending consolidation proposals (Sprint 5)

## Boundaries

- The UI is **read-only**. Edits to artifacts go through the existing
  \\\`${PROJECT_NAME} \\\` CLI commands (\\\`add\\\`, \\\`generate\\\`, \\\`update\\\`).
- The skill does NOT replace the agent's primary surface — the agent
  still runs in the terminal. The UI is for human inspection.
- Closing the browser tab does not stop the server. Stop it explicitly
  with \\\`kill $(cat ~/.${PROJECT_NAME}/brain-ui.pid | jq -r .pid)\\\` or
  \`${PROJECT_NAME} brain ui --stop\` (Sprint 4.c).

## When NOT to use

- The user wants to query captures programmatically — point them at
  the HTTP API directly (\\\`curl http://127.0.0.1:4477/api/v1/captures/search?q=…\\\`).
- The user is in lite/standard/full mode — the brain lives in Postgres
  and the UI is served by codi-app, not this skill.
`;
