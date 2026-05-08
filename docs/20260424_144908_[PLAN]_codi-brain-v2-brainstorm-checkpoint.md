# Codi Brain v2 — Brainstorm Checkpoint

- **Date**: 2026-04-24 14:49
- **Document**: 20260424*144908*[PLAN]\_codi-brain-v2-brainstorm-checkpoint.md
- **Category**: PLAN
- **Status**: IN PROGRESS — brainstorming skill active, spec not yet written

> **Purpose of this document:** pre-compact snapshot of an active codi-brainstorming session. Contains every decision locked so far, every research finding from the two parallel reference-project reads, the unified architecture sketch, and the exact resume point. After `/compact` this file is the source of truth for continuing the design without losing context.

---

## 1. Where we are in the codi workflow

```
codi-brainstorming  ← WE ARE HERE (4.5 of 5 questions answered)
   ↓
codi-plan-writer    (produces [PLAN]-v2-impl.md with atomic TDD tasks)
   ↓
codi-plan-execution (INLINE or SUBAGENT mode)
   ↓
codi-branch-finish  (PR + merge)
```

**Next action after compact:** confirm defaults for Q5 (lint location, Leiden cadence, vault modes), then write the formal design spec at `docs/YYYYMMDD_HHMMSS_[PLAN]_codi-brain-v2-design.md`, dispatch the spec-reviewer subagent, present to user for approval, then invoke `codi-plan-writer`.

---

## 2. Context summary — what prompted this

Week 2B shipped successfully (`0a970b8a` + `15c269a9` on branch `feature/hub-update-in-normal-menu`): brain-client library, 6 skills, 1 rule, 3 Claude Code hooks (SessionStart + Stop L1+L3 + PostToolUse), claude-code adapter wiring. Full suite 2476 passed + 1 skipped. Validated with real Gemini API + live brain.

User opened Obsidian and saw the vault's global graph view as disconnected islands (87 decision nodes with zero inter-node edges). Asked why nothing was connected. We explained: Python's `rebuild_index()` generates only a flat `index.md` hub; decisions never link to each other.

User then asked us to deeply inspect two reference projects and propose a merged design:

- `/Users/laht/projects/graphify`
- `/Users/laht/projects/claude-obsidian`

Two parallel subagent deep-reads produced comprehensive feature inventories (preserved below in §3 and §4). From those, we drafted a unified v2 architecture (§5) and started codi-brainstorming (§6).

---

## 3. graphify deep-read summary (reference project #1)

**What it is:** an AI coding assistant skill (`/graphify` in Claude Code, Codex, Cursor, Gemini CLI, etc.) that reads a folder of files and builds an interactive knowledge graph. Output: `graph.html`, `graph.json`, `GRAPH_REPORT.md`. Python package `graphifyy` on PyPI.

### 3.1 Directory layout + purpose

```
graphify/
  __main__.py       1375 LOC   CLI dispatch, installers
  detect.py          510 LOC   file discovery, .graphifyignore walker, manifest
  extract.py        3302 LOC   tree-sitter AST extractors for 21 languages
  ingest.py          297 LOC   URL/tweet/arxiv/pdf/image/youtube/webpage fetchers
  build.py           107 LOC   NetworkX graph assembly + ID-normalization remap
  cluster.py         137 LOC   Leiden (graspologic) → Louvain fallback
  analyze.py         540 LOC   god_nodes, surprising_connections, suggest_questions
  report.py          181 LOC   GRAPH_REPORT.md renderer
  export.py         1014 LOC   to_json, to_html (vis.js), to_obsidian, to_svg, to_graphml, to_cypher
  cache.py           178 LOC   SHA256 per-file cache
  validate.py         72 LOC   schema validation
  watch.py           225 LOC   watchdog live rebuild
  transcribe.py      182 LOC   Whisper + yt-dlp
  wiki.py            227 LOC   agent-crawlable markdown wiki
  serve.py           373 LOC   stdio MCP server: query_graph, get_node, shortest_path, god_nodes
  security.py        205 LOC   URL/path/label validators
  skill.md          1327 LOC   Claude-Code skill prompt (source of truth for pipeline)
  skill-*.md                   12 per-agent variants (codex, copilot, aider, droid, etc.)
```

### 3.2 Three-pass pipeline (orchestrated by skill.md, not Python)

```
detect → [Pass A: AST extract || Pass B: semantic subagents] → Pass C: merge
      → build → cluster → analyze → report → export
```

