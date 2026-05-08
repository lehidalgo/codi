# Codi Brain v2 — Design Spec (Code Knowledge mode)

- **Date**: 2026-04-24 14:57
- **Document**: 20260424*145740*[PLAN]\_codi-brain-v2-design.md
- **Category**: PLAN
- **Status**: **SUPERSEDED — 2026-04-30**. The v2 effort has been re-scoped to "Project Specification mode" instead of "Code Knowledge mode". CK mode remains designed but deferred to v2.x.
- **Successor**: `docs/20260430_232636_[PLAN]_codi-brain-v2-spec-mode-design.md`
- **Rollout**: `docs/20260430_232636_[ROADMAP]_codi-brain-v2-spec-mode-rollout.md`
- **Predecessor**: `docs/20260424_144908_[PLAN]_codi-brain-v2-brainstorm-checkpoint.md`
- **Reason for supersession**: A 10-question grilling session on 2026-04-30 surfaced that the agency's primary business need is end-to-end traceability from stakeholder requirements to code, not a Zettelkasten-style knowledge wiki. The CK mode's substrate (vault + Memgraph + Qdrant + reconciler + confidence-tagged links) is preserved and reused; only the page taxonomy + relations vocabulary + skills are re-scoped for Spec mode. CK mode will be added back as a second mode in v2.x once Spec mode ships and validates.

---

> **Note for readers:** This document describes the original v2 vision for a Code Knowledge wiki. It is preserved for historical reference. The currently-approved v2 design is the Spec mode successor linked above. Do not implement against this document.

---

## 1. Goal + architecture

**Goal.** Turn the brain from a flat decision log (Week 2B) into a compounding, agent-authored wiki with a confidence-tagged graph index, following the merged pattern of `claude-obsidian` (agent-authored filesystem) + `graphify` (confidence-tagged graph) + our existing Memgraph/Qdrant infrastructure.

**Architecture.** Three layers with strict ownership:

1. **Layer 1 — Vault (agent-authored, filesystem-of-truth).** The coding agent (or its subagents) writes every wikilink, every frontmatter block, every `index.md` / `log.md` / `hot.md` entry. No Python process generates content.
2. **Layer 2 — Indexes (brain-side, reconciled).** Memgraph holds the graph of pages + typed edges with confidence tags. Qdrant holds per-page embeddings. Leiden community detection runs on demand + hourly. Both are **derived** from Layer 1 — the filesystem is the only source of truth.
3. **Layer 3 — Query + derived views (brain-side, read-only routes).** Hybrid search, community detection, god-nodes, contradictions, shortest-path, 8-category lint.

**Core principle.** _Coding agent is the author; brain is the reconciler + indexer + query engine._

---

## 2. Three-layer model

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3 — Query + derived views (brain-side, Python)        │
│   GET /notes/search   (hybrid vector + tag + graph)         │
│   GET /hot            (returns Layer 1 hot.md content)      │
│   GET /graph/communities    (Leiden partitions)             │
│   GET /graph/god-nodes      (high-degree hubs)              │
│   GET /graph/contradictions (pages linked via `contradicts`)│
│   GET /graph/shortest-path?from=<slug>&to=<slug>            │
│   GET /lint-report    (runs 8 lint queries → markdown)      │
└─────────────────────────────────────────────────────────────┘
                            ↑ reads from
┌─────────────────────────────────────────────────────────────┐
│ Layer 2 — Indexes (brain-side, reconciled from Layer 1)     │
│   Memgraph: (:Page)-[:LINKS_TO {confidence, score, ...}]→   │
│   Qdrant:   per-page embeddings, payload={vault_path,type}  │
│   Leiden:   community partitions, refreshed on-demand+hourly│
└─────────────────────────────────────────────────────────────┘
                            ↑ reconciles from
