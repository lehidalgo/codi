# Codi Brain v2 — Project Specification Mode Design

- **Date**: 2026-04-30 23:26
- **Document**: 20260430*232636*[PLAN]\_codi-brain-v2-spec-mode-design.md
- **Category**: PLAN
- **Status**: APPROVED — locked decisions Q1-Q10 from grilling session 2026-04-30
- **Supersedes**: `docs/20260424_145740_[PLAN]_codi-brain-v2-design.md` (Code Knowledge mode)
- **Companion roadmap**: `docs/20260430_232636_[ROADMAP]_codi-brain-v2-spec-mode-rollout.md`
- **Predecessors**:
  - `docs/20260424_144908_[PLAN]_codi-brain-v2-brainstorm-checkpoint.md`
  - Phase 1 Week 2A handoff (last shipped state of codi-brain)
  - Documentation standard research: `~/projects/plan-ai/docs/20260430_211100_[RESEARCH]_documentation-standard.md`

---

## 0. Executive summary

Codi Brain v2 is the platform that converts software-agency stakeholder input (transcripts, docs, meeting notes) into a structured, graph-indexed, embedding-searchable specification, and links every spec artifact to the code that implements it. The system supports iterative stakeholder feedback through versioned `supersedes` chains and operates both online (against a shared VPS) and offline (per-developer Docker stack), with bidirectional Git sync.

The substrate (Memgraph + Qdrant + vault filesystem + reconciler + watcher) is shared across two designed modes: **Spec mode** ships in v2; **Code Knowledge mode** is designed but deferred to v2.x. Both modes coexist in the same codebase; only Spec mode is implemented Day 1.

---

## 1. Goal and scope (Q1)

### 1.1 Primary goal

Enable the agency to:

1. Ingest stakeholder input in any common format and convert it to a standardized set of artifacts (BusinessGoal, FunctionalRequirement, NonFunctionalRequirement, UserStory, ImplementationPlan).
2. Index every artifact as a node in a typed property graph alongside the project's source code (functions, classes, modules).
3. Generate end-to-end traceability: from any commit, navigate up to the user story and business goal that motivated it; from any business goal, navigate down to the code that implements it.
4. Survive iterative requirement changes: when a stakeholder revises a spec, the system creates a new version, links it via `supersedes` to the previous, and surfaces downstream artifacts (Plans, code) that may need re-evaluation.
5. Operate offline at developer-laptop level and sync via Git when network is available.

### 1.2 Out of scope (Q10)

Explicitly NOT in v2 scope. These are reserved for v2.x or v3:

