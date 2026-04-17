# codi-brainstorming

Design exploration and specification workflow. Explores context, asks clarifying questions, proposes approaches with trade-offs, and produces an approved design spec before any implementation starts. Includes an optional local preview server for rendering HTML design specs.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Node.js 18+ | required | preview server (`server.cjs`) |

No npm install needed — `server.cjs` is a self-contained bundle.

## Scripts

| File | Purpose |
|------|---------|
| `scripts/server.cjs` | Local HTTP server for previewing HTML design documents |
| `scripts/start-server.sh` | Start the preview server; outputs JSON with URL and paths |
| `scripts/stop-server.sh` | Stop the preview server gracefully |
| `scripts/frame-template.html` | HTML shell for rendered design spec previews |
| `scripts/helper.js` | Live-reload client injected into preview pages |

## Preview Server

The preview server is optional — use it when the design spec is complex enough to benefit from rendered HTML preview rather than plain markdown.

```bash
# Start the server
bash scripts/start-server.sh --project-dir .

# The command outputs JSON:
# { "url": "http://localhost:PORT", "screen_dir": "...", "state_dir": "..." }

# Open the URL in your browser to review rendered design specs live.

# Stop when done
bash scripts/stop-server.sh <session_dir>
```

## Workflow Summary

The brainstorming skill enforces a hard gate: no implementation skill is invoked until the design is written and the user approves it. The workflow:

1. Explore project context (code graph, recent commits, existing patterns)
2. Ask clarifying questions — one at a time
3. Propose 2-3 approaches with trade-offs
4. Present design sections and get approval
5. Write the spec to `docs/` using the codi naming convention
6. Invoke the appropriate next skill (plan-writer, tdd, etc.)