- **Pass A (AST, deterministic):** tree-sitter parse → emits structural nodes + `imports/contains/calls/extends/implements` edges. Call-graph edges tagged `INFERRED` (name resolution is best-effort).
- **Pass B (semantic, LLM):** Claude subagents run in parallel. Each chunk of 20-25 files becomes one subagent. Grouped by same-directory to maximize cross-file edge extraction. Images get isolated chunks.
- **Pass C (merge):** `_normalize_id` reconciles LLM-generated IDs against AST IDs. Semantic nodes overwrite AST on conflicts; AST precision wins for structural, LLM enrichment wins for the rest.

### 3.3 Confidence model (THE KEY INSIGHT we're adopting)

Every edge carries two trust dimensions:

```
{
  "confidence": "EXTRACTED" | "INFERRED" | "AMBIGUOUS",
  "confidence_score": 0.0..1.0
}
```

Hard rules from graphify's skill.md:302-308:

- `EXTRACTED` → score always `1.0`
- `INFERRED` → score per-edge: strong 0.8-0.9, reasonable 0.6-0.7, weak 0.4-0.5
- `AMBIGUOUS` → score `0.1-0.3`
- **`0.5` is banned as a lazy default** — if tempted to pick 0.5, user is actually unsure which tier, so pick AMBIGUOUS

### 3.4 Edge relation vocabulary

- AST-deterministic: `imports`, `imports_from`, `contains`, `calls`, `extends`, `implements`, `listens`, `binds`, `uses_static_prop`
- Skill-declared: `calls, implements, references, cites, conceptually_related_to, shares_data_with, semantically_similar_to, rationale_for`
- Hyperedges (≥3 nodes): `participate_in, implement, form`

### 3.5 Key patterns worth stealing

1. **Two-dimensional confidence** (tier × numeric score) — categorical for filtering, numeric for ranking. Ban on 0.5 lazy default.
2. **Parallel subagent dispatch via single-message Agent block** — serializing them defeats parallelism.
3. **God-nodes filter** — excludes file-stub synthetic nodes (ends `()` with degree ≤1) so top-degree lists show real abstractions.
4. **ID normalization as reconciliation layer** — don't force LLM to match AST format, normalize both sides and re-map edges.
5. **Markdown body-only hashing for cache invalidation** — frontmatter edits don't bust cache.
6. **Leiden on graph topology (no embeddings)** — community detection works on edge density alone; the semantic edges LLM extracted already encode similarity.
7. **AMBIGUOUS tier as soft gate** — ambiguous edges enter graph but are surfaced in report for human review. Never invent an edge; when unsure, tag AMBIGUOUS.
8. **Hyperedges as convex hulls in vis.js** — show group relationships without N² pairwise edges.

### 3.6 Extraction schema (verbatim from skill.md:312-313)

```json
{
  "nodes": [
    {
      "id": "...",
      "label": "...",
      "file_type": "code|document|paper|image|rationale",
      "source_file": "...",
      "source_location": null,
      "source_url": null,
      "captured_at": null,
      "author": null,
      "contributor": null
    }
  ],
  "edges": [
    {
      "source": "...",
      "target": "...",
      "relation": "calls|implements|references|cites|conceptually_related_to|shares_data_with|semantically_similar_to|rationale_for",
      "confidence": "EXTRACTED|INFERRED|AMBIGUOUS",
      "confidence_score": 1.0,
      "source_file": "...",
      "source_location": null,
      "weight": 1.0
    }
  ],
  "hyperedges": [
    {
      "id": "...",
      "label": "...",
      "nodes": ["..."],
      "relation": "participate_in|implement|form",
      "confidence": "EXTRACTED|INFERRED",
      "confidence_score": 0.75
    }
  ]
}
```

---

## 4. claude-obsidian deep-read summary (reference project #2)

**What it is:** Claude Code plugin (v1.4.3) that turns an Obsidian vault into an LLM-maintained wiki. Based on Karpathy's LLM Wiki pattern. Tagline: "Persistent, compounding wiki vault." The coding agent reads sources and WRITES every wikilink; zero deterministic indexing.

### 4.1 Directory layout + artifacts