- Code Knowledge mode (the original v2 design — Zettelkasten wiki for agent learnings).
- Multi-mode dynamic switching (a vault declares its mode statically at init).
- Cross-project queries (each project's brain instance is isolated).
- Web UI (Obsidian remains the read-side; CLI + Claude Code skills are the write-side).
- Bidirectional Jira sync (reference-only Day 1+; bidirectional is v2.x if business demand justifies).
- Whisper / yt-dlp / Defuddle ingestion of audio/video/web (Day 1+ only handles markitdown-supported formats).
- Mobile clients.
- Auto-coding (the agent is a consumer, not a system component).
- SaaS / multi-org billing.

---

## 2. Architecture overview

### 2.1 Three-layer model (inherited from prior v2 design)

```
Layer 3 — Query + derived views (brain-side, Python)
  /vault/write, /vault/validate, /notes/search, /graph/trace,
  /lint-report, /webhooks/github, /admin/tokens
            ↑ reads from
Layer 2 — Indexes (brain-side, derived from L1)
  Memgraph: typed property graph (Page nodes + LINKS_TO edges,
            Function/Class/Method/Module nodes from code-graph,
            Token nodes for auth, WebhookDelivery for idempotency)
  Qdrant:   per-page embeddings (note_embeddings collection)
            per-code-unit embeddings (code_embeddings collection)
            ↑ reconciles from
Layer 1 — Vault + code repos (filesystem-of-truth, agent-authored)
  vault/sources/, business-goals/, requirements/, nfrs/, stories/,
  plans/, .raw/, meta/
  vault/.codi/mode.yaml          declares the mode
  vault/.codi/active-plan        active plan tracking for hooks
  services/<n>/                  source code (per project)
```

**Strict ownership contract:**

- L1 vault + code = source of truth.
- L2 Memgraph + Qdrant = derived; if they desync, rebuild from L1. Never the reverse.
- L3 routes only read from L2; writes go through `POST /vault/write` which performs the 6-step atomic commit (Memgraph → embed → Qdrant → file → reconciler → git).

### 2.2 Two designed modes

| Mode               | Status                     | Page types                                                                                                                           | Skills                                                                                                       |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Spec**           | Day 1 ship                 | Source, BusinessGoal, FunctionalRequirement, NonFunctionalRequirement, UserStory, ImplementationPlan (+ Scenario, Constraint Day 1+) | `init`, `rawconvert`, `ingest`, `update`, `plan`, `query`, `lint` (+ `replan`, `scenario`, `promote` Day 1+) |
| **Code Knowledge** | Designed, deferred to v2.x | Source, Entity, Concept, Domain, Decision, Comparison, Question, Pattern (agency)                                                    | `ck-ingest`, `ck-decide`, `promote-to-agency`, etc.                                                          |

A vault declares its mode in `vault/.codi/mode.yaml` at init and the mode is static for the vault's lifetime.

---

## 3. Deployment topology (Q2 + Q3)

### 3.1 Hybrid model

- **Per-project brain instance** is the unit of deployment (option (a) of Q2). Each project of the agency runs its own codi-brain stack (Memgraph + Qdrant + brain-api in Docker Compose). No multi-tenant cross-project queries.
- **Agency-wide knowledge** lives in a separate vault repo (`_agency-vault.git`). Each developer's local instance mounts it as a second `VAULT_ROOT` for read-mostly access. Cross-project promotion is explicit (manual skill `codi-brain-promote`).
- **Offline-first overlay**: each developer can run a local Docker stack and operate without network. Sync to remote VPS happens via Git push when network is available.

### 3.2 Repository topology

Per project (during development):

```
~/codi/<project>/                  # MONOREPO of the project (1 git repo)
├── services/
│   ├── api/                       # backend
│   ├── web/                       # frontend
│   └── worker/                    # other services
├── vault/                         # Spec + per-project artifacts
│   ├── sources/                   # Source artifacts (derived summaries)
│   ├── business-goals/
│   ├── requirements/              # FunctionalRequirements
│   ├── nfrs/                      # NonFunctionalRequirements
│   ├── stories/                   # UserStories
│   ├── plans/                     # ImplementationPlans
│   ├── meta/                      # lint-reports, link-log, etc.
│   ├── .raw/                      # immutable raw input + normalized/
│   └── .codi/
│       ├── mode.yaml              # ["spec"]
│       └── active-plan            # current plan_id for post-commit hook
├── docker-compose.yaml            # codi-brain local stack
├── .codi/                         # config
└── README.md
```

Agency-wide (separate repo, cloned once per developer):

```
~/codi/_agency-vault/              # SEPARATE git repo, agency-wide CK
├── patterns/
├── decisions/
├── glossary/
└── meta/
```

### 3.3 Production handover

Production split is a one-shot event at project handover, not part of the development flow. Per service that needs its own production repo: `git subtree split --prefix=services/<n> -b prod-<n>` and push to a new repo. The vault stays in the monorepo as historical archive or its reusable parts get promoted to `_agency-vault`.

### 3.4 Sync model

- **Git is the only sync substrate.** Memgraph and Qdrant state are NEVER synced directly between instances; they are rebuilt from the vault on each side.
- **Offline → online**: developer commits locally, pushes when network returns. VPS receives via webhook (Q9b), pulls, reconciler reindexes the VPS instance.
- **Conflicts**: standard git merge. UUID-based identity (Q4) means renames don't break edges. Slug collisions across branches resolve at file-level merge.

---

## 4. Identity and naming (Q4)

### 4.1 Hybrid scheme

Every artifact has two identifiers:

- **`id`** (UUIDv4 in frontmatter): canonical graph node key. Inmutable. Survives renames, reescritures, mode migrations.
- **`slug`** (kebab-case in filename + frontmatter): human-readable label. Used in wikilinks. Mutable under explicit rename only.

```yaml
---
id: 550e8400-e29b-41d4-a716-446655440000
slug: user-password-reset
type: FunctionalRequirement
title: "User can reset password via email"
---
```

### 4.2 Rules

- **Filename = `<slug>.md`.** Filename and `slug` field always in sync; renames in Obsidian → reconciler updates frontmatter; edits to frontmatter `slug` → reconciler renames the file.
- **Folder = `vault/<type-folder>/`** where the mapping `{type → folder}` is fixed (see §5).
- **Slug derivation**: at creation, slug is derived from title via `slugify_title()` (existing function in `vault/slugify.py`). After creation, slug is decoupled from title — title can change without touching slug.
- **Slug uniqueness**: unique within `(vault_origin, type)`. Collisions across vaults are allowed and intentional (project A's `auth` ≠ project B's `auth`).

### 4.3 Memgraph constraint

```cypher
CREATE CONSTRAINT ON (n:Page) ASSERT n.id IS UNIQUE
```

Slug is indexed but not constrained — uniqueness within `(vault_origin, type, slug)` is enforced by reconciler logic, not by the database.

### 4.4 Wikilink resolution

The reconciler resolves wikilinks at index time:

```
[[X]]                  → look up X by slug in current vault, any folder.
[[<type>/X]]           → look up X by slug in vault/<type>/.
[[_agency/<type>/X]]   → look up X in the agency vault.
```

If exactly one match → create `[:LINKS_TO]` edge to that UUID.
If zero matches → create `(:MissingPage {slug: X, ...})` placeholder.
If multiple matches → emit lint error `AMBIGUOUS_WIKILINK`, require human resolution.

### 4.5 Rename detection

The reconciler detects renames by:

1. Watching for `<old>.md` deletion + `<new>.md` creation in the same tick.
2. Reading `id` from the new file's frontmatter.
3. If `id` already exists in the graph at a different `vault_path` → rename. Update `slug` and `vault_path` properties; preserve all edges.
4. If `id` is new → fresh creation.

---

## 5. Type taxonomy (Q5)

### 5.1 Day 1 ship (6 types)

| #   | Type                       | Folder                  | Purpose                                                                                    |
| --- | -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `Source`                   | `vault/sources/`        | Raw stakeholder input summarized: transcripts, docs, meeting notes. The provenance anchor. |
| 2   | `BusinessGoal`             | `vault/business-goals/` | High-level business objective. Top of the hierarchy.                                       |
| 3   | `FunctionalRequirement`    | `vault/requirements/`   | Volere snowcard schema (description + rationale + fit_criterion).                          |
| 4   | `NonFunctionalRequirement` | `vault/nfrs/`           | Tagged with ISO/IEC 25010:2023 quality characteristic.                                     |
| 5   | `UserStory`                | `vault/stories/`        | Cohn template + INVEST + acceptance criteria.                                              |
| 6   | `ImplementationPlan`       | `vault/plans/`          | Technical plan written by the agent BEFORE coding a Story. ADR-shaped.                     |

### 5.2 Deferred to Day 1+ (in Spec mode)

- `Scenario` (Gherkin companion of a Story) — added when a Story justifies executable specs.
- `Constraint` (ADR-like reusable technical decision) — added when a decision recurs across Plans.

### 5.3 Code Knowledge mode types (designed, not implemented Day 1)

- `Source`, `Entity`, `Concept`, `Domain`, `Decision`, `Comparison`, `Question`, `Pattern`.
- The taxonomy is reserved in the schema design; no implementation Day 1.

### 5.4 Type signal

The type of an artifact is declared in TWO places that must agree:

- **`type` field in frontmatter** (canonical for lint and graph queries).
- **Folder location** (canonical for filesystem navigation and Obsidian).

The reconciler validates `type ↔ folder` consistency. Mismatch is a `BLOCKING` validation error.

### 5.5 Frontmatter schema (universal fields, all types)

```yaml
id: <UUIDv4>
slug: <kebab-case>
type: <one of Day 1 types>
title: <1-200 chars>
version: <int ≥ 1>
status: <draft|review|approved|deprecated>
priority: <must|should|could|wont> # MoSCoW or WSJF for Stories
created: <ISO 8601>
updated: <ISO 8601>
author: <"agent:<model>" or "human:<email>">

source_evidence: # required for non-Source types
  - "[[sources/<slug>]]#L<from>-L<to>"

relations: # typed edges; may be empty arrays
  satisfies: []
  refines: []
  derived_from: []
  depends_on: []
  conflicts_with: []
  tested_by: []
  implemented_by: []
  elaborated_by: []
  supersedes: null

# Type-specific fields below
```

### 5.6 Type-specific fields

```yaml
# NonFunctionalRequirement
nfr_quality: <one of ISO/IEC 25010:2023>
# {FunctionalSuitability, PerformanceEfficiency, Compatibility,
#  InteractionCapability, Reliability, Security, Maintainability,
#  Flexibility, Safety}

# UserStory
invest:
  I: <pass|fail|n/a>
  N: <pass|fail|n/a>
  V: <pass|fail|n/a>
  E: <pass|fail|n/a>
  S: <pass|fail|n/a>
  T: <pass|fail|n/a>

# ImplementationPlan
code_refs: # populated by post-commit-link hook
  - qualified_name: "auth.password_reset.send_reset_email"
    file: "services/api/src/auth/password_reset.py"
    commit: "<sha>"

# Embedding control (all types)
embed_version: <int, must equal version>
embed_model: "text-embedding-3-small"
chunk_strategy: <full_body|split_acceptance|hierarchical>
```

---

## 6. Relation vocabulary (Q5c)

### 6.1 Day 1 emitted by agent (5 relations)

| Relation                       | Direction             | Usage                                                             |
| ------------------------------ | --------------------- | ----------------------------------------------------------------- |
| `derived_from`                 | child → parent        | Any artifact ← Source. Backbone of provenance.                    |
| `satisfies`                    | child → parent        | Story → FR/Goal; FR → Goal; NFR → Goal/FR.                        |
| `elaborated_by`                | upstream → downstream | Story → Plan. The Plan elaborates how the Story is implemented.   |
| `implemented_by`               | spec → code           | Plan → `:Function`/`:Class`/`:Method` (cross-link to code-graph). |
| `supersedes` / `superseded_by` | new → old             | Versioning under stakeholder feedback.                            |

### 6.2 Day 1+ allowed but not auto-emitted (4 relations)

| Relation         | Use when                                                             |
| ---------------- | -------------------------------------------------------------------- |
| `refines`        | Sub-requirement → super-requirement (deeper hierarchy).              |
| `depends_on`     | A → B implementation order.                                          |
| `conflicts_with` | Bidirectional, when stakeholder input contradicts.                   |
| `tested_by`      | Spec → test artifact (when test artifacts integrate with the graph). |

The full 9-relation vocabulary is declared in the schema enum from Day 1; the agent is constrained to emit only the Day 1 set by default. Humans can author the deferred ones manually via frontmatter; the reconciler accepts all 9.

---

## 7. Validation gates (Q6)

### 7.1 Three gates, defense-in-depth

| Gate                           | Where                                                    | Cost    | When                                                        |
| ------------------------------ | -------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| **G1 — Skill self-validation** | Client (skill calls `POST /vault/validate` or local CLI) | <100 ms | Before each agent write; loop with retry max 3              |
| **G2 — Brain reconciler**      | codi-brain Python                                        | <500 ms | On every `POST /vault/write`; on watcher events             |
| **G3 — CI lint**               | GitHub Actions / cron                                    | 1-5 min | On PR + daily; report to `vault/meta/lint-report-<date>.md` |

A single Python library `codi_brain.validation` is consumed by all three: as importable lib (G2 reconciler), as CLI `codi-brain validate <path>` (G3 CI), and as HTTP endpoint `POST /vault/validate` (G1 skills).

### 7.2 Severity levels

- **BLOCKING**: gate rejects. Skill retries max 3 with structured error feedback. Reconciler returns 4xx, no graph write. CI fails. Examples: malformed frontmatter, duplicate `id`, `type`↔folder mismatch, body empty.
- **WARNING**: gate accepts, registers in lint report. Examples: missing `source_evidence`, missing relation, vague AC, `embed_version ≠ version`.
- **INFO**: visible but not enforced. Style preferences.

Rule: only block what corrupts the graph or breaks traceability inevitably.

### 7.3 Day 1 deterministic rules (16)

**Schema (BLOCKING)**:

1. `id` present, valid UUIDv4.
2. `type` present, in 6-type Day 1 enum.
3. `slug` present, kebab-case, 1-80 chars.
4. `title` present, 1-200 chars.
5. `version` present, integer ≥ 1.
6. `status` in `{draft, review, approved, deprecated}`.
7. Folder matches type mapping.
8. Body non-empty after whitespace strip.
9. Each relation entry has `id` (valid UUID) and `title` (wikilink); `relation` value in 9-vocabulary enum.

**Identity (BLOCKING)**: 10. `id` does not collide with an existing node at a different `vault_path`. 11. If file existed before the change, `id` must match prior version (no `id` rotation on existing artifacts). 12. `(type, slug, vault_origin)` unique within the vault.

**Type-specific (BLOCKING)**: 13. NFR: `nfr_quality` present, in ISO/IEC 25010:2023 enum (9 values). 14. UserStory: `invest` block with 6 sub-fields declared (values may be fail or n/a).

**References (WARNING in G2, BLOCKING in G3)**: 15. Each relation target `id` resolves to an existing node (or `:MissingPage` for forward refs). 16. Each `code_refs[].qualified_name` resolves to a node in the code-graph.

### 7.4 Day 1+ semantic rules (LLM-based, G3 only)

Deferred to Phase Gamma. Examples:

- INVEST conformance semantic check.
- AC measurability evaluation.
- Duplicate detection (embedding similarity).
- Contradiction detection.
- NFR quantitative target check.

### 7.5 Cross-artifact rules (WARNING in G3)

- Every `UserStory` has at least one `satisfies` outbound to an FR or BusinessGoal.
- Every `ImplementationPlan` has at least one `elaborated_by` inbound from a Story.
- Every `BusinessGoal` has at least one `derived_from` outbound to a Source.
- Orphan detection: artifacts with no inbound or outbound edges (Sources are exempted from inbound check).
- DAG check: no cycles in `derived_from` or `supersedes` chains.

---

## 8. Skills catalog (Q7)

### 8.1 Day 1 ship: 7 skills + 1 hook

| Skill                   | Inputs                                | Outputs                                                                             |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `codi-brain-init`       | project name, description             | vault scaffold + `.codi/mode.yaml` + `vault/CLAUDE.md`                              |
| `codi-brain-rawconvert` | path to file or folder under `.raw/`  | normalized markdown at `.raw/<topic>/normalized/` (uses markitdown as engine Day 1) |
| `codi-brain-ingest`     | path to normalized markdown           | Source + N×BusinessGoal + N×FR + N×NFR + N×UserStory with all relations cabled      |
| `codi-brain-update`     | feedback text + affected artifact ids | versioned mutations: new versions with `supersedes` chains; old marked deprecated   |
| `codi-brain-plan`       | story_id                              | ImplementationPlan linked via `elaborated_by` ← Story                               |
| `codi-brain-query`      | natural-language question             | answer with citations to artifact ids and code refs                                 |
| `codi-brain-lint`       | (no args, operates on whole vault)    | `vault/meta/lint-report-<date>.md`                                                  |

| Hook                    | Trigger                         | Action                                                                                                                           |
| ----------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `post-commit-link-code` | git post-commit on project repo | Calls `POST /code/changed-since/<commit>`; reads `.codi/active-plan`; creates `:Plan -[implemented_by]-> :Function/:Class` edges |

### 8.2 Day 1+ skills (deferred)

- `codi-brain-replan` — when a Story is superseded, helps developer re-evaluate the Plan.
- `codi-brain-scenario` — generates Gherkin companion for a Story.
- `codi-brain-promote` — promotes a per-project artifact to the agency vault.
- `codi-brain-jira-link` — links existing Jira issue to a Story.
- `codi-brain-jira-create` — creates Jira issue from a Story.

### 8.3 Invocation model (Q7b)

- **Slash command** is the primary explicit interface. Every skill has a slash command (`/codi-init`, `/codi-ingest`, etc.).
- **Natural language matching** is secondary. Skills with safe-to-invoke patterns include their NL triggers in the skill description; the harness matches and confirms with the user before execution. Day 1: only `ingest`, `query`, `update`, `lint` use NL matching.
- **Hooks** are deterministic only Day 1. The `post-commit-link-code` hook is the only Day 1 hook. LLM-driven hooks are deferred (latency + cost not bounded).

### 8.4 Communication model (Q7c)

- **HTTP API is primary.** Skills call brain endpoints (`POST /vault/write`, `POST /vault/validate`, `GET /graph/trace`, etc.) with the developer's bearer token.
- **Filesystem is secondary**, used by humans editing in Obsidian. The watcher detects filesystem changes and triggers reconciliation through the same atomic 6-step path.
- **Skills NEVER write directly to vault filesystem** for graph-managed artifacts. Always via `POST /vault/write` for atomicity (rollback on failure) and validation (G2).

### 8.5 Standard skill anatomy

Every skill follows the same skeleton:

```
1. Validate prerequisites (project initialized, brain reachable, etc.).
2. Query graph context (what already exists, what is in scope).
3. Generate artifact(s) via LLM.
4. Loop: POST /vault/validate → if BLOCKING, re-prompt with errors; max 3 attempts.
5. Persist via POST /vault/write or /vault/write/batch.
6. Surface summary + artifact IDs + warnings to user.
```

After 3 failed validation attempts, the skill emits a clear "manual review needed" message with the validation errors, instead of silently retrying or producing junk.

---

## 9. End-to-end data flow (Q8)

The full iteration cycle from stakeholder input to merged code with traceability:

```
0. Project bootstrap (1×)
   `codi project new <id>` → monorepo + Docker stack + agency vault symlink
   `/codi-init` → vault scaffold

1. Stakeholder call
   Developer drops .vtt/.docx/.pdf into vault/.raw/<topic>/

2. Raw conversion
   `/codi-rawconvert .raw/<topic>/`
   → vault/.raw/<topic>/normalized/<file>.md

3. Ingest (heaviest skill)
   `/codi-ingest .raw/<topic>/normalized/`
   → 1× Source, N× BusinessGoal, N× FR, N× NFR, N× Story
   → all relations cabled (derived_from, satisfies)
   → atomic batch write via 6-step

4. Story selection + planning
   `/codi-plan US-XXX`
   → 1× ImplementationPlan
   → Story -[elaborated_by]-> Plan
   → .codi/active-plan ← PL-XXX

5. Coding
   Developer writes code in services/.
   git commit (regular)
   → post-commit-link-code hook fires
   → /code/changed-since/<prev-sha> → list of new qualified_names
   → CREATE Plan -[implemented_by]-> :Function/:Class edges

6. Demo + feedback
   Stakeholder sends new transcript + feedback notes
   Developer drops in .raw/

7. Iteration
   `/codi-update --source <path> --affects US-XXX,FR-YYY`
   → analyze diff with LLM
   → emit version+1 of affected artifacts
   → CREATE supersedes edges
   → mark old as status=deprecated
   → emit warning if Plan elaborates a now-deprecated Story

8. Sync to remote (when network returns)
   git push (monorepo: code + vault together)
   → GitHub webhook → VPS
   → VPS pulls + reconciler reindexes

9. Lint diaria
   cron on VPS runs `/codi-lint`
   → vault/meta/lint-report-<date>.md
```

### 9.1 Sub-decisions locked in flow

- **Q8a**: raw files in `vault/.raw/`, dot-prefixed (hidden from Obsidian), append-only immutable.
- **Q8b**: active plan tracking via `.codi/active-plan` file (set by `/codi-plan` skill); fallback parsing of commit message `(PL-XXX)` patterns; if neither resolves, the post-commit hook logs to `vault/meta/link-log.md` and skips edge creation (developer can manually link later via Day 1+ `codi-brain-link-commit`).
- **Q8c**: when a Story is superseded, the system emits a WARNING about Plans elaborating the deprecated Story but takes NO automatic action. The developer/PM decides via Day 1+ `codi-brain-replan` skill or accepts the deprecation as historical. Code edges are NEVER touched automatically.

---

## 10. Auth model (Q9a)

### 10.1 Per-developer revocable bearer tokens

- **Format**: `cb_<32 random hex>` (128 bits entropy).
- **Storage**: `:Token` nodes in Memgraph.
- **Validation**: FastAPI middleware queries Memgraph on each request, with 60s LRU cache to mitigate latency.
- **Revocation**: admin endpoint marks `revoked_at`; next request fails.

### 10.2 Schema

```cypher
CREATE CONSTRAINT ON (t:Token) ASSERT t.id IS UNIQUE

(:Token {
  id: "cb_a3f9...",
  developer_name: "Alice",
  developer_email: "alice@agencia.com",
  scopes: ["vault:write", "vault:read", "graph:read"],
  created_at: datetime(),
  last_used_at: datetime(),
  revoked_at: null,
  issued_by: "admin"
})
```

### 10.3 Day 1 scopes (3)

- `vault:read` — search, traverse, read artifacts.
- `vault:write` — create, update, batch write.
- `graph:read` — direct graph queries.

Day 1+ adds `admin`, `agency:write`, etc.

### 10.4 Admin endpoints

- `POST /admin/tokens` — issue new (requires `BRAIN_ADMIN_TOKEN`, separate from bearer).
- `DELETE /admin/tokens/<id>` — revoke.
- `GET /admin/tokens` — list (token values masked).

CLI:

```
codi-brain admin issue-token --name "Alice" --email "alice@agencia.com"
codi-brain admin revoke-token cb_a3f9...
```

### 10.5 Token distribution flow

1. Admin issues via CLI on VPS.
2. Token shown ONCE on stdout.
3. Distributed to developer via secure channel (1Password share, Bitwarden, Signal — never email/Slack plain).
4. Developer's local CLI: `codi config set-token cb_a3f9...` → stored in `~/.codi/credentials` with mode 0600.
5. Local Docker stack of the developer uses a SEPARATE auto-generated token for self-auth; the VPS-issued token is only used when calling the VPS.

### 10.6 Rotation

- Day 1: manual on developer offboarding or token compromise.
- Day 1+: automated 90-day rotation with grace period.

---

## 11. Sync and webhooks (Q9b)

### 11.1 Webhook architecture

GitHub webhook → VPS endpoint:

- Endpoint: `POST https://brain.<agencia>.com/webhooks/github`
- Verification: HMAC-SHA256 against `GITHUB_WEBHOOK_SECRET` env var. Constant-time comparison via `hmac.compare_digest()`.
- Idempotency: `X-GitHub-Delivery` UUID stored in `:WebhookDelivery` Memgraph nodes with 14-day TTL.

### 11.2 Events processed Day 1

- `push` to `main` branch → pull repo + reconcile changed `.md` files in `vault/` + run code-graph update on changed `services/` files.
- All other events: 200 OK with no action.

### 11.3 Failure handling

- Handler returns 200 within <1s after signature verification + delivery registration.
- Real processing happens in `WebhookEventQueue` (analogous to existing `PushRetryQueue`), persisted to `.codi/webhook-queue/<delivery_id>.json`.
- Failures retry with exponential backoff. After N attempts, alert via Prometheus metric (Day 1+ pages admin via configured channel).

### 11.4 Concurrency

`asyncio.Lock` per project at the handler level prevents re-entrancy when rapid commits arrive. The reconciler's existing `VaultLock` handles inner-write serialization.

### 11.5 Admin endpoints

- `GET /admin/webhooks/deliveries` — list (success/fail per delivery).
- `POST /admin/webhooks/replay/<delivery_id>` — manual reprocess.

### 11.6 Setup operacional (out of code scope)

- HTTPS + valid TLS cert (Caddy + Let's Encrypt).
- GitHub repo Settings → Webhooks → URL + secret + push event only.
- Same for `_agency-vault` repo.

---

## 12. Observability (Q9c)

### 12.1 Stack

```
codi-brain (FastAPI)
  ↓ /metrics endpoint (prometheus-client, already in deps)
Prometheus (scrape every 15s)
  ↓
Grafana (port 3000, dashboards)

codi-brain stdout (loguru JSON)
  ↓ Promtail
Loki (logs storage)
  ↓
Grafana (logs viewer)
```

All four services added to `docker-compose.yaml` as additional services. ~600 MB RAM, ~5 GB disk overhead.

### 12.2 Metric catalog (Day 1)

**Ingest pipeline**: `codi_ingest_total{skill,project,status}`, `codi_ingest_duration_seconds{skill}`, `codi_ingest_artifacts_created_total{type}`, `codi_validate_blocking_errors_total{rule_id}`, `codi_validate_warnings_total{rule_id}`, `codi_skill_retry_total{skill,attempt}`.

**Brain write**: `codi_vault_write_total{status}`, `codi_vault_write_duration_seconds{step}` (histogram per 6-step phase), `codi_vault_lock_wait_seconds`, `codi_embedding_total{model,status}`, `codi_embedding_duration_seconds{model}`.

**Reconciler**: `codi_reconcile_runs_total{trigger}`, `codi_reconcile_duration_seconds`, `codi_reconcile_drift_detected_total{type}`, `codi_filesystem_events_total{kind}`.

**Webhook**: `codi_webhook_received_total{event}`, `codi_webhook_processed_duration_seconds{event}`, `codi_webhook_signature_failures_total` (security signal).

**Auth**: `codi_auth_requests_total{result}`, `codi_token_lookup_duration_seconds`.

**System**: `codi_memgraph_query_duration_seconds{query}`, `codi_qdrant_query_duration_seconds`, `codi_vault_size_bytes{project,vault_origin}`, `codi_graph_node_count{label}`.

### 12.3 Dashboards (Day 1)

Three Grafana dashboards provisioned via JSON in `observability/dashboards/`:

1. **Ingest health**: success rate, retry rates, top violated rules, P95 latency. One row per skill.
2. **Brain internals**: write latency breakdown (6 steps), reconcile drift, embedding cost, vault size growth.
3. **Webhook + sync**: deliveries received, processing latency, signature failures, git pull duration.

### 12.4 Logging

JSON structured logs from loguru. Standard fields: `timestamp`, `level`, `request_id`, `project_id`, `skill`, `step`, `duration_ms`, `message`, plus event-specific fields.

### 12.5 Alerts

Day 1+ only. Capture metrics in v2; calibrate thresholds with 2-4 weeks of real data; configure alerts pointing to Slack/PagerDuty/email after.

---

## 13. External integrations (Q10b)

### 13.1 Jira reference-only (Phase Gamma)

```yaml
# UserStory frontmatter (new field)
external_refs:
  jira:
    issue_key: "ACME-123"
    url: "https://acme.atlassian.net/browse/ACME-123"
    last_synced_at: "2026-04-30T21:00:00Z"
    cached_status: "In Progress"
```

Skills:

- `codi-brain-jira-link` — link existing Jira issue to a Story; comment on Jira ticket with vault link.
- `codi-brain-jira-create` — create Jira issue from a Story.

Cron pulls Jira status every 30 minutes for `cached_status` only. NO body/AC/relations sync.

### 13.2 Adapter pattern for future integrations

```python
src/codi_brain/integrations/external_refs/
class ExternalRefAdapter(Protocol):
    def create_issue(self, story: UserStory) -> ExternalRef: ...
    def fetch_status(self, ref: ExternalRef) -> str: ...
    def link_back(self, ref: ExternalRef, vault_url: str) -> None: ...

class JiraAdapter(ExternalRefAdapter): ...
class LinearAdapter(ExternalRefAdapter): ...        # Day 1+ on demand
class GitHubIssuesAdapter(ExternalRefAdapter): ...  # Day 1+ on demand
```

### 13.3 Bidirectional sync (deferred to v2.x)

When upgraded:

- Webhook Jira → VPS (HMAC + idempotency, analog to GitHub webhook).
- Conflict resolution rules: Jira wins on `status`/`assignee`/`sprint`; vault wins on body/AC/relations.
- Auth via OAuth 2.0 or API token with rate limit handling.
- Tests against Jira sandbox instance.

Estimated cost: ~2 weeks. Justified only when client demands or team grows past 5+ devs heavily using Jira.

---

## 14. Concurrency and error handling (preserved from prior v2)

### 14.1 Concurrency primitives

- **VaultLock**: async RW lock around vault writes. Multiple readers OK; single writer; writer preference; timeout. Already implemented in Phase 1.
- **VaultWriteContext**: 6-step atomic commit (Memgraph → embed → Qdrant → file → reconciler → git). Rollback on any step failure. Already implemented in Phase 1.
- **PushRetryQueue**: persisted retry queue for git remote push failures. Already implemented.
- **WebhookEventQueue**: persisted retry queue for webhook event processing. NEW Day 1.

### 14.2 Error handling

- **Malformed frontmatter** during reconcile → log + add to `vault/meta/parse-errors-<date>.md` + skip; do not block reconcile.
- **Embedding API failure** → retry 3× with backoff, then queue to `.codi/embed-retry/`. Page still written to filesystem and Memgraph; embedding retried later.
- **Git push failure** → existing PushRetryQueue.
- **Webhook processing failure** → WebhookEventQueue.
- **Skill validator retries exhausted** → skill surfaces structured error to user with exact rule violations + last attempt content; user reviews manually.

---

## 15. Migration from Phase 1

### 15.1 What survives

The Phase 1 substrate is preserved verbatim:

- Memgraph schema (constraints on Function/Class/Method/.../Note).
- Qdrant collections (`code_embeddings`, `note_embeddings`).
- VaultLock, VaultWriteContext, GitOps, PushRetryQueue, FilesystemWatcher, ScheduledReconcileTask, Reconciler.
- Auth middleware (gets extended for per-developer tokens).
- Routes structure.

### 15.2 What changes

- `Note` becomes `Page` with extended schema (versioning, status, priority, type-specific fields).
- `kind` field is replaced by `type` field with 6 valid values (was 2: `decision`, `hot`).
- `links` array is replaced by typed `relations` block; reconciler creates `LINKS_TO` edges with `relation` property.
- `id` truncated UUID is replaced by full UUIDv4. Existing `n-<12hex>` nodes coexist with new full UUIDv4 nodes; no migration script needed.
- Folder structure: existing `decisions/` becomes one of many; new folders added (`sources/`, `business-goals/`, `requirements/`, `nfrs/`, `stories/`, `plans/`, `meta/`).

### 15.3 Wipe procedure (clean v2 start)

The 87 existing `kind=decision` nodes from Phase 1 Week 2A are dummy/test data. Procedure:

```bash
codi-brain admin wipe-vault --confirm
```

Internally:

1. `POST /vault/wipe` (admin-only): drops all `:Note` and `:Page` nodes, detaches edges, deletes Qdrant collections, deletes vault folder content except `.git`.
2. Push the wipe commit so the remote has audit record.
3. Run `/codi-init` to recreate empty vault scaffold with v2 layout.

No migration tooling, no bridge format. Saves ~1 day of v2 scope.

---

## 16. Ship criterion

v2 is shipped when ALL true:

1. Phase Alpha demo passes locally on a developer laptop (full Spec→Plan→Code→Trace loop with fixtures).
2. Phase Beta demo passes with 2+ developers + VPS + 1 functional GitHub webhook.
3. Phase Gamma demo passes with 1 real piloto project end-to-end with Jira reference-only.
4. E2E test coverage >70% in codi-brain Python suite.
5. E2E test for each of 7 skills + 1 hook with realistic fixtures.
6. Operational documentation: VPS provisioning, developer onboarding, runbook (token revocation, webhook fail, brain restart).
7. Grafana dashboards in production showing >2 weeks of real metrics.
8. Roadmap document for v2.x with prioritized CK mode + bidirectional Jira items.
9. Sign-off from one piloto client on a real project completed using the system.

---

## 17. Risks (consolidated from grilling)

1. **Phase Alpha demo can fail** — agent may not reliably convert real (non-fixture) transcripts to coherent artifacts. Mitigation: 5-10 diverse real transcripts as test fixtures + iterate prompts to >80% manual-review-pass rate before exiting Alpha.
2. **GitHub webhook requires public DNS + TLS** — outside code scope. Mitigation: `infra/setup-vps.sh` provisioning script as deliverable.
3. **Adoption discipline** — system requires developers to use `/codi-plan` before coding, otherwise `implemented_by` edges don't form. Mitigation: training session post-Alpha + lint rule that flags commits without active-plan.
4. **Jira API rate limits** — Atlassian Cloud limits are strict. Mitigation: backoff + batching from Day 1+ implementation.
5. **Token storage in Memgraph plain** — if VPS is compromised, tokens leak. Mitigation Day 1: encrypted Docker volumes at host level. Day 1+: argon2-hash in DB.
6. **Edge explosion under iteration** — `supersedes` chains grow unbounded over project lifetime. Mitigation: prune `supersedes` traversal to depth 2 in display; full chain remains in graph for audit.
7. **NFR cluster collapse in embeddings** — different ISO 25010 quality characteristics cluster together. Mitigation: prepend type prefix `"<type> <title>: "` before embedding (already in design).
8. **CK mode resurrection cost** — if v2.x revives Code Knowledge mode, it requires ~1 week of refactoring to reintroduce its types/relations as a second mode. Acceptable trade-off vs. shipping Spec mode 4-6 weeks faster.

---

## 18. References

- `docs/20260424_144908_[PLAN]_codi-brain-v2-brainstorm-checkpoint.md` (CK brainstorm + graphify findings)
- `docs/20260424_145740_[PLAN]_codi-brain-v2-design.md` (CK mode design — SUPERSEDED)
- `docs/20260423_212728_[REPORT]_codi-brain-phase-1-week-2b-progress.md` (Week 2B handoff)
- `docs/20260423_115429_[PLAN]_codi-brain-phase-1-week-2a-design.md` (Week 2A design)
- `docs/20260422_200000_[AUDIT]_codi-brain-coverage-audit.md` (coverage audit)
- `~/projects/plan-ai/docs/20260430_211100_[RESEARCH]_documentation-standard.md` (3-agent research that seeded Q1-Q5)
- ISO/IEC 25010:2023 — `https://www.iso.org/standard/78176.html`
- OSLC RM 2.1 — `https://docs.oasis-open-projects.org/oslc-op/rm/v2.1/requirements-management-spec.html`
- Volere snowcards — `https://www.volere.org/wp-content/uploads/2018/12/06-Atomic-Requirements.pdf`
- Mike Cohn user stories — `https://www.mountaingoatsoftware.com/agile/user-stories`
- Microsoft GraphRAG — `https://microsoft.github.io/graphrag/`
- markitdown (raw conversion engine) — `https://github.com/microsoft/markitdown`
