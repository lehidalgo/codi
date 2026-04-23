# Codi Brain — Product Coverage Audit

- **Date**: 2026-04-22 20:00
- **Document**: 20260422_200000_[AUDIT]_codi-brain-coverage-audit.md
- **Category**: AUDIT
- **Status**: Audit — opinionated, awaiting decisions on §10

## Executive summary

The current plan (`20260422_183000_[ARCHITECTURE]_codi-brain-pieces-and-attribution.md`) covers roughly **85%** of the essential functionality found across the reference projects and leaves out the right things. Three real gaps need filling in v1 — per-user attribution, a lightweight operations layer, and a typed read API — and three pieces of complexity can be cut without losing capability. Two scope items you added (Bolt-like workflow layer, GraphQL) need concrete answers and I give them below. The final recommendation is one project-scoped brain per VPS with per-user API keys, Obsidian-ready vault always on, REST for writes, GraphQL for rich reads, and n8n (already in `rl3-infra-vps`) as the external workflow engine instead of building one inside the brain.

## Assumptions

- Target deployment stays `rl3-infra-vps` / Coolify on Hetzner. No Google Drive, no Dropbox, no consumer sync tools in the core path.
- Python 3.12 + uv for the service. `code-graph-rag` is a pinned dependency, not forked.
- Memgraph stays durable enough via periodic snapshots + R2 offsite. Memgraph Platform (paid) is out of scope unless an incident forces it.
- "Team" means 2–20 users sharing one project brain. Any team over 20 is outside v1 and wants OIDC + RBAC.
- Solo devs deploy the exact same stack. No separate local mode. A $4/month CAX11 is their brain.

## 1. Reference-by-reference feature audit

### 1.1 `code-graph-rag`

| Feature | In plan | Notes |
|---|---|---|
| Tree-sitter multi-language parsing | Yes | Inherited via dependency. |
| Memgraph graph database | Yes | Reused. |
| Qdrant vector store | Yes | Reused. |
| Incremental git-diff ingest | Yes | Wrapped by `POST /ingest/repo`. |
| Real-time file watcher | Yes | Optional background task in `brain-api`. |
| Natural-language-to-Cypher | Yes | Backs the code search endpoint. |
| Code snippet retrieval | Yes | `GET /code/snippet`. |
| Semantic code search | Yes | Via Qdrant. |
| MCP stdio server | **No** | Dropped on purpose — skills over HTTP replace it. |
| Surgical code edit tool | **No** | Out of scope. Edits are the agent's job, not the brain's. |
| Multi-project in one graph | Partial | Supported at the graph layer; we ship one-brain-per-project. |
| Pydantic-AI plumbing | Yes | Used for on-server note summarization. |

### 1.2 `graphify`

| Feature | In plan | Notes |
|---|---|---|
| Deterministic + optional-semantic ingest | Yes | Two-layer pattern preserved. |
| 25-language tree-sitter coverage | Partial | We get whatever `code-graph-rag` supports (~10 languages). Add grammars as needed. |
| Confidence labels on edges | Yes | Mandatory from day one. |
| Leiden clustering + community view | **No, v2** | Nice, not essential for v1. |
| `GRAPH_REPORT.md` health report | Yes | `/lint` endpoint writes to vault. |
| Multi-platform skill abstraction | Yes | Codi ships skills to all IDEs. |
| Obsidian vault export | Yes | Core feature, not export — the vault IS the UI. |
| Neo4j export | **No** | Not needed; we speak Cypher natively. |
| Git hooks installation | Partial | Codi handles agent hooks; git hooks are out of brain scope. |
| URL ingestion | **No, v2** | Important, but can wait. |
| Video/audio transcription | **No, v2** | Whisper adds a worker; defer. |
| PDF/DOCX extraction | **No, v2** | Pypdf/docx adds a worker; defer. |

### 1.3 `claude-obsidian`

| Feature | In plan | Notes |
|---|---|---|
| Obsidian vault as the human UI | Yes | Always-on, git-backed. |
| Hot-cache singleton | Yes | `wiki/hot.md`, ~500 words. |
| Immutable `_raw/` sources | Yes | Mirror the pattern for any ingested source. |
| Delta manifest | Partial | `code-graph-rag` already caches by hash; vault ingest can reuse same approach. |
| Contradiction flagging | **No, v2** | Data model allows it; automation deferred. |
| Append-only log | Yes | `wiki/log.md`, newest-first. |
| Three query modes (quick/standard/deep) | Partial | Skills can vary the scope; no enforced tier. |
| Git auto-commit on write | Yes | Vault reconciler commits on every API write. |
| Cross-agent markdown skills | Yes | Codi ships. |
| Wiki lint | Yes | `/lint` endpoint. |
| Dataview / Bases dashboards | Yes | Frontmatter design supports both. |
| Canvas support | **No, v2** | Nice-to-have. |
| Autoresearch skill | **No, v2** | Needs URL ingest first. |
| Defuddle (web cleanup) | **No, v2** | Needs URL ingest first. |

