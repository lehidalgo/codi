# Codi Brain — Phase 1 Remaining Phases + Phase 2 Preview

- **Date**: 2026-04-23 17:00
- **Document**: 20260423_170000_[ROADMAP]_codi-brain-phase-1-next-phases.md
- **Category**: ROADMAP

## Where we are (2026-04-23)

Phase 1 is ~65% done. Weeks 0, 1, and 2A are shipped to
`github.com/lehidalgo/codi-brain` (private, `main` at `ab3ce83`).
The brain stack runs end-to-end on localhost via
`docker compose up` + `bash scripts/week2a_smoke.sh`. The vault on
disk is a real Obsidian vault. **What is missing is the piece that
actually makes the brain useful during development: a client.**
Week 2A built the server; nothing yet calls it from a Claude Code /
Cursor / Codex session.

### Phase 1 status

| Week | Scope | Status |
|------|-------|--------|
| 0 | Absorb code-graph-rag into codi-brain | ✅ shipped |
| 1 | Foundation + code graph API (Dockerfile, auth, rate-limit, ingest, search) | ✅ shipped |
| 2A | Notes API + Vault integration (brain-side) | ✅ shipped |
| 2B | Client-side adoption (CLI + agent integration) | 🔜 next |
| 3 | Production deployment + hardening (VPS, TLS, retention, backups) | pending |

Phase 2 (multi-user + per-user keys + per-project isolation) is out
of scope until Phase 1 ships to production.

## Week 2B — Client-side adoption

### Problem

Today the brain is a headless HTTP service. Every decision, every
"hot state", every cross-session context lookup requires a manual
curl. That is exactly backwards: the whole point is that agents use
the brain automatically as part of their session lifecycle. Week 2B
fixes that.

### Goal

By end of Week 2B: opening a Claude Code / Cursor / Codex session in
a project that has `codi` installed automatically reads hot state on
session start, writes decisions during work, and searches prior
decisions before re-deciding something.

### Scope candidates (to refine in brainstorming)

1. **`codi-brain-client` package** — a thin Python or Node library
   that wraps the HTTP API with typed calls: `createNote()`,
   `searchNotes()`, `getHot()`, `putHot()`. Auth handled once via env
   or config. Target consumer: skills, hooks, and CLI commands.

2. **Claude Code skill: `codi-brain-recall`** — invoked
   automatically on session start (via SessionStart hook or skill
   auto-trigger). Reads `GET /hot` + searches recent decisions for
   the current project. Injects the result into the agent's context.

3. **Claude Code skill: `codi-brain-decide`** — invoked explicitly by
   the user (`/codi-brain-decide "use Gemini for generation"`) or
   automatically after a brainstorm skill approves a design. Writes
   via `POST /notes` with kind=decision. Returns a `[[wikilink]]` the
   agent can drop into the current file.

4. **Stop-hook autocapture** — at end of session, the Stop hook
   extracts decisions mentioned in the conversation (via a small
   extraction prompt) and persists them. Opt-in per project.

5. **CLI `codi brain` subcommand** — `codi brain status`,
   `codi brain search "keyword"`, `codi brain decide "text"`. For
   users who do not run through an agent.

6. **Agent portability: Cursor + Codex** — Week 2B must at minimum
   define the integration surface for Cursor (rules + MCP) and Codex
   (AGENTS.md + hooks), even if only one is wired up initially.

### What Week 2B is NOT

- NOT a rewrite of the brain API (that shipped in Week 2A and is
  stable)
- NOT a UI — Obsidian is the read-side UI, the agent is the
  write-side UI
- NOT multi-user (that is Phase 2)
- NOT production deployment (that is Week 3)

### Estimated effort

3-5 days of focused work, comparable to Week 2A. Scope splits
naturally into two: a pure client library (fast, no agent
integration) and the agent wiring (slower, needs design decisions
about hook vs skill vs rule).

### Next action

Run `codi-brainstorming` on Week 2B scope. Output: a design spec
(`docs/YYYYMMDD_HHMMSS_[PLAN]_codi-brain-phase-1-week-2b-design.md`).
Decisions to reach: client-library language (Python vs Node vs
both), automatic-capture strategy (Stop hook vs explicit skill vs
both), agent-portability order (Claude Code first then Cursor? all
three at once? one as a reference implementation and document the
contract for the other two?).

## Week 3 — Production deployment + hardening

### Goal

