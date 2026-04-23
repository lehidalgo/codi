import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to open a local HTML file or static website in "live inspect" mode so the coding agent can see which elements the user is clicking on in real time. Also activate when the user says "open this html and watch what I click", "start html live inspect", "inspect this page with me", "collaboratory mode for this site", "let me select elements in the browser and tell you what they are", or wants the agent to drive a local web page. Runs a local HTTP server that injects a DOM inspector into every served page, exposes REST endpoints for the agent to read the current selection, recent user interactions, and (optionally) to run JavaScript inside the page.
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — HTML Live Inspect

## Overview

HTML Live Inspect turns any local HTML file or static website into a shared
workspace between the human (in a browser) and the coding agent (in a
terminal). You start a tiny Node HTTP server pointed at a directory, give the
user the URL, and every page the server returns is silently augmented with a
DOM inspector. When the user hovers or clicks an element, a full context
snapshot is pushed to the server. The agent reads a handful of REST
endpoints to know exactly what the user is looking at and what they just
did. When enabled, the agent can also run JavaScript inside the live page to
drive the UI, highlight things, fill forms, or trigger actions — a true
collaboratory.

This skill is the HTML twin of \`${PROJECT_NAME}-content-factory\`: same Node CJS +
stdlib \`http\` stack, same start/stop shell scripts, same workspace layout
under \`.codi_output/\`.

---

## When to Activate

- The user asks you to open a local HTML file or folder so you can see what
  they click.
- The user says "start html live inspect", "open this html in collaboratory
  mode", "let me show you in the browser", "watch what I select", "inspect
  this page with me".
- The user wants you to drive a local web page (click, fill, read state)
  while they watch in a browser.
- The user is designing HTML and wants you to know which element they mean
  without pasting selectors.

## Skip When

- The user wants to test a live remote URL — use \`${PROJECT_NAME}-webapp-testing\`
  (Playwright-backed).
- The user wants to generate social cards or slides — use
  \`${PROJECT_NAME}-content-factory\`.
- The user wants to build frontend components from scratch — use
  \`${PROJECT_NAME}-frontend-design\`.

---

## Skill assets

| Asset | Purpose |
|-------|---------|
| \`\${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]]\` | Start the server — prints JSON \`{url, apiBase, pid}\` |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]]\` | Stop the server gracefully via pid file |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/server.cjs]]\` | Node HTTP entrypoint (zero deps) |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/client/inspector.js]]\` | Injected browser-side overlay and capture script |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/routes/selection-routes.cjs]]\` | \`/api/selection\` handlers |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/routes/events-routes.cjs]]\` | \`/api/events\` handlers |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/routes/dom-routes.cjs]]\` | \`/api/dom\` handler |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/routes/eval-routes.cjs]]\` | \`/api/eval\` handler (agent → page JS) |
| \`\${CLAUDE_SKILL_DIR}[[/scripts/routes/health-routes.cjs]]\` | \`/api/health\` and \`/api/page\` handlers |

---

## Agent workflow

### Step 1 — Start the server

Run:

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]] --site-dir <absolute-path-to-html-or-folder>
\`\`\`

Flags:

| Flag | Default | Purpose |
|------|---------|---------|
| \`--site-dir <path>\` | required | File or directory to serve |
| \`--host <host>\` | \`127.0.0.1\` | Bind address (localhost only by default) |
| \`--port <port>\` | random high port | Fixed port |
| \`--workspace <dir>\` | \`/tmp/html-live-inspect-workspace\` | pid/log/state root |
| \`--no-eval\` | eval enabled | Disable the \`/api/eval\` endpoint and in-page executor |
| \`--idle-timeout <ms>\` | \`1800000\` | Auto-shutdown after idle (30 min) |
| \`--foreground\` | background | Run attached (for debugging) |

The launcher prints one JSON line on stdout:

\`\`\`json
{"url":"http://localhost:49234","apiBase":"http://localhost:49234/api","pid":12345,"siteDir":"/abs/path","allowEval":true}
\`\`\`

Capture \`url\` and \`apiBase\`. Tell the user the URL and ask them to open
it in their browser.

### Step 2 — Wait for the user to select something

The inspector supports three selection modes:

- **Plain click** — replaces the single current selection. Read with
  \`GET /api/selection\`.
- **Cmd/Ctrl + click** — toggles membership in a multi-selection set.
  Each selected element gets an orange overlay, and a badge in the corner
  shows the count. Read the set with \`GET /api/selections\`.
- **Alt + click** — clears both the single selection and the entire
  multi-selection set.

After the user tells you they have selected, choose the right endpoint:

\`\`\`bash
# Single selection (most common)
curl -s "$apiBase/selection"

# Multi-selection set — returns {count, selections: [...]}
curl -s "$apiBase/selections"
\`\`\`

When \`count > 0\`, prefer \`/api/selections\` and apply operations to all
of them at once (see Step 5).

### Step 3 — Read context and act

The selection payload contains everything you need to reason about the
element the user picked:

- \`selector\` — stable CSS selector (use for further DOM queries via
  \`/api/dom?selector=...\` or \`/api/eval\`)
- \`tag\`, \`id\`, \`classes\`, \`attributes\` — semantic identity
- \`text\`, \`outerHTMLSnippet\` — content (truncated to 500 chars / 2 KB)
- \`computedStyles\` — curated subset (box model, typography, color,
  flex/grid) — not the full raw style object
- \`boundingRect\` — x, y, width, height in viewport coordinates
- \`parentChain\` — up to 5 ancestors (tag, id, classes, selector)
- \`childrenCount\` — direct children count
- \`pageUrl\`, \`pageTitle\` — context

### Step 4 — Catch up on recent interactions

\`\`\`bash
curl -s "$apiBase/events?since=0"
\`\`\`

Returns a ring buffer of recent events (clicks, inputs, form submits,
navigations, scroll positions). Each event has a monotonic \`seq\` — poll
with \`?since=<last-seq>\` to get only new events. The response also has
\`dropped\` (events lost to buffer overflow) and \`nextSeq\`.

### Step 5 — Drive the page (optional, if \`allowEval\` is true)

\`\`\`bash
curl -s -X POST "$apiBase/eval" \\
  -H "Content-Type: application/json" \\
  -d '{"js":"document.querySelector(\\"#submit\\").click(); return true;"}'
\`\`\`

The body's \`js\` string is wrapped in a \`Function()\` and executed in the
page context. The return value (or thrown error) comes back as
\`{ok, result, error}\`. Use this to click buttons, fill inputs, toggle
state, read computed values the static snapshot does not capture, or
highlight elements for the user.

Powerful things to do with eval:
- Highlight the element you are talking about:
  \`\`\`js
  const el = document.querySelector(sel);
  el.style.outline = '3px solid magenta';
  setTimeout(() => el.style.outline = '', 2000);
  \`\`\`
- Scroll an element into view before the user looks:
  \`\`\`js
  document.querySelector(sel).scrollIntoView({behavior:'smooth', block:'center'});
  \`\`\`
- Read live values not in the static snapshot:
  \`\`\`js
  return {value: document.querySelector('#name').value, scroll: window.scrollY};
  \`\`\`
- Drive a form end-to-end on behalf of the user for a demo.

Eval times out after 10 seconds by default. Override with
\`{"js":"...", "timeoutMs": 30000}\`.

**Applying an operation to the multi-selection set:**

\`\`\`bash
selectors=$(curl -s "$apiBase/selections" | jq -c '.selections | map(.selector)')
curl -s -X POST "$apiBase/eval" -H "Content-Type: application/json" \\
  -d "{\\"js\\":\\"const sels=\${selectors}; sels.forEach(s=>document.querySelectorAll(s).forEach(el=>el.style.color='red')); return sels.length;\\"}"
\`\`\`

**Similarity / query selection (Option C pattern):**

When the user clicks one element and says "apply to all like this", do not
ask them to click every one. Instead:

1. Read \`GET /api/selection\` to get the clicked element's tag + classes +
   parent context.
2. Propose 2-3 \`querySelectorAll\` variants that might match what they
   want, e.g.:
   - all siblings with the same tag: \`.hero > p\`
   - all elements with the same class: \`.btn.primary\`
   - all descendants matching a pattern: \`.card h3\`
3. Preview the match count for each with
   \`POST /api/eval { js: "return window.__HLI__.previewQuery('.btn.primary');" }\`.
4. Highlight the best match set briefly to confirm visually:
   \`POST /api/eval { js: "return window.__HLI__.highlight('.btn.primary', 2000);" }\`.
5. Get user confirmation in chat.
6. Apply the operation with a single eval over the full \`querySelectorAll\`.

The inspector exposes these helpers on \`window.__HLI__\`:
- \`previewQuery(selector)\` → match count (or \`-1\` on invalid selector)
- \`highlight(selectorOrList, ms)\` → briefly outlines all matches in magenta
- \`listSelections()\` → array of selectors currently in the multi set
- \`describe(selector)\` → full snapshot for a CSS selector

### Step 6 — Stop the server

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]]
\`\`\`

The server also auto-shuts down after 30 minutes of idle.

---

## Server API reference

All endpoints return JSON. Base URL is \`\${apiBase}\` (from the start
script output).

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | \`/api/health\` | — | \`{status, uptimeMs, siteDir, allowEval, version}\` |
| GET | \`/api/page\` | — | \`{url, title, viewport, userAgent, lastUpdateMs}\` |
| GET | \`/api/selection\` | — | Single current selection, or \`null\` |
| GET | \`/api/selection/history?limit=N\` | — | Previous single-click selections |
| GET | \`/api/selections\` | — | Multi-selection set: \`{count, selections:[...]}\` |
| DELETE | \`/api/selections\` | — | Clear the multi-selection set |
| GET | \`/api/events?since=<seq>&limit=N\` | — | \`{events, nextSeq, dropped}\` |
| DELETE | \`/api/events\` | — | \`{ok: true}\` |
| GET | \`/api/dom?selector=<css>\` | — | Selection-shape object for the first match, or \`null\` |
| POST | \`/api/eval\` | \`{js, timeoutMs?}\` | \`{ok, result, error}\` — 403 if disabled |

The ingest, pull, and push endpoints under \`/__inspect/*\` are internal —
they are used by the injected client, never by the agent.

---

## Conventions

- **Always serve an absolute path.** Pass \`--site-dir\` with the full path
  so the server does not depend on where it was started.
- **One inspected site at a time.** If you need a second, stop the first
  (the workspace tracks a single active server via pid file).
- **Bind to localhost only.** Do not pass \`--host 0.0.0.0\` unless the
  user explicitly asks for LAN access — and tell them it is unauthenticated.
- **Wait for user interaction.** Do not poll \`/api/selection\` in a tight
  loop. Either wait for the user to say "I clicked" or poll once every few
  seconds.
- **Cite the selector, not the description.** When referring to what the
  user selected in your replies, include the exact \`selector\` from the
  payload so the user knows you are looking at the same element.
- **Always echo the URL to the user.** The user cannot interact with a
  server they do not know how to open.

---

## Output contract

When activated, you must:

1. Start the server and emit the \`url\` to the user in plain text.
2. Confirm which directory is being served and whether eval is enabled.
3. Explain in one line that the user can hover + click to select.
4. Poll \`/api/selection\` once the user confirms they have selected, and
   summarize the element in 2-3 sentences (tag + role + text + key
   classes).
5. Stop the server with the stop script when the user is done, or when
   you are handing off to another skill.

---

## Constraints

- Do NOT start the server without an explicit \`--site-dir\` from the user.
- Do NOT bind to any interface other than \`127.0.0.1\` unless the user
  explicitly asks.
- Do NOT poll APIs in a busy loop — respect the server.
- Do NOT run \`/api/eval\` with code the user has not seen — show the JS
  first, get confirmation, then execute.
- Do NOT ask the user to click every element when a similarity query
  could match them all — propose a selector, preview the count, confirm,
  then apply (Option C pattern in Step 5).
- Do NOT leave the server running across unrelated tasks. Stop it when
  done.
- Do NOT use this skill to inspect remote production sites — use
  \`${PROJECT_NAME}-webapp-testing\` (Playwright) for that.
`;