```
claude-obsidian/
  .claude-plugin/          plugin.json + marketplace.json
  .cursor/rules/ .windsurf/rules/ .github/copilot-instructions.md
  .obsidian/snippets/      vault-colors.css (4 custom callouts + folder colors)
  .raw/                    immutable source documents
  _templates/              comparison.md, concept.md, entity.md, question.md, source.md
  agents/                  wiki-ingest.md, wiki-lint.md (subagent defs, Sonnet)
  bin/                     setup-multi-agent.sh, setup-vault.sh
  commands/                autoresearch.md, canvas.md, save.md, wiki.md
  docs/                    install-guide.md
  hooks/                   hooks.json (4 events), README.md
  skills/
    wiki/                  SKILL.md + references/{css-snippets,frontmatter,git-setup,mcp-setup,modes,plugins,rest-api}.md
    wiki-ingest/           SKILL.md
    wiki-query/            SKILL.md
    wiki-lint/             SKILL.md
    save/                  SKILL.md
    autoresearch/          SKILL.md + references/program.md
    canvas/                SKILL.md + references/canvas-spec.md
    defuddle/              SKILL.md
    obsidian-bases/        SKILL.md
    obsidian-markdown/     SKILL.md
  wiki/                    the demo vault
  AGENTS.md GEMINI.md CLAUDE.md ATTRIBUTION.md README.md WIKI.md
```

### 4.2 Three-layer vault architecture

- **`.raw/`** — immutable source documents. Dot-prefix hides from Obsidian explorer/graph.
- **`wiki/`** — agent-generated knowledge base.
- **`CLAUDE.md`** — schema + instructions (the plugin itself).

### 4.3 Standard vault structure

| Path                | Purpose                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `wiki/index.md`     | Master catalog. Sections: Domains / Entities / Concepts / Sources / Questions / Comparisons             |
| `wiki/log.md`       | Chronological op log. Append-only. **New entries at TOP.** Format: `## [YYYY-MM-DD] operation \| Title` |
| `wiki/hot.md`       | Hot cache. ~500-word recent context. **Overwritten each update.**                                       |
| `wiki/overview.md`  | Executive summary of whole wiki                                                                         |
| `wiki/sources/`     | One summary page per raw source                                                                         |
| `wiki/entities/`    | People, orgs, products, repos                                                                           |
| `wiki/concepts/`    | Ideas, patterns, frameworks                                                                             |
| `wiki/domains/`     | Top-level topic areas                                                                                   |
| `wiki/comparisons/` | Side-by-side analyses                                                                                   |
| `wiki/questions/`   | Filed answers to user queries                                                                           |
| `wiki/meta/`        | Dashboards, lint reports, canvas maps, `.base` files                                                    |

`_index.md` files inside `entities/`, `concepts/`, `sources/` as scoped sub-indexes for query-skill drill-in.

### 4.4 The 10 skills

| Skill               | Triggers                                                          | Tools                          | I/O                                                                    |
| ------------------- | ----------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `wiki`              | `/wiki`, "set up wiki", "scaffold vault"                          | Read Write Edit Glob Grep Bash | Scaffolds vault (10 steps); maintains hot cache                        |
| `wiki-ingest`       | "ingest", "process this source", "batch ingest"                   | + WebFetch                     | One source → 8-15 wiki pages                                           |
| `wiki-query`        | "what do you know about", "query:", "query quick:", "query deep:" | Read Glob Grep (read-only)     | hot → index → pages; files good answers back                           |
| `wiki-lint`         | "lint", "health check", "find orphans", "wiki audit"              | Read Write Edit Glob Grep      | 8-category health check; outputs `wiki/meta/lint-report-YYYY-MM-DD.md` |
| `save`              | `/save`, "save this", "file this conversation"                    | Read Write Edit Glob Grep      | Conversation → new wiki page                                           |
| `autoresearch`      | `/autoresearch`, "research [topic]"                               | + WebFetch + WebSearch         | 3-round: broad → gap-fill → synthesis                                  |
| `canvas`            | `/canvas`, "add to canvas"                                        | Read Write Edit Glob Grep      | JSON Canvas files, auto-positions                                      |
| `defuddle`          | "clean this url", "strip ads"                                     | Read Bash                      | Shells out to defuddle-cli; saves 40-60% tokens                        |
| `obsidian-bases`    | "create a base", ".base file"                                     | Read Write                     | Reference + writer for `.base` YAML (Obsidian 2025)                    |
| `obsidian-markdown` | "wikilink", "callout", "obsidian syntax"                          | Read Write Edit                | Pure syntax reference                                                  |

### 4.5 The ingest loop (11 steps — THE CORE PATTERN)

From `skills/wiki-ingest/SKILL.md`:

**Delta tracking** (`:16-48`): md5/sha256 of `.raw/` file vs `.raw/.manifest.json`. Skip if hash matches. After ingest: record `{hash, ingested_at, pages_created, pages_updated}`.