### 1.4 `rl3-infra-vps`

| Feature | In plan | Notes |
|---|---|---|
| Coolify app deployment | Yes | Three services added to `client.yaml`. |
| Traefik + DNS-01 TLS | Yes | Existing path. |
| `pg_dump + age + rclone` backup | Yes | Extended to Memgraph dump + Qdrant snapshot + vault git push. |
| Tailscale-only admin | Yes | Brain admin routes bound to Tailscale. |
| Env_builder pattern | Yes | One new `brain_api` builder. |
| `acme.json` persistence | Yes | Inherited from existing Traefik path. |
| n8n as a workflow engine | Yes | Available at the infra level; the brain calls it. |

### 1.5 Codi

| Feature | In plan | Notes |
|---|---|---|
| Three-layer pipeline (source → installed → generated) | Yes | Brain becomes a new artifact type. |
| Cross-agent skill distribution | Yes | Seven brain skills. |
| Common-subset hook script | Yes | One script, both agents. |
| Hook runtime normalization shim (CORE-P1) | Dependency | Brain hook script uses it when Codi ships it. |
| Observation markers | **Post-v1** | Consumed as an input channel once Codi Wave 4 lands. |
| Guardrails engine | Out of brain scope | Codi's own feature. |

### 1.6 Karpathy LLM Wiki pattern (`obsidia.md`)

| Feature | In plan | Notes |
|---|---|---|
| Three layers (raw / wiki / schema) | Yes | `_raw/` + `wiki/` + the rule file. |
| Three verbs (ingest / query / lint) | Yes | Three endpoint families. |
| `index.md` auto-maintained | Yes | Rebuilt on every write. |
| `log.md` newest-first | Yes | Append-only. |
| `qmd` search fallback | Not needed | Qdrant covers it. |

## 2. Coverage matrix (gaps and overlaps)

### 2.1 Covered (fully)

Code parsing, graph storage, vector embeddings, incremental ingest, real-time watcher, code search, snippet retrieval, confidence labels, two-layer ingest, hot cache, append-only log, master index, git auto-commit, Obsidian vault, multi-agent skills, Coolify deployment, Traefik TLS, backup pipeline.

### 2.2 Covered (partially — acceptable for v1)

