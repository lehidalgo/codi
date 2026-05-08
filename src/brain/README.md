# src/brain/ — Codi v3 ed.0 Hono UI server

UI server target (per ADR-v3ed0-007.F8.2).

## Purpose

Hono + HTMX server that hosts the Codi v3 brain UI:

- **Live mode**: dashboard of active session with capture markers, tool calls, workflow phase. Polling SQLite WAL + SSE refresh.
- **Consolidación mode**: dev encargado dropea N SQLites de devs, scratch DB temporal, 8 patterns SQL detection, 6 proposal types, accept/edit/reject inline, .zip preset-compat output.

## Layout (target)

- **server.ts** (sprint 4) — Hono app entry + spawn-or-attach lifecycle (lock file + EADDRINUSE protection per ADR-v3ed0-007).
- **routes/** (sprint 4) — `/`, `/live`, `/findings`, `/proposals`, `/skills`, `/workflows`, `/llm-config`, `/prompts`, `/export`.
- **api/** (sprint 4) — 13 HTTP endpoints under `/api/v1/*` (health, loaded-dbs, findings, proposals, skills, llm/invoke, events/stream, etc.).
- **sse/** (sprint 4) — SSE event stream for live observation.
- **consolidation/** (sprint 5) — pipeline 5 stages (Ingest, Pattern detection, Proposal generation, Human review, Generate package).
- **templates/** (sprint 4) — Eta server-rendered HTML templates with HTMX directives.

## Status

**Skeleton stage** — empty until sprint 4.

## Related

- ADR-v3ed0-007: 4 architectural features (F8.2 brain SQLite + UI Live)
- ADR-v3ed0-005: SQLite canonical (data source for UI)