The brain runs on a real VPS, survives restarts, survives disk
failure (via remote git push of the vault), has TLS, and has
observable SLOs.

### Scope

1. **VPS deploy target** — the parent Phase 1 spec called out
   Coolify (self-hosted Hetzner / DigitalOcean). Pick the concrete
   target, provision, stand up docker-compose production stack.
2. **Secrets management** — `BRAIN_BEARER_TOKEN` + OpenAI key +
   vault-remote credentials go through the deploy target's secret
   store, not `.env` files. Rotation procedure documented.
3. **TLS + domain** — Caddy or Coolify's built-in Let's Encrypt.
   The brain API should only be reachable over HTTPS.
4. **Vault git remote** — stand up a private GitHub repo (or
   Gitea) as the vault's `origin`. PushRetryQueue + reconciler
   give us at-least-once sync; verify that end-to-end on the VPS.
5. **Backups** — Memgraph + Qdrant data volumes backed up off-box
   (restic to S3-compatible storage). Vault itself is
   self-backing-up via git remote.
6. **Retention policy** — implement the spec §8 retention decisions:
   hard-delete orphan Qdrant points, TTL for session-scoped notes,
   archive path for tombstoned-but-kept notes.
7. **SLO + alerting** — basic Grafana dashboard reading the
   `/metrics` endpoint. Alert on `vault_push_failures_total` rising,
   `reconcile_runs_total{outcome="failure"}` rising, `/healthz`
   returning 503 for >5 min.
8. **Production smoke + runbook** — `scripts/prod_smoke.sh` (not
   the local one) hits the deployed brain with a real OpenAI key and
   exercises the full loop. Runbook doc for incident response:
   brain-api down, Memgraph full, Qdrant corruption, vault-git
   remote unreachable.

### Estimated effort

1 week of focused work. Low risk (no new features) but lots of
config surface.

### Next action

After Week 2B lands, run `codi-brainstorming` on Week 3 scope with
focus on the VPS target decision (Coolify vs bare docker-compose vs
Kubernetes). Produce deploy runbook + hardening checklist spec.

## Phase 2 preview (out of scope but worth documenting)

Phase 2 adds multi-user + per-user keys + per-project isolation —
the pieces the Phase 1 spec §4.3 deliberately deferred:

1. `User`, `UserKey`, `Project` node types materialize in Memgraph.
2. Bearer token becomes per-user JWT or signed Paseto; `ADMIN_USER_ID`
   env goes away.
3. Multi-tenant: one brain instance serves multiple projects, with
   row-level isolation enforced at the route + Cypher layers.
4. Web UI for browsing vaults + cross-project search + admin
   operations (invite user, rotate key, export vault).
5. Phase 2 migration is **additive** — no Phase 1 data rewriting.
   Seed one row each from the Phase 1 env vars, then accept new rows.

Phase 2 design spec should wait until Phase 1 has ~1 month of
real-use telemetry, because observed usage patterns will shape the
multi-tenancy model more than upfront design.

## Decision points for the user

Before brainstorming Week 2B, three calls to make:

1. **Client library language.** Python matches the brain; Node
   matches the Codi CLI. Both? One first? Which order?
2. **Automatic vs explicit capture.** Should the brain observe
   agent conversations and auto-extract decisions (power + privacy
   concern), or should capture always be explicit (safer + requires
   user discipline)?
3. **Agent portability order.** Ship Claude Code integration first
   and document the contract for Cursor + Codex, or build a
   minimal integration for all three at once?

These are the questions `codi-brainstorming` will ask in Week 2B's
intake; thinking about them now shortens that session.

## References

- Parent Phase 1 plan:
  `docs/20260422_230000_[PLAN]_codi-brain-phase-1.md`
- Phase 1 impl plan (week-by-week):
  `docs/20260423_010000_[PLAN]_codi-brain-phase-1-impl.md`
- Week 0 progress report:
  `docs/20260423_020000_[REPORT]_codi-brain-phase-1-week-0-progress.md`
- Week 2A design spec:
  `docs/20260423_115429_[PLAN]_codi-brain-phase-1-week-2a-design.md`
- Week 2A impl plan + progress log:
  `docs/20260423_120127_[PLAN]_codi-brain-phase-1-week-2a-impl.md`
- Week 2A handoff report:
  `docs/20260423_164719_[REPORT]_codi-brain-phase-1-week-2a-progress.md`
- Brain repo: `github.com/lehidalgo/codi-brain` (private),
  `main` at `ab3ce83`