Multi-project graph (we ship one-per-deployment), query depth modes (skill-level not enforced), delta manifest (reusing code-graph-rag's hash cache).

### 2.3 Missing in current plan (must address now)

Three real gaps:

1. **Per-user attribution.** Current plan uses a single shared bearer token. Every note looks anonymous. For a team, this is broken at day one. Fix: per-user API keys stored in Memgraph as `User` nodes; every write carries `author_id`; vault frontmatter includes `author`. Minimal cost, major capability.
2. **Typed read API (GraphQL).** You asked for it explicitly. REST works for skill-based writes, but GraphQL is the right fit for a future UI, dashboards, or cross-project queries. Fix: add `/graphql` with a small read-only schema alongside REST. Strawberry or Ariadne, one file, resolvers hit the same service code as REST.
3. **Lightweight ops layer.** Named "Bolt-like workflow/execution layer" in the prompt. The brain needs a way to run scheduled jobs (lint, reindex) and react to events (GitHub push). Fix: two in-process crons inside `brain-api` (lint daily, reindex hourly) and one webhook endpoint (`POST /hooks/github`). Anything richer lives in **n8n** which is already deployed for Sapphira in `rl3-infra-vps` — n8n calls the brain's HTTP API. No workflow engine inside the brain.

### 2.4 Deferred (v2, named)

Leiden clustering, URL ingest, PDF/DOCX/video ingest, contradiction auto-detection, canvas, autoresearch, defuddle, observation-marker consumption, OIDC, multi-workspace per deployment, MCP wrapper.

## 3. Overengineering review — what to cut

Four items in the current plan that add complexity without matching value:

1. **`POST /sessions` endpoints.** Sessions don't need their own table or endpoints. Let the hook script generate a UUID per session and pass it as `session_id` on every write. A "session" is emergent from the tag. Cut `POST /sessions`, `POST /sessions/{id}/log`, `POST /sessions/{id}/close`. Keep one `POST /log` that takes `session_id` as a field.
2. **`POST /ingest/doc`.** Humans can't write to the vault (concurrency rules). So a doc ingest endpoint is only called by the agent, and the agent already uses `POST /notes`. Cut the endpoint. Keep `POST /ingest/repo` because it's non-trivial (wraps `code-graph-rag`).
3. **`PATCH /notes/{id}`.** Notes are immutable at v1. Decisions that change are superseded (new note with `SUPERSEDES` edge), not patched. Cuts concurrency questions. `PUT /hot` is the one exception because hot context is a singleton by design.
4. **`POST /lint` as an API endpoint.** Make lint a cron inside `brain-api` that writes `wiki/_meta/lint-YYYY-MM-DD.md`. The skill then reads the file via the vault. One less endpoint, one less moving part.

Trimmed API:

```
POST   /notes                    (create, immutable after)
GET    /notes/{id}
GET    /notes/search
GET    /code/search
GET    /code/snippet
GET    /hot
PUT    /hot
POST   /log                      (append a log entry with session_id field)
POST   /ingest/repo
POST   /hooks/github             (webhook)
GET    /graphql                  (read-only rich queries)
GET    /healthz
```

Eleven endpoints. Nothing cut that carries load-bearing functionality.

## 4. Simplicity vs completeness review

Current plan passes on completeness with the three v1 gaps from §2.3 addressed. Simplicity is mostly fine; §3 cuts tighten it. Stress tests I ran mentally:

- **Solo dev, one project.** Installs Codi, runs `codi add brain --host ... --token ...`, opens vault in Obsidian. Works. No surprises.
- **Team of 5 on one project.** Each user has their own API key. Notes are attributed. Vault has one git remote everyone can pull from. No one writes directly to the vault. Works. No surprises.
- **Solo dev with 3 projects.** Three VPS instances or three services inside one VPS. Each has its own brain, its own vault repo. User has three API keys. Cross-project queries not supported in v1 — accepted.
- **Incident: Memgraph restart loses recent writes.** With in-memory Memgraph, the last few minutes of notes could be lost on crash. Durability story: snapshots every 15 min + replay from `log.md` on restart. Needs explicit design; v1 risk acknowledged in §8 below.
- **Incident: vault git push fails.** Write succeeds in Memgraph, fails to push. Reconciler queues failed pushes, retries on schedule. Humans see a staleness header in Obsidian until resolved.

## 5. Project-level vs user-level architecture

This is the key architectural call. I recommend **project-level brain with per-user attribution.**

Split of concerns:

| Concern | Level | Why |
|---|---|---|
| Code graph, notes, vault, decisions, rules, skills | Project | Team shares one source of truth. Matches `rl3-infra-vps` one-client-per-VPS model. |
| API key | Per-user (scoped to a project) | Attribution, revocation, rate limiting, audit. |
| Author tag on every write | Per-user | Notes show who wrote them. |
| Hot context | Project | One singleton per project; everyone sees the same working memory. |
| Private notes | **Out of v1** | Adds row-level security. Post-v1 feature (`visibility: private` on a note). |
| UI preferences (hot size, query depth, LLM choice) | Per-user, client-side | Lives in Codi user config, never hits the brain. |
| Rules / skills / hooks | Project | Everyone on the team plays by the same rules. |
| Cross-project memory ("my decisions across all repos") | Post-v1 | Queries fan out across multiple brains. |

**Pros of project-level as the primary unit:**
- Matches existing infra pattern. One deployment, one responsibility.
- Clean blast radius. One brain down, one project affected.
- Simple ACLs: you have the project's key or you don't.
- Natural team experience: shared memory, shared decisions, shared vault.
- Maps to how the code is organized anyway — one repo, one brain.

**Cons:**
- Consultant working on 5 projects has 5 API keys and 5 hot caches. Fine for v1; painful at 20 projects.
- No cross-project intelligence ("I learned X on project A, it applies to project B"). Post-v1 problem.

**Why not user-level primary?**
- User-level means one brain per user, which then needs per-project partitioning inside, which means multi-tenancy, which means row-level security and more auth. More complexity, later payoff.
- User-level also means the brain lives in a place that isn't tied to the codebase it describes. Disconnected.

**Why not hybrid (both levels)?**
- Two brains to deploy, two data models to keep in sync, two sources of truth. Bad trade at v1.

## 6. Storage and hosting recommendation

**VPS only. Not Google Drive. Not hybrid.**

- **Google Drive is wrong for this job.** Not a graph database, not a service host, no real auth granularity, terrible for markdown-tool workflows, sync conflicts are a nightmare. Use it for files, not systems.
- **VPS (Coolify / Hetzner / `rl3-infra-vps`)** is correct. One Compose stack per project. All state on the VPS: Memgraph, Qdrant, vault worktree. Backups to Cloudflare R2. Vault git remote on GitHub.
- **Hybrid architecture** adds complexity for no concrete gain at v1. Skip.

If a user wants the vault readable in Drive, they can export (git → Drive) as a downstream job. The brain doesn't know or care.

Resource fit: CAX21 (4 vCPU, 8 GB RAM) per brain for a team; CAX11 (2 vCPU, 4 GB) for a solo dev with small-to-medium repos. Memgraph is the memory pressure ceiling.

## 7. Auth / access model recommendation

**Per-user API key from v1.** Not per-deployment, not per-project-shared.

Implementation shape:

- `User` node in Memgraph with `id`, `name`, `email`, `api_key_hash`, `created_at`, `active`.
- Keys issued via `codi brain admin create-user <email>` on the VPS, over Tailscale-bound admin endpoints.
- Bearer header on every request: `Authorization: Bearer <key>`.
- Every write sets `author_id = current_user.id` server-side. Clients can't spoof it.
- Revoke by flipping `active=false` on the User node.
- Rate limits per user (not per IP): 1000 requests/min, raised on demand.

**Not in v1:**
- OIDC / SSO. Useful for enterprise; noisy for v1.
- Per-resource ACLs. Everyone on the project sees all project notes; private notes are a post-v1 frontmatter flag.
- OAuth apps / service accounts. Personal API keys cover agents and humans equally.

**Solo dev simplification.** Solo dev has one user — themselves. One key. No UX overhead versus a shared token, same security story.

**Cost of per-user keys over shared token:** ~150 lines of FastAPI middleware + two admin endpoints. Tiny.

## 8. Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Memgraph RAM ceiling on large repos | Medium | Service OOM | Default to CAX21; monitor; disk-backed fork (Neo4j) if it hits. |
| Memgraph crash loses recent writes | Medium | Minutes of notes lost | 15-min snapshots + `log.md` replay; document as known v1 limit. |
| Vault git push failure | Medium | Stale Obsidian view | Reconciler queue + retry + stale header in vault. |
| Bearer token leak | Medium | Full project access | Per-user keys, revocable; audit log shows which key. |
| Codex `apply_patch` invisible to hooks | High | No in-session edit audit on Codex | Reconstruct from `git diff` on `Stop`; document limit. |
| LLM API outage during semantic ingest | High | Enrichment stalls | Structural parse still runs; semantic is opt-in and cached. |
| Coolify API breaking changes | Medium | Deploy fails | Pin Coolify version per client; CI reproduction. |
| `code-graph-rag` upstream breakage | Medium | Brain build fails | Pin tag, not main; manual upgrade reviews. |
| Concurrent multi-agent writes to same Note | Low (v1) | Lost update | Notes are immutable at v1; supersede instead of edit. |
| `rl3-infra-vps` CAX11 co-tenancy with other services | Low | Resource contention | Put brain on its own client VPS for team; solo dev can co-locate. |

## 9. MVP scope recommendation

Four weeks of focused work for one engineer, or two weeks for two. The MVP ships all three features users actually want: the agent can search code and memory, the human can browse the Obsidian vault, the team can attribute who said what.

### Week 1 — service skeleton

- FastAPI app scaffolding.
- Memgraph + Qdrant Compose.
- `User`, `Note` node schema + constraints.
- Per-user API key middleware.
- Bearer auth + rate limiting.
- `/healthz` + `/readyz`.

### Week 2 — code brain

- `code-graph-rag` as pinned dependency.
- `POST /ingest/repo` wraps its incremental ingest.
- `GET /code/search` + `GET /code/snippet`.
- Qdrant integration for code docstrings.
- Hourly reindex cron.
- `POST /hooks/github` webhook.

### Week 3 — memory brain + vault

- `POST /notes`, `GET /notes/{id}`, `GET /notes/search`.
- `GET /hot` + `PUT /hot` + `POST /log`.
- Vault reconciler: every write updates Memgraph, the vault file, and pushes to git.
- Wikilink generation: each edge → `[[link]]` in note body.
- Daily lint cron writes `wiki/_meta/lint-YYYY-MM-DD.md`.
- Pre-configured `.obsidian/` (graph colors, folder filters, one Bases dashboard).

### Week 4 — agents + infra

- Seven skills shipped via Codi, one rule, one hook script.
- `/graphql` read-only schema (Strawberry or Ariadne).
- `codi add brain` command + per-IDE config generation.
- `rl3-infra-vps` patches: `client.yaml` entries, `brain_api` env_builder, backup crons.
- Deploy against the Codi repo as the dogfood workspace.
- Restore-from-R2 drill documented and run.

### Explicitly out of MVP

MCP wrapper; URL/PDF/video ingest; contradiction detection; clustering; autoresearch; observation-marker auto-ingest; web UI beyond Obsidian; multi-workspace per instance; private notes.

## 10. Final architecture recommendation

### 10.1 Stack

Three containers per project VPS. No new databases, no new orchestrators.

- `brain-api` — FastAPI app wrapping `code-graph-rag`; exposes REST writes + GraphQL reads.
- `memgraph` — code graph + narrative graph in one database.
- `qdrant` — vector embeddings for code and notes.

External dependencies:
- `rl3-infra-vps` provisions and runs it.
- GitHub hosts the vault git remote.
- Cloudflare R2 holds backups.
- n8n (already on the infra) runs any multi-step workflow that calls the brain; the brain does not host a workflow engine.

### 10.2 Data

- Code nodes from `code-graph-rag` (unchanged).
- `User` nodes + per-user API keys.
- `Note` nodes with `kind`, `author_id`, `session_id`, `confidence`, `body`.
- Three narrative edges: `REFERENCES`, `RELATED_TO`, `SUPERSEDES`. All confidence-labeled.

### 10.3 Surfaces

- **REST** — writes and simple reads. Called by skills via `curl`. Eleven endpoints.
- **GraphQL** — read-only typed queries. For future UI and dashboards. One schema file.
- **Webhook** — `/hooks/github` for push events.
- **Admin endpoints** — user create/revoke, Tailscale-bound only.

### 10.4 Humans

Open Obsidian on a local clone of the vault git repo. Browse the graph view, read notes, watch Bases dashboards. Never push. All writes go through agents calling the API.

### 10.5 Agents

Codi ships seven skills + one rule + one hook script. `codi add brain` wires every IDE (Claude Code, Cursor, Codex, Gemini) to the brain host with a per-user API key from the user's `~/.codi/secrets.yaml`.

### 10.6 What this preserves vs. the references

- Everything in `code-graph-rag` except the MCP wrapper (replaced by skills + HTTP).
- Every honesty idea in `graphify` that matters for v1 (confidence labels, two-layer ingest, health reports).
- Every human-facing idea in `claude-obsidian` / Karpathy LLM Wiki (vault, hot cache, log, index, wikilink graph view).
- Every deployment convention in `rl3-infra-vps` (Coolify, Traefik, backups, Tailscale admin).
- Every distribution advantage in Codi (three-layer pipeline, cross-agent skills, common-subset hooks).

### 10.7 What this cuts that doesn't matter

- MCP server (wrapper, not a capability).
- Separate session endpoints (session_id is a tag).
- Note patches (immutable + supersede).
- Doc ingest endpoint (vault is read-only for humans, agents write via `/notes`).
- Lint endpoint (cron writes to vault).
- In-brain workflow engine (n8n already exists on the infra).
- Local embedded mode (service-only; solo devs deploy the same stack cheaply).

## 11. Decisions required

Six questions you need to answer before the Week-1 work starts:

1. **Per-user API keys from v1?** My recommendation: yes. You will regret the shared bearer token by week 3.
2. **GraphQL in v1?** My recommendation: yes, read-only, Strawberry — one day of work, major future payoff.
3. **Workflow engine in the brain?** My recommendation: no. Use n8n externally.
4. **Private notes in v1?** My recommendation: no. Frontmatter flag `visibility: private` added post-v1.
5. **Deployment shape: dedicated brain VPS per project, or services inside an existing client (e.g., Codi)?** My recommendation: dedicated VPS for team brains; solo devs can co-locate inside their existing client to save cost.
6. **Default VPS size: CAX11 or CAX21?** My recommendation: CAX21 for teams (8 GB RAM), CAX11 for solo devs on small-to-medium repos.

Once these six are answered, the MVP plan is unblocked and the next doc is the `[PLAN]` for Week 1 — file-by-file inside a new `codi-brain` repo, plus the `rl3-infra-vps` patches.