┌─────────────────────────────────────────────────────────────┐
│ Layer 1 — Vault (agent-authored, filesystem as truth)       │
│   .raw/             immutable source documents              │
│   wiki/                                                     │
│     index.md, log.md, hot.md, overview.md                   │
│     sources/, entities/, concepts/, domains/,               │
│     comparisons/, questions/, decisions/, meta/             │
│   CLAUDE.md         schema + instructions                   │
└─────────────────────────────────────────────────────────────┘
```

**Strict ownership contract:**

| Layer       | Who writes               | Who reads    | Source of truth? |
| ----------- | ------------------------ | ------------ | ---------------- |
| L1 vault    | coding agent + subagents | everyone     | ✅ YES           |
| L2 Memgraph | brain reconciler only    | brain routes | ❌ derived       |
| L2 Qdrant   | brain reconciler only    | brain routes | ❌ derived       |

If L2 ever disagrees with L1, rebuild L2 from L1. Never the reverse.

---

## 3. Component inventory

### 3.1 Vault layout (Layer 1)

| Path                | Owner                     | Purpose                                                                                                  | Append/overwrite                     |
| ------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `.raw/`             | agent                     | Immutable source documents. Dot-prefix hides from Obsidian.                                              | Append-only (no modifications ever)  |
| `wiki/index.md`     | agent                     | Master catalog. Sections: Domains / Entities / Concepts / Sources / Questions / Comparisons / Decisions. | Overwrite with full list each update |
| `wiki/log.md`       | agent                     | Chronological op log. **New entries at TOP.** Format: `## [YYYY-MM-DD] operation \| Title`               | Append-at-top                        |
| `wiki/hot.md`       | agent                     | Hot cache. ~500 words of recent context. See §3.1.1 for required template.                               | Full overwrite each update           |
| `wiki/overview.md`  | agent                     | Executive summary of the vault.                                                                          | Overwrite when big picture changes   |
| `wiki/sources/`     | agent                     | One summary page per raw source.                                                                         | One file per source                  |
| `wiki/entities/`    | **orchestrator only**     | People, orgs, products, repos. Written deterministically from subagent manifests.                        | Upsert from manifest aggregate       |
| `wiki/concepts/`    | agent                     | Ideas, patterns, frameworks.                                                                             | One file per concept                 |
| `wiki/domains/`     | agent                     | Top-level topic areas (+ `_index.md` scoped sub-index).                                                  | One file per domain                  |
| `wiki/comparisons/` | agent                     | Side-by-side analyses.                                                                                   | One file per comparison              |
| `wiki/questions/`   | agent                     | Filed answers to user queries.                                                                           | One file per question                |
| `wiki/decisions/`   | agent                     | Ephemeral session decisions (preserved from Week 2B).                                                    | One file per decision                |
| `wiki/meta/`        | brain lint + agent canvas | `lint-report-YYYY-MM-DD.md`, `communities.md`, `canvas/*.canvas`.                                        | Overwrite (lint reports are dated)   |
| `CLAUDE.md`         | user (vault owner)        | Schema + instructions pinning agent behavior.                                                            | Hand-authored                        |

**`.raw/` invariant:** any Python or agent modification to a file under `.raw/` is a bug. Source documents are write-once, read-many.

#### 3.1.1 Required `wiki/hot.md` template

Every overwrite MUST emit exactly this structure:

```markdown
---
type: meta
title: "Hot Cache"
updated: 2026-04-24T14:30:00Z
---

# Recent Context

## Last Updated

YYYY-MM-DD — one-line "what happened in the last session"

## Key Recent Facts

- Bullet 1 (top takeaway, wikilinked if possible)
- Bullet 2
- Bullet 3

## Recent Changes

- Created: [[Page A]], [[Page B]]
- Updated: [[Page C]]
- Flagged: [[Page D]] (contradiction with [[Page E]])

## Active Threads

- User is currently researching [[Topic X]]
- Open question: [[Question Y]]
```

- Target: ~500 words / ~500 tokens. Hard cap 800 tokens.
- Overwrite completely on every update; never append.
- Refreshed by orchestrator after every ingest batch and after any `codi-brain-save` invocation.
- Cross-project reach: other projects' `CLAUDE.md` may instruct "before anything, read this vault's `wiki/hot.md`" — deferred to v2.1 but template shape is stable for this reason.

**Subagent contract:** per-source files OK (one subagent may write its own `wiki/sources/<slug>.md`, `wiki/concepts/*.md` for concepts it introduces). Global files (`index.md`, `log.md`, `hot.md`, `overview.md`, `entities/*.md`) are **FORBIDDEN** from subagents — only the orchestrator writes them, after all subagents finish.

### 3.2 Memgraph schema (Layer 2)

```cypher
(:Page {
  slug: "gemini-2-5-flash",                  // stable ID, matches filename stem
  type: "entity" | "concept" | "source" |
        "domain" | "decision" | "comparison" | "question",
  vault_path: "entities/gemini-2-5-flash.md",
  title: "Gemini 2.5 Flash",
  status: "seed" | "developing" | "mature" | "evergreen",
  created: "2026-04-24T14:00:00Z",
  updated: "2026-04-24T14:30:00Z",
  content_hash: "sha256(body-only)",         // body excluded frontmatter
  tags: ["llm", "google"]
})

-[:LINKS_TO {
  confidence: "EXTRACTED" | "INFERRED" | "AMBIGUOUS",
  confidence_score: 1.0,                     // 0.0..1.0; EXTRACTED=1.0; 0.5 BANNED
  relation: "cites" | "references" | "contradicts" |
            "conceptually_related_to" | "semantically_similar_to" |
            "rationale_for" | "supersedes" | "part_of" | "calls",
  reason: "free-text from agent, nullable",
  source_location: "heading:## Approach"     // for traceability, nullable
}]-> (:Page)
```

