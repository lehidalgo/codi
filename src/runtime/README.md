# src/runtime/ — Codi runtime layer

Hosts the agent-facing runtime: brain (SQLite), capture hooks, workflow
engine, and the brain-ui HTTP server.

## Layout

- **brain/** — SQLite brain DB (better-sqlite3 + Drizzle schema mirror).
  Schema in `schema.ts`, migrations in `migrate.ts`, opener in `db.ts`.
- **brain-ui/** — Hono server that exposes a read-only window into the
  brain. Routes in `routes-api.ts`, server-rendered pages in `pages/`,
  SSE stream in `sse.ts`, lifecycle (pidfile + spawn-or-attach) in
  `lifecycle.ts`.
- **capture/** — Stop / PostToolUse / SessionStart hooks. Marker parser
  in `markers.ts`, persistence in `persist.ts`, session bootstrap in
  `session.ts`, agent memory ingest in `agent-memory.ts`.
- **workflow/** — phase runner, gate registry, transitions, slim status.
  Built-in workflow definitions seeded from
  `src/templates/workflows/*.yaml` via `brain/seed-workflows.ts`.
- **tokens/** — context-window pricing + token accounting.
- **brain-event-log.ts** — wrapper around the brain DB that exposes the
  workflow event log + active-workflow pointer to callers in `src/cli/`.

## Status

Production runtime. ISSUE-099 dropped the legacy "Skeleton stage" note —
sprints 1-7 closed long ago and the layout above is the live reality.

## Related

- ADR-v3ed0-002: Codi merge + adapt
- ADR-v3ed0-005: SQLite canonical + ExternalSyncer (sync runtime deleted
  in ISSUE-005; ExternalSyncer interface survives inside the
  `dev-sheets-sync` skill template)
- ADR-v3ed0-008: DDD internal layout (this directory is distinct from
  `src/core/`, which holds pure functions; `src/runtime/` carries the
  side-effect-heavy plumbing)
