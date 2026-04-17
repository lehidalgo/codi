# html-live-inspect

A local HTTP server skill that turns any HTML file or static website into a
collaboratory between a human in a browser and a coding agent in a terminal.

The agent starts the server pointed at a directory, tells the user the URL,
and the user opens it. Every page served gets a tiny inspector script
injected into it. When the user hovers or clicks a DOM element, the inspector
reports the full context — selector, attributes, text, computed styles,
bounding rect, parent chain — back to the server. The agent then polls a
handful of REST endpoints to know exactly what the user is looking at, what
they just interacted with, and (when enabled) can even run JavaScript inside
the page to drive the UI.

This skill is the HTML-side counterpart to `content-factory`: same Node
CJS + stdlib `http` stack, same workspace conventions under `.codi_output/`,
same start/stop shell script pattern.

---

## Table of contents

1. [What this skill does](#what-this-skill-does)
2. [Directory structure](#directory-structure)
3. [Workflow](#workflow)
4. [Configuration](#configuration)
5. [Server API reference](#server-api-reference)
6. [Injected inspector client](#injected-inspector-client)
7. [Design decisions](#design-decisions)
8. [Adapting for similar use cases](#adapting-for-similar-use-cases)
9. [Testing](#testing)

---

## What this skill does

1. Serves a user-supplied directory over HTTP on `127.0.0.1:<random-port>`.
2. Injects `<script src="/__inspect/inspector.js"></script>` before `</body>`
   on every HTML response.
3. The injected inspector draws a hover outline, lets the user click to lock
   a selection, and streams selection events and user interactions to the
   server via `POST /__inspect/ingest`.
4. The server exposes a REST API the coding agent polls to read:
   - What element is currently selected (full context)
   - A ring buffer of recent user interactions (click, input, navigation,
     scroll)
   - Current page URL, title, viewport
5. Optional (on by default, disable with `--no-eval`): the agent can push
   JavaScript to the server, which the in-page inspector long-polls, runs in
   the page context, and returns the result to the agent.

---

## Directory structure

```
html-live-inspect/
├── README.md                           # this file
├── index.ts                            # exports template + staticDir
├── template.ts                         # SKILL.md body (wrapped in TS literal)
├── evals/
│   └── evals.json                      # trigger + behavior evals
├── scripts/
│   ├── package.json                    # zero-dep Node package manifest
│   ├── start-server.sh                 # launcher — prints JSON {url,pid,apiBase}
│   ├── stop-server.sh                  # graceful shutdown via pid file
│   ├── server.cjs                      # HTTP entrypoint + static + injection
│   ├── lib/
│   │   ├── http-utils.cjs              # sendJson, sendText, readBody, status helpers
│   │   ├── workspace.cjs               # pid/log/state files under .codi_output/
│   │   ├── selection-store.cjs         # latest selection + history
│   │   ├── event-log.cjs               # ring buffer (seq-based, default 500)
│   │   ├── eval-bridge.cjs             # long-poll queue for agent→browser eval
│   │   └── injector.cjs                # <script> tag injection into HTML
│   ├── routes/
│   │   ├── health-routes.cjs           # GET /api/health, GET /api/page
│   │   ├── selection-routes.cjs        # GET /api/selection[, /history]
│   │   ├── events-routes.cjs           # GET /api/events?since=N, DELETE /api/events
│   │   ├── dom-routes.cjs              # GET /api/dom?selector=...
│   │   ├── eval-routes.cjs             # POST /api/eval (+ internal pull/push)
│   │   └── ingest-routes.cjs           # POST /__inspect/ingest (client → server)
│   └── client/
│       └── inspector.js                # injected browser-side overlay + capture
└── tests/
    └── integration/
        └── server.test.js              # boot server, hit API, assert shapes
```

---

## Workflow

1. **Agent invokes** `scripts/start-server.sh --site-dir <path>`. The
   launcher picks a random port, writes pid/log files under
   `<project>/.codi_output/html-live-inspect/`, and prints a JSON line
   `{"url":"http://localhost:PORT","apiBase":"http://localhost:PORT/api","pid":1234}`.
2. **User opens the URL** in a browser. The first HTML response has the
   inspector script injected. The browser loads `/__inspect/inspector.js`
   from the server.
3. **User hovers and clicks** elements. The inspector draws an outline,
   captures a full context snapshot on click, and POSTs it to
   `/__inspect/ingest`.
4. **Agent polls** `GET /api/selection` to know what the user is looking at,
   and `GET /api/events?since=N` to catch up on recent interactions.
5. **Agent drives the UI** (if eval is enabled) by calling `POST /api/eval`
   with a JavaScript body. The server queues it; the inspector's long-poll
   loop picks it up, runs it inside the page, and posts the result back.
6. **Agent shuts down** the server with `scripts/stop-server.sh`. The
   workspace directory stays if a `--project-dir` was given, otherwise it
   is wiped from `/tmp/`.

---

## Configuration

Environment variables honored by `server.cjs`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `HLI_PORT` | random high port | bind port |
| `HLI_HOST` | `127.0.0.1` | bind address |
| `HLI_SITE_DIR` | required | directory served as static root |
| `HLI_WORKSPACE` | `/tmp/html-live-inspect-workspace` | pid/log/state root |
| `HLI_ALLOW_EVAL` | `1` | `0` disables `/api/eval` and in-page eval |
| `HLI_EVENT_BUFFER` | `500` | ring buffer capacity for events |
| `HLI_IDLE_TIMEOUT_MS` | `1800000` | auto-shutdown when idle (30 min) |
| `HLI_OWNER_PID` | none | parent PID to watch for exit |

All of these are settable via flags on `start-server.sh`:
`--site-dir`, `--host`, `--port`, `--workspace`, `--no-eval`,
`--idle-timeout`, `--foreground`/`--background`.

---

## Server API reference

Base URL: `http://127.0.0.1:<port>`. All responses are JSON unless noted.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | `{status, uptimeMs, siteDir, allowEval}` |
| GET | `/api/page` | `{url, title, viewport, userAgent, lastUpdateMs}` |
| GET | `/api/selection` | Full context of the currently locked element — `null` if none |
| GET | `/api/selection/history?limit=N` | Previous selections (max 50) |
| GET | `/api/events?since=<seq>&limit=N` | `{events:[...], nextSeq, dropped}` |
| DELETE | `/api/events` | Clear the event ring buffer |
| GET | `/api/dom?selector=<css>` | Ask the page to resolve the selector and return context |
| POST | `/api/eval` | Body `{js, timeoutMs?}` → `{ok, result?, error?}` (403 if eval disabled) |
| GET | `/__inspect/inspector.js` | The injected client script (served raw JS) |
| GET | `/__inspect/eval-pull` | Internal long-poll for the inspector — not for agent use |
| POST | `/__inspect/eval-push` | Internal result callback from the inspector |
| POST | `/__inspect/ingest` | Internal sink for selection/event updates from the inspector |

Selection payload shape:

```json
{
  "seq": 42,
  "timestamp": 1713110400000,
  "selector": "main > section:nth-of-type(2) > button.primary",
  "tag": "button",
  "id": "submit",
  "classes": ["btn", "primary"],
  "attributes": {"type": "submit", "aria-label": "Send"},
  "text": "Send message",
  "outerHTMLSnippet": "<button id=\"submit\" ...>...</button>",
  "boundingRect": {"x": 120, "y": 480, "width": 140, "height": 44},
  "computedStyles": {"display": "inline-block", "color": "rgb(255,255,255)", ...},
  "parentChain": [
    {"tag": "section", "id": "", "classes": ["hero"], "selector": "main > section:nth-of-type(2)"},
    ...
  ],
  "childrenCount": 1,
  "pageUrl": "http://localhost:1234/index.html",
  "pageTitle": "Demo"
}
```

---

## Injected inspector client

`scripts/client/inspector.js` is the brain of the browser side. It:

- Draws a dashed outline on `mouseover` via a single absolutely-positioned
  overlay `<div>` — does not touch the page's own styles.
- Locks the selection on `click` (or `Alt+click` to unlock).
- Builds a stable CSS selector path using `:nth-of-type` indices.
- Snapshots a curated set of computed styles (box model, typography, color,
  flex/grid) — not the full `getComputedStyle` object, which is huge.
- Captures interactions (`click`, `input`, `submit`, `scroll`, navigation)
  and POSTs them to `/__inspect/ingest` with a monotonic sequence number.
- Long-polls `/__inspect/eval-pull`; when a task arrives, runs it in a
  controlled `Function()` scope, captures the result (or error), and POSTs
  back to `/__inspect/eval-push`.
- Exposes `window.__HLI__` with helpers for debugging but nothing the page
  can exploit to exfiltrate data — the inspector is isolated per origin and
  only communicates with its own server.

---

## Design decisions

- **Zero npm deps** — Node stdlib `http`/`fs`/`path` only. Matches
  `content-factory` and eliminates install friction.
- **Single-process server, single shared state** — the server is expected
  to run one inspected site at a time, so in-memory state is fine. Pid + log
  files let a second invocation detect and replace a stale instance.
- **Long-poll over WebSocket for eval** — one code path, no upgrade dance,
  works behind anything. Long-poll timeout of 25s matches browser fetch
  defaults.
- **Injection via regex on response body** — simple and resilient. For
  responses that are missing `</body>`, the injector appends to the end.
- **`script-src` is NOT tightened** — if a user's HTML already has a strict
  CSP, the injected inspector may be blocked. Documented as a known
  limitation; the user can add `'self'` to their `script-src` or set the
  `--csp-relax` flag to rewrite their `Content-Security-Policy` header (off
  by default).
- **Eval is opt-out, not opt-in** — the user explicitly opted for this
  during skill design. Disable with `--no-eval` for demos to untrusted
  stakeholders.
- **No auth on localhost** — bound to `127.0.0.1` by default. Exposing to a
  LAN requires `--host 0.0.0.0` AND `--allow-remote`, and prints a loud
  warning.

---

## Adapting for similar use cases

To build a variant (e.g. a PDF inspector, a canvas inspector):

1. Duplicate the directory under `src/templates/skills/<new-name>/`.
2. Replace `scripts/client/inspector.js` with the target-specific capture
   logic.
3. Adjust `scripts/lib/injector.cjs` for the new content type — the regex
   that finds an injection point will differ.
4. Re-export and register in `src/templates/skills/index.ts` and
   `src/core/scaffolder/skill-template-loader.ts`.

The server core (`server.cjs`, `routes/`, `lib/http-utils.cjs`,
`lib/workspace.cjs`, `lib/event-log.cjs`, `lib/selection-store.cjs`,
`lib/eval-bridge.cjs`) is reusable as-is.

---

## Testing

- **Evals** — run the 6 cases in `evals/evals.json` after any change to the
  description. Two negatives are required to keep false triggers down.
- **Integration test** — `tests/integration/server.test.js` boots the
  server against a fixture directory, hits every API endpoint, asserts
  response shapes, and checks that HTML responses carry the injected
  script tag. Run with `npx vitest run src/templates/skills/html-live-inspect/tests/`.
- **Manual smoke test** — `bash scripts/start-server.sh --site-dir ./fixtures`
  then open the printed URL, click elements, and `curl $apiBase/selection`.