Unique constraint on `(:Page).slug`. Reconciler upserts by `slug`, replacing `vault_path` + `content_hash` + edges derived from the frontmatter `links:` block and plain-body `[[wikilinks]]`.

**Missing-target handling.** When a link's target slug is not found in Memgraph at reconcile time, the reconciler creates a placeholder node:

```cypher
(:MissingPage {slug: "...", first_referenced_from: "...", first_seen: datetime()})
```

and draws `[:LINKS_TO]` into that node instead of `:Page`. Lint categories 2 and 4 query `:MissingPage` directly — no need for a `target_missing` edge property. When a real `:Page` with the same slug is later written, the reconciler rewrites inbound edges from `:MissingPage → :Page` and deletes the placeholder.

### 3.3 Qdrant schema (Layer 2)

- Collection: `vault_pages`
- Vector dim: 1536 (OpenAI `text-embedding-3-small`, matches Week 2A brain)
- Payload: `{ slug, vault_path, type, title, tags, content_hash }`
- Point ID: deterministic `sha256(slug)` truncated to uint64 (so re-ingest is idempotent)

### 3.4 Brain-side routes (Layer 3)

Preserved from Week 2A/2B:

- `POST /notes` (retired — superseded by `/vault/write`; kept as alias returning 301 for backward compat)
- `GET /notes/search` (kept, now hybrid across vault pages + confidence-weighted graph ranking)
- `GET /hot` / `PUT /hot` (returns `wiki/hot.md` raw content; PUT is ignored, hot.md is agent-authored)
- `POST /vault/reconcile` (kept — now also rebuilds Memgraph schema on drift)
- `GET /healthz`, `GET /metrics` (kept)

New in v2:

- `POST /vault/write` — accepts `{ vault_path, frontmatter, body }`; runs the 6-step atomic commit (Memgraph upsert → embed → Qdrant upsert → file write → reconciler → git push via retry queue).
- `POST /vault/wipe` — admin-only (requires `BRAIN_ADMIN_TOKEN`). Drops all `:Page` nodes + detaches edges + deletes Qdrant collection + deletes vault folder contents except `.git`. Invoked by `codi brain wipe-vault --confirm`. Emits a git commit `"wiki: wipe vault"` so the remote has an auditable record.
- `GET /graph/communities?force=<bool>` — returns Leiden partitions. Partitions are cached in Memgraph as a `community_id` property on `:Page` and refreshed by (a) `force=true` on-demand, or (b) the hourly APScheduler job (see §4.5). `force=false` returns cached value.
- `GET /graph/god-nodes?min_degree=<int>&limit=<int>` — top-degree pages, excluding synthetic hubs (filename-stub nodes with degree ≤ 1).
- `GET /graph/contradictions` — returns pairs `(a, b)` linked via `relation="contradicts"`.
- `GET /graph/shortest-path?from=<slug>&to=<slug>&max_depth=<int>` — BFS on Memgraph.
- `GET /lint-report` — runs the 8 lint checks (Cypher + Python, see §4.4), writes `wiki/meta/lint-report-YYYY-MM-DD.md`, returns the markdown inline.

### 3.5 Client-side skills (Codi CLI repo)

Eight skills. Replaces Week 2B's six narrow skills:

| Skill                     | Replaces (Week 2B)                                         | Trigger                                                           | I/O                                                                                                   |
| ------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `codi-brain-wiki`         | (NEW)                                                      | "set up wiki", "scaffold vault"                                   | Scaffolds vault folder layout, writes `CLAUDE.md`, initial `index.md`/`hot.md`/`log.md`/`overview.md` |
| `codi-brain-ingest`       | absorbs most of `codi-brain-decide` + `codi-brain-hot-set` | "ingest this source", "process this URL", "save transcript"       | One source → 8-15 wiki pages via 11-step loop (§4.1)                                                  |
| `codi-brain-query`        | absorbs `codi-brain-recall` + `codi-brain-hot-get`         | "what do you know about", "query:", "query quick:", "query deep:" | Three-depth query (hot → index → pages)                                                               |
| `codi-brain-lint`         | (NEW, wraps `GET /lint-report`)                            | "lint the wiki", "audit wiki", "find orphans"                     | Writes `wiki/meta/lint-report-YYYY-MM-DD.md`                                                          |
| `codi-brain-save`         | absorbs Stop-hook L3 primary path                          | "save this session", `/save`                                      | Conversation → new page(s) in the right folder                                                        |
| `codi-brain-decide`       | kept (narrow shortcut)                                     | "decide:", "log decision"                                         | Single decision capture → `wiki/decisions/<slug>.md`                                                  |
| `codi-brain-review`       | kept from Week 2B                                          | `/codi-brain-review`                                              | Interactive review of recent decisions/concepts                                                       |
| `codi-brain-undo-session` | kept from Week 2B                                          | `/codi-brain-undo-session`                                        | Rollback all writes from one session                                                                  |