**URL ingest** (`:52-68`): WebFetch → optional `defuddle [url]` → slug from URL path → `.raw/articles/[slug]-YYYY-MM-DD.md` with `source_url` + `fetched` frontmatter → continue with single-source flow.

**Image/vision ingest** (`:72-94`): Read natively, OCR + describe, save to `.raw/images/[slug]-YYYY-MM-DD.md` with `source_type: image`, copy image to `_attachments/images/`.

**Single source ingest — 11 steps** (`:102-123`):

1. Read source completely (no skimming).
2. Discuss takeaways with user ("What to emphasize? How granular?"); skip on "just ingest it".
3. Create source summary in `wiki/sources/`.
4. Create/update entity pages for every person/org/product/repo.
5. Create/update concept pages for significant ideas.
6. Update `wiki/domains/*` + their `_index.md` sub-indexes.
7. Update `wiki/overview.md` if big picture changed.
8. Update `wiki/index.md` with all new pages.
9. Update `wiki/hot.md`.
10. Append entry at TOP of `wiki/log.md`: `## [YYYY-MM-DD] ingest | Title` + Source + Summary wikilink + Pages created + Pages updated + Key insight.
11. Check contradictions; add `> [!contradiction]` callouts on BOTH sides.

**Batch ingest** (`:127-138`): confirm list, process each deferring cross-refs, cross-ref pass after, update index/hot/log once at end. Check in every 10 sources.

### 4.6 Frontmatter schemas (universal + per-type)

Universal fields: `type, title, created, updated, tags, status, related, sources`. `status` enum: `seed|developing|mature|evergreen`.

Type-specific:

- **source**: `source_type` (article|video|podcast|paper|book|transcript|data), `author`, `date_published`, `url`, `confidence` (high|medium|low), `key_claims`
- **entity**: `entity_type` (person|organization|product|repository|place), `role`, `first_mentioned`
- **concept**: `complexity` (basic|intermediate|advanced), `domain`, `aliases`
- **comparison**: `subjects[]`, `dimensions[]`, `verdict`
- **question**: `question`, `answer_quality` (draft|solid|definitive)
- **domain**: `subdomain_of`, `page_count`

### 4.7 Hot cache pattern (wiki/hot.md)

```markdown
---
type: meta
title: "Hot Cache"
updated: YYYY-MM-DDTHH:MM:SS
---

# Recent Context

## Last Updated (YYYY-MM-DD + one-line "what happened")

## Key Recent Facts (bulleted top takeaways)

## Recent Changes (Created / Updated / Flagged lists — all wikilinks)

## Active Threads ("User is currently researching...", "Open question...")
```

- Target: ~500 words / ~500 tokens
- **Overwrite completely** each update (never append)
- Updated: after every ingest, significant query, session end
- Cross-project reach: CLAUDE.md in other projects can instruct "read this vault's hot.md first"

### 4.8 Query skill (three depths)

- **Quick** (hot + index only, ~1500 tokens): fast facts
- **Standard** (hot + index + 3-5 pages, ~3000): default answering
- **Deep** (full wiki + optional web, ~8000+): research

Standard workflow: read hot.md → read index.md → read 3-5 matched pages → follow wikilinks depth-2 → synthesize with `(Source: [[Page]])` citations → offer to file answer as `wiki/questions/*.md` → if gap detected, say so and offer to source it.

**No vector search.** Wiki graph IS the index. Filename uniqueness is addressing. Glob/Grep only.

### 4.9 Lint skill (8 categories)

1. **Orphan pages** — no inbound wikilinks
2. **Dead links** — wikilink → nonexistent file
3. **Stale claims** — assertions contradicted by newer sources
4. **Missing pages** — concepts/entities mentioned in 2+ pages, no own page
5. **Missing cross-references** — entity names appearing without `[[]]`
6. **Frontmatter gaps** — missing `type/status/created/updated/tags`
7. **Empty sections** — heading with no body
8. **Stale index entries** — index.md pointing at renamed/deleted pages

Output: `wiki/meta/lint-report-YYYY-MM-DD.md` with sections Summary / Orphans / Dead Links / Missing Pages / Frontmatter Gaps / Stale Claims / Cross-Ref Gaps.

### 4.10 Four hooks (`hooks/hooks.json`)