Dropped: `codi-brain-hot-set` / `codi-brain-hot-get` (hot.md is agent-authored via `codi-brain-ingest`/`codi-brain-save`; no standalone skill needed).

### 3.6 Rule: `codi-brain-capture` (rewritten)

Meta-rule that orchestrates the eight skills. Replaces the marker-only rule from Week 2B.

Structure:

- Schema section: all 7 frontmatter types (source/entity/concept/domain/decision/comparison/question).
- When-to-invoke-which-skill decision tree.
- Wikilink style guide: plain `[[Title]]` in body; `links:` in frontmatter for tagged edges.
- Confidence rubric (§6).
- Contradiction protocol: when contradicting an existing page, write dual `> [!contradiction]` callouts on BOTH sides (mirroring claude-obsidian §4.5 step 11).

### 3.7 Frontmatter templates (7 new, one per page type)

At `src/templates/skills/codi-brain-wiki/_templates/`, one per page type. Universal fields (required on every page): `type, title, created, updated, tags, status, related, sources, links`. Type-specific additions:

- **source**: `source_type` (article|video|podcast|paper|book|transcript|data), `author`, `date_published`, `url`, `confidence` (high|medium|low), `key_claims`
- **entity**: `entity_type` (person|organization|product|repository|place), `role`, `first_mentioned`
- **concept**: `complexity` (basic|intermediate|advanced), `domain`, `aliases`
- **domain**: `subdomain_of`, `page_count`
- **decision**: `reason`, `alternatives_considered`, `superseded_by` (nullable), `session_id` (Claude Code session that authored it, for `codi brain undo-session` grouping), `rolled_back` (bool, default false)
- **comparison**: `subjects[]`, `dimensions[]`, `verdict`
- **question**: `question`, `answer_quality` (draft|solid|definitive)

### 3.8 Custom callouts (4 CSS snippets)

Copy `vault-colors.css` from claude-obsidian verbatim into `src/templates/skills/codi-brain-wiki/_assets/vault-colors.css`. Wiki skill copies to `.obsidian/snippets/` during scaffold.

| Callout         | Color         | Icon           | Semantic                          |
| --------------- | ------------- | -------------- | --------------------------------- |
| `contradiction` | reddish-brown | alert-triangle | Resolvable conflict between pages |
| `gap`           | beige         | help-circle    | Topic has no source (actionable)  |
| `key-insight`   | bright blue   | lightbulb      | The most important takeaway       |
| `stale`         | gray          | clock          | Time-based decay of a claim       |

### 3.9 Hooks (Claude Code reference impl)

Four hooks. Three upgraded from Week 2B, one new:

| Hook           | Matcher                             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Source of logic                                                                                                                                                |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart` | `startup\|resume`                   | Flush outbox + inject `wiki/hot.md` content as `additionalContext`                                                                                                                                                                                                                                                                                                                                                                                      | Upgraded from Week 2B (same structure, reads hot.md instead of calling `/hot`)                                                                                 |
| `PostCompact`  | (no matcher)                        | Re-inject `wiki/hot.md` — context compaction drops hook output                                                                                                                                                                                                                                                                                                                                                                                          | **NEW** (mirrors claude-obsidian)                                                                                                                              |
| `Stop`         | (no matcher)                        | (a) Auto-commit `wiki/ .raw/` if changes exist since HEAD. (b) `<CODI-DECISION@v1>...` inline marker extraction kept as opt-in fallback for users who don't want to invoke `codi-brain-decide` explicitly. (c) Gemini-based transcript extraction retained as opt-in helper for post-session audit suggestions — NOT the primary path. Primary path is now agent-authored pages written via `codi-brain-ingest` / `codi-brain-save` during the session. | Upgraded from Week 2B: auto-commit is new; marker path demoted to fallback; primary write path moved from Stop-hook-at-end to during-session skill invocations |
| `PostToolUse`  | `Write\|Edit` (matches vault paths) | `git add wiki/ .raw/ && git commit -m "wiki: auto-save $(date)"` → signal brain to reconcile                                                                                                                                                                                                                                                                                                                                                            | **NEW behavior** (was git-commit-only in Week 2B)                                                                                                              |

Script generators live in `src/core/hooks/brain-hooks.ts`. Adapter wiring in `src/adapters/claude-code.ts` stays gated on the presence of any `codi-brain-*` skill.

### 3.10 Subagent orchestrator

New file: `src/brain-client/ingest-orchestrator.ts`. Implements hybrid pattern (Q2 lock):

1. Orchestrator receives list of sources.
2. Dispatches one subagent per source via `Task` tool (single message, all in parallel).
3. Each subagent writes its own `wiki/sources/<slug>.md` + `wiki/concepts/*.md` for concepts it introduces.
4. Each subagent emits a **manifest** at `.codi/ingest-manifests/<session-id>/<source-slug>.json`. `<session-id>` is the Claude Code session ID available in every hook payload (key `session_id`) and passed from the orchestrator to each subagent as a prompt parameter. For CLI-triggered ingests outside a Claude Code session (e.g. `codi brain ingest path/to/source.md`), the orchestrator mints a UUIDv4 prefixed with `cli-` (example: `cli-7e3f...`). Manifest format:
   ```typescript
   type IngestManifest = {
     source_slug: string;
     entities_mentioned: Array<{
       name: string;
       entity_type: "person" | "organization" | "product" | "repository" | "place";
       role: string | null; // e.g. "author", "maintainer"
       first_mentioned_in: string; // vault_path of the source
       mentions: number; // raw count
     }>;
     concepts_introduced: string[]; // slugs of concepts this subagent wrote
     domains_touched: string[]; // slugs of domains cross-referenced
   };
   ```
5. Orchestrator waits for all subagents, aggregates manifests, deterministically writes/updates `wiki/entities/<Name>.md` (no merge conflicts — single writer).
6. Orchestrator updates `wiki/index.md`, `wiki/hot.md`, `wiki/log.md`, `wiki/overview.md` (single-writer for global files).
7. Orchestrator runs cross-reference pass: for each entity, insert `[[wikilinks]]` into the source pages where the entity is mentioned.
8. Orchestrator triggers `POST /vault/reconcile`.

### 3.11 CLI additions

`codi brain` keeps existing subcommands from Week 2B:

- `status`, `search`, `decide`, `hot`, `outbox`, `undo-session`

Adds three new subcommands:

- `codi brain wipe-vault --confirm` — drops Memgraph nodes + Qdrant collection + vault folder content, leaves empty scaffold. **Launches v2 clean** per Q4.
- `codi brain lint [--write-report]` — hits `GET /lint-report`, writes report file if flag set.
- `codi brain graph [communities|god-nodes|contradictions]` — human-readable wrappers over the new `/graph/*` routes.

### 3.12 Multi-agent symlink installer

New file: `bin/setup-multi-agent.sh` (mirrors claude-obsidian). Symlinks `~/.codex/skills/codi-brain-*`, `~/.opencode/skills/codi-brain-*`, `~/.gemini/skills/codi-brain-*`, `~/.windsurf/rules/codi-brain-capture.md` to the per-agent directories. Per-agent bootstrap files already exist (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, etc.); this script only wires the skill links.

---

## 4. Data flow

### 4.1 Ingest flow (11-step loop, borrowed from claude-obsidian §4.5)

**Delta tracking.** Before ingest, compute `sha256(file body)` vs `.raw/.manifest.json`. Skip if hash matches. After ingest: record `{hash, ingested_at, pages_created, pages_updated}`.

**Single source, 11 steps:**

1. Read source completely.
2. Discuss takeaways with user (skippable on "just ingest it").
3. Create source summary in `wiki/sources/<slug>.md`.
4. Create/update entity pages **(via orchestrator manifest, not subagent)**.
5. Create/update concept pages.
6. Update `wiki/domains/*` + their `_index.md`.
7. Update `wiki/overview.md` if big picture changed.
8. Update `wiki/index.md` with all new pages.
9. Update `wiki/hot.md` (overwrite).
10. Append at TOP of `wiki/log.md`: `## [YYYY-MM-DD] ingest | Title` + 5 lines (Source, Summary, Pages created, Pages updated, Key insight).
11. Contradiction check: if this source contradicts an existing page, add `> [!contradiction]` callouts on BOTH pages.

**Batch ingest.** Same as single-source but:

- Steps 1-5 run in parallel per-source via orchestrator (§3.10).
- Steps 6-10 run ONCE at the end (orchestrator, single writer).
- User check-in every 10 sources.

### 4.2 Query flow (three depths, borrowed from claude-obsidian §4.8)

| Depth    | Tokens (approx) | Reads                                                           |
| -------- | --------------- | --------------------------------------------------------------- |
| Quick    | ~1500           | `hot.md` + `index.md` only                                      |
| Standard | ~3000           | + 3-5 matched pages, 1-hop wikilink follow                      |
| Deep     | ~8000+          | + full wiki via `GET /notes/search` hybrid + optional WebSearch |

Quick → Standard → Deep decided by user phrasing. Skill offers to file the answer as `wiki/questions/<slug>.md` when complete.

### 4.3 Reconcile flow

Triggered by `POST /vault/reconcile` (agent invokes after writes) or `POST /vault/write` (per-file). Steps:

1. Parse YAML frontmatter.
2. Parse body for plain `[[wikilinks]]`.
3. Upsert `(:Page {slug, ...})` in Memgraph by `slug`.
4. For each entry in `links:` frontmatter → upsert `[:LINKS_TO]` with the confidence metadata.
5. For each plain body `[[Target]]` → upsert `[:LINKS_TO {confidence: "EXTRACTED", confidence_score: 1.0, relation: "references"}]` if no matching frontmatter `links:` entry exists.
6. Compute `sha256(body)` → compare to stored; if drifted, re-embed + update Qdrant.
7. If orphan edges detected (target slug missing), leave them (lint will surface).

### 4.4 Lint flow (brain-side, 8 categories, Q5a lock)

All 8 categories expressed as Cypher queries:

| #   | Category            | Implementation                                                                                                                          |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Orphan pages        | Cypher: `MATCH (p:Page) WHERE NOT EXISTS { ()-[:LINKS_TO]->(p) } AND p.slug <> 'index' RETURN p.slug, p.title`                          |
| 2   | Dead links          | Cypher: `MATCH (p:Page)-[l:LINKS_TO]->(m:MissingPage) RETURN p.slug AS source, m.slug AS dead_target, l.relation`                       |
| 3   | Stale claims        | Cypher: `MATCH (p:Page) WHERE p.status IN ['seed','developing'] AND p.updated < datetime() - duration('P90D') RETURN p.slug, p.updated` |
| 4   | Missing pages       | Cypher: `MATCH ()-[:LINKS_TO]->(m:MissingPage) WITH m.slug AS t, count(*) AS refs WHERE refs >= 2 RETURN t, refs ORDER BY refs DESC`    |
| 5   | Missing cross-refs  | Python (brain-side): scans page bodies for entity names (from `:Page {type:'entity'}.title`) appearing without `[[wikilinks]]`          |
| 6   | Frontmatter gaps    | Python (brain-side): scans YAML frontmatter for missing required fields `type/status/created/updated/tags`                              |
| 7   | Empty sections      | Python (brain-side): scans for markdown headings with no body text before the next heading                                              |
| 8   | Stale index entries | Cypher: `MATCH (i:Page {slug:'index'})-[l:LINKS_TO]->(m:MissingPage) RETURN m.slug`                                                     |

Output format: `wiki/meta/lint-report-YYYY-MM-DD.md` with sections Summary / Orphans / Dead Links / Missing Pages / Stale Claims / Cross-Ref Gaps / Frontmatter Gaps / Empty Sections / Stale Index.

Cadence: on-demand only (agent invokes `codi-brain-lint` skill). No scheduled runs.

### 4.5 Community detection flow (Q5b lock)

Leiden via `graspologic`, with Louvain fallback for disconnected components.

- On-demand: `GET /graph/communities?force=true` → recomputes, writes `wiki/meta/communities.md`.
- Scheduled: every hour (APScheduler) → same computation; skips if graph unchanged (checksum of edge set).
- Per-write: **no**. Too expensive, thrashes communities.

---

## 5. Concurrency + error handling

### 5.1 Concurrency primitives

Preserved from Week 2A/2B:

- **RW-lock** around vault writes: multiple readers OK, single writer. Prevents torn reads during reconcile.
- **VaultWriteContext**: 6-step atomic commit (Memgraph → embed → Qdrant → file → reconciler → git push via retry queue). If any step fails, earlier steps rollback; never a dangling file without graph entry.
- **PushRetryQueue** for vault git remote (persisted to `.codi/push-retry/*.json`).
- **Outbox pattern** client-side for `POST /vault/write` failures (persisted to `.codi/brain-outbox/<ts>_<session>_<rand>.json`).

### 5.2 New concern: subagent write conflicts

Subagents write in parallel to `wiki/sources/` and `wiki/concepts/`. Two subagents may both try to create `wiki/concepts/<same-slug>.md`. Resolution:

- First-writer wins (filesystem create-exclusive).
- Losing subagent records `existing_page_updated: <slug>` in its manifest.
- Orchestrator detects the collision from manifest aggregate and writes a contradiction callout if the two concept descriptions diverge materially (diff check > 40% line change).

### 5.3 Error handling

- **Malformed frontmatter** during reconcile → log + add to `wiki/meta/parse-errors-YYYY-MM-DD.md` + skip that file (don't block reconcile).
- **Qdrant embedding failure** → retry 3×, then queue to `.codi/embed-retry/*.json` for later retry. Page still written to filesystem + Memgraph.
- **Git push failure** → push retry queue (existing).
- **Subagent crash** → its manifest never appears; orchestrator proceeds with aggregate of surviving manifests + logs the missing slug.

---

## 6. Confidence model

Adopted verbatim from graphify §3.3.

Two dimensions per edge:

- **Tier** (categorical): `EXTRACTED | INFERRED | AMBIGUOUS`
- **Score** (numeric): 0.0..1.0

Hard rules:

1. `EXTRACTED` ⇒ `confidence_score = 1.0` always.
2. `INFERRED` ⇒ 0.4-0.9: strong 0.8-0.9, reasonable 0.6-0.7, weak 0.4-0.5.
3. `AMBIGUOUS` ⇒ 0.1-0.3.
4. **`0.5` is BANNED as a lazy default.** If tempted, the correct tier is AMBIGUOUS (0.1-0.3), not INFERRED-weak.
5. Unannotated plain `[[wikilinks]]` in body default to `EXTRACTED:1.0` (the agent wrote it explicitly).

Where confidence lives (Q3 lock):

- In the **source page's** YAML frontmatter under `links:` — carries explicit metadata:
  ```yaml
  ---
  title: "Switch extractor to Gemini 2.5 Flash"
  type: decision
  status: developing
  links:
    - target: "Gemini 2.5 Flash"
      relation: "references"
      confidence: EXTRACTED
      score: 1.0
    - target: "Claude Haiku"
      relation: "semantically_similar_to"
      confidence: INFERRED
      score: 0.7
      reason: "alternative considered, not directly compared"
  ---
  ```
- Body carries plain `[[wikilinks]]` for reading ergonomics; reconciler pairs by target slug.
- Drift (body wikilink without frontmatter entry, or vice versa) → lint category "Cross-Ref Gaps".

Obsidian 1.4+ renders frontmatter as Properties panel → users can browse confidence in-UI.

---

## 7. Migration story

**Wipe clean (Q4 lock).** The existing 87 Week 2B decision nodes are validation artifacts, confirmed by user as "dummy test data, we can delete that."

Procedure (one command):

```bash
codi brain wipe-vault --confirm
```

Internally:

1. `POST /vault/wipe` on the brain (drops all `:Page` nodes + detaches edges + deletes Qdrant collection + deletes vault folder contents except `.git` + pushes the wipe commit).
2. `codi brain wiki` (scaffold skill) runs → recreates empty vault layout + fresh `index.md`/`hot.md`/`log.md`/`overview.md`.

No migration tooling. No bridge format. No intermediate compat layer. Saves ~1 day of v2-F scope.

---

## 8. Phased rollout (~18 working days, 3.5-4 weeks)

| Phase    | Scope                                                                                                 | Days |
| -------- | ----------------------------------------------------------------------------------------------------- | ---- |
| **v2-A** | Vault scaffolding expansion (new folders, `POST /vault/write` route)                                  | 2    |
| **v2-B** | Reconciler rebuild (Memgraph schema + YAML + wikilink parser + Leiden)                                | 3    |
| **v2-C** | New `/graph/*` + `/lint-report` routes (8-category Cypher + Leiden on-demand/hourly)                  | 2    |
| **v2-D** | 8 new/rewritten skills + `codi-brain-capture` rule rewrite + 7 frontmatter templates + 4 CSS callouts | 4    |
| **v2-E** | Hook expansion (PostCompact NEW, upgraded Stop/PostToolUse, subagent orchestrator)                    | 2    |
| **v2-F** | `codi brain wipe-vault` + wiki scaffold skill                                                         | 1    |
| **v2-G** | Multi-agent parity (Cursor/Codex/Gemini CLI/Windsurf/Copilot symlinks)                                | 2    |
| **v2-H** | Docs + E2E tests + handoff report                                                                     | 2    |

Ship order: A → B → C (brain-side done) → D → E → F → G → H (client + integration).

---

## 9. Out of scope (explicit YAGNI list)

These are not in v2 launch; deferred to v2.1 or later:

1. **Defuddle integration** (article-body cleaning before ingest).
2. **Autoresearch skill** (3-round web research).
3. **Canvas skill** (Obsidian JSON Canvas files).
4. **obsidian-bases skill** (Obsidian 2025 `.base` YAML).
5. **Multi-mode vaults** (Research / Code / Learning modes). Single "Code Knowledge" mode at launch (Q5c lock).
6. **Chunk-level embeddings** (per-paragraph). Page-level only.
7. **Cross-project vault sharing** (other projects' CLAUDE.md pointing at this vault's `hot.md`).
8. **Web UI** (Obsidian remains the read-side UI; CLI remains the write-side UI).
9. **Defuddle/Whisper/yt-dlp ingestion** (video/audio/tweet sources).

---

## 10. Ship criterion

v2 is shipped when:

1. `pnpm test` green on the Codi CLI repo, including:
   - Unit tests for all 8 skills + rewritten rule + 7 frontmatter templates.
   - Unit tests for brain-client orchestrator (manifest aggregate + entity dedup).
   - E2E test: full 11-step ingest loop against a live brain with a sample source document, verifying all 4 global files updated + graph built correctly + lint clean.
2. Brain-side Python test suite (codi-brain repo) green, including:
   - Reconciler parses frontmatter + body wikilinks into Memgraph correctly.
   - 8-lint Cypher queries each have a test case with seeded violating data.
   - Leiden community detection on a seeded graph matches expected partitions.
3. `codi brain wipe-vault --confirm` followed by `codi brain wiki` (scaffold) + one ingest cycle produces a vault whose Obsidian graph view shows **connected** components (not disconnected islands — the fix for the problem that triggered v2).
4. Handoff report at `docs/YYYYMMDD_HHMMSS_[REPORT]_codi-brain-v2-progress.md` lists all 8 phases + commit map + test count delta + deviations.
5. User sign-off on the Obsidian graph view showing meaningful inter-page connectivity.

---

## 11. References

- Checkpoint: `docs/20260424_144908_[PLAN]_codi-brain-v2-brainstorm-checkpoint.md` (§3 graphify findings, §4 claude-obsidian findings)
- Week 2B handoff: `docs/20260423_212728_[REPORT]_codi-brain-phase-1-week-2b-progress.md`
- Week 2A design: `docs/20260423_115429_[PLAN]_codi-brain-phase-1-week-2a-design.md`
- Reference project 1 (graphify): `/Users/laht/projects/graphify/graphify/skill.md` (1327 lines — pipeline contract)
- Reference project 2 (claude-obsidian): `/Users/laht/projects/claude-obsidian/skills/wiki-ingest/SKILL.md` (11-step loop)
- Reference (claude-obsidian vault arch): `/Users/laht/projects/claude-obsidian/skills/wiki/SKILL.md`
- Reference (claude-obsidian frontmatter): `/Users/laht/projects/claude-obsidian/skills/wiki/references/frontmatter.md`
- Reference (claude-obsidian hooks): `/Users/laht/projects/claude-obsidian/hooks/hooks.json`
- Reference (claude-obsidian callouts): `/Users/laht/projects/claude-obsidian/.obsidian/snippets/vault-colors.css`
- Reference (claude-obsidian multi-agent installer): `/Users/laht/projects/claude-obsidian/bin/setup-multi-agent.sh`

---

## 12. Resolved decisions (from brainstorm)

| #   | Question                           | Decision                                                                |
| --- | ---------------------------------- | ----------------------------------------------------------------------- |
| Q1  | Scope ambition                     | (c) Full merge — claude-obsidian + graphify + our infra                 |
| Q2  | Subagent orchestration             | (iii) Hybrid — source-centric w/ entity-page delegation to orchestrator |
| Q3  | Confidence tag storage             | (ii) YAML frontmatter `links:` section                                  |
| Q4  | Migration of 87 existing decisions | Wipe clean                                                              |
| Q5a | Lint location                      | Brain-side Python (Cypher queries)                                      |
| Q5b | Leiden cadence                     | On-demand + hourly scheduled                                            |
| Q5c | Vault modes at launch              | Single "Code Knowledge" mode                                            |