1. **SessionStart** (matcher `startup|resume`): `cat wiki/hot.md` + prompt hook saying "silently read wiki/hot.md"
2. **PostCompact**: re-inject hot.md because hook-injected context doesn't survive compaction
3. **PostToolUse Write|Edit**: `git add wiki/ .raw/ && git commit -m "wiki: auto-commit $(date)"`
4. **Stop**: checks for wiki/ changes since HEAD; if yes, emits `WIKI_CHANGED:` instruction telling Claude to regenerate hot.md

### 4.11 Four custom callouts (`.obsidian/snippets/vault-colors.css`)

| Callout         | Color         | Icon           | Semantic                          |
| --------------- | ------------- | -------------- | --------------------------------- |
| `contradiction` | reddish-brown | alert-triangle | Resolvable conflict between pages |
| `gap`           | beige         | help-circle    | Topic has no source (actionable)  |
| `key-insight`   | bright blue   | lightbulb      | The most important takeaway       |
| `stale`         | gray          | clock          | Time-based decay of a claim       |

### 4.12 Multi-agent support

Per-agent bootstrap files at repo root: `CLAUDE.md`, `AGENTS.md` (Codex/OpenCode), `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, `.windsurf/rules/*.md`. `bin/setup-multi-agent.sh` symlinks `skills/` into `~/.codex/skills/`, `~/.opencode/skills/`, `~/.gemini/skills/`, etc.

Skill frontmatter uses only `name` + `description` (cross-platform Agent Skills format).

### 4.13 Agent-vault contract

- **Immutability**: `.raw/` is read-only. Any modification is a bug.
- **Addressing**: filename uniqueness across vault. Wikilinks resolve by basename.
- **Every page has YAML frontmatter**: flat, `type|title|created|updated|tags|status|related|sources` minimum.
- **Every write touches four places**: the page + `index.md` + `log.md` + `hot.md`.
- **Logs append-only at TOP**; hot cache overwrite-only.
- **Citations**: every non-obvious claim cites `(Source: [[Page]])`. Wiki > training data.
- **Contradictions flagged, never resolved silently**.
- **Gaps acknowledged, never fabricated over**.

---

## 5. Unified v2 architecture (the merge)

**Core principle:** _Coding agent is the author; brain is the reconciler + indexer + query engine. Filesystem is source of truth; Memgraph + Qdrant are derived indexes with graph-theoretic properties the agent can't compute alone._

### 5.1 Three layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3 — Query + derived views (brain-side, Python)        │
│   GET /notes/search (hybrid vector + tag + wikilink graph)  │
│   GET /hot, GET /graph/communities, GET /lint-report        │
│   GET /god-nodes, GET /contradictions                       │
│   GET /graph/shortest-path?from=<slug>&to=<slug>            │
└─────────────────────────────────────────────────────────────┘
                            ↑ reads from
┌─────────────────────────────────────────────────────────────┐
│ Layer 2 — Indexes (brain-side, Python)                      │
│   Memgraph: nodes (source/entity/concept/domain/…),         │
│             edges (wikilinks with confidence tags)          │
│   Qdrant:   per-page embeddings for semantic search         │
│   Leiden:   community detection on scheduled reconcile      │
└─────────────────────────────────────────────────────────────┘
                            ↑ reconciles from
┌─────────────────────────────────────────────────────────────┐
│ Layer 1 — Vault (agent-authored, filesystem as truth)       │
│   .raw/          immutable source documents                 │
│   wiki/                                                     │
│     index.md, log.md, hot.md, overview.md                   │
│     sources/     summary per raw source                     │
│     entities/    people, orgs, products, repos              │
│     concepts/    ideas, patterns, frameworks                │
│     domains/     top-level topic areas                      │
│     comparisons/ side-by-side analyses                      │
│     questions/   filed answers                              │
│     decisions/   ephemeral session decisions                │
│     meta/        lint reports + dataview dashboards         │
│   CLAUDE.md      schema + instructions                      │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Memgraph schema (new)

```cypher
(:Page {
  slug: "gemini-2-5-flash",
  type: "entity" | "concept" | "source" | "domain" | "decision" | "comparison" | "question",
  vault_path: "entities/gemini-2-5-flash.md",
  status: "seed" | "developing" | "mature" | "evergreen",
  created, updated, content_hash
})

-[:LINKS_TO {
  confidence: "EXTRACTED" | "INFERRED" | "AMBIGUOUS",
  confidence_score: 0.0..1.0,
  relation: "cites" | "references" | "contradicts" |
            "conceptually_related_to" | "semantically_similar_to" |
            "rationale_for" | "supersedes" | "part_of" | ...,
  reason: "free-text from agent if provided",
  source_location: "paragraph index or heading"
}]-> (:Page)
```

### 5.3 What changes vs Week 2B

**Brain-side (codi-brain repo):**

1. `POST /notes` → `POST /vault/write` (upsert semantics). Accept arbitrary `vault_path` + `frontmatter` + `body`.
2. `rebuild_index` RETIRED. Agent owns `index.md`, `hot.md`, `log.md`, `overview.md`.
3. Reconciler parses YAML frontmatter + body wikilinks into Memgraph with confidence tags.
4. Reconciler runs 8-category lint as Cypher queries; writes to `wiki/meta/lint-report-YYYY-MM-DD.md` on demand.
5. New routes: `GET /graph/communities`, `/graph/god-nodes`, `/graph/contradictions`, `/graph/shortest-path`, `/lint-report`.
6. Qdrant gets per-page embeddings keyed by `vault_path`.
7. Leiden community detection runs on demand + hourly scheduled.

**Client-side (codi repo):** 8. 7 skills: `codi-brain-wiki` (scaffold), `codi-brain-ingest` (source → 8-15 pages), `codi-brain-query` (tiered read), `codi-brain-lint` (wraps `/lint-report`), `codi-brain-save` (session end), `codi-brain-decide` (narrow shortcut kept for quick captures), `codi-brain-autoresearch` (3-round web research). 9. 1 rule: `codi-brain-capture` rewritten as orchestrating meta-rule. 10. 6 frontmatter templates (one per page type). 11. 4 custom CSS callouts copied from claude-obsidian. 12. 4 hooks: SessionStart (upgraded), PostCompact (NEW), Stop (upgraded), PostToolUse Write|Edit (upgraded with auto-commit). 13. Subagent orchestration for batch ingest (hybrid pattern, see §6.2). 14. Multi-agent symlinks via new `bin/setup-multi-agent.sh`.

### 5.4 What dies in v2

- `rebuild_index.py` (demoted to backwards-compat fallback)
- Week 2B's flat `codi-brain-decide/recall/hot-get/hot-set` one-shots (folded into unified `codi-brain-ingest` + `codi-brain-query`)
- Week 2B's L3 Gemini Stop-hook extraction as primary path (becomes opt-in lint helper)
- Hot-as-singleton-note (replaced with overwrite-only structured `wiki/hot.md`)

### 5.5 What stays from Week 2B

- Memgraph + Qdrant infrastructure
- VaultWriteContext 6-step atomic commit (still wraps writes)
- RW-lock concurrency primitive
- PushRetryQueue + outbox
- Filesystem watcher with debounce
- Redaction patterns + evidence-verification extractor (becomes opt-in lint helper)
- `codi-brain-client` TS library

### 5.6 Migration from Week 2B

**Clean slate.** User confirmed the 87 existing decisions are validation artifacts. `codi brain wipe-vault --confirm` drops them all; v2 starts empty. No migration tooling required.

### 5.7 Effort estimate

~18 working days / 3.5-4 weeks across 8 phases:

| Phase | Scope                                                                          | Days |
| ----- | ------------------------------------------------------------------------------ | ---- |
| v2-A  | Vault scaffolding expansion (new folders, `/vault/write`)                      | 2    |
| v2-B  | Reconciler rebuild (Memgraph schema + YAML+wikilink parser + Leiden)           | 3    |
| v2-C  | New `/graph/*` + `/lint-report` routes (8-category Cypher)                     | 2    |
| v2-D  | New skills + rule rewrite + frontmatter templates                              | 4    |
| v2-E  | Hook expansion (PostCompact, upgraded Stop/PostToolUse, subagent orchestrator) | 2    |
| v2-F  | `codi brain wipe-vault` + `migrate-v1-to-v2` (dry-run + apply)                 | 1    |
| v2-G  | Multi-agent parity (Cursor/Codex/Gemini CLI/Windsurf/Copilot symlinks)         | 2    |
| v2-H  | Docs + E2E tests + handoff report                                              | 2    |

---

## 6. Decisions LOCKED during brainstorming

### 6.1 Q1 — Scope ambition ✅ LOCKED: **(c) Full merge**

All of claude-obsidian + graphify rigor + our infrastructure. 3.5-4 week impl scope.

### 6.2 Q2 — Subagent orchestration ✅ LOCKED: **(iii) Hybrid — source-centric with entity-page delegation**

- One subagent per source for sources/concepts/decisions (claude-obsidian style).
- Entity pages written ONCE by orchestrator after collecting all entity-mentions from all subagents.
- Subagents emit JSON manifests (`.codi/ingest-manifests/<session-id>/<source-slug>.json`) listing "entities mentioned + references to sources".
- Orchestrator authors `entities/<Name>.md` deterministically from manifests — clean cross-source dedup, no merge conflicts.
- Manifest doubles as audit trail.

### 6.3 Q3 — Confidence tag storage ✅ LOCKED: **(ii) YAML frontmatter `links:` section**

```yaml
---
title: "Switch extractor to Gemini 2.5 Flash"
type: concept
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

- Body uses plain `[[wikilinks]]`; frontmatter carries metadata.
- Obsidian 1.4+ renders frontmatter as Properties panel.
- Reconciler pairs entries by target name; flags drift as lint warning.
- Unannotated plain links default to `EXTRACTED:1.0`.

### 6.4 Q4 — Migration of existing 87 decisions ✅ LOCKED: **Wipe clean**

Per user: "that is dummy test data, we can delete that". v2 launches on empty vault. Saves ~1 day of migration tooling.

### 6.5 Q5 — Three smaller defaults ⏳ PENDING (resume point)

Presented recommendations; awaiting user confirmation on:

**5a. Lint location:** brain-side Python (Cypher queries against Memgraph) — RECOMMENDED
**5b. Leiden cadence:** on-demand + hourly scheduled (not per-write) — RECOMMENDED
**5c. Vault modes at launch:** single "Code Knowledge" mode; defer multi-mode to v2.1 — RECOMMENDED

**Resume here after compact:** ask user to confirm/change these three; when confirmed, proceed to spec writing.

---

## 7. Session handoff — how to resume after compact

```bash
cd ~/projects/codi
git log --oneline | head -3     # expect 15c269a9 or later on feature/hub-update-in-normal-menu
git status --short              # expect clean (+ docs/obsidia.md + docs/test.md untracked, intentional)
pnpm test 2>&1 | tail -3        # expect 2476 passed, 1 skipped
```

**Resume script:**

1. Read this checkpoint file fully: `docs/20260424_144908_[PLAN]_codi-brain-v2-brainstorm-checkpoint.md`
2. Announce you are continuing codi-brainstorming for "Codi Brain v2".
3. Ask the user: "Before compact we paused on Q5. My recommendations were: 5a) lint brain-side, 5b) Leiden on-demand+hourly, 5c) single Code Knowledge mode at launch. Confirm these or adjust?"
4. On confirmation, write the formal design spec at `docs/YYYYMMDD_HHMMSS_[PLAN]_codi-brain-v2-design.md` using §5 as the architecture skeleton + §6 as the resolved decisions.
5. Dispatch the spec-reviewer subagent per codi-brainstorming skill's process.
6. Fix findings inline.
7. Present to user for final approval.
8. On approval, invoke `codi-plan-writer`.

**Design spec structure to follow:**

- §1 Goal + architecture
- §2 Three-layer model (from §5.1)
- §3 Component inventory (vault layout, Memgraph schema, Qdrant schema, routes, skills, rule, hooks, CLI)
- §4 Data flow (ingest / query / reconcile / lint)
- §5 Concurrency + error handling
- §6 Confidence model (from §3.3 + §5.2 + §6.3)
- §7 Migration story (wipe-clean, §6.4)
- §8 Phased rollout (from §5.7)
- §9 Out of scope (explicit YAGNI list)
- §10 Ship criterion
- §11 References (§3 + §4 of this checkpoint)

**Things that MUST appear in the spec:**

- The `.raw/` immutable layer contract (read-only, agent-never-writes).
- The subagent contract: "per-source writes OK, global-file writes FORBIDDEN".
- Manifest format (`.codi/ingest-manifests/<session-id>/<source-slug>.json`) — TypeScript type + example.
- Frontmatter schemas for all 7 page types (source/entity/concept/domain/decision/comparison/question).
- Confidence rubric from §3.3 (especially the ban on 0.5).
- Lint's 8 categories as Cypher queries.
- Hot.md template from §4.7.
- Log.md append-at-TOP rule.
- Dual-callout contradiction protocol from §4.5 step 11.
- The 4 custom CSS callouts from §4.11.
- Claude Code hook registration for all 4 events (SessionStart matcher `startup|resume`, PostCompact, Stop, PostToolUse Write|Edit).
- Multi-agent symlink installer (from §4.12).

---

## 8. Critical open implementation questions (for plan-writer phase, not brainstorm)

These aren't blockers for the design spec — capture them for the impl plan to resolve:

1. **Reconciler atomicity**: when the agent writes 10 files during an ingest, should we defer Memgraph reconciliation until the agent signals "done", or reconcile on every debounced filesystem change? Latter is simpler but causes intermediate inconsistent graph states.

2. **Orphan handling**: when agent deletes a page, reconciler detects dead inbound links. Does lint auto-fix (create stub or remove links), or just flag?

3. **Qdrant collection sizing**: page embeddings at 1536 dims × (expected 500-2000 pages after a few weeks of use) is fine. But chunk-level embeddings (if we ever want "find me the paragraph about X") push it. Defer to v2.1.

4. **Hot.md session-id scoping**: single global hot.md vs per-agent-session hot state? claude-obsidian uses single global (overwritten each session). Week 2B had session-scoped `session_id`. Align with claude-obsidian's single global.

5. **Cross-project vault sharing**: claude-obsidian supports other projects' CLAUDE.md pointing at the vault's hot.md. Do we ship this pattern in v2 launch, or defer? Probably defer — single-vault-per-user is fine to start.

6. **Defuddle integration**: optional shelling out to `defuddle-cli` for article cleaning before ingest. Defer to v2.1.

7. **Autoresearch skill**: 3-round web research is nontrivial. Can slip from v2 to v2.1 without losing the core value proposition.

8. **Canvas skill**: JSON Canvas integration. Defer to v2.1 — not core value.

9. **obsidian-bases skill**: Obsidian's new `.base` YAML (2025 feature). Defer — not required for v2.

10. **Subagent model choice**: Sonnet (claude-obsidian uses Sonnet for subagents) or Haiku for sources, Opus for orchestrator? Claude Code skill frontmatter doesn't force a model; defer to user config.

---

## 9. Recent commits for context

```
15c269a9  test(e2e): real Gemini L3 validation (redact + extract + dedup)
1b13566a  test(e2e): Week 2B comprehensive validation (harness + redaction)
7410cb35  docs(brain): Week 2B handoff report + roadmap update (Week 2B shipped)
0a970b8a  feat(brain-client): Week 2B Phases B-tail through G
17dc2b5d  feat(redactor): redactTranscript with hit counts (privacy-safe)
26812e92  feat(redactor): extensible pattern list
ce345614  feat(brain-client): BrainClient factory with outbox fallback
```

Branch: `feature/hub-update-in-normal-menu`
Upstream: `github.com/lehidalgo/codi` (pushed)
Codi-brain branch: `main` at `ab3ce83` on `github.com/lehidalgo/codi-brain` (unchanged — v2 is mostly codi-client-side; brain-side changes come with v2-A/B/C phases)

---

## 10. Reference files in this repo to read when resuming

- This checkpoint: `docs/20260424_144908_[PLAN]_codi-brain-v2-brainstorm-checkpoint.md` (you are here)
- Week 2B design spec: `docs/20260423_192802_[PLAN]_codi-brain-phase-1-week-2b-design.md`
- Week 2B impl plan: `docs/20260423_200411_[PLAN]_codi-brain-phase-1-week-2b-impl.md`
- Week 2B handoff: `docs/20260423_212728_[REPORT]_codi-brain-phase-1-week-2b-progress.md`
- Roadmap: `docs/20260423_170000_[ROADMAP]_codi-brain-phase-1-next-phases.md`
- Week 2A design: `docs/20260423_115429_[PLAN]_codi-brain-phase-1-week-2a-design.md`
- Week 2A impl: `docs/20260423_120127_[PLAN]_codi-brain-phase-1-week-2a-impl.md`
- Reference: `/Users/laht/projects/graphify/graphify/skill.md` (1327 lines — the graphify pipeline contract)
- Reference: `/Users/laht/projects/claude-obsidian/skills/wiki-ingest/SKILL.md` (the 11-step ingest loop)
- Reference: `/Users/laht/projects/claude-obsidian/skills/wiki/SKILL.md` (vault architecture spec)
- Reference: `/Users/laht/projects/claude-obsidian/skills/wiki/references/frontmatter.md` (page type schemas)
- Reference: `/Users/laht/projects/claude-obsidian/hooks/hooks.json` (4-hook registration)
- Reference: `/Users/laht/projects/claude-obsidian/.obsidian/snippets/vault-colors.css` (4 callouts)
- Reference: `/Users/laht/projects/claude-obsidian/bin/setup-multi-agent.sh` (symlink installer)
