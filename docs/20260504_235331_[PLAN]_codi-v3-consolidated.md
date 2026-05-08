# Plan: Codi v3 — Diseño consolidado (post-grilling Q1-Q32)

- **Date**: 2026-05-04 23:53 (saneamiento documental Q32: 2026-05-06)
- **Document**: 20260504*235331*[PLAN]\_codi-v3-consolidated.md
- **Category**: PLAN
- **Estado**: design-locked tras 32 preguntas de grilling iterativo (Q1-Q32)
- **Sustituye**: 20260504*221654*[PLAN]\_codi-v3-design.md (queda como histórico parcial Q1-Q11)

---

## Constants (counts vivos — única fuente)

Si cambias estos números, propágalos a TODAS las secciones que los citan. Esta tabla es la fuente única; las demás menciones son derivadas.

| Constant                          | Valor  | Composición                                                                                                                                                                                                                                             |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artefactos builtin v3.0-full      | **92** | 56 skills + 15 gates + 12 rules + 8 agents + 1 preset                                                                                                                                                                                                   |
| Skills                            | **56** | 4 foundation + 7 workflows + 9 SDD core + 4 SDD ortogonales + 3 utility + 4 deployment + 3 self-dev + 1 code quality + 3 git + 2 self-improve + 4 meta-creators + 1 session continuity + 1 content + 1 obs + 1 ops + 2 extensibilidad + 6 DDD/Hexagonal |
| Gates                             | **15** | 14 core deterministic/agent-fork + 1 opt-in `gate-test-first-commit` (activable via `invariants.tdd_strict: true`)                                                                                                                                      |
| Rules                             | **12** | iron-laws, output-discipline, workflow, recommend-pattern, security, error-handling, testing, git-workflow, documentation, improvement-dev, domain-driven, hexagonal-architecture                                                                       |
| Agents (subagent definitions)     | **8**  | lead, worker, reviewer, advisor, scaffolder, docs-lookup, architect, compliance-reviewer                                                                                                                                                                |
| Presets                           | **1**  | `codi-minimal` (incluye 91 artefactos core; `gate-test-first-commit` es opt-in fuera del preset)                                                                                                                                                        |
| Containers full                   | **9**  | codi-app, codi-workers, codi-db, codi-graph, codi-vector, codi-indexer, codi-ui, caddy, vaultwarden                                                                                                                                                     |
| Containers sin codegraph          | **7**  | sin codi-graph y codi-vector                                                                                                                                                                                                                            |
| Workflows                         | **7**  | project, feature, bug-fix, refactor, migration, audit, review                                                                                                                                                                                           |
| Hooks runtime                     | **5**  | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop (Anthropic protocol)                                                                                                                                                                      |
| Hooks git (no Anthropic protocol) | **1**  | pre-push                                                                                                                                                                                                                                                |
| Q decisiones cerradas             | **32** | Q1-Q32, ver §25 mapping                                                                                                                                                                                                                                 |
| Roadmap fases                     | **12** | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9-bis, 10 (18 semanas)                                                                                                                                                                                                    |
| SDD inner-loop fases              | **5**  | Clarify → Spec → Plan → Implement → Verify (Q30)                                                                                                                                                                                                        |
| Bounded contexts internos         | **7**  | notes, workflows, memory, codegraph, improvements, auth, observability (§29)                                                                                                                                                                            |
| Tiers degradación                 | **5**  | 0 Full → 4 Baseline (single-user no-auth)                                                                                                                                                                                                               |

---

## Tabla de contenidos

0. Resumen ejecutivo
1. Visión y principios rectores
2. Arquitectura de despliegue (9 contenedores Docker)
3. Modelo de tenancy y auth
4. Modelo de dominio (notas + wikilinks + grafo)
5. Persistencia (Postgres + Memgraph + Qdrant + Vaultwarden)
6. API contract (REST + SSE + JWT)
7. Estándar de skills v3
8. Catálogo builtin (92 artefactos)
9. Workflow contracts concretos (7 workflows)
10. Hooks runtime payload contracts (5 hooks runtime + 1 git hook)
11. Sistema de overrides en 3 capas
12. Auto-mejora continua (3 etapas)
13. LLM provider routing
14. Observabilidad y 5 tiers de degradación
15. Dashboard codi-ui (6 secciones)
16. Lifecycle: install / deploy / connect
17. CLI commands set
18. Code graph (`code-graph-rag` subproyecto propio del equipo)
19. Migración Codi v2 + absorción DevLoop
20. Build/Release + Secrets + Backup
21. Testing strategy
22. Roadmap por fases (12 fases — 18 semanas)
23. Riesgos y mitigaciones
24. Preguntas abiertas
25. Mapping de decisiones a preguntas grilling
26. Cierre
27. Compatibilidad de agentes en 2 tiers (Claude Code Tier 1A + Codex CLI Tier 1B + Tier 2 + Tier 3)
28. Patrones operacionales de Symphony (OpenAI harness engineering)
29. Codi v3 mismo con DDD táctico + Hexagonal
30. Workflow concurrency + extensibility (Q23 + Q25)
31. Baseline lite vs full (Q32 — separación esencial vs nice-to-have)

---

## 0. Resumen ejecutivo

Codi v3 es un **agent harness orquestador** distribuido como `docker-compose` de 9 contenedores idénticos en local, VPS y cloud. Combina:

- **Configuración declarativa multi-target** (herencia Codi v2): genera CLAUDE.md, AGENTS.md, .cursor/, .codex/ desde una sola fuente.
- **Runtime de proceso event-sourced** (herencia DevLoop): workflows phase-locked, HARD GATES con literal `ok`, classifier mecánico, replay determinista.
- **Memoria persistente con grafo unificado**: notas con wikilinks `[[ ]]`, embeddings (pgvector), grafo (Memgraph) que conecta código + lecciones + decisiones, vault Obsidian-compatible (export read-only).
- **Auto-mejora continua**: agente emite observaciones libres, job de cribado periódico clusters por embedding, propuestas humanos-aprobables con HARD GATE.
- **Multi-tenant por agencia**: 3 scopes (user/project/agency), elevación de conocimiento workflow-driven, RLS Postgres.
- **Code graph**: `code-graph-rag` es **subproyecto propio del equipo** (no vendor externo). Co-evoluciona con Codi v3. 10 lenguajes Tree-sitter, integración via wrapper HTTP que puede crecer según necesidad. Ambos proyectos forman parte de la solución integrada.
- **Secrets management**: Vaultwarden self-hosted como source de truth para LLM keys + secrets de aplicación.

El sistema arranca con **default = todo on**, **apagable individualmente**, y degrada a través de **5 tiers** con auto-recovery hasta llegar al **Tier 4 Baseline** que es funcionalmente equivalente a Codi v2 + DevLoop estáticos. Nunca queda peor que el estado actual.

Todas las integraciones externas se hacen vía **skills + HTTP** (no MCP server propio). Solo APIs LLM externas (OpenAI / Anthropic / Gemini), sin local ONNX/Ollama.

Para una agencia de IA con 4 devs: levantan el compose una vez, comparten cerebro colmena, los 4 ven en grafo Obsidian-like la conexión entre código + lecciones + ADRs + workflows en curso. Los 4 contribuyen markers de mejora; un agency_admin aprueba propuestas con HARD GATE.

**Total**: 9 contenedores con codegraph on, 7 sin. **92 artefactos builtin** (56 skills + 15 gates + 12 rules + 8 agents + 1 preset; reorganizados post-Q30 para alinear con SDD inner-loop de 5 fases; +1 gate opt-in `gate-test-first-commit` para TDD strict). ~18 semanas de implementación con 2-3 ingenieros TS + 150 LOC Python para wrapper code-graph-rag.

**Codi v3 mismo se implementa con DDD táctico + Hexagonal**: bounded contexts en `packages/codi-app/src/core/{notes,workflows,memory,codegraph,improvements,auth,observability}/`, dependency rule estricta enforced con `dependency-cruiser`, use cases en 6 pasos, domain events tipados. Plus 6 skills builtin + 2 rules + 2 agents (architect/compliance-reviewer read-only) que el agente propone al user con UX de 3 opciones según naturaleza del project.

**Persistencia única Postgres + Memgraph + Qdrant + Vaultwarden** — sin Sheets/xlsx. Toda la data integra en BD. UI provee export a JSON/CSV/Markdown via `/v1/data/export` para visualización externa o backup off-system. Symphony (OpenAI harness engineering) aporta 8 patrones operacionales adoptados: SPEC normativa RFC 2119, single-writer Orchestrator aggregate, continuation retries 1s tras éxito, stall detection por eventos del agente, retry tokens UUID, path safety canonicalize symlinks, mandatory acknowledgement flag para modos peligrosos.

**Compatibilidad de agentes en 2 tiers** (validada contra KBs oficiales — Q29):

- **Tier 1 (full compat)** con sub-split asimétrico:
  - **1A — Claude Code**: Anthropic hook protocol nativo (5 runtime hooks usados de los 27 disponibles), skills nativas en `.claude/skills/`, subagents en `.claude/agents/<name>.md` (YAML), settings en `.claude/settings.json`.
  - **1B — Codex CLI**: hook protocol compartido pero paths distintos: skills nativas en `.agents/skills/` (NO `.codex/skills/`), subagents en `.codex/agents/<name>.toml` (TOML schema diferente), settings en `.codex/config.toml`. Requiere `trust_level = "trusted"` por proyecto, `commit_attribution = ""`, `[features] codex_hooks = true`. `AGENTS.override.md` para no pisar `AGENTS.md` del proyecto del usuario.
  - **Lógica de hooks ÚNICA**: 5 eventos compartidos (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop) + 5 restricciones de compat dual + tool name normalization (`apply_patch` ↔ `Edit`/`Write`/`NotebookEdit`).
- **Tier 2 (config generation only, sin runtime hooks)**: Cursor, Windsurf, Cline, GitHub Copilot. Reciben skills/rules/agents como archivos estáticos + CLAUDE.md/equivalente. Sin hooks runtime nativos. El dev invoca CLI manualmente para persistir (`codi memory record`, `codi run`). Funcional pero degradado.
- **Tier 3 (futura evaluación)**: opencode, Antigravity, Gemini CLI, Q Developer, Continue. Evaluables case-by-case según demanda real de la agencia. NO en v3.0.

**Skills loading tiers** (KB-validated — skill budget ~2% context window): A always-loaded (~10), B implicit-by-description (~39), C explicit-only (~7). Total 56 skills sin truncate (post-Q30 reorg).

**Distribución doble track**: `codi generate` (default, copia a `.claude/`/`.codex/`/`.agents/`) + `codi plugin publish` (opt-in, manifest `plugin.json` para marketplace privado por agencia o publicación futura).

---

## 1. Visión y principios rectores

### 1.1 Visión

Codi v3 es lo que un dev solo o una agencia despliegan **una sola vez** en local o en cloud para que sus agentes IA (Claude Code, Codex, Cursor, opencode, etc.) tengan:

- Cerebro colmena compartido con memoria persistente.
- Workflows phase-locked auditables.
- Auto-mejora continua de skills/rules.
- Generación multi-target de configs.
- Observabilidad operacional + costos LLM.

El dev solo abre su agente IA en el repo; **todo lo demás se resuelve solo** vía SessionStart hook que verifica entorno + auto-arranca + inyecta contexto.

### 1.2 Principios rectores (12)

1. **Build + Runtime unificados**: una misma fuente declarativa describe artefactos _y_ procesos.
2. **Vocabulario cerrado, evolución por ADR**: eventos, fases, workflow types, output modes, severidades cerradas.
3. **Determinismo donde se puede, IA donde se debe**: classifiers/validators puros; RAG/planning/summarization LLM con fallback determinista.
4. **Local-first, online-optional**: Postgres + Memgraph + Qdrant + Vaultwarden local en Docker; cloud es despliegue sin rediseño.
5. **Trace is sacred**: cada decisión auditada, append-only event log + git.
6. **Human in the loop por defecto**: HARD GATES con literal `ok` (case-insensitive 2-chars).
7. **Modular monolith**: un solo repo monorepo con pnpm workspaces; sin microservicios prematuros.
8. **No vendor lock**: schemas estables (Zod + JSON Schema publicado).
9. **Atomic + rollback**: cada mutación lleva snapshot pre + rollback determinista.
10. **Diff mínimo, simplicidad primero**: capabilities solo si añaden valor.
11. **Schema-driven**: Zod en core + JSON Schema publicado. Schema parity tests entre TS y otras implementaciones.
12. **Self-hosted dogfooding**: el repo de Codi usa Codi sobre sí mismo (en Fase 10).

### 1.3 Iron Laws (heredadas de DevLoop, formalizadas como rule `codi-iron-laws`)

1. **Recommend AND execute** — default acción; preguntar solo en HARD GATE / credentials / ambiguous-business / irreversible-write.
2. **One question per turn** — elicitación atómica.
3. **Sheet/Canvas is sacred** — info estratégica al canvas estructurado, no en chat. (En v3 = `codi.notes` con wikilinks.)
4. **HARD GATES need 'ok'** — literal `ok | OK | Ok` (case-insensitive, exactamente 2 chars).
5. **Pull before patch** — re-runs empiezan con sync de estado.
6. **Atomic + rollback** — sync auto-snapshot; restore --latest.
7. **Never commit without approval** — git commit/PR/branch delete user-gated.
8. **Honor output mode** — caveman/normal per project preference.

---

## 2. Arquitectura de despliegue (9 contenedores Docker)

### 2.1 Compose oficial (vive en `infra/docker-compose.yml` del monorepo)

```yaml
services:
  codi-app: # 1
    image: ghcr.io/codi/codi-app:${VERSION}
    depends_on: [codi-db, codi-graph, vaultwarden]
    environment:
      DATABASE_URL: postgres://codi:${DB_PASSWORD}@codi-db:5432/codi
      MEMGRAPH_URL: bolt://codi-graph:7687
      VAULTWARDEN_URL: http://vaultwarden:80
      VAULTWARDEN_SERVICE_ACCOUNT_TOKEN: ${VAULTWARDEN_SERVICE_ACCOUNT_TOKEN}
      JWT_SECRET: ${JWT_SECRET}
      CODI_INDEXER_URL: http://codi-indexer:8081
      CODI_INDEXER_API_TOKEN: ${CODI_INDEXER_API_TOKEN}

  codi-workers: # 2
    image: ghcr.io/codi/codi-workers:${VERSION}
    depends_on: [codi-db, codi-graph]

  codi-db: # 3
    image: pgvector/pgvector:pg16
    volumes: [pgdata:/var/lib/postgresql/data]

  codi-graph: # 4
    image: memgraph/memgraph-mage:latest
    volumes: [memgraph_data:/var/lib/memgraph]

  codi-vector: # 5 (profile: codegraph)
    profiles: [codegraph]
    image: qdrant/qdrant:v1.11.3
    volumes: [qdrant_data:/qdrant/storage]

  codi-indexer: # 6 (profile: codegraph)
    profiles: [codegraph]
    build:
      context: ../projects/code-graph-rag
      dockerfile: ../../infra/Dockerfile.code-graph-rag
    depends_on: [codi-graph, codi-vector]
    volumes:
      - ../:/repos/host:ro
      - codi_indexer_data:/data

  codi-ui: # 7
    image: ghcr.io/codi/codi-ui:${VERSION}
    depends_on: [codi-app]

  caddy: # 8
    image: caddy:2
    ports: ["80:80", "443:443"]

  vaultwarden: # 9
    image: vaultwarden/server:latest
    environment:
      DOMAIN: https://vault.${CADDY_DOMAIN:-localhost}
      SIGNUPS_ALLOWED: "false"
      ADMIN_TOKEN: ${VAULTWARDEN_ADMIN_TOKEN}
    volumes: [vaultwarden_data:/data]

volumes:
  pgdata: {}
  memgraph_data: {}
  qdrant_data: {}
  caddy_data: {}
  caddy_config: {}
  vaultwarden_data: {}
  codi_indexer_data: {}
```

### 2.2 Tabla de contenedores

| #   | Container      | Stack                                                  | Función                                                                                   | Recursos       | Profile   |
| --- | -------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------- | --------- |
| 1   | `codi-app`     | TS + Node 20 + Hono                                    | API HTTP `/v1/*`, orchestrator, generator, thoughts processor in-process, proxy a indexer | 256MB, 0.5 CPU | core      |
| 2   | `codi-workers` | TS + Node 20 + pg-boss                                 | Jobs async (cribado, embedding notas, reconcile, health-orchestrator)                     | 256MB, 0.5 CPU | core      |
| 3   | `codi-db`      | `pgvector/pgvector:pg16`                               | Manifest, notas, vectores de notas, queue, auth                                           | 1GB, 1 CPU     | core      |
| 4   | `codi-graph`   | `memgraph/memgraph-mage`                               | Graph SoT (code nodes/edges + projection notas)                                           | 512MB-2GB      | core      |
| 5   | `codi-vector`  | `qdrant/qdrant:1.11.x`                                 | Vector store de code embeddings (gestionado por code-graph-rag)                           | 256MB-1GB      | codegraph |
| 6   | `codi-indexer` | Python 3.12 + `projects/code-graph-rag` + wrapper HTTP | Indexer Tree-sitter (10 lenguajes), Memgraph + Qdrant writer                              | 512MB-1GB      | codegraph |
| 7   | `codi-ui`      | React 19 + Vite                                        | Dashboard + graph view + improvements review                                              | 128MB          | core      |
| 8   | `caddy`        | `caddy:2`                                              | Reverse proxy + TLS automático                                                            | 64MB           | core      |
| 9   | `vaultwarden`  | `vaultwarden/server`                                   | Secrets management (LLM keys + app secrets)                                               | 100MB          | core      |

**Total con todo on (default)**: 9 contenedores, ~3.5GB RAM. Para laptop dev solo: aceptable. Para agencia VPS: 8-16GB recomendado.

**Total con codegraph apagado**: 7 contenedores (sin `codi-vector` ni `codi-indexer`), ~2.2GB RAM.

### 2.3 Modos de despliegue (idéntico compose)

```bash
# Local (dev solo) - default todo on
docker compose --profile codegraph up -d

# Local sin code graph (RAM constrained)
docker compose up -d

# VPS / Cloud (agencia)
CADDY_DOMAIN=codi.miagencia.com docker compose --profile codegraph up -d
```

Caddy enruta:

- `https://codi.miagencia.com/` → codi-ui
- `https://codi.miagencia.com/v1/*` → codi-app
- `https://vault.miagencia.com/` → vaultwarden

### 2.4 Single repo monorepo

```
codi/                          ← repo único, NO codi-infra separado
├── packages/
│   ├── codi-cli/              ← npm publish package
│   ├── codi-app/              ← daemon TS (Hono)
│   ├── codi-workers/          ← jobs TS (pg-boss)
│   ├── codi-ui/               ← React app
│   └── codi-shared/           ← types + utils
├── projects/
│   └── code-graph-rag/        ← subproyecto propio del equipo (Git submodule pinned a tag, co-evoluciona con Codi v3 — Q28)
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.app
│   ├── Dockerfile.workers
│   ├── Dockerfile.ui
│   ├── Dockerfile.code-graph-rag
│   ├── codi-indexer-wrapper/  ← ~150 LOC Python FastAPI
│   ├── Caddyfile.template
│   └── .env.example
├── .codi/                     ← self-host (Fase 10)
├── docs/
├── tests/                     ← E2E, chaos, perf
└── pnpm-workspace.yaml
```

### 2.5 Horizontal scaling (cuándo y cómo)

Codi v3 v3.0 está diseñado para agencias hasta ~50 devs. El plan asume baseline 4 devs (Q5). Para crecer, los servicios se separan en stateless vs stateful:

| Servicio                | Stateless v3.0              | Estrategia escala                                                                |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `codi-app`              | ✅ sí (estado en BD)        | `docker compose up -d --scale codi-app=N`. Caddy round-robin via upstream config |
| `codi-workers`          | ✅ sí (jobs en pg-boss)     | scale=N, pg-boss reparte jobs vía SKIP LOCKED                                    |
| `codi-ui`               | ✅ sí (estático)            | scale=N o servir desde CDN si cloud                                              |
| `codi-db` (Postgres)    | ❌ stateful                 | single-primary v3.0; read replicas defer v3.x                                    |
| `codi-graph` (Memgraph) | ❌ stateful                 | single-instance v3.0; cluster mode defer v3.x                                    |
| `codi-vector` (Qdrant)  | ❌ stateful                 | single-instance v3.0; cluster mode defer v3.x                                    |
| `codi-indexer`          | ⚠️ stateless si idempotente | scale=N para concurrencia indexing; doc separation por project                   |
| `caddy`                 | ✅ sí                       | scale=N detrás de cloud LB                                                       |
| `vaultwarden`           | ❌ stateful                 | single-instance; backup daily a S3-compatible                                    |

Comando para scale:

```bash
docker compose up -d --scale codi-app=3 --scale codi-workers=2
```

Sin esto, una agencia de 50 devs satura un solo `codi-app`. Trade-off: scaling >1 instance requiere session affinity SOLO para SSE streams (Caddy `lb_policy ip_hash` para `/v1/stream/*`); el resto de endpoints es stateless y tolera round-robin.

Cluster mode para los 3 stateful (Postgres, Memgraph, Qdrant) está **fuera de scope v3.0** — añadir ADR cuando demanda real lo justifique.

---

## 3. Modelo de tenancy y auth

### 3.1 Jerarquía (single-agency-per-instance)

```
agency (1 por compose)
├── members (4 devs en agencia tipo)
└── projects (≥1)
      └── members (subset de devs)
```

Multi-agency-per-instance: descartado para v3.0 (complicación SaaS futura).

### 3.2 Scopes (3 niveles)

```ts
type Scope = "user" | "project" | "agency";
```

- **`user`**: notas personales del dev. Solo él.
- **`project`** (default): conocimientos del proyecto X. Members del project.
- **`agency`**: conocimientos elevados. Todos los devs de la agencia.

### 3.3 Auth: email + password + JWT

- Login: `POST /v1/auth/login { email, password }` → `{ token, refresh }`
- JWT: claims `{ user_id, agency_id, project_memberships, exp }`. TTL 7d.
- CLI guarda en `~/.codi/credentials.json` (mode 600).
- Agente recibe via env `CODI_TOKEN` inyectado por CLI o SessionStart hook.
- Refresh: auto-renew si quedan <2 días.
- Roles: `agency_admin`, `project_admin`, `member`.

### 3.4 RLS en Postgres

Cada request setea `app.user_id`, `app.project_id`, `app.agency_id` via `SET LOCAL`. Policies aplican filtros automáticos por scope. Cross-leak entre projects o entre agencies imposible.

### 3.5 Project state en `.codi/codi.yaml`

```yaml
name: my-project
project_id: <uuid>
agency_id: <uuid>

deployment:
  mode: local | cloud | hybrid
  local: { api_url: http://127.0.0.1:8080 }
  cloud: { api_url: https://codi.miagencia.com }

last_active_workflow: feature-auth-20260504
last_active_user: <user-uuid>

# hooks tunables (Q16)
hooks:
  pre_tool_use:
    classifier_mode: local | daemon | hybrid # default: local
  stop:
    summary_default: false
    summary_provider: anthropic/claude-haiku-4-5
  user_prompt_submit:
    recall_whisper_timeout_ms: 1000
    recall_whisper_top_k: 5

# secretos
secrets:
  vaultwarden:
    mode: bundled | external
    url: <url>
    cache_ttl_seconds: 300

# code graph (Q22)
codegraph:
  enabled: true
  reindex:
    on_commit: true
    on_branch_switch: true
    schedule: "0 */6 * * *"
    full_reindex_min_interval: "7d"
  embeddings:
    enabled: false
    provider: openai/text-embedding-3-large
    max_lines_per_function: 200
```

---

## 4. Modelo de dominio: notas unificadas + wikilinks + grafo

### 4.1 Tabla única `codi_notes.notes` con discriminator `type`

| Type           | Origen                                               |
| -------------- | ---------------------------------------------------- |
| `observation`  | output del agente vía marker `[CODI-OBSERVATION]`    |
| `lesson`       | extracted by thoughts processor del transcript       |
| `decision`     | recorded during workflow (event `decision_recorded`) |
| `improvement`  | candidate de auto-mejora (Q9)                        |
| `adr`          | Architecture Decision Record                         |
| `plan`         | implementation plan                                  |
| `context-term` | entrada en docs/CONTEXT.md                           |
| `thought`      | bloque de razonamiento del agente                    |
| `missing`      | stub creado por wikilink no resuelto                 |

### 4.2 Wikilinks `[[ ]]` como sintaxis canónica

```markdown
La decisión [[adr-0042-jwt-vs-session]] se aplica en
[[code:src/auth/middleware.ts:authenticate]] que usa
[[lesson:bcrypt-cost-12-baseline]].
```

**Sintaxis**:

- `[[slug]]` → la nota más reciente del slug en el project
- `[[type:slug]]` → nota de tipo específico
- `[[code:<qualified_name>]]` → nodo del code graph (Memgraph)
- `[[slug|alias]]` → con texto display
- `[[missing:proposed-slug]]` → stub explícito

**Parser** corre en cada write:

1. Regex extrae wikilinks
2. Resuelve targets (notas existentes o code_nodes en Memgraph)
3. Inserta `note_links(from, to, link_type='wikilink')`
4. Si target no existe → crea note `type='missing'`

### 4.3 Vault Obsidian-compatible (export read-only)

```
.codi/vault/
├── observations/   <slug>.md
├── lessons/        <slug>.md
├── decisions/      <slug>.md
├── adrs/           <slug>.md
├── plans/          <slug>.md
└── context/        <slug>.md
```

- Cada `.md` es **export desde Postgres** (BD → FS, una sola dirección).
- Frontmatter: `id, slug, type, title, scope, project_id, agency_id, tags, version`.
- **Job de export** en `codi-workers`: cada cambio en `codi_notes.notes` regenera el `.md` correspondiente. **NO hay sync inverso**. Edits manuales del dev en `.md` quedan pisadas en el siguiente export.
- Dev abre `.codi/vault/` con Obsidian Desktop como **viewer**.
- Edición canónica vía agente API o codi-ui. Custom UI también valido sobre `/v1/notes/*` y `/v1/graph`.

### 4.4 Grafo en Memgraph (proyección + code-graph-rag)

```cypher
(:Note { id, type, slug, title, scope, project_id })
(:CodeNode { qualified_name, type, file, line, signature })  -- gestionado por code-graph-rag
(:CodeFile { path, project_id, last_indexed_commit })

(n1:Note)-[:LINKS_TO { type: 'wikilink' }]->(n2:Note)
(n1:Note)-[:LINKS_TO { type: 'wikilink' }]->(c:CodeNode)
(n1:Note)-[:SIMILAR { weight: 0.87 }]->(n2:Note)
(c1:CodeNode)-[:CALLS]->(c2:CodeNode)
(c1:CodeNode)-[:CONTAINS]->(c2:CodeNode)
(c1:CodeNode)-[:INHERITS_FROM]->(c2:CodeNode)
(c1:CodeNode)-[:IMPORTS]->(c2:CodeNode)
```

Memgraph es SoT para code graph (gestionado por code-graph-rag). Postgres es SoT para notas. Wikilinks `[[code:<qn>]]` enlazan ambos dominios.

### 4.5 Embeddings

- **Notes**: pgvector en Postgres, default `openai/text-embedding-3-large` (3072d). HNSW index.
- **Code**: Qdrant en `codi-vector` container, gestionado por code-graph-rag. Mismo provider+dim por agency setting.

Job `embedding-similarity` cada 24h calcula k-NN (k=5) e inserta edges `note_links(type='similarity', weight)`.

---

## 5. Persistencia

### 5.1 División de responsabilidades

| Dominio                                     | Lo escribe                      | Lo lee                           | DB                      |
| ------------------------------------------- | ------------------------------- | -------------------------------- | ----------------------- |
| Manifest + workflows + audit + auth + queue | `codi-app`, `codi-workers`      | `codi-app`                       | Postgres                |
| Notes (canonical)                           | `codi-app` (hooks + agent)      | `codi-app`                       | Postgres + pgvector     |
| Code graph nodes/edges                      | `codi-indexer` (Python, vendor) | `codi-app` (proxy a indexer)     | Memgraph (SoT) + Qdrant |
| Code embeddings                             | `codi-indexer`                  | `codi-app` (vía wrapper)         | Qdrant                  |
| Coordination (lease + signal)               | `codi-app`                      | `codi-app`                       | Postgres                |
| Secrets (LLM keys + app)                    | `agency_admin` (UI Vaultwarden) | `codi-app` (vía service account) | Vaultwarden             |

### 5.2 Schemas Postgres consolidados

```sql
-- AUTH (multi-tenant)
CREATE SCHEMA codi_auth;
CREATE TABLE codi_auth.agencies (id uuid PK, name, created_at);
CREATE TABLE codi_auth.projects (id uuid PK, agency_id, name, repo_url, created_at);
CREATE TABLE codi_auth.users (id uuid PK, agency_id, email UNIQUE, password_hash, created_at);
CREATE TABLE codi_auth.project_memberships (user_id, project_id, role, PK(user_id, project_id));
CREATE TABLE codi_auth.secret_refs (
  agency_id uuid, key_name text,
  vaultwarden_org_id text, vaultwarden_item_id text,
  PK(agency_id, key_name)
);
CREATE TABLE codi_auth.llm_config (
  agency_id PK,
  default_chat_provider, default_chat_model,
  default_embedding_provider, default_embedding_model, default_embedding_dim,
  per_task_overrides jsonb
);
CREATE TABLE codi_auth.agency_settings (
  agency_id PK,
  pre_tool_use_classifier_mode text DEFAULT 'local'
    CHECK (pre_tool_use_classifier_mode IN ('local','daemon','hybrid')),
  pre_tool_use_classifier_threshold float DEFAULT 0.7,
  hooks_stop_summary_default bool DEFAULT false,
  hooks_stop_summary_provider text DEFAULT 'anthropic/claude-haiku-4-5',
  hooks_stop_summary_max_tokens int DEFAULT 300
);
CREATE TABLE codi_auth.elevation_proposals (
  id, observation_id, current_scope, proposed_scope, evidence jsonb,
  status, created_at, decided_by
);

-- MANIFEST (heredado Codi v2)
CREATE SCHEMA codi_manifest;
CREATE TABLE codi_manifest.state (project_id PK, agents jsonb, hooks jsonb, last_generated);
CREATE TABLE codi_manifest.operations (project_id, ts, op_type, details jsonb);
CREATE TABLE codi_manifest.artifact_manifest (project_id, name, type, content_hash, version, managed_by, installed_at, PK(project_id, name));
CREATE TABLE codi_manifest.audit_log (id PK, project_id, entry_type, ts, details jsonb);

-- PROCESS (heredado DevLoop)
CREATE SCHEMA codi_process;
CREATE TABLE codi_process.workflows (id PK, project_id, type, slug, current_phase, started_at, ended_at, status, current_owner);
CREATE INDEX workflows_active_by_owner ON codi_process.workflows (project_id, current_phase, current_owner) WHERE status = 'active';  -- G3.4: scaling 50 projects × 20 workflows
CREATE TABLE codi_process.workflow_events (id PK, workflow_id, event_type, schema_version, ts, author jsonb, parent_event_id, commitable bool, payload jsonb);
CREATE INDEX workflow_events_by_workflow_ts ON codi_process.workflow_events (workflow_id, ts);  -- G3.4: replay/timeline queries

-- NOTES (Q9 unificada)
CREATE SCHEMA codi_notes;
CREATE TABLE codi_notes.notes (
  id uuid PK,
  slug text NOT NULL,
  type text NOT NULL CHECK (type IN ('observation','lesson','decision','improvement','adr','plan','context-term','thought','missing')),
  title text,
  body text,
  embedding vector(3072),
  embedding_model text,
  tags text[],
  status text,                    -- ej. para improvement: 'open'|'noise'|'clustered'|'proposed'|'approved'|'applied'|'rejected'|'dismissed'
  scope text NOT NULL CHECK (scope IN ('user','project','agency')),
  source text,                    -- 'agent'|'manual'|'workflow'|'ingested'
  user_id uuid, project_id uuid, agency_id uuid NOT NULL,
  created_at, updated_at,
  CHECK ((scope='user' AND user_id IS NOT NULL AND project_id IS NULL)
      OR (scope='project' AND project_id IS NOT NULL)
      OR (scope='agency' AND project_id IS NULL AND user_id IS NULL)),
  UNIQUE(slug, type, project_id)
);
CREATE INDEX notes_embedding_hnsw ON codi_notes.notes USING hnsw (embedding vector_cosine_ops);
CREATE INDEX notes_fts ON codi_notes.notes USING gin (to_tsvector('english', coalesce(title,'') || ' ' || body));
CREATE INDEX notes_tags ON codi_notes.notes USING gin (tags);
ALTER TABLE codi_notes.notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE codi_notes.note_links (
  from_note_id uuid REFERENCES codi_notes.notes(id) ON DELETE CASCADE,
  to_note_id uuid REFERENCES codi_notes.notes(id) ON DELETE CASCADE,
  to_code_qualified_name text,    -- link a Memgraph CodeNode
  link_type text NOT NULL,        -- 'wikilink','similarity','derives_from','supersedes','evidences'
  weight float,
  PK(from_note_id, COALESCE(to_note_id::text, to_code_qualified_name), link_type)
);

-- OVERRIDES (Q13 — improvements aplicadas a artefactos)
CREATE TABLE codi_notes.skills_overrides (
  id uuid PK,
  artifact_name text NOT NULL,    -- 'codi-feature-workflow'
  artifact_type text NOT NULL,    -- 'skill'|'rule'|'agent'
  diff text NOT NULL,             -- diff unificado contra base
  base_version int NOT NULL,
  scope text NOT NULL,            -- 'project'|'agency'|'user'
  project_id uuid, agency_id uuid NOT NULL,
  status text NOT NULL,           -- 'active'|'reverted'|'materialized'
  approved_by uuid, approved_at timestamptz,
  reverted_at timestamptz,
  source_improvement_id uuid,
  metadata jsonb
);

-- COORDINATION (hive mind)
CREATE SCHEMA codi_coord;
CREATE TABLE codi_coord.leases (id PK, target text, agent_id, ttl_ms, status, expires_at, agency_id, project_id, user_id);
CREATE TABLE codi_coord.signals (id PK, from_agent, to_agent, reply_to, thread_id, payload jsonb, sent_at, acked_at, agency_id, project_id);

-- OBSERVABILITY (Q11 + Q19)
CREATE SCHEMA codi_obs;
CREATE TABLE codi_obs.llm_calls (id PK, agency_id, project_id, user_id, provider, model, task, tokens_in, tokens_out, cost_usd numeric(10,6), duration_ms, status, error, created_at);
CREATE TABLE codi_obs.system_metrics (id PK, ts, metric_name, value double, labels jsonb);
CREATE TABLE codi_obs.hook_telemetry (id PK, hook_event, session_id, user_id, project_id, agency_id, duration_ms, status, tokens_emitted, metrics jsonb, created_at);
CREATE TABLE codi_obs.degradation_state (id serial PK, tier int, subsystems jsonb, since, last_check, trigger_event, recovery_event);
CREATE TABLE codi_obs.degradation_history (id PK, from_tier, to_tier, trigger_event, recovery_event, duration_seconds, occurred_at);
CREATE TABLE codi_obs.cypher_queries (id PK, user_id, agency_id, project_id, query text, result_count, duration_ms, status, error, executed_at);
CREATE TABLE codi_obs.backups (id PK, type, filename, size_bytes, encrypted bool, created_at, retention_until);
```

**Postgres NO contiene `codi_codegraph` schema**. Code graph data vive en Memgraph (SoT) + Qdrant (gestionados por code-graph-rag — subproyecto propio del equipo, Q28).

### 5.3 Memgraph projection

Reconstruible siempre desde Postgres + repo. Job de proyección de notas en `codi-workers`. Code graph data populada por `codi-indexer` (wrapper sobre `code-graph-rag` — subproyecto propio del equipo, Q28).

---

## 6. API contract (REST + SSE + JWT)

### 6.1 Convenciones

- Protocol: REST sobre HTTP plain. Sin gRPC, sin JSON-RPC.
- Versioning: URL path `/v1/...`
- Auth: `Authorization: Bearer <jwt>` excepto `/health*`, `/v1/auth/{login,refresh}`
- Pagination: cursor (`next_cursor` en response)
- Real-time: SSE en `/v1/events/stream`
- Rate limiting (G3.2): token bucket per-user, configurable en `agency_settings.rate_limits` (defaults: 60 req/min generic, 10 req/min para `/v1/notes/search` y `/v1/llm/*`). Headers `X-RateLimit-Limit` + `X-RateLimit-Remaining` + `Retry-After` en 429. Endpoints `/health*` exentos.
- Streaming: `Accept: text/event-stream` para LLM responses
- Errors: shape cerrado `{ error: { code, message, request_id, details? } }`

### 6.2 Endpoints (~50 en 9 grupos)

```
# AUTH
POST   /v1/auth/login                 { email, password } → { token, refresh }
POST   /v1/auth/refresh               { refresh }         → { token }
GET    /v1/auth/me                                        → { user, agency, projects }
POST   /v1/auth/bootstrap-agency      (especial, solo cuando agencies vacía)

# MANIFEST & GENERATION
GET    /v1/manifest
POST   /v1/manifest/generate          { agents?, force? }
GET    /v1/manifest/drift
POST   /v1/manifest/backup            { trigger }
POST   /v1/manifest/restore           { snapshot_id }

# WORKFLOW
POST   /v1/workflow/run               { type, slug }
GET    /v1/workflow/:id
POST   /v1/workflow/:id/transition    { to_phase, evidence, approval_token: "ok" }
POST   /v1/workflow/:id/scope/expand
POST   /v1/workflow/:id/scope/incidental
POST   /v1/workflow/:id/abandon
POST   /v1/workflow/:id/recover
POST   /v1/workflow/:id/handover      { to_user_id, note }                            # Q23
POST   /v1/workflow/:id/handover/accept { approval_token: "ok" }                      # Q23
POST   /v1/workflow/:id/force-handover { to_user_id, reason, approval_token: "ok" }   # Q23
GET    /v1/workflow/:id/replay
GET    /v1/workflow/:id/events        (cursor pagination)
POST   /v1/workflow/create            { name, phases, gates, ... }                    # Q25 — workflow custom
POST   /v1/gate/create                { name, type, output_schema, ... }              # Q25 — gate custom

# NOTES (memoria + improvements + everything)
POST   /v1/notes/record               { type, body, scope, tags?, ... }
POST   /v1/notes/search               { query, scope?, type?, k, detail_level }
POST   /v1/notes/timeline             { note_id, before, after }
POST   /v1/notes/get                  { ids[], detail_level }
POST   /v1/notes/resume-pack          { detail_level: 'L0'|'L1'|'full', summary_only? }
GET    /v1/notes/sessions
DELETE /v1/notes/:id                                     (soft-delete)
POST   /v1/notes/elevate              { note_id, target_scope: 'agency' }  # HARD GATE 'ok'
POST   /v1/notes/resolve-wikilinks    { wikilinks[] }    → { resolved, missing }
GET    /v1/notes/suggest-slug         { text }           → { slug, alternatives }

# CODEGRAPH (proxy a codi-indexer wrapper)
POST   /v1/codegraph/index            { repo_path }      → { job_id }
GET    /v1/codegraph/index/:job_id
POST   /v1/codegraph/search
GET    /v1/codegraph/callers/:qn?depth=N
GET    /v1/codegraph/callees/:qn?depth=N
GET    /v1/codegraph/snippet/:qn
POST   /v1/codegraph/cypher           (agency_admin only, rate-limited)

# GRAPH (UI)
GET    /v1/graph?project_id=...&types=...&depth=N

# COORDINATION
POST   /v1/lease/acquire              { target, ttl_ms }
POST   /v1/lease/:id/release
POST   /v1/lease/:id/renew
POST   /v1/signal/send
GET    /v1/signal/inbox               { unacked? }
POST   /v1/signal/:id/ack

# IMPROVEMENTS
GET    /v1/improvements/proposals     (status='proposed')
POST   /v1/improvements/:id/approve   { approval_token: "ok" }
POST   /v1/improvements/:id/reject    { reason }
POST   /v1/improvements/:id/revert    { approval_token: "ok" }
POST   /v1/improvements/:id/materialize { approval_token: "ok" }

# DASHBOARD
GET    /v1/dashboard/health
GET    /v1/dashboard/llm-costs?period=30d
GET    /v1/dashboard/workflows?period=30d
GET    /v1/dashboard/hive-mind
GET    /v1/dashboard/codegraph
GET    /v1/dashboard/reliability      (Q11 — degradation state + hook metrics)
GET    /v1/dashboard/stream           (SSE — deltas en tiempo real)

# DATA EXPORT (BD es source of truth única; sin Sheets/xlsx)
GET    /v1/data/export?type=notes|workflows|llm-calls|all&format=json|csv|md&period=30d
                                      → URL temporal de descarga (ZIP)
GET    /v1/data/admin/raw-table?table=...   (agency_admin only, paginated)
                                      → exporta tabla específica para queries ad-hoc

# HOOKS TELEMETRY (fire-and-forget)
POST   /v1/hooks/telemetry

# SESSION BOOTSTRAP (consumed por SessionStart hook)
GET    /v1/session/bootstrap          → { context, status, charter, pending_workflows, ... }

# CLASSIFY (consumed por PreToolUse en mode 'daemon'/'hybrid')
POST   /v1/classify                   { tool_name, tool_input, current_workflow_id }

# HEALTH
GET    /healthz                       (liveness, no auth)
GET    /readyz                        (readiness, no auth)
GET    /metrics                       (Prometheus format)
```

### 6.3 SSE stream

```
GET /v1/events/stream?topics=workflow,memory,improvements&project_id=...

event: workflow_phase_completed
event: memory_observation_recorded
event: improvement_proposed
event: degradation_changed
event: note_synced
: keepalive (cada 15s)
```

RLS aplicada (un dev solo ve eventos de sus projects).

### 6.4 Error format

```json
{
  "error": {
    "code": "rev_conflict | not_found | unauthorized | forbidden | rate_limited | gate_pending | validation_failed | internal | unavailable",
    "message": "human-readable",
    "request_id": "uuid",
    "details": { ... },
    "hint": "..."
  }
}
```

Exit codes CLI: 0 success, 1 generic, 2 args, 3 daemon unreachable, 4 auth, 5 forbidden, 6 not found, 7 validation, 8 gate pending, 9 rate limited, 10 rev conflict.

---

## 7. Estándar de skills v3

### 7.1 Estructura física

```
<skill-name>/
├── SKILL.md              # frontmatter Zod + body Markdown
├── references/           # opcional
├── scripts/              # opcional
├── examples/             # opcional
├── evals/                # opcional
└── recipe.json           # opcional, machine-readable manifest
```

### 7.2 Frontmatter (Anthropic + Codi v2 + extensiones v3)

```yaml
---
# Anthropic standard (NUNCA modificar)
name: kebab-case
description: <max 1024>
allowed-tools: [Read, Write, Bash, ...]
disable-model-invocation: false
argument-hint: "<args>"

# Codi v2 standard
version: <int> # bump obligatorio en cada edit
managed_by: codi | user | acquired
schemaVersion: 1
type: skill
mode: skill | gate | workflow | install
category: <closed enum>
user-invocable: true
effort: low | medium | high | max
compatibility: [claude-code, cursor, codex, ...]
context: fork # opcional
paths: [globs] # opcional

# Codi v3 extensions
provides:
  - api: /v1/codegraph/search
  - external: openai-chat
requires:
  - flag: codegraph.enabled
  - api: codi-app
  - env: OPENAI_API_KEY
  - min_tier: 1 # Q11 — degradation tier mínimo

triggers:
  description-keywords: ["search code"]
  patterns: # explicit regex
    - regex: "qué llama a "
  skip-when: # anti-overlap (resuelve user's memoria sobre overlaps)
    - skill: codi-recall
      reason: "use recall for non-code memory queries"

self_improvement:
  observation_categories:
    - trigger-miss
    - trigger-false
    - missing-example
  evolve_threshold: 5
  auto_propose: true
  auto_apply: false # Iron Law 4 estricto

knowledge: # Q9 — impacto en notes
  produces: [observation, lesson]
  consumes: [observation, decision, code]
  wikilinks_required: true # obliga sección "Wikilinks usage" en body

hooks_override: # Q16 — override config workflow-level
  pre_tool_use_classifier_mode: hybrid
  stop_summary_on: true
  stop_summary_provider: anthropic/claude-sonnet-4-6
---
```

### 7.3 Body — secciones canónicas

**4 secciones obligatorias** (mínimo absoluto). El resto son condicionales y solo se incluyen si la skill las usa.

```markdown
# {{name}}

## Trigger # OBLIGATORIA — cuándo se invoca esta skill

## Steps # OBLIGATORIA — pasos numerados, accionables

## Output # OBLIGATORIA — qué artefacto produce y dónde se persiste (BD + filesystem opcional)

## Skip when # OBLIGATORIA — condiciones para no invocar (evita overlap con otras skills)

## Hard Gate # CONDICIONAL — solo si la skill termina con HARD GATE 'ok' del user

## Inputs # CONDICIONAL — solo si la skill consume artefactos específicos

## Integration # CONDICIONAL — solo si llama a codi-app o external services

### codi-app

### External

## Examples # CONDICIONAL — solo skills complejas que se benefician de ejemplo

## Wikilinks usage # CONDICIONAL — solo si knowledge.wikilinks_required: true

## Self-improvement signals # CONDICIONAL — solo si la skill emite observation markers
```

Razón: la mayoría de skills no necesita Examples/Inputs/Integration sections; añadirlas como obligatorias creaba boilerplate sin valor. Este body mínimo sale de §8.0 tier B análisis (skills tier B con descriptions <80 chars + body <500 líneas no se truncan).

### 7.4 4 modes

- **`skill`**: capability invocable.
- **`gate`**: check de gate de workflow. Output strict JSON.
- **`workflow`**: define workflow type con phases + gates + events (Q12).
- **`install`**: skill especial. Una sola: `codi-install`.

---

## 8. Catálogo builtin (92 artefactos)

### 8.0 Skills loading tiers (KB-validated — skill budget management)

Tanto Claude Code como Codex aplican un **skill budget de ~2% del context window** (~8000 chars) al cargar SKILL.md frontmatter+description. 56 skills always-active se truncarían silenciosamente y romperían el discovery por description match. Codi v3 organiza el catálogo en tres tiers de loading:

| Tier loading                    | Cuántas | Cómo se cargan                                                                                                                                                                                                                                                                                                                                                                          | Ejemplos                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — always-loaded**           | ~10     | `allow_implicit_invocation: true` + carga eager en SessionStart                                                                                                                                                                                                                                                                                                                         | `codi-team-charter`, `codi-recall`, `codi-remember`, `codi-session-recovery`, `codi-caveman`, `codi-{commit,branch-finish}`, `codi-install`, `codi-health-check`, `codi-observability`                                                                                                                                                                                                         |
| **B — implicit-by-description** | ~39     | `allow_implicit_invocation: true` pero carga lazy: SessionStart envía solo `name + description` (corto), el agente expand-ea al matchear                                                                                                                                                                                                                                                | workflows (7), gates triggers, content factory, code-review, refactoring, audit-fix, meta-creators (4), DDD/Hexagonal (6), brainstorming, clarify (NEW), spec-writer (NEW), prototype (NEW), debugging, tdd, plan-writer, plan-execution, codebase-explore, architecture-review, evidence-gathering, verify, dev-{operations,docs-manager,e2e-testing}, dispatching-parallel-agents, worktrees |
| **C — explicit-only**           | ~7      | `allow_implicit_invocation: false`. El SessionStart hook envía SOLO `(name, description)` (~80 chars cada uno) — el agente las conoce para sugerirlas en lenguaje natural ("voy a usar `codi-rotate-secrets`"). El SKILL.md completo se carga solo tras invocación explícita por user (`/skill-name`) o tras agente proponer la skill y user dar 'ok'. Total budget tier C: ~600 chars. | `codi-rotate-secrets`, `codi-deploy`, `codi-connect`, `codi-rule-feedback`, `codi-refine-rules`, `codi-workflow-creator`, `codi-gate-creator`                                                                                                                                                                                                                                                  |

Counts exactos (10 + 39 + 7 = 56 skills) verificados contra §8.1. La asignación tier se documenta como campo `loading_tier: A|B|C` en frontmatter v3 (§7.2 — añadir a estándar).

**Razón del split**:

- Tier A: skills que el agente DEBE conocer en cada sesión (charter, memoria, sesión).
- Tier B: skills cuyo description corto cabe en budget; el SKILL.md completo solo se carga al ejecutar.
- Tier C: skills destructivas o de baja frecuencia que no deberían dispararse por similitud semántica.

**Implicación operativa**: el adapter de cada agente Tier 1 emite `.claude/skills/` y `.agents/skills/` con el tier reflejado en frontmatter. Codex y Claude Code aplican budget independientemente; el split tier evita que el agente truncate skills críticas.

### 8.1 Skills (56)

#### Foundation (4)

1. `codi-team-charter`
2. `codi-caveman`
3. `codi-recall`
4. `codi-remember`

#### Workflows (7)

5-11. `codi-{project,feature,bug-fix,refactor,migration,audit,review}-workflow`

#### SDD inner-loop core (9) — alineado con 5 fases SDD canónicas

| #   | Skill                            | Fase SDD        | Rol                                                                                                                    |
| --- | -------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 12  | `codi-clarify` (NEW)             | 1 Clarify       | entrevista 1-Q-at-time + lazy CONTEXT.md, absorbe grill-me + grill-with-docs patterns                                  |
| 13  | `codi-spec-writer` (NEW)         | 2 Spec          | doc 1-2 páginas: Problem / User stories / Acceptance criteria / Out of scope / Constraints. Termina con HARD GATE 'ok' |
| 14  | `codi-plan-writer`               | 3 Plan          | bite-sized tasks (2-5 min) con vertical slices; header agentic-aware estilo superpowers/writing-plans                  |
| 15  | `codi-plan-execution`            | 4 Implement     | task-by-task con fresh subagent + two-stage review (spec compliance → code quality)                                    |
| 16  | `codi-tdd`                       | 4 (sub-cycle)   | red-green-refactor micro-cycle dentro de cada task; Iron Law TDD                                                       |
| 17  | `codi-debugging`                 | 4 (sub bug)     | 4-phase systematic-debugging: root cause → reproduce → hypothesize → instrument; Iron Law debug                        |
| 18  | `codi-verify` (RENAMED)          | 5 Verify        | gate de completion con evidence required; Iron Law verification. Absorbe codi-verification + codi-test-suite           |
| 19  | `codi-code-review` (MERGED)      | 5 (post-verify) | bidireccional: request side + receive side. Absorbe codi-pr-review + codi-receiving-code-review                        |
| 20  | `codi-codebase-explore` (MERGED) | 1 (sub-skill)   | exploración estructural; absorbe codi-codebase-onboarding                                                              |

#### SDD inner-loop ortogonales (4) — invocadas por trigger

21. `codi-brainstorming` — divergent ideation antes de Clarify (2-3 opciones); NO solapa con clarify
22. `codi-prototype` (NEW) — throwaway entre Spec y Plan si design uncertain; captura decisión en ADR
23. `codi-architecture-review` — revisión arquitectónica en fase Plan o post-Verify
24. `codi-evidence-gathering` — captura evidencia externa (logs, traces) en cualquier fase

#### Workflow utility (3)

25. `codi-worktrees`
26. `codi-dispatching-parallel-agents`
27. `codi-session-recovery` (movido aquí; antes en session continuity)

#### Deployment lifecycle (4)

28. `codi-install` (mode: install)
29. `codi-health-check`
30. `codi-deploy`
31. `codi-connect`

#### Codi self-development (3)

32. `codi-dev-operations`
33. `codi-dev-docs-manager`
34. `codi-dev-e2e-testing`

#### Code quality (1)

35. `codi-refactoring`

(Note: `codi-code-review` ya listada en SDD inner-loop core #19, bidireccional. `codi-pr-review` y `codi-receiving-code-review` deprecadas — absorbidas por `codi-code-review`.)

#### Git lifecycle (3)

36. `codi-commit`
37. `codi-branch-finish`
38. `codi-audit-fix`

#### Self-improvement (2)

39. `codi-rule-feedback`
40. `codi-refine-rules`

#### Meta-creators (4)

41. `codi-skill-creator`
42. `codi-rule-creator`
43. `codi-agent-creator`
44. `codi-preset-creator`

#### Session continuity (1)

45. `codi-session-log`

(Note: `codi-session-recovery` ya listada en Workflow utility #27.)

#### Content (1)

46. `codi-content-factory`

#### Observability (1)

47. `codi-observability`

#### Operations (1)

48. `codi-rotate-secrets`

#### Extensibilidad (2) — Q25

49. `codi-workflow-creator` (crea workflow types custom)
50. `codi-gate-creator` (crea gates custom)

#### Arquitectura DDD/Hexagonal (6) — aprendizajes externos

51. `codi-architecture-propose` — detecta naturaleza del project + 3-options dialog (full/mixed/status-quo) + recuerda elección sesión
52. `codi-domain-modeling` — workshop DDD táctico (bounded contexts + ubiquitous language + context map + aggregates + domain events)
53. `codi-hexagonal-scaffold` — scaffold port + 2 adapters (real + in-memory para tests) en lenguaje detectado
54. `codi-progressive-refactor` — migración módulo a módulo con app funcional tras cada paso (Domain → Application → Infrastructure → Presentation)
55. `codi-compliance-audit` — score 0-100 ponderado (layer 30%, deps 25%, ports 15%, CQRS 15%, testing 10%, observability 5%)
56. `codi-bounded-context-validate` — linter AST-based (no grep) por lenguaje (`dependency-cruiser` TS, `import-linter` Python, `goimports` Go)

#### Catálogo SDD reorg — resumen de cambios (Q30)

**Deprecated (4)**:

- `codi-codebase-onboarding` → absorbido por `codi-codebase-explore`
- `codi-test-suite` → absorbido por `codi-verify`
- `codi-pr-review` → absorbido por `codi-code-review` (bidireccional)
- `codi-receiving-code-review` → absorbido por `codi-code-review` (bidireccional)

**New (3)**:

- `codi-clarify` — entrevista 1-Q-at-time + lazy CONTEXT.md
- `codi-spec-writer` — doc spec antes de plan, separa "qué" de "cómo"
- `codi-prototype` — throwaway pre-Plan si design uncertain

**Renamed (1)**:

- `codi-verification` → `codi-verify` (más conciso, alinea con verb-form)

**Net**: 57 - 4 + 3 = **56 skills**.

### 8.2 Gates (15, todos `mode: gate` — 14 core + 1 opt-in)

Cada gate declara su criterio explícito. Los `agent-fork` gates dispatch un subagent existente del catálogo §8.4 (no se crean subagents nuevos).

| Gate                            | Tipo                       | Workflow uso                                                          | Criterio (chequeable)                                                                                                                                                                                                                                                  | Subagent (si agent-fork)           |
| ------------------------------- | -------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `gate-intent-complete`          | deterministic              | todos                                                                 | `workflow_state.intent.clarification_artifact` existe en BD; no quedan `[NEEDS-CLARIFICATION]` markers                                                                                                                                                                 | —                                  |
| `gate-plan-coverage`            | agent-fork                 | feature, bug-fix, refactor, migration                                 | `spec_artifact` existe + `plan_artifact` existe + subagent verifica que el plan cubre todos los `acceptance_criteria` del spec                                                                                                                                         | `reviewer`                         |
| `gate-deep-modules`             | agent-fork                 | refactor, feature                                                     | subagent verifica que el plan respeta los principios de módulos deep (no shallow), DDD bounded contexts respetados                                                                                                                                                     | `architect`                        |
| `gate-verify-complete`          | mixto                      | todos                                                                 | deterministic: tests last-run exit 0 + coverage ≥ project threshold; agent-fork: subagent valida que evidence_artifacts cubren acceptance_criteria                                                                                                                     | `reviewer` + `compliance-reviewer` |
| `gate-self-review`              | deterministic              | execute phase de feature/bug-fix/refactor                             | `tasks_completed == tasks_total` + `codi-verify` ejecutada y produjo `evidence_artifact` + lint + type-check exit 0                                                                                                                                                    | —                                  |
| `gate-discover-complete`        | deterministic              | project                                                               | `discover.codebase_summary` + `discover.adr_candidates >= 0` (puede ser cero si bootstrap), no hay errores de lectura                                                                                                                                                  | —                                  |
| `gate-decompose-complete`       | deterministic              | project, feature                                                      | `plan_artifact.tasks` no vacío + cada task tiene `files`, `steps` y opcionalmente `vertical_slice` flag                                                                                                                                                                | —                                  |
| `gate-sync-complete`            | deterministic              | project                                                               | `knowledge_base_initialized` event emitido + `backlog_seeded` event emitido                                                                                                                                                                                            | —                                  |
| `gate-reproduce-complete`       | deterministic + agent-fork | bug-fix                                                               | deterministic: existe failing test que reproduce el bug + tests last-run lo muestra failing; agent-fork: subagent valida que el test reproduce el síntoma reportado                                                                                                    | `reviewer`                         |
| `gate-baseline-tests-pass`      | deterministic              | refactor                                                              | tests last-run exit 0 ANTES de empezar refactor (snapshot baseline guardado en BD)                                                                                                                                                                                     | —                                  |
| `gate-rollback-plan-present`    | deterministic              | migration                                                             | `plan_artifact.rollback_steps` no vacío + cada paso tiene comando ejecutable + `rollback_tested` flag set por dry-run                                                                                                                                                  | —                                  |
| `gate-data-validation-complete` | mixto                      | migration                                                             | deterministic: `data-validation.sample_size >= 1000` + `validation_queries_run`; agent-fork: subagent compara estructura pre/post sample                                                                                                                               | `compliance-reviewer`              |
| `gate-scan-complete`            | deterministic              | audit                                                                 | `scan.findings` artifact existe (puede tener 0 findings); `scan_phase_read_only` no se violó (chequeo via PostToolUse events)                                                                                                                                          | —                                  |
| `gate-analysis-complete`        | deterministic              | review                                                                | `analyze.review_artifact` existe + cada finding tiene `severity` y `location`                                                                                                                                                                                          | —                                  |
| `gate-test-first-commit`        | deterministic              | feature, bug-fix, refactor (opt-in via `invariants.tdd_strict: true`) | parsea `git log --since=phase_started`: cada task del plan debe tener un commit `test:` ANTES de su commit `feat:`/`fix:`/`refactor:` correspondiente. Si user no activa `tdd_strict`, este gate no se ejecuta — Iron Law TDD queda como recomendación, no enforcement | —                                  |

### 8.3 Rules (12)

1. `codi-iron-laws`
2. `codi-output-discipline`
3. `codi-workflow`
4. `codi-recommend-pattern`
5. `codi-security`
6. `codi-error-handling`
7. `codi-testing`
8. `codi-git-workflow`
9. `codi-documentation`
10. `codi-improvement-dev`
11. `codi-domain-driven` — cuándo aplica DDD, principios, ubiquitous language obligatorio, anti-patterns (anemic domain, transaction script)
12. `codi-hexagonal-architecture` — ports en domain, adapters en infrastructure, dependency rule estricta, in-memory adapters para tests

### 8.4 Agents (8)

1. `lead`
2. `worker`
3. `reviewer`
4. `advisor`
5. `scaffolder`
6. `docs-lookup`
7. `architect` — read-only, propone arquitectura (DDD/Hexagonal/Layered/Clean) con 3-options dialog. NO modifica código.
8. `compliance-reviewer` — read-only, audita compliance contra rules + emite veredicto PASS / PASS-WITH-WARNINGS / FAIL con severidades CRITICAL/WARNING/INFO.

### 8.5 Presets (1)

`codi-minimal` — incluye los 91 artefactos core (todos excepto `gate-test-first-commit` que es opt-in via `invariants.tdd_strict: true`).

### 8.6 MCP servers (0)

Cero. Política sin-MCP-en-core.

---

## 9. Workflow contracts concretos (7 workflows)

### Skeleton común (todos)

```yaml
events_emitted_default:
  - phase_started, phase_completed
  - phase_transition_proposed, phase_transition_approved, phase_transition_rejected
  - scope_change_classified, scope_expansion_proposed, scope_expansion_approved, scope_expansion_rejected
  - incidental_change_recorded, decision_recorded
  - subagent_dispatched, subagent_completed
  - workflow_completed, workflow_abandoned, workflow_handover

human_approval_required_default:
  - phase_transition_approved, workflow_abandoned

invariants_default:
  - knowledge_base_required: true
  - blocks_main_commit: true
  - blocks_unverified_force_push: true
```

### 9.1 — `codi-project-workflow`

```yaml
phases: [intent, discover, decompose, sync, done]
mandatory_phase: sync
phase_transitions:
  - { from: intent,    to: discover,  requires_gates: [gate-intent-complete] }
  - { from: discover,  to: decompose, requires_gates: [gate-discover-complete] }
  - { from: decompose, to: sync,      requires_gates: [gate-decompose-complete] }
  - { from: sync,      to: done,      requires_gates: [gate-sync-complete] }
events_emitted: + [context_term_added, adr_proposed, adr_approved, knowledge_base_initialized, backlog_seeded]
skills_by_phase:
  intent:    [codi-brainstorming, codi-clarify, codi-recall, codi-codebase-explore]
  discover:  [codi-codebase-explore, codi-evidence-gathering, codi-recall]
  decompose: [codi-spec-writer, codi-plan-writer, codi-dispatching-parallel-agents]
  sync:      [codi-plan-writer]
  done:      [codi-session-log]
invariants: + [allows_blank_knowledge_base: true, bootstrap_workflow: true]
hooks_override: { stop_summary_on: true }
```

### 9.2 — `codi-feature-workflow`

```yaml
phases: [intent, plan, decompose, execute, verify, done]
mandatory_phase: decompose
phase_transitions:
  - { from: intent,    to: plan,      requires_gates: [gate-intent-complete] }
  - { from: plan,      to: decompose, requires_gates: [gate-plan-coverage, gate-deep-modules] }
  - { from: decompose, to: execute,   requires_gates: [gate-decompose-complete] }
  - { from: execute,   to: verify,    requires_gates: [gate-self-review] }
  - { from: verify,    to: done,      requires_gates: [gate-verify-complete] }
skills_by_phase:
  intent:    [codi-brainstorming, codi-clarify, codi-recall]
  plan:      [codi-spec-writer, codi-plan-writer, codi-evidence-gathering, codi-codebase-explore, codi-architecture-review, codi-prototype, codi-architecture-propose, codi-domain-modeling, codi-hexagonal-scaffold]
  decompose: [codi-dispatching-parallel-agents, codi-tdd, codi-plan-writer]
  execute:   [codi-plan-execution, codi-tdd, codi-worktrees, codi-commit, codi-remember]
  verify:    [codi-verify, codi-code-review, codi-bounded-context-validate, codi-compliance-audit]
  done:      [codi-branch-finish, codi-code-review, codi-session-log]
invariants: + [requires_workspace_isolation: true, requires_failing_tests_first: true]
hooks_override: { stop_summary_on: true, pre_tool_use_classifier_mode: hybrid }
```

### 9.3 — `codi-bug-fix-workflow`

```yaml
phases: [intent, reproduce, plan, execute, verify, done]
mandatory_phase: reproduce
phase_transitions:
  - { from: intent,    to: reproduce, requires_gates: [gate-intent-complete] }
  - { from: reproduce, to: plan,      requires_gates: [gate-reproduce-complete] }
  - { from: plan,      to: execute,   requires_gates: [gate-plan-coverage] }
  - { from: execute,   to: verify,    requires_gates: [gate-self-review] }
  - { from: verify,    to: done,      requires_gates: [gate-verify-complete] }
events_emitted: + [hypothesis_proposed, hypothesis_validated, hypothesis_rejected, regression_test_added]
skills_by_phase:
  intent:    [codi-clarify, codi-brainstorming, codi-recall]
  reproduce: [codi-debugging, codi-evidence-gathering, codi-verify]
  plan:      [codi-plan-writer, codi-debugging]
  execute:   [codi-plan-execution, codi-tdd, codi-worktrees, codi-commit, codi-remember]
  verify:    [codi-verify, codi-code-review]
  done:      [codi-branch-finish, codi-code-review, codi-session-log]
invariants: + [requires_failing_test_in_reproduce: true, 3_strikes_rule_diagnose: true]
hooks_override: { stop_summary_on: false, pre_tool_use_classifier_mode: hybrid }
```

### 9.4 — `codi-refactor-workflow`

```yaml
phases: [intent, baseline, plan, execute, verify, done]
mandatory_phase: baseline
phase_transitions:
  - { from: intent,   to: baseline, requires_gates: [gate-intent-complete] }
  - { from: baseline, to: plan,     requires_gates: [gate-baseline-tests-pass] }
  - { from: plan,     to: execute,  requires_gates: [gate-plan-coverage, gate-deep-modules] }
  - { from: execute,  to: verify,   requires_gates: [gate-self-review] }
  - { from: verify,   to: done,     requires_gates: [gate-verify-complete] }
skills_by_phase:
  intent:   [codi-architecture-review, codi-brainstorming, codi-clarify, codi-recall]
  baseline: [codi-verify, codi-evidence-gathering]
  plan:     [codi-plan-writer, codi-architecture-review, codi-codebase-explore, codi-architecture-propose, codi-progressive-refactor, codi-domain-modeling]
  execute:  [codi-plan-execution, codi-refactoring, codi-worktrees, codi-commit, codi-remember, codi-tdd]
  verify:   [codi-verify, codi-code-review, codi-architecture-review, codi-bounded-context-validate, codi-compliance-audit]
  done:     [codi-branch-finish, codi-code-review, codi-session-log]
invariants: + [requires_baseline_tests_passing: true, no_behavior_change: true, requires_failing_tests_first: true]
hooks_override: { stop_summary_on: true, pre_tool_use_classifier_mode: hybrid }
```

### 9.5 — `codi-migration-workflow`

```yaml
phases: [intent, plan, execute, verify, data-validation, done]
mandatory_phase: data-validation
phase_transitions:
  - { from: intent,          to: plan,            requires_gates: [gate-intent-complete] }
  - { from: plan,            to: execute,         requires_gates: [gate-plan-coverage, gate-rollback-plan-present] }
  - { from: execute,         to: verify,          requires_gates: [gate-self-review] }
  - { from: verify,          to: data-validation, requires_gates: [gate-verify-complete] }
  - { from: data-validation, to: done,            requires_gates: [gate-data-validation-complete] }
skills_by_phase:
  intent:          [codi-clarify, codi-brainstorming, codi-evidence-gathering, codi-recall]
  plan:            [codi-spec-writer, codi-plan-writer, codi-codebase-explore, codi-evidence-gathering]
  execute:         [codi-plan-execution, codi-tdd, codi-worktrees, codi-commit, codi-remember]
  verify:          [codi-verify, codi-code-review]
  data-validation: [codi-evidence-gathering, codi-verify]
  done:            [codi-branch-finish, codi-code-review, codi-session-log]
invariants: + [requires_rollback_plan: true, blocks_force_push_all_phases: true, requires_real_data_sample: true]
hooks_override: { stop_summary_on: true, pre_tool_use_classifier_mode: daemon }
```

### 9.6 — `codi-audit-workflow`

```yaml
phases: [intent, scan, fix, verify, done]
mandatory_phase: scan
phase_transitions:
  - { from: intent, to: scan,   requires_gates: [gate-intent-complete] }
  - { from: scan,   to: fix,    requires_gates: [gate-scan-complete] }
  - { from: fix,    to: verify, requires_gates: [gate-self-review] }
  - { from: verify, to: done,   requires_gates: [gate-verify-complete] }
skills_by_phase:
  intent: [codi-clarify, codi-brainstorming, codi-evidence-gathering]
  scan:   [codi-codebase-explore, codi-evidence-gathering]
  fix:    [codi-audit-fix, codi-plan-execution, codi-refactoring, codi-worktrees, codi-commit]
  verify: [codi-verify, codi-code-review]
  done:   [codi-branch-finish, codi-session-log]
invariants: + [scan_phase_read_only: true, per_finding_commit: true]
hooks_override: { stop_summary_on: false, pre_tool_use_classifier_mode: local }
```

### 9.7 — `codi-review-workflow`

```yaml
phases: [intent, analyze, respond, done]
mandatory_phase: analyze
phase_transitions:
  - { from: intent,  to: analyze, requires_gates: [gate-intent-complete] }
  - { from: analyze, to: respond, requires_gates: [gate-analysis-complete] }
  - { from: respond, to: done,    requires_gates: [gate-verify-complete] }
skills_by_phase:
  intent:  [codi-clarify, codi-brainstorming, codi-recall]
  analyze: [codi-code-review, codi-evidence-gathering, codi-codebase-explore]
  respond: [codi-code-review, codi-refactoring, codi-commit, codi-remember]
  done:    [codi-branch-finish, codi-session-log]
invariants: + [analyze_phase_read_only: true, response_required_for_each_finding: true]
hooks_override: { stop_summary_on: false, pre_tool_use_classifier_mode: local }
```

---

## 10. Hooks runtime payload contracts (5 hooks runtime + 1 git hook)

> **Nota terminológica (KB-validated)**: el Anthropic hook protocol cubre 5 eventos runtime (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop) que son IDÉNTICOS en Claude Code y Codex CLI. `pre-push` NO es parte de ese protocolo — es un git hook independiente que vive en `.husky/pre-push` o `.git/hooks/pre-push`. Codi v3 lo integra para enforce branch policy, pero la separación conceptual es importante: los 5 runtime hooks usan el wrapper `_hook-handler.cjs` con stdin JSON; el git hook recibe stdin formato git y NO depende del runtime de Claude Code/Codex. PermissionRequest existe en ambos protocolos pero Codi v3 v3.0 lo usa solo para auto-allow `mcp__codi__.*` (config estática), no como hook runtime con lógica.

### 10.1 Wrapper común (safe fallback)

```bash
#!/bin/bash
set -euo pipefail
[[ -z "${CLAUDE_PROJECT_DIR:-}" ]] || [[ ! -f "$CLAUDE_PROJECT_DIR/.codi/codi.yaml" ]] && exit 0
source "$CLAUDE_PROJECT_DIR/.codi/runtime/.env"
curl -sf -m 1 "${CODI_API_URL}/healthz" > /dev/null || { echo "{}"; exit 0; }
INPUT=$(cat)
exec node "$CLAUDE_PROJECT_DIR/.codi/hooks/$1.cjs" <<< "$INPUT"
```

### 10.2 Hook 1: `SessionStart`

**Input**: `{ session_id, transcript_path, cwd, matcher: "startup"|"resume", hook_event_name: "SessionStart" }`

**Codi v3 hace**:

1. Lee `.codi/codi.yaml` → mode + api_url
2. Probe daemon (timeout 3s); si local + docker down → `docker compose up -d`
3. GET `/v1/session/bootstrap?project_id=...&session_id=...`
4. Compone `additionalContext` con: tier actual, charter, pending workflows, last session summary
5. POST telemetry

**Output**: `{ additionalContext: "<codi-context>...</codi-context>", decision: null }`

### 10.3 Hook 2: `UserPromptSubmit`

**Input**: `{ session_id, prompt, transcript_path, hook_event_name }`

**Codi v3 hace**:

1. Lee active workflow state (Postgres `codi_process.workflows`)
2. Match `prompt` contra `triggers.patterns` de skills disponibles
3. POST `/v1/notes/search { query: prompt, k: 5, scope: project }` (recall whisper, **síncrono con timeout 1s configurable**)
4. POST `/v1/notes/resolve-wikilinks` si prompt contiene `[[ ]]`
5. Compone `additionalContext` estructurado
6. POST telemetry

**Output**: `{ additionalContext: "<workflow-state>...</workflow-state>\n<recall-whisper>...</recall-whisper>\n<skill-hint>...</skill-hint>" }`

### 10.4 Hook 3: `PreToolUse`

**Input**: `{ session_id, tool_name, tool_input, transcript_path, hook_event_name }`

**Codi v3 hace** (decision tree con **classifier_mode configurable**):

1. **Bash**: regex match contra `GUARD_BASH_PATTERNS` → deny si dangerous
2. **Edit/Write/NotebookEdit**:
   - Verifica file en scope.protected → deny
   - Si active workflow + file fuera de scope_files → run classifier (local/daemon/hybrid)
   - Si classify == 'incidental' → allow + flag
   - Si classify == 'scope-expansion' → deny con guía
3. POST telemetry: `evaluated_count, blocked_count, block_reasons, classifier_confidence`

**Output (allow)**: `{}`

**Output (deny)**: `{ permissionDecision: "deny", permissionDecisionReason: "..." }`

### 10.5 Hook 4: `PostToolUse`

**Input**: `{ session_id, tool_name, tool_input, tool_response, transcript_path, hook_event_name }`

**Codi v3 hace**:

1. Si edit clasificado `incidental`: emit event `incidental_change_recorded`
2. POST `/v1/notes/record` con `type='thought'`, `body='[edit]: <file>'`
3. Si edit afecta `.codi/skills/<x>/SKILL.md` (managed_by:user): trigger background `codi generate`
4. **Workflow state update** (cierra el gap entre tool execution y workflow_state):
   - Si transcript contiene marker `[CODI-TASK-DONE: <task_id>]` desde el último PostToolUse: POST `/v1/workflow/<id>/state-update` con `tasks_completed += [task_id]`.
   - Si tool ejecutado fue `Edit`/`Write` sobre file declarado en `current_phase.expected_outputs`: POST state-update con `outputs_produced += [file_path]`.
   - Garantiza que gates `gate-self-review`, `gate-decompose-complete`, etc. tengan datos frescos al evaluarse.
5. POST telemetry

**Output**: `{}`

### 10.6 Hook 5: `Stop`

**Input**: `{ session_id, transcript_path, hook_event_name, stop_hook_active }`

**Codi v3 hace**:

1. Lee transcript completo
2. Extrae markers: `[CODI-OBSERVATION:...]`, `[CODI-EVENT:...]`, `[CODI-PHASE:...]`, `[CODI-EVIDENCE:...]`
3. Por cada marker, request al daemon
4. Parsea wikilinks `[[ ]]` en transcript
5. POST `/v1/notes/resolve-wikilinks` con la lista
6. **Workflow state update** (consolidación de evidence al cierre del turno):
   - Por cada marker `[CODI-EVIDENCE: <type>=<value>]`: POST `/v1/workflow/<id>/state-update` con `evidence_artifacts.append({type, value, ts})`.
   - Por cada marker `[CODI-PHASE-READY]`: POST con flag `current_phase.agent_proposes_transition = true` (deja que el workflow runner evalúe gates).
7. Si workflow activo + `summary_on_stop: true` (per workflow/project/agency): genera session summary llamando LLM
8. POST telemetry: `markers_extracted, observations_persisted, wikilinks_parsed, wikilinks_resolved_rate, missing_stubs_created, evidence_consolidated`

**Output**: `{}`

### 10.7 Git hook (no Anthropic protocol): `pre-push`

**Propósito**: este hook NO es parte del Anthropic hook protocol. Vive en `.husky/pre-push` (gestionado por husky) y NO recibe stdin JSON del runtime del agente. Codi v3 lo provee como integración complementaria, pero conceptualmente es independiente de los 5 hooks runtime.

**Input**: stdin formato git `<local-ref> <local-sha> <remote-ref> <remote-sha>`

**Codi v3 hace**:

1. Detecta force-push: `<local-sha>` non-fast-forward respecto a `<remote-sha>`
2. Si force-push:
   - Lee commits que se dropearían: `git rev-list <remote-sha> ^<local-sha>`
   - Para cada commit: verifica si toca `.codi/runtime/archives/`
   - Si alguno toca archives: BLOCK
3. Verifica branch policy: pushing a main/develop directamente con `--force`: BLOCK
4. Exit 0 si OK, 1 si BLOCK con stderr explicativo

### 10.7-bis-pre — Patrones operacionales canónicos (lecciones de ruflo y OpenSpec)

**Pattern A0 — Tool name normalization (apply_patch ↔ Edit/Write/NotebookEdit)**

Los matchers en `.claude/settings.json` y `.codex/hooks.json` aceptan alias para escribir reglas portables (e.g. `"matcher": "Edit|Write|apply_patch"`), pero el campo `tool_name` reportado en stdin difiere por agente:

- Claude Code reporta `tool_name: "Edit"` o `"Write"` o `"NotebookEdit"`.
- Codex CLI reporta `tool_name: "apply_patch"` para los tres (unifica file edits).

`_hook-handler.cjs` normaliza al inicio:

```js
const TOOL_ALIASES = { apply_patch: "Edit" };
const tool = TOOL_ALIASES[input.tool_name] || input.tool_name;
```

Toda lógica downstream (scope enforcement, classifier, telemetría) usa el nombre normalizado. Razón: sin esto, una rule `Edit` no matchea contra eventos de Codex y el scope enforcement falla silenciosamente.

**Pattern A — `stdin-jq-xargs` (shell-injection safety)**

NUNCA pasar `$TOOL_INPUT_*` directamente a un comando shell. Adoptar como patrón canónico:

```bash
# Vulnerable (NO usar):
"command": "codi-hook ${TOOL_INPUT_command}"

# Seguro (canónico Codi v3):
"command": "cat | jq -r '.tool_input.command' | tr '\\n' '\\0' | xargs -0 -I {} codi-hook '{}'"
```

Razón: ruflo issue #1747 documenta que inputs con `>` redirects creaban archivos vacíos en CWD. Codi v3 nace con el patrón seguro desde el día 1.

**Pattern B — Timeout-everywhere en hook handler**

Hook handler central `.codi/hooks/_hook-handler.cjs` con 3 timeouts:

| Timeout             | Default | Aplica a                                   |
| ------------------- | ------- | ------------------------------------------ |
| `globalTimeout`     | 5000ms  | Hook completo (kill si excede)             |
| `readStdinTimeout`  | 500ms   | Lectura de stdin (no espera input colgado) |
| `subHandlerTimeout` | 3000ms  | Cada sub-handler invocado por dispatch     |

Razón: ruflo issues #1530 + #1531 — hooks que cuelgan paralizan Claude Code entero. Codi v3 nace con timeouts, no como retrofit.

**Pattern C — `Stop` y `SubagentStop` tipo `prompt` (LLM self-evaluation)**

En lugar de comando shell, el hook devuelve un prompt al LLM que responde JSON:

```json
{
  "type": "prompt",
  "prompt": "Has the workflow phase completed all required tasks? Reply with: {\"decision\": \"stop\"|\"continue\", \"reason\": \"...\"}"
}
```

El LLM evalúa el transcript completo y decide si es OK terminar o si quedan tareas pendientes. Self-evaluation runtime.

**Pattern D — `PermissionRequest` auto-allow per matcher**

Reduce prompts repetitivos al user para tools propios:

```json
"PermissionRequest": [{
  "matcher": "^Bash\\(codi .*\\)$",
  "decision": "allow"
}]
```

Sin esto, cada `codi memory search` pide permiso al user. Friction insostenible.

**Pattern E — Three-layer instructions al agente** (de OpenSpec)

Endpoint `GET /v1/skills/:name/instructions?phase=X` retorna 3 campos separados:

```json
{
  "context": "Project tech stack: TypeScript + Hono + Postgres...",
  "rules": ["Cada use case en 6 pasos", "Domain layer no importa de Infrastructure"],
  "template": "## Use Case: <name>\n### Pre-conditions\n...",
  "instruction": "Create a new use case following the template..."
}
```

Con guardrail explícito: _"do NOT copy `<context>` or `<rules>` blocks into the artifact"_. Esto previene que el agente copie las constraints en el output.

**Pattern F — Pre-write validation atómica** (de OpenSpec)

Cualquier mutación de artifact:

1. Construye el output completo en memoria
2. Valida contra Zod schema final
3. Solo escribe si pasa
4. Si falla: log + abort + "No files were changed"

Sin escrituras parciales que dejen state corrupto.

**Pattern G — Resilient parsing con `safeParse` por campo** (de OpenSpec)

Parser de configs:

- Cada campo se valida con `safeParse` independiente
- Campo inválido emite warning pero NO descarta el resto
- Mejor UX que abortar el comando entero por un typo

**Pattern H — Manifest JSON canónico, docs derivadas** (anti-drift de ruflo)

Codi v3 mantiene `codi list --json` como single-source-of-truth. Documentación Astro Starlight se genera desde el manifest, no se edita a mano. Evita drift documental que ruflo sufre (215 vs 314 vs 300 MCP tools en distintos docs).

**Pattern I — Smoke test as artifact contract** (de ruflo)

Cada skill/rule/agent ships con `<artifact>/scripts/smoke.sh` que valida output exact-match `N passed, 0 failed`. Linter `codi validate` ejecuta smokes en pre-commit. Sin smoke verde: artifact no se publish-a.

**Pattern J — Namespace convention** (de ruflo)

Memoria + improvements + overrides usan namespace `<artifact-stem>-<intent>`:

- `notes-observations`, `notes-lessons`, `notes-decisions`
- `workflows-state`, `workflows-events`
- `improvements-candidates`, `improvements-applications`

Reservados: `codi-system`, `codi-meta`. Documentado en single-source.

### 10.7-bis — Scope enforcement modes (Q23)

PreToolUse hook tiene **4 modos** configurables por workflow + per-phase:

| Modo                            | Comportamiento                                         | Default en                                                     |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| `strict`                        | Bloquea cualquier edit fuera de `scope.files_in_plan`  | migration, audit-scan, review-analyze                          |
| `warn`                          | Permite + emite warning, NO expande scope              | rara vez, opt-in agency                                        |
| **`auto-expand`** **(default)** | Permite + auto-añade al scope + audit event            | feature, bug-fix, refactor, project, audit-fix, review-respond |
| `off`                           | Sin scope tracking. Solo bloquea por always-block list | rapid prototyping opt-in                                       |

**Lista always-block** (independiente del modo, SIEMPRE bloquea):

- `.env*`, `**/.env*`
- `*.lock`, `package-lock.json`, `pnpm-lock.yaml`
- Files con marker `<!-- generated -->` o en `paths.protected`
- Migrations en `migrations/applied/`
- `.git/`, `.codi/runtime/archives/`
- Push directo a branches protegidos (main, develop, release/\*)
- Patterns extra de `.codi/codi.yaml#paths.always_block` (extensible per-project)

**Verify phase** muestra "scope drift" al humano:

- Original scope vs auto-expanded files
- Si drift >50%: gate-verify-complete pide reflexión soft (no bloqueo)

**Eventos nuevos**: `scope_auto_expanded`, `scope_drift_high_warning`.

### 10.8 Configuración tunable (Q16)

`.codi/codi.yaml`:

```yaml
hooks:
  pre_tool_use:
    classifier_mode: local | daemon | hybrid # default: local
    classifier_threshold: 0.7
  stop:
    summary_default: false
    summary_provider: anthropic/claude-haiku-4-5
    summary_max_tokens: 300
  user_prompt_submit:
    recall_whisper_timeout_ms: 1000
    recall_whisper_top_k: 5
  session_start:
    auto_recovery: true
    bootstrap_max_tokens: 1500
```

Jerarquía override: `workflow.hooks_override` > `project (.codi/codi.yaml)` > `agency (codi_auth.agency_settings)` > `system_default`.

### 10.9 Configuración Codex CLI específica (KB-validated)

Cuando el agente Tier 1 es Codex, `.codex/config.toml` lleva tres claves obligatorias para Codi v3:

```toml
[features]
# Verificar (no asumir): codex_hooks es Stable + default true en releases recientes.
# Codi v3 lo deja explicito por idempotencia + para soportar versiones older.
codex_hooks = true

# Nunca añadir co-author trailers (regla del usuario + codi-git-workflow)
commit_attribution = ""

[projects."<absolute-path-del-proyecto>"]
# CRÍTICO: sin trust_level = "trusted", Codex SKIPEA todos los .codex/ layers
# silenciosamente (rules, skills, agents, hooks). codi install lo setea automaticamente.
trust_level = "trusted"
```

**Granular approval policy** (Codex CLI, opcional):

```toml
[approval_policy.granular]
# Ejemplo: aprobar Bash con codi-* siempre, denegar curl externo, pedir confirmación resto
rules = [
  { tool = "Bash", pattern = "^codi-.*", decision = "allow" },
  { tool = "Bash", pattern = "^curl https?://(?!localhost)", decision = "deny" },
]
```

Equivalente Claude Code: `.claude/settings.json#permissionRules` (KB Claude Code es el reference).

**Named permission profiles** (Codex CLI):

```toml
[permission_profiles.codi-workflow]
description = "Permisos default para sesiones con workflow Codi activo"
allow = ["Bash(codi *)", "mcp__codi__*"]
deny  = ["Bash(rm -rf *)", "Bash(git push --force *)"]

[permission_profiles.codi-readonly]
description = "Solo lectura — para review/audit phases"
allow = ["Read", "Grep", "Glob"]
deny  = ["Edit", "Write", "Bash"]
```

Codi v3 emite ambos profiles desde el adapter Codex; el workflow activo selecciona cuál cargar según `phase.permission_profile`.

---

## 11. Sistema de overrides en 3 capas (Q13)

### 11.1 Las 3 capas

```
┌─────────────────────────────────────────────────────────────┐
│ CAPA 1 — Filesystem committed a git (.codi/)                │
│   Base builtin (managed_by:codi) o user customization       │
│   Sync: git pull/push                                       │
│   Velocidad: minutos | Permanencia: alta                    │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│ CAPA 2 — BD Postgres (codi_notes.skills_overrides)          │
│   Improvements aprobadas con HARD GATE                      │
│   scope=user/project/agency, status active|reverted|materialized│
│   Sync: SSE broadcast + auto-pull en SessionStart           │
│   Velocidad: segundos | Permanencia: media                  │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│ CAPA 3 — Cache local (.claude/, .codex/, .cursor/)          │
│   = Capa1.base + Capa1.user + Capa2.overrides               │
│   gitignored, regenerado por codi generate                  │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 Orden de precedencia

```
effective_skill_content = base_skill_content
                       + apply(user_customization_diff)
                       + apply(active_overrides_scope_agency)
                       + apply(active_overrides_scope_project)
                       + apply(active_overrides_scope_user)
```

Más específico gana: user > project > agency > customization > base.

### 11.2-bis Fingerprint del base (resuelve riesgo OpenSpec replace-only)

Schema `codi.skills_overrides` lleva **`base_hash`** SHA-256 desde día 0:

```sql
CREATE TABLE codi.skills_overrides (
  id uuid PK,
  artifact_name text,
  diff text,
  base_version int,
  base_hash text NOT NULL,          -- SHA-256 del SKILL.md base al momento de aprobar el override
  scope text,
  ...
);
```

**Detección de conflictos**:

1. Al aplicar un override: lee base actual del SKILL.md, calcula `current_base_hash`
2. Si `current_base_hash != override.base_hash`: el base cambió desde que se aprobó el override
3. Sistema NO aplica silenciosamente. Genera **conflict marker** estilo git:

```
<<<<<<< current base
... contenido actual del SKILL.md ...
=======
... resultado de aplicar override.diff al base original ...
>>>>>>> override <id>
```

4. Conflict requiere resolución humana (HARD GATE 'ok' del agency_admin).

Esto evita el "silent data loss" que OpenSpec aún arrastra (replace-only en MODIFIED). **Diseño desde día 0, no retrofit**.

### 11.3 Endpoints

```
GET  /v1/skills/:name           # effective (merged)
GET  /v1/skills/:name?raw=true  # solo base
GET  /v1/skills/:name/overrides # lista overrides activos
POST /v1/improvements/:id/materialize  { artifact, scope, approval_token: "ok" }
                                # convierte override en edit del SKILL.md user-managed
```

### 11.4 Materialization

`codi improvement materialize <override_id>` aplica el diff al `.codi/skills/<name>/SKILL.md` (user-managed), bump version, delete override row. Útil tras 30 días estables.

---

## 12. Auto-mejora continua (3 etapas — Q9 simplificada)

### Etapa 1 — Captura libre

Marker `[CODI-OBSERVATION: <artifact>|<texto libre>]` en transcript del agente. Sin taxonomía obligatoria.

Stop hook captura → POST `/v1/notes/record` con `type='improvement', source='agent', status='open'`.

CLI manual: `codi feedback "..."`.

### Etapa 2 — Cribado periódico

Job `improvements-cribado` en `codi-workers`, cada 24h o `codi improvement aggregate`:

1. Lee notes `type='improvement'` con `status='open'`.
2. Embedding cosine similarity > 0.85 + same artifact → cluster.
3. Clusters <3 instancias → `status='noise'`.
4. Clusters ≥3: LLM call (provider configurado) → genera diff propuesto + summary 1-frase + confidence.
5. `status='proposed'`.

### Etapa 3 — Revisión humana (HARD GATE)

UI/CLI muestra candidates `proposed`. Aprobación: `agency_admin` con `--confirm ok` literal.

Aplicación:

1. INSERT en `codi.skills_overrides` con scope + diff (NO escribe al SKILL.md base).
2. Bump conceptual version (override es la "v+1" lógica).
3. Audit en manifest event log: `improvement_applied`.
4. Trigger `codi generate` para regenerar `.claude/` cache con effective.
5. Marca clusters relacionados como `status='applied'`.

Rechazo: `status='rejected'`. Notes del cluster → `status='dismissed'`.

Revert manual: `codi improvement revert <id>`. Sin auto-revert (Iron Law 7).

---

## 13. LLM provider routing

### 13.1 Providers (3, sin local)

- **OpenAI**: chat (`gpt-4o-mini`, `gpt-4o`) + embeddings (`text-embedding-3-large` 3072d default, `text-embedding-3-small` 1536d optional)
- **Anthropic**: chat (`claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`)
- **Google Gemini**: chat (`gemini-2.5-flash`, `gemini-2.5-pro`) + embeddings (`gemini-embedding-001` 768d)

### 13.2 Configuración agency-wide

```yaml
default_chat_provider: anthropic
default_chat_model: claude-sonnet-4-6
default_embedding_provider: openai
default_embedding_model: text-embedding-3-large
default_embedding_dim: 3072
per_task_overrides:
  cribado: anthropic/claude-haiku-4-5
  thoughts_processor: anthropic/claude-haiku-4-5
  gate_plan_coverage: anthropic/claude-sonnet-4-6
  gate_deep_modules: anthropic/claude-sonnet-4-6
```

### 13.3 API keys en Vaultwarden

`codi_auth.secret_refs` referencia items en Vaultwarden organization vault. `codi-app` resuelve via service account token. Cache TTL 5min.

**Cross-environment (G4.3)**: Vaultwarden corre como contenedor en local + cloud (mismo image), evitando doble store. La agencia decide single-source: Vaultwarden self-hosted local con backup periódico a S3, o Vaultwarden en VPS cloud accedido desde dev local via VPN. Adapter para AWS Secrets Manager / GCP Secret Manager queda como **opt-in v3.x** (§24.2 #13) si la agencia ya opera infra KMS managed y prefiere no operar Vaultwarden.

### 13.4 Cost tracking

Cada call → `codi_obs.llm_calls` con tokens + cost USD estimado (tabla pricing hardcoded). Dashboard sección "LLM costs".

### 13.5 Rate limits

In-memory token bucket por agency: 60 req/min, 100k tokens/min default. Excede → 429.

### 13.6 Sin auto-fallback en v3.0

Fail explícito si provider down. Reintento 3x con backoff (1m, 5m, 15m). Switchover automático defer v3.x.

---

## 14. Observabilidad y 5 tiers de degradación

### 14.1 5 tiers

| Tier                                 | Off                                               | Capabilities                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** Full                           | —                                                 | todo                                                                                                                                                                                                                   |
| **1** No embeddings                  | embeddings, similarity edges, cribado clustering  | wikilinks explicit, FTS5, workflow, codegraph queries Memgraph, hive mind                                                                                                                                              |
| **2** No graph projection            | embeddings, Memgraph, graph UI                    | UI tabla, codegraph CTE Postgres, wikilinks contra Postgres                                                                                                                                                            |
| **3** No daemon (read-only fallback) | daemon writes, codegraph indexer, jobs, dashboard | hooks leen cache; writes a queue local                                                                                                                                                                                 |
| **4** Baseline                       | todo daemon-backed                                | static rules + skills + hooks scripts; sin persistencia. **single-user single-project, sin auth, sin RLS, sin scopes**. Equivalente funcional a Codi v2 + DevLoop estáticos. Agencias multi-tenant requieren Tier ≤ 3. |

### 14.2 Health orchestrator

`codi-workers` cada 30s probe daemon + Postgres + Memgraph + LLM error rates → compute tier → update `codi_obs.degradation_state` → SSE broadcast.

### 14.3 Auto-recovery

| Subsystem            | Action                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memgraph             | `docker compose up -d codi-graph`, retry 3x                                                                                                                                 |
| Postgres             | manual (riesgo data loss)                                                                                                                                                   |
| Embeddings           | reset circuit breaker, retry backoff                                                                                                                                        |
| `codi-app`           | `docker compose restart codi-app`                                                                                                                                           |
| `codi-indexer`       | `docker compose restart codi-indexer`                                                                                                                                       |
| pg-boss queue (G3.3) | jobs failed >3 retries van a tabla `pgboss.archive` (DLQ implícita). UI dashboard §15 expone count + permite reenvío manual. Jobs con timeout >300s se kill-an y van a DLQ. |

### 14.4 Hooks awareness de tier

Hooks leen `~/.codi/cache/degradation_state.json` (TTL 30s). SessionStart inyecta status al agente cuando tier > 0.

### 14.5 Skills declaran `min_tier`

Loader verifica tier al cargar. Si `min_tier > current_tier`: skill no carga, agente recibe contexto.

### 14.6 Métricas de hooks (60+)

Universales: `invocations, duration_ms (p50/p95/p99), success_rate, timeout_rate, fallback_rate, malformed_output_rate, daemon_unreachable_rate`.

Por hook: ver §10. SessionStart 7 métricas, UserPromptSubmit 7, PreToolUse 5, PostToolUse 4, Stop 7, pre-push 3.

Persistidas en `codi_obs.hook_telemetry`.

### 14.7 Feature flags por capability (granular, ortogonal a tiers)

Los 5 tiers son degradación automática (system reacts). Las feature flags son opt-out manual (user decides). Los dos coexisten — un flag off siempre apaga la capability sin importar el tier.

```yaml
# .codi/codi.yaml
features:
  self_improvement_loop: true # 3-stage auto-mejora (captura + cribado + revisión humana)
  recall_whisper: true # UserPromptSubmit inyecta resultados similares
  code_graph: true # Memgraph + Qdrant + Tree-sitter (controla los 2 contenedores codegraph)
  embeddings: true # pgvector + similarity edges (apagar = Tier 1 forzado)
  wikilinks_resolver: true # Stop hook parsea [[ ]] y crea stubs
  hard_gate_enforcement: true # apagar = caos; solo dev/debug; NO usar en producción
```

Effect rules:

- `code_graph: false` → docker compose lanza 7 contenedores (no codegraph + indexer).
- `embeddings: false` → fuerza Tier 1 mínimo (sin downgrade automático).
- `self_improvement_loop: false` → skills `codi-rule-feedback`, `codi-refine-rules` no se sugieren (tier C ya las gatea, esto es overlay extra).
- `hard_gate_enforcement: false` → workflow `phase_transition_proposed` se auto-aprueba sin esperar 'ok'. Solo para tests E2E + dev local. NO publicar en docs como recomendación.

`codi config set features.code_graph false` actualiza `.codi/codi.yaml` + emite `feature_flag_changed` event. Hooks releen `.codi/codi.yaml` cache cada 30s.

---

## 15. Dashboard codi-ui (6 secciones)

### 15.1 Stack

React 19 + Vite + Recharts + TanStack Table. SSE para updates real-time. Cache 5min in-memory en `codi-app`. Sin Prometheus/Grafana (`/metrics` endpoint disponible para integración custom).

### 15.2 6 secciones

| Sección           | Endpoint                    | Métricas                                                                              |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| **System health** | `/v1/dashboard/health`      | 9 containers status, DB pool, Memgraph latency, SSE connections, queue depth, RAM/CPU |
| **LLM costs**     | `/v1/dashboard/llm-costs`   | spending/provider/model/task/user/project, tokens trend, EOM estimate, budget         |
| **Workflows**     | `/v1/dashboard/workflows`   | total/in-progress/completed/abandoned, phase distribution, gates failed               |
| **Hive mind**     | `/v1/dashboard/hive-mind`   | active sessions, leases, signals, elevations pending, notes elevated                  |
| **Codegraph**     | `/v1/dashboard/codegraph`   | nodes/edges, coverage %, last reindex, top-10 referenced                              |
| **Reliability**   | `/v1/dashboard/reliability` | tier actual + history, MTTR per subsystem, hook success/latency, % time in Tier 0     |

---

## 16. Lifecycle: install / deploy / connect

### 16.0 Install modes (Q32 — alineado con Baseline lite vs full §31)

`codi install --mode=<lite|standard|full>` permite al user elegir nivel sin entender los 5 tiers internos. Detalle de gating completo en §31.

| Mode               | Containers                                         | BD                                         | Auth/RLS           | Equivale a             | Use case                                                                       |
| ------------------ | -------------------------------------------------- | ------------------------------------------ | ------------------ | ---------------------- | ------------------------------------------------------------------------------ |
| **lite** (default) | 3 (codi-app + codi-workers + codi-db con pgvector) | Postgres                                   | API token estático | v3.0-lite (§31)        | Agencia 4 devs, dev solo, evaluación inicial. ~1.2GB RAM. Cubre 80% del valor. |
| **standard**       | 6 (lite + codi-graph + codi-vector + codi-indexer) | Postgres + Memgraph + Qdrant               | + multi-user JWT   | v3.0-lite + code graph | Agencia que quiere code graph pero sin UI/Vaultwarden. ~2.8GB RAM.             |
| **full**           | 9 (standard + codi-ui + caddy + vaultwarden)       | Postgres + Memgraph + Qdrant + Vaultwarden | + RLS opcional     | v3.0-full              | Agencia con UI dashboard + Vaultwarden + multi-tenant. ~3.5GB RAM.             |

**Alias deprecated**: `--mode=simple` se acepta como alias de `lite` durante v3.0 (CLI emite warning); removido en v3.1.

Migration entre modos:

- `codi install --upgrade --mode=standard` desde lite: pull imágenes Memgraph + Qdrant + indexer, indexa codebase background.
- `codi install --upgrade --mode=full` desde standard: pull UI + caddy + vaultwarden, configura TLS + bootstrap vault.
- `codi install --downgrade --mode=lite` desde standard/full: backup BD a `.codi/backups/<ts>.sql`, para containers extras, mantiene datos en BD core. Reversible.

Default si user no especifica: prompt interactivo "¿lite, standard o full? [lite]" en step 2 del flow.

### 16.1 `codi-install` skill — 11 pasos

1. **Detect environment**: OS, Docker, ports, network outbound, RAM, disk
2. **Choose deployment mode**: local | cloud | hybrid (+ install mode lite/standard/full de §16.0; default `lite`)
3. **Setup infra/ directory**: clone compose desde monorepo
4. **Configure .env**: auto-generate JWT_SECRET, DB_PASSWORD, VAULTWARDEN_ADMIN_TOKEN
5. **Detect & configure LLM providers**: prompt for Anthropic/OpenAI/Gemini keys
6. **Compute feature flags**: based on detected limitations
7. **`docker compose --profile codegraph up -d`**: 9 contenedores arriba
8. **Wait healthchecks 60s**: incluye Vaultwarden bootstrap
   8.5. **Bootstrap Vaultwarden**: create org, service account, store LLM keys
9. **Bootstrap agency + admin user**: via `/v1/auth/bootstrap-agency`
10. **Init project + run doctor**: `.codi/codi.yaml`, validate
11. **Configure Tier 1 agent paths** (per agente detectado):

- **Si Claude Code**: emit `.claude/settings.json` + skills + agents + rules.
- **Si Codex CLI** (CRÍTICO):
  - `~/.codex/config.toml`: añadir `[projects."<absolute-cwd>"].trust_level = "trusted"` (sin esto, Codex SKIPEA todo `.codex/` silenciosamente).
  - `[features] codex_hooks = true` (verificar; default true en versiones recientes pero set explicit por idempotencia).
  - `commit_attribution = ""` (regla anti-AI-signature).
  - Emit `.codex/config.toml` + `.codex/hooks.json` + `.codex/agents/*.toml`.
  - Emit skills nativas a `.agents/skills/` (NO `.codex/skills/`).
  - Si proyecto del user ya tiene `AGENTS.md`: emit `AGENTS.override.md` en lugar de pisar.

### 16.2 4 escenarios

- **A**: Dev solo MacBook (~4min)
- **B**: Agencia restringida (sin internet outbound, features LLM degradadas)
- **C**: VPS Linux (modo cloud). `codi deploy --target vps --host <user@host> --domain <fqdn>` ejecuta: ssh + `git pull` + `docker compose pull` + `docker compose --profile codegraph up -d` + healthcheck. Idempotente. La skill `codi-deploy` (#30) orquesta el flow.
- **D**: Re-install / upgrade (`--upgrade`, idempotente con backup)

### 16.3 Recovery

`codi install --resume` retoma desde step fallido leyendo `~/.codi/install-state.json`.

`codi install --reset` borra todo y empieza de cero.

### 16.4 Telemetría opt-in

Pregunta explícita en step 1. Default off. Endpoint `https://telemetry.codi.dev` recolecta agregados anonimizados.

### 16.5 Skills relacionadas

`codi-install` (mode: install), `codi-health-check`, `codi-deploy`, `codi-connect`.

---

## 17. CLI commands set

### 17.1 Estructura noun-verb (estilo `kubectl`)

15 namespaces + 7 shortcuts top-level:

```bash
# Shortcuts top-level (heavy-use)
codi init           = codi project init
codi up             = codi infra up
codi down           = codi infra down
codi run <type>     = codi workflow run
codi status         # holistic
codi doctor         = codi diagnose health
codi feedback "X"   = codi improvement quick-add
codi connect <url>  = codi project link --api-url

# Namespaces
codi auth          login | logout | me | refresh | tokens
codi project       init | list | link | unlink
codi infra         up | down | restart | logs | status | ps | reset
codi manifest      generate | drift | backup | restore | status
codi workflow      run | status | transition | scope | abandon | recover | list | replay | events
                   handover | handover-accept | force-handover                          # Q23
                   create                                                                # Q25
                   loosen-scope | tighten-scope                                          # Q23
codi gate          create                                                                # Q25
codi memory        record | search | get | timeline | resume-pack | sessions | delete | elevate
codi codegraph     index | status | search | callers | callees | snippet | cypher
codi improvement   list | show | approve | reject | revert | materialize | aggregate
codi llm           config | keys | test | costs
codi skill         list | show | diff | scaffold | validate | overrides
codi rule          list | show | scaffold | validate
codi agent         list | show | scaffold
codi preset        list | install | create
codi diagnose      [--section]
codi migrate       [--from v2|devloop|both --dry-run --revert]
codi rotate        secret jwt|encryption-key|db-password
codi backup        list | restore | prune
codi vault         conflicts list | resolve   (vault export read-only ya, sin reconciler)
```

### 17.2 Flags estándar

```
--json | --yaml | --quiet | --verbose | --dry-run
--confirm <token>     # HARD GATES, espera literal "ok"
--api-url <url> | --token <jwt> | --project <id>
--help, -h | --version, -v
```

### 17.3 HARD GATES enforced

Comandos peligrosos requieren `--confirm ok`:

- `codi infra reset --confirm ok`
- `codi memory delete <id> --confirm ok`
- `codi memory elevate <id> --to-scope agency --confirm ok`
- `codi improvement approve <id> --confirm ok`
- `codi improvement revert <id> --confirm ok`
- `codi improvement materialize <id> --confirm ok`
- `codi llm keys delete <provider> --confirm ok`
- `codi workflow abandon --confirm ok`
- `codi rotate secret <name> --confirm ok`

### 17.4 Tab completion

`codi completions zsh > ~/.zsh/completions/_codi`. Soporte bash/zsh/fish.

### 17.5 Help system 3 niveles

1. Built-in `codi <cmd> --help` (auto-generado por commander)
2. Topic guides `codi help <topic>` (Markdown desde `.codi/docs/help/<topic>.md`)
3. Tutoriales `codi tutorial <topic>` (interactivos con Clack)

---

## 18. Code graph (`code-graph-rag` subproyecto propio del equipo)

### 18.1 Estrategia

`code-graph-rag` es un **subproyecto propio del equipo**, NO un vendor externo. Vive como Git submodule en `projects/code-graph-rag/` o como sibling repo según prefiera el equipo. **Co-evoluciona con Codi v3**: cambios al schema Memgraph, queries Tree-sitter, o API HTTP fluyen sin barrera. El wrapper HTTP de integración puede crecer según necesidad (no es "thin wrapper" forzado).

### 18.2 Containers nuevos (profile: codegraph)

- `codi-vector`: Qdrant 1.11.x para code embeddings
- `codi-indexer`: Python 3.12 + uv + vendor copy + wrapper HTTP de ~150 LOC

### 18.3 Wrapper HTTP minimal

`infra/codi-indexer-wrapper/main.py` (~150 LOC FastAPI):

```python
@app.post("/index") → invoca cgr CLI vía Popen
@app.post("/index/incremental") → realtime_updater.py
@app.get("/search") → semantic_search() de code-graph-rag
@app.get("/callers/{qn}") → MemgraphIngestor Cypher
@app.get("/callees/{qn}") → análogo
@app.get("/snippet/{qn}") → file slice
```

### 18.4 Integración desde codi-app (TS)

Proxy ~200 LOC en `packages/codi-app/src/codegraph/proxy.ts`. Endpoints `/v1/codegraph/*` reenvían al wrapper con auth via `CODI_INDEXER_API_TOKEN`.

### 18.5 Languages

10 builtin (los que code-graph-rag ya soporta): TypeScript, JavaScript, Python, Rust, Go, Scala, Java, C++, Lua + variants.

### 18.6 Cypher passthrough security

Endpoint `/v1/codegraph/cypher`:

1. Auth: rol `agency_admin` obligatorio
2. Rate limit: 5 req/min
3. Timeout: 5s
4. Result cap: LIMIT 1000 auto-injected
5. Read-only: `MATCH` permitido; `CREATE|MERGE|DELETE|SET|REMOVE` rechazado por parser
6. Audit: cada request a `codi_obs.cypher_queries`
7. Project scope: query rewrite añade WHERE project_id

### 18.7 Total LOC nuevo

- 150 LOC Python wrapper
- 200 LOC TS proxy
- = **350 LOC nuevos**

vs alternativa de port-to-TS (~3.700 LOC). **10x menos código mantener**.

---

## 19. Migración Codi v2 + absorción DevLoop

### 19.1 Estrategia: big bang single-branch

```
github.com/codi/codi (monorepo único)
├── main                         → Codi v2 estable, freezeada (solo critical hotfixes)
└── feature/codi-v3              → DESARROLLO COMPLETO de v3 (Fases 0-10)
```

Sin `codi-infra` repo separado. Sin compatibility window. Sin parallel staging.

### 19.2 Sin compat window

v3.0.0 release rompe v2:

- v2 commands removed (excepto migrate commands durante 1 release)
- Major version bump justifica break
- Usuario v2 que intenta upgrade sin migrar: error con guía

### 19.3 Self-host switch atomic con merge

Mismo PR/merge a main incluye:

- v3 source code completo
- Eliminación `src/templates/` (movido a `.codi/`)
- One-layer pipeline activated
- Migración del `.codi/` de este repo a schema v3
- Nueva versión `3.0.0`

### 19.4 Validación pre-merge (9 gates)

1. `docker compose --profile codegraph up -d` → 9 containers healthy en <60s
2. `codi init` en sandbox → arranca + doctor pasa
3. 7 workflows ejecutables E2E
4. Auto-mejora flow: emit → cribado → propose → approve → effective change
5. Hive mind 2 sesiones simultaneas BD compartida
6. Tier degradation: kill containers → tier transitions → recovery → tier 0
7. `codi migrate-from-v2` testeado contra fixture v2 repo
8. Coverage ≥85% global
9. `codi doctor --ci` pasa

### 19.5 Comando único polimórfico

`codi migrate` detecta setup automáticamente:

- `.codi/state.json` → v2 puro
- `.workflow/` + `.devloop/` → DevLoop puro
- ambos → both

Subcomandos: `--from v2|devloop|both --dry-run --revert`.

### 19.6 Skill `codi-migrate` builtin

Una sola skill polimórfica que detecta + orquesta. Vive 1 release; en v3.1 mueve al repo `codi-migrations` opcional; en v3.2 removed.

---

## 20. Build/Release + Secrets + Backup

### 20.1 SemVer + monorepo único

- `v3.0.0`, `v3.0.1`, `v3.1.0`, ...
- Hotfix patches: any time. Minor: biweekly. Major: ADR explícito.
- 1 línea SemVer aplica al CLI + daemon + workers + UI + compose + caddy.

### 20.2 CI release pipeline

```yaml
on: { push: { tags: [v*] } }
jobs:
  validate
  publish-npm                # codi-cli@<version>
  publish-docker (matrix)    # ghcr.io/codi/codi-{app,workers,ui}:<version>+latest+v3+v3.0
  github-release
```

Multi-arch obligatorio: `linux/amd64` + `linux/arm64`.

### 20.3 Secrets en Vaultwarden

- **LLM keys**: vaultwarden organization vault, accedidas vía service account
- **Infra secrets** (`JWT_SECRET`, `DB_PASSWORD`, `VAULTWARDEN_ADMIN_TOKEN`): `~/.codi/infra/.env` chmod 600
- **`ENCRYPTION_KEY`**: eliminado (no se usa pgcrypto)
- **Rotation**:
  - LLM keys: cambio en Vaultwarden UI, propaga en cache TTL 5min
  - JWT/DB password: `codi rotate secret <name>` con `--confirm ok` + restart
- **External Vaultwarden** opt-in: si agencia tiene vault propio, skip-ea container (7 contenedores)

### 20.4 Backup

| Origen            | Frecuencia  | Retención | Encriptado      |
| ----------------- | ----------- | --------- | --------------- |
| Postgres          | daily 02:00 | 30 días   | sí              |
| Memgraph          | weekly      | 4 weeks   | sí              |
| Vaultwarden       | daily 02:30 | 90 días   | sí (más fuerte) |
| `.codi/codi.yaml` | daily       | 30 días   | no              |

Local default `~/.codi/infra/backups/`. Cloud (S3, GCS) defer a v3.x.

`codi backup list/restore/prune` con HARD GATE en restore.

### 20.5 Skill `codi-rotate-secrets` builtin

Orquesta rotación con guía interactiva al agente.

---

## 21. Testing strategy

### 21.1 Stack

- **Unit**: Vitest (heredado Codi v2)
- **Integration**: Vitest + Testcontainers (Postgres + Memgraph + Qdrant + Vaultwarden reales en Docker)
- **E2E**: Playwright + scripted CLI scenarios
- **Contract**: Schema parity tests TS Zod ↔ JSON Schema export
- **Performance**: autocannon + custom harness
- **Chaos**: scripts + Docker API

### 21.2 Pirámide

```
                ╱╲
               ╱E2E╲           ~10% (25 escenarios canónicos)
              ╱──────╲         ~20min full
             ╱ Integ.  ╲       ~20% (testcontainers)
            ╱──────────╲       ~10min full
           ╱   Unit     ╲      ~70% (pure functions, schemas)
          ╱──────────────╲     ~5min full
```

### 21.3 Coverage targets

| Package             | Lines    | Branches |
| ------------------- | -------- | -------- |
| `codi-shared`       | ≥95%     | ≥90%     |
| `codi-app/core`     | ≥90%     | ≥85%     |
| `codi-app/adapters` | ≥85%     | ≥75%     |
| `codi-workers`      | ≥85%     | ≥75%     |
| `codi-cli`          | ≥80%     | ≥70%     |
| `codi-ui`           | ≥75%     | ≥65%     |
| **Global**          | **≥85%** | **≥75%** |

Gate del big bang merge.

### 21.4 25 E2E scenarios mapeados a 9 big bang gates

(detallados en §19.4 + adicionales: wikilinks-resolve, vault-export-cycle, hooks-runtime-flow, hard-gate-ok, cypher-passthrough-rbac, cost-tracking, backup-restore-cycle, sse-stream-multi-client, force-push-archive-block, scope-expansion-flow, generate-multi-agent)

### 21.5 CI pipeline

```
lint-typecheck (5min) → unit (10min) → integration (15min) + schema-parity (3min) → e2e (30min) → coverage-gate
nightly: chaos (45min) + performance bench
```

Required checks para merge a main: lint, unit, integration, schema-parity, e2e, coverage-gate.

---

## 22. Roadmap por fases (12 fases — 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9-bis, 10 — 18 semanas)

| Fase      | Duración | Objetivo                                                                                                                                                                                                                                                                                                                  |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0**     | 1w       | Estabilización: cerrar deudas v2, ADRs base (0001-0005)                                                                                                                                                                                                                                                                   |
| **1**     | 1w       | Estándar interno: schemas Zod nuevos (event, phase, workflow, gate), constants expandidos. **ADR-0006 internal DDD layout** + `dependency-cruiser` config                                                                                                                                                                 |
| **2**     | 2w       | Compose + daemon mínimo: 9 containers arrancando, Postgres schemas DDL, codi-app auth + manifest endpoints, codi-workers pg-boss, Vaultwarden bootstrap. **Layout DDD inicial** (core/application/infrastructure/presentation)                                                                                            |
| **3**     | 2w       | Process (DevLoop absorb): event-log, reducer, classifier, gate-runner; 5 hooks runtime con **stdin-jq-xargs + timeout-everywhere**; 7 workflow contracts; 15 gates (14 core + 1 opt-in `gate-test-first-commit`); 27 workflow infrastructure skills (incluyendo SDD inner-loop core 9 + ortogonales 4 + utility post-Q30) |
| **4**     | 2w       | Notas unificadas + wikilinks: schema, endpoints `/v1/notes/*`, parser wikilinks, markers `[CODI-OBSERVATION]`. **`base_hash` SHA-256 en skills_overrides**                                                                                                                                                                |
| **5**     | 1w       | Embeddings + cribado: pgvector configurado, jobs embedding-compute + similarity, cribado con LLM, LLM provider routing                                                                                                                                                                                                    |
| **6**     | 0.5w     | Vault export + visualización: job export Postgres → `.md` read-only, slugify+frontmatter render TS, Obsidian compat verify                                                                                                                                                                                                |
| **7**     | 1w       | Code graph: integración con `code-graph-rag` (subproyecto propio), Dockerfile thin, wrapper HTTP que puede crecer, proxy desde codi-app, Qdrant container, codi-codebase-explore actualizada. Posibilidad de cambios cross-repo en `code-graph-rag` si necesario                                                          |
| **8**     | 2w       | Hive mind + UI dashboard: lease+signal endpoints, SSE stream, codi-ui 6 secciones, force-directed graph render                                                                                                                                                                                                            |
| **9**     | 1w       | Observability + tiers + auto-recovery: hook telemetry, health orchestrator job, 5 tiers + transitions, skills `min_tier`, recovery scripts                                                                                                                                                                                |
| **9-bis** | 1w       | **Skills DDD/Hexagonal**: 6 skills nuevas (`codi-architecture-propose`, `codi-domain-modeling`, `codi-hexagonal-scaffold`, `codi-progressive-refactor`, `codi-compliance-audit`, `codi-bounded-context-validate`) + 2 rules + 2 agents (architect, compliance-reviewer read-only)                                         |
| **10**    | 1w       | Migración + release v3.0: codi-migrate skill battle-tested, doc `[GUIDE]_migrate-*`, validation 9 gates, big bang merge to main + tag v3.0.0                                                                                                                                                                              |

**Total**: 15.5 semanas + 2.5 semanas de buffer/RC = **~18 semanas** con 2-3 ingenieros TS + 1 colaborador para wrapper Python.

---

## 23. Riesgos y mitigaciones

### 23.1 Arquitectónicos

| Riesgo                                              | Mitigación                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Memgraph BSL license bloquea SaaS                   | Self-hosted ok; ADR documenta; eval Neo4j si SaaS futuro                                                                               |
| Vaultwarden AGPL-3.0                                | Self-hosted internal: sin impacto. Multi-tenant SaaS futuro: revisar                                                                   |
| pgvector + 3072d performance en repos grandes       | HNSW index + cluster pruning; switch a 1536d si bottleneck                                                                             |
| Wikilinks → Memgraph projection lag                 | reconcile job cada 1h + fallback queries Postgres                                                                                      |
| Hooks safe-fallback enmascara fallos reales         | Métricas `hook.fallback_rate` alertan en dashboard Reliability                                                                         |
| Long-running feature/codi-v3 branch diverge de main | Rebase semanal + main en maintenance-only mode                                                                                         |
| code-graph-rag breaking changes                     | Co-evolución coordinada (es subproyecto propio del equipo); cambios cross-repo en mismo PR si necesario; tests E2E validan integración |

### 23.2 Operacionales

| Riesgo                                   | Mitigación                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Dev solo abrumado por 9 contenedores     | `codi install` gestiona todo; healthcheck inmediato; profile codegraph apagable |
| RAM total 3.5GB+ exceeds laptop          | flag para apagar codegraph (Tier 2 manual); warning en step 1 install           |
| Cost LLM out of control                  | dashboard alerts 80% budget + per-task overrides + quota agency                 |
| Cross-project knowledge leak             | RLS Postgres testeado obligatoriamente                                          |
| Hook failures cascadean a sesión rota    | safe fallback wrapper + tier 4 baseline                                         |
| Vaultwarden caído deja sin LLM           | cache TTL 5min en codi-app + degradation tier; LLM keys cached                  |
| Dev edita `.md` del vault esperando sync | docs claras "vault es read-only export"; warning en frontmatter de cada `.md`   |

### 23.3 Adopción

| Riesgo                                      | Mitigación                                                            |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Migración Codi v2 → v3 rompe presets custom | dry-run + reverse migrate + skill `codi-migrate` polimórfica          |
| DevLoop users no migran                     | skill `codi-migrate --from devloop` + bridge mode 1 release           |
| Aprendizaje notes+wikilinks complejo        | onboarding skill + UI graph view + Obsidian compat (read-only viewer) |

---

## 24. Preguntas abiertas

### 24.1 Tácticas (defer a implementation)

1. Schema DDL completo con triggers + constraints (Fase 2)
2. UI design (paleta, componentes específicos) — Fase 8
3. CI/CD release pipeline detallado — Fase 10
4. Documentación user-facing (Astro Starlight) — Fase 10
5. Test fixtures para migrate-from-v2 — Fase 9-10

### 24.2 Estratégicas (revisitar antes de v3.x)

1. **Acquisition policy** (`codi-acquire`): cuándo re-habilitar? Probable v3.1
2. **OAuth login** (GitHub/Google): probable v3.1
3. **Multi-agency-per-instance**: si Codi se ofrece como SaaS hosted. Probable v4
4. **Memgraph swap**: si BSL bloquea, eval Neo4j Community o KuzuDB. Probable v4
5. **Local LLM (Ollama)**: si una agencia restringida lo necesita. Probable v3.x bajo flag
6. ~~**Sheets sync**~~ **DESCARTADO definitivamente**: la persistencia única de Codi v3 es Postgres + Memgraph + Qdrant + Vaultwarden. Toda integridad de datos pasa por la BD. La UI provee export a JSON/CSV/Markdown via `/v1/data/export`. Si una agencia necesita visualización tabular, exporta CSV y carga donde quiera. Sin sync bidireccional con Sheets/xlsx.
7. **VSCode extension** + **Mobile UI**: probable v4
8. **S3/cloud backup storage nativa**: probable v3.x
9. **Privacy + GDPR compliance** (Q24 deferred): probable v3.x. Plantea: transcripts off-default, retention policies, Right to Access export ZIP, Right to Forget con anonimización selectiva, audit log accesos, sub-procesadores documentados, consent flow al sign-up, DPIA template. **No va a desarrollo en v3.0**, queda como roadmap document para cuando la agencia necesite compliance formal.
10. **Kubernetes manifests** (G4.1): docker compose en VPS cubre agencias hasta ~50 devs. K8s manifests + Helm chart se evalúan post-v3.0 si demanda real lo justifica. Probable v3.x.
11. **Terraform / Pulumi modules** (G4.2): provisioning cloud-native (AWS/GCP/Azure) defer post-v3.0. v3.0 documenta deploy manual VPS via `codi deploy --target vps`. Probable v3.x junto con K8s.
12. **Multi-region deployment** (G3.5): plan v3.0 asume single-region. Multi-region requiere Postgres logical replication + Qdrant geo-replication + DNS-based failover. Probable v4 (mismo orden que multi-agency-per-instance).
13. **AWS KMS / GCP Secret Manager adapter** (G4.3): Vaultwarden self-hosted cubre local + cloud cross-environment. Adapter para cloud KMS managed services es opt-in v3.x si una agencia ya tiene infraestructura KMS y prefiere no operar Vaultwarden.
14. **Postgres read replicas + Memgraph cluster + Qdrant cluster** (G3.1 cluster mode): v3.0 single-instance per stateful service. Cluster mode defer v3.x cuando tráfico real lo justifique (>50 devs sostenidos o >10 req/s pico en `codi-app`).

---

## 27. Compatibilidad de agentes en 2 tiers (antes §22-bis-i)

Decisión clave: Codi v3 v3.0 ships con **compatibilidad completa SOLO para Claude Code y Codex CLI** (Tier 1). El resto de agentes recibe config generation estática (Tier 2) sin runtime hooks. Tier 3 evaluable case-by-case.

### Tier 1 — Full compatibility (subset compartido de hooks)

**Agentes**: Claude Code + Codex CLI.

**Justificación verificada contra docs oficiales** (Claude Code: `code.claude.com/docs/en/hooks`; Codex CLI: `developers.openai.com/codex/hooks`):

Ambos agentes implementan hooks con **6 eventos canónicos compartidos** y schema mayoritariamente compatible:

| Evento            | Claude Code | Codex CLI |
| ----------------- | ----------- | --------- |
| SessionStart      | ✅          | ✅        |
| UserPromptSubmit  | ✅          | ✅        |
| PreToolUse        | ✅          | ✅        |
| PermissionRequest | ✅          | ✅        |
| PostToolUse       | ✅          | ✅        |
| Stop              | ✅          | ✅        |

Los **5 hooks runtime** que Codi v3 usa (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop) están **TODOS en este subset compartido**. PermissionRequest aparece en la tabla porque ambos protocols lo soportan, pero Codi v3 v3.0 lo usa solo como config estática (auto-allow `mcp__codi__.*`), no como hook con lógica runtime. El git hook `pre-push` es independiente del Anthropic protocol (vive en `.husky/`). Por tanto Codi v3 puede implementar una lógica única de hooks que sirva a ambos agentes Tier 1.

**Pero requiere adapter por agente** que difiere en:

- **Configuration paths**: Claude Code escribe a `.claude/settings.json`; Codex escribe a `.codex/hooks.json` + habilita `[features] codex_hooks = true` en `config.toml`.
- **Tool name mapping**: Codex usa `apply_patch` para edits + `Bash`. Claude Code usa `Edit`/`Write`/`Bash`. El adapter de Codex traduce internamente.
- **Features avanzados solo Claude Code** que Codi v3 NO usa: prompt hooks, agent hooks, async hooks, `permissionDecision: "ask"|"defer"`, eventos extra (Setup, SessionEnd, ConfigChange, FileChanged, etc.).
- **Eventos exclusivos Claude Code (24+)** que Codi v3 NO requiere: Codi v3 funciona solo con los 6 compartidos.

#### 5 restricciones de compat dual (verificadas contra docs oficiales)

Para que los hooks de Codi v3 funcionen idénticos en Claude Code y Codex, el código debe respetar:

1. **PreToolUse**: usar SOLO `permissionDecision: "deny"` con `permissionDecisionReason`. NO usar `"allow"`, `"ask"`, `"defer"`, `updatedInput`, `additionalContext`, `continue: false` (fail-open en Codex).

2. **PermissionRequest**: usar solo `decision.behavior: "allow"` o `"deny"` con `message` opcional. NO usar `updatedInput`, `updatedPermissions`, `interrupt` (fail-closed en Codex).

3. **PostToolUse**: `decision: "block"` reemplaza output con reason en Codex (no revierte el tool ya ejecutado). NO usar `updatedMCPToolOutput`, `suppressOutput`.

4. **UserPromptSubmit y Stop**: matcher ignorado en Codex. Filtrar dentro del hook handler si se requiere lógica condicional.

5. **Tool name aliasing**: hook handlers deben tratar `tool_name: "apply_patch"` igual que `Edit`/`Write` (Codex unifica file edits bajo `apply_patch`).

Estas 5 restricciones están verificadas contra:

- Claude Code: `https://code.claude.com/docs/en/hooks` (extensión Anthropic)
- Codex CLI: `https://developers.openai.com/codex/hooks` (extensión OpenAI)

El código de Codi v3 hooks lleva tests específicos que validan compat dual contra ambos schemas.

**Features Tier 1**:

- 5 hooks runtime (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop) + 1 git hook (pre-push, fuera del Anthropic protocol)
- Recall whisper en `<workflow-state>` + `<recall>` injection
- Tier degradation context awareness
- Scope enforcement bloqueo en PreToolUse
- Stop hook captura markers `[CODI-OBSERVATION]` automáticamente
- PermissionRequest auto-allow para tools `mcp__codi__.*`
- Wrapper script `_run-node` con stdin-jq-xargs + timeout-everywhere
- Skills cargadas por description match nativo
- Slash commands functional
- Settings.json (Claude) / config.toml (Codex) auto-generated
- TLS / auth via env `CODI_TOKEN`
- Self-improvement loop completamente funcional
- Workflows phase-locked con HARD GATE 'ok' enforced

**Path adapters** (verificados contra docs oficiales — paths NO simétricos):

| Componente                                       | Claude Code                                               | Codex CLI                                                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Settings                                         | `.claude/settings.json`                                   | `.codex/config.toml` (TOML, no JSON)                                                                                                      |
| Skills nativas                                   | `.claude/skills/<name>/SKILL.md`                          | **`.agents/skills/<name>/SKILL.md`** (no `.codex/`!)                                                                                      |
| Agents (subagents)                               | `.claude/agents/<name>.md` (YAML frontmatter)             | `.codex/agents/<name>.toml` (TOML schema distinto)                                                                                        |
| Hooks                                            | `.claude/settings.json#hooks` o plugin `hooks/hooks.json` | `.codex/hooks.json` o inline `[hooks]` en `config.toml`                                                                                   |
| Memory primary                                   | `CLAUDE.md`                                               | `AGENTS.md`                                                                                                                               |
| Memory override (no conflict con repo existente) | n/a (CLAUDE.md is canonical)                              | `AGENTS.override.md` (toma precedencia sobre AGENTS.md)                                                                                   |
| Rules / paths-based                              | `.claude/rules/*.md` con `paths:` frontmatter             | `.codex/rules/*.rules` (Starlark)                                                                                                         |
| Trust model                                      | implicit                                                  | **explícito**: `[projects."<absolute-path>"].trust_level = "trusted"` (sin esto, Codex SKIPEA todos los `.codex/` layers silenciosamente) |
| Commit attribution                               | n/a (Codi rule prohíbe `Co-Authored-By:`)                 | `commit_attribution = ""` obligatorio (Codex añade trailer por default)                                                                   |
| Slash commands                                   | `.claude/commands/<name>.md` o skill                      | NO documentado `.codex/prompts/`. **Equivalente funcional**: skills invocadas con `$nombre`                                               |

### Tier 1 sub-split: 1A (Claude Code) y 1B (Codex CLI) — features asimétricos

Aunque ambos comparten los 5 runtime hooks + git pre-push, hay features avanzados que Codi v3 v3.0 **no** usa pero que vale documentar para v3.x:

**Solo Claude Code (Tier 1A)** — eventos extra disponibles si Codi v3 los adopta más adelante:

- `Setup`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `StopFailure`, `InstructionsLoaded`, `ConfigChange`, `FileChanged`, `PostToolBatch`, prompt hooks, agent hooks, async hooks (~22 eventos extra sobre los 5 compartidos).
- `permissionDecision: "ask"` y `"defer"` con `additionalContext`, `updatedInput`, `updatedPermissions`.
- Subagentes definidos como `.claude/agents/<name>.md` con frontmatter YAML.

**Solo Codex CLI (Tier 1B)** — features extra que Codi v3 sí adopta:

- `commit_attribution = ""` (la regla anti-AI-signature).
- Granular approval policy (§10.9).
- Named permission profiles (§10.9).
- `AGENTS.override.md` para no pisar `AGENTS.md` del proyecto del usuario.
- Trust model explícito (`trust_level = "trusted"` por proyecto).
- Subagentes definidos como `.codex/agents/<name>.toml` (TOML schema diferente; el adapter traduce desde la definición canónica Codi).

**Compromiso v3.0**: la lógica de hooks runtime es ÚNICA y usa solo los 5 eventos + 5 restricciones documentadas en §27. Las asimetrías 1A/1B se manejan en los **adapters** (path + format + config TOML/JSON), no en el código de hooks.

### Plugin distribution model (verificado contra ambos KBs)

Tanto Claude Code como Codex soportan distribución como **plugin** (manifest + marketplace), alternativa al modelo "copiar a `.claude/`/`.codex/`" que Codi v2 usa actualmente:

| Aspecto                             | Modelo overwrite (v2)            | Modelo plugin (v3 propuesto)                                |
| ----------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| Distribución                        | `codi generate` copia archivos   | Marketplace JSON + plugin manifest                          |
| Update                              | `codi generate --force`          | `claude plugins update codi` / `codex plugins update codi`  |
| Conflicto con artifacts del usuario | Posible (mismo path)             | Aislado en `${CLAUDE_PLUGIN_ROOT}` / `${CODEX_PLUGIN_ROOT}` |
| Versionado                          | Basado en frontmatter `version:` | SemVer en `plugin.json`                                     |
| Namespace                           | Convención `codi-*`              | Forzado por plugin id                                       |

**Manifest Claude Code** (`.claude-plugin/plugin.json`):

```json
{
  "id": "codi",
  "version": "3.0.0",
  "skills": ["skills/codi-*/SKILL.md"],
  "agents": ["agents/codi-*.md"],
  "rules": ["rules/codi-*.md"],
  "hooks": "hooks/hooks.json"
}
```

**Manifest Codex CLI** (`.codex-plugin/plugin.json`): schema análogo, pero `skills` apunta a `.agents/skills/` (no `.codex/skills/`) y `agents` a `.codex/agents/*.toml`.

**Decisión v3.0**: shippeamos en **doble track**:

- `codi generate` sigue siendo el modo default (consistente con v2, supports custom paths, no requiere marketplace).
- `codi plugin publish` (nueva) genera los manifests y empuja a un marketplace privado por agencia (opt-in).

El plugin model se vuelve obligatorio cuando Codi v3 ship a marketplace público (post-v3.0). Hasta entonces, sirve como mecanismo opt-in para agencias que quieren auto-update centralizado.

### Tier 2 — Config generation only (sin runtime hooks)

**Agentes**: Cursor, Windsurf, Cline, GitHub Copilot.

**Justificación**: estos agentes NO tienen el sistema de hooks de Anthropic. Soportan solo configs estáticos (rules, instructions, skills como prompt context).

**Features Tier 2**:

- Skills/rules/agents como archivos estáticos generados
- `CLAUDE.md` / `.cursorrules` / `.windsurfrules` / etc. con instrucciones globales
- Configs MCP si el agente lo soporta (Cursor sí, otros parcial)

**Features que Tier 2 NO recibe**:

- Runtime hooks (no soportados por estos agentes)
- Recall whisper dinámico (el agente no tiene hook UserPromptSubmit)
- Scope enforcement runtime (no hay PreToolUse)
- Tier degradation awareness (no hay SessionStart con context inject)
- Marker capture automático (no hay Stop hook)
- Self-improvement loop fluido

**Resultado para Tier 2**: el agente lee skills + rules + agents como prompt context, pero la integración con el daemon Codi v3 es **manual**:

- El dev ejecuta `codi memory record "..."` cuando quiere persistir
- El dev ejecuta `codi run feature ...` cuando quiere arrancar workflow
- El dev consulta `codi recall "..."` cuando quiere context

**Path adapters Tier 2**:
| Agente | Output paths |
|---|---|
| Cursor | `.cursor/rules`, `.cursor/skills/`, `.cursor/mcp.json` |
| Windsurf | `.windsurfrules`, `.windsurf/skills/` |
| Cline | `.clinerules`, `.cline/skills/` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/`, `.github/agents/` |

### Tier 3 — Future evaluation (no en v3.0)

**Agentes**: opencode, Antigravity, Gemini CLI, Q Developer, Continue, otros futuros.

Evaluables case-by-case según demanda real de la agencia. Si un agente Tier 3 adopta el Anthropic hook protocol (como Claude Code/Codex hicieron), puede promoverse a Tier 1 sin reescribir Codi v3.

### Documentación de tiers

`docs/<ts>_[GUIDE]_agent-compatibility-tiers.md` (entregable Fase 10):

- Tabla exhaustiva de features por tier
- Cómo el dev sabe qué tier soporta su agente preferido
- Migración Tier 2 → Tier 1 (cambiar a Claude Code o Codex)
- Roadmap de promoción cuando otros agentes adopten Anthropic hook protocol

### Implicaciones de simplificación

- **Esfuerzo Fase 3 (hooks)**: solo se implementa para Tier 1. Una sola pasada cubre ambos agentes Tier 1.
- **Esfuerzo Fase 8 (UI dashboard)**: se demuestra el flow Tier 1; Tier 2 muestra "limited integration" badge.
- **Tests E2E**: la suite obligatoria valida Tier 1; Tier 2 tiene tests más simples (verifica config files generados correctamente).
- **`codi install`**: pregunta "¿qué agente usas principalmente?". Si Tier 1, configura todo; si Tier 2, configura solo configs estáticos + advierte "integración manual".

## 28. Patrones operacionales de Symphony (OpenAI harness engineering) (antes §22-bis-ii)

Symphony es el orquestador de agentes Codex publicado por OpenAI bajo Apache 2.0 como reference impl de su iniciativa "harness engineering". Implementado en Elixir/OTP. Codi v3 adopta los siguientes 8 patrones (sin migrar a BEAM, ecosistema TS más relevante para integraciones agente):

### 1. SPEC normativa RFC 2119

Symphony publica `SPEC.md` (2169 líneas) language-agnostic con MUST/SHOULD/MAY. Permite que otro agente reimplemente Symphony en cualquier lenguaje desde el SPEC.

**Codi v3**: publicar `docs/CODI_V3_SPEC.md` con MUST/SHOULD/MAY normativos. Permite reimplementación Python/Go/Rust desde el SPEC + da contrato estable para tooling externo.

### 2. WORKFLOW.md as in-repo contract

Symphony tiene un solo `WORKFLOW.md` con YAML front matter + body Liquid. Versionado con código del repo consumidor. Hot-reloaded cada 1s.

**Codi v3**: ya alineado con `.codi/codi.yaml` + frontmatter de workflow-skills (Q12). Refuerzo: hot-reload polling de mtime+hash con last-known-good si el parse falla.

### 3. Single-writer Orchestrator aggregate

Toda mutación del scheduling state pasa por un único `GenServer` que actúa como single source of truth. Workers reportan via mensajes asíncronos. Evita locks y race conditions.

**Codi v3**: con DDD/Hexagonal interno (§29), el `Orchestrator` es Aggregate Root del bounded context `workflows`. Métodos: `tick`, `dispatch`, `reportWorkerExit`, `reportAgentEvent`, `scheduleRetry`. Workers (containers) reportan via SSE/HTTP, nunca mutan state directamente.

### 4. Continuation retries de 1s tras éxito

Symphony agenda re-check del estado externo 1s después de que el worker exit limpio. Razón: agente "exit normal" no significa "issue done". El tracker decide.

**Codi v3**: tras `workflow_completed` event, schedule `continuation_check` 1s después que verifica si el PR sigue open / branch ahead-of-main / ticket sigue activo. Si sí: trigger nuevo run.

### 5. Stall detection por eventos del agente (no subprocess alive)

Symphony mantiene `last_event_at` por agente. Si supera `codex.stall_timeout_ms` (default 5min), termina el worker y schedule retry.

**Codi v3**: hook PostToolUse + Stop emiten `agent_event` cada N segundos. Health orchestrator detecta agentes en deadlock interno (subprocess vivo pero sin output) y los mata con retry. Métrica nueva: `agent.stall_terminated_count`.

### 6. Retry tokens (`make_ref()`) para invalidación atómica

Cada retry agendado lleva un token único. Al ejecutarse, verifica que sigue siendo el activo (no fue cancelado y reagendado). Evita zombi-callbacks.

**Codi v3**: usar `crypto.randomUUID()` o counter monotónico. Schema `codi_process.retry_attempts` ya tiene espacio para `retry_token text`.

### 7. Path safety con canonicalize symlink-segment

Symphony tiene `PathSafety.canonicalize/1` que resuelve symlinks segmento-a-segmento para detectar escapes del workspace root.

**Codi v3**: importante con docker volumes montados. Hooks que generen symlinks maliciosos no podrán escapar `.codi/runtime/` o el repo del project. Implementación: ~50 LOC TS.

### 8. Mandatory acknowledgement flag

Symphony exige `--i-understand-that-this-will-be-running-without-the-usual-guardrails` con banner ANSI rojo para arrancar. Reconocimiento ético explícito de que está corriendo agentes sin supervisión humana.

**Codi v3**: para modos peligrosos (`--auto-approve`, `--bypass-confirmations`, `--danger-full-access`), exigir flag explícito largo + banner rojo. Patrón ético adoptable directamente.

### Patrones que NO copiamos de Symphony

- **State in-memory exclusivo**: Codi v3 con Postgres es superior. Symphony pierde retry timers en restart.
- **TUI dashboard de 1952 LOC**: Codi v3 tiene web dashboard React 19, suficiente.
- **Tracker.Linear único**: Codi v3 no se ata a Linear, mantiene workflow contracts agnósticos.
- **JSON-RPC stdio para agente principal**: Codi v3 ya usa HTTP REST + skills enseñan al agente.
- **Single-tenant**: Codi v3 ya planifica multi-tenant por agency con RLS Postgres.
- **`Task.Supervisor` con `:one_for_one`**: docker-compose con `restart: on-failure` cubre el caso sin BEAM.

---

## 29. Codi v3 mismo con DDD táctico + Hexagonal (antes §22-bis)

### 29.1 Bounded contexts internos

Codi v3 tiene 7 bounded contexts naturales en su implementación:

| Context         | Responsabilidad                                            | Aggregate root                 |
| --------------- | ---------------------------------------------------------- | ------------------------------ |
| `notes`         | Observations, lessons, decisions, ADRs, plans, wikilinks   | `Note`                         |
| `workflows`     | Phase machines, gates, events, archives                    | `Workflow`                     |
| `memory`        | Embeddings, retrieval, similarity edges                    | `MemoryStore` (anémico, OK)    |
| `codegraph`     | ACL al code-graph-rag (subproyecto propio del equipo, Q28) | `CodeGraphProxy`               |
| `improvements`  | Auto-mejora 3 etapas, overrides                            | `ImprovementCandidate`         |
| `auth`          | Multi-tenancy, RLS, sessions, secrets refs                 | `User`, `Project`, `Agency`    |
| `observability` | Tiers, metrics, audit, llm_calls                           | (event-sourced, sin aggregate) |

### 29.2 Layout por capas

```
packages/codi-app/src/
├── core/                          # DOMAIN (sin deps externas)
│   ├── notes/
│   │   ├── entities/              # Note (aggregate root), Link
│   │   ├── value-objects/         # NoteId, Slug, Wikilink
│   │   ├── events/                # NoteCreated, NoteLinked, NoteElevated
│   │   ├── services/              # WikilinkResolver
│   │   ├── repositories/          # INoteRepository (interface)
│   │   └── shared/                # tipos compartidos del context
│   ├── workflows/                 # análogo
│   ├── memory/                    # análogo
│   ├── codegraph/                 # análogo
│   ├── improvements/              # análogo
│   ├── auth/                      # análogo
│   ├── observability/             # análogo
│   └── shared-kernel/             # tipos cross-context (Tenant, Scope, Tier)
├── application/                   # APPLICATION (CQRS lite — command/query separation, sin event sourcing completo §29.7)
│   ├── commands/                  # CQRS write
│   │   ├── notes/RecordNote.ts
│   │   ├── workflows/TransitionPhase.ts
│   │   └── ...
│   ├── queries/                   # CQRS read
│   │   ├── notes/SearchNotes.ts
│   │   └── ...
│   └── event-handlers/            # cross-context reaction handlers
├── infrastructure/                # INFRASTRUCTURE (adapters)
│   ├── repositories/postgres/     # PostgresNoteRepository implements INoteRepository
│   ├── adapters/llm/              # OpenAIAdapter, AnthropicAdapter, GeminiAdapter
│   ├── adapters/vaultwarden/
│   ├── adapters/code-graph-rag/   # ACL al wrapper HTTP
│   └── http/hono/                 # Hono routes (presentation entry-point)
└── presentation/                  # PRESENTATION
    └── http/handlers/             # request handlers que invocan use-cases
```

### 29.3 Reglas de dependencia (enforced)

Linter `dependency-cruiser` configurado en pre-commit:

```js
forbidden: [
  { from: { path: "^src/core" }, to: { path: "^src/(application|infrastructure|presentation)" } },
  { from: { path: "^src/application" }, to: { path: "^src/(infrastructure|presentation)" } },
  // G1.2 — anti-corruption layer entre bounded contexts (regla expandida)
  {
    from: { path: "^src/core/(notes|workflows|memory|codegraph|improvements|auth|observability)" },
    to: { path: "^src/core/(notes|workflows|memory|codegraph|improvements|auth|observability)" },
    pathNot: "^src/core/$1", // permite imports DENTRO del mismo context
    reason:
      "cross-context coupling. Use shared-kernel/ types o domain events para comunicación entre contexts.",
  },
];
```

### 29.4 Use cases en 6 pasos

Heredado de ddd_skill.md, refinado:

```ts
class RecordNote {
  async execute(cmd: RecordNoteCommand): Promise<Result<NoteId, RecordNoteError>> {
    // 1. Validate command (Zod)
    const validated = RecordNoteCommandSchema.safeParse(cmd)
    if (!validated.success) return err({ code: 'validation_failed', issues })

    // 2. Load aggregates via repository ports
    const project = await this.projectRepo.findById(cmd.projectId)
    if (!project) return err({ code: 'not_found' })

    // 3. Execute business logic (en domain entity)
    const note = Note.create({ ... })

    // 4. Persist via repository ports
    await this.noteRepo.save(note)

    // 5. Publish events
    await this.eventBus.publish(note.pullEvents())

    // 6. Return DTO
    return ok({ noteId: note.id.value })
  }
}
```

### 29.5 Domain events tipados

Heredado de ddd_skill.md:

```ts
abstract class DomainEvent {
  abstract readonly eventId: string; // uuid
  abstract readonly aggregateId: string;
  abstract readonly occurredOn: Date;
  abstract readonly eventVersion: number; // para forward compatibility
}

class NoteCreated extends DomainEvent {
  constructor(
    readonly noteId: string,
    readonly type: NoteType,
    readonly scope: Scope,
    readonly createdBy: UserId,
  ) {
    super();
  }
}
```

Eventos del manifest event log (Q12) son DomainEvents serializados.

### 29.6 In-memory adapters para tests

Cada port tiene 2 adapters: real (Postgres/HTTP/etc.) y in-memory para tests:

```ts
class InMemoryNoteRepository implements INoteRepository {
  private notes = new Map<string, Note>();
  async save(note: Note) {
    this.notes.set(note.id.value, note);
  }
  async findById(id: NoteId) {
    return this.notes.get(id.value) ?? null;
  }
}
```

Tests unitarios usan in-memory; tests integration usan real con testcontainers (Q19).

### 29.7 NO aplicamos

- **NO `final readonly class` obsesivo**: TS readonly types son suficientes; no merece la pena reinventar `data class` Kotlin-style.
- **NO Aggregate boundaries por reglas de transacción** estrictas: Postgres con OCC `_rev` cubre el caso. Aggregate es organizativo aquí.
- **NO Saga / Process Manager** complejos en v3.0: workflow event log + reducer puro lo cubre.
- **NO Event Sourcing** completo: solo event log auditable, no rebuild-from-events. State materializado en tablas SoT.

## 30. Workflow concurrency + extensibility (Q23 + Q25) (antes §24-bis)

### Concurrencia (Q23)

- **N=20 workflows simultáneos** por project (configurable). Sin limit cross-workflow estricto.
- **File conflicts = trabajo de Git**, no de Codi. Cada workflow vive en su rama via `codi-worktrees`.
- **Workflow ownership**: `current_owner` per workflow.
- **Handover voluntario**: `codi workflow handover --to <user>` + accept del receptor.
- **Force takeover**: solo `project_admin` + workflow stale >7 días + HARD GATE 'ok'.
- **Awareness cross-workflow**: read-only en context del agente, sin enforcement.
- **Pair programming en mismo workflow**: defer v3.x.

### Scope enforcement permisivo (Q23)

- Default `auto-expand` para feature/bug-fix/refactor/project/audit-fix/review-respond.
- Default `strict` para migration + audit-scan + review-analyze.
- Lista pequeña de always-block (independent del modo).
- Verify phase revisa drift.

### Extensibilidad de workflows (Q25)

- **Phases siguen cerradas** (15 phases en vocabulary closed enum, evolución por ADR upstream).
- **Agency puede crear workflow types custom** combinando phases existentes.
- **Agency puede crear gates custom** siguiendo `mode: gate`.
- **Wizards**: `codi-workflow-creator` + `codi-gate-creator` skills builtin.
- **Validación**: Zod + DAG check + skills/gates referenciados existen.
- **Sharing entre projects same agency**: vía git (manual o submodule).
- **Sharing cross-agency**: defer a acquisition policy v3.x.

## 25. Mapping de decisiones a preguntas grilling

| Pregunta | Decisión                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Sección plan                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Q1       | Docker compose multi-container                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | §2                                                                                                                          |
| Q2       | 9 contenedores (con codegraph + Vaultwarden)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | §2.2                                                                                                                        |
| Q3       | Default todo on, apagable; solo APIs LLM externas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | §1.2, §13                                                                                                                   |
| Q4       | Postgres SoT + Memgraph projection (notes); Memgraph SoT + Qdrant (code)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | §5.1                                                                                                                        |
| Q5       | Single-agency-per-instance, 3 scopes, JWT email+pass, project_id en codi.yaml, elevation workflow auto-propose+human-approve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | §3                                                                                                                          |
| Q6       | Skill v3 shape: frontmatter Anthropic + extensiones provides/requires/triggers/skip-when/self_improvement/knowledge + 4 modes + recipe.json opcional                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | §7                                                                                                                          |
| Q7       | 80 artefactos core (49 skills + 14 gates + 10 rules + 6 agents + 1 preset)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | §8                                                                                                                          |
| Q8       | API REST + SSE + JWT bearer + URL versioning + ~50 endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | §6                                                                                                                          |
| Q9       | Notes unificadas + wikilinks `[[ ]]` + cribado embeddings + 3 etapas auto-mejora                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | §4, §12                                                                                                                     |
| Q10      | LLM provider routing 3 providers (OpenAI+Anthropic+Gemini), default chat anthropic, default embedding openai/text-embedding-3-large 3072d                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | §13                                                                                                                         |
| Q11      | Hook metrics (60+) + 5 tiers degradación + auto-recovery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | §10, §14                                                                                                                    |
| Q12      | Workflow contract en frontmatter unificado (mode: workflow)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | §7, §9                                                                                                                      |
| Q13      | 3 capas (filesystem committed + BD overrides + cache local)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | §11                                                                                                                         |
| Q14      | Big bang single-branch monorepo, sin compat window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | §19                                                                                                                         |
| Q15      | CLI noun-verb + 7 shortcuts top-level + flags estándar + tab completion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | §17                                                                                                                         |
| Q16      | Hooks runtime payload contracts; classifier_mode local/daemon/hybrid configurable; stop summary opt-in per workflow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | §10                                                                                                                         |
| Q17      | 7 workflow contracts concretos (project, feature, bug-fix, refactor, migration, audit, review); 14 gates totales                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | §9                                                                                                                          |
| Q18      | codi-install flow 10 pasos + 4 escenarios + recovery con `--resume` + Vaultwarden bootstrap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | §16                                                                                                                         |
| Q19      | Testing: Vitest + Testcontainers + Playwright + 70-20-10 pirámide + 25 E2E + nightly chaos/perf + ≥85% coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | §21                                                                                                                         |
| Q20      | SemVer + monorepo único + Vaultwarden para secrets + backup daily Postgres + skill `codi-rotate-secrets`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | §20                                                                                                                         |
| Q21      | (retired) Vault simplificado: export read-only desde BD, sin reconciler bidireccional                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | §4.3                                                                                                                        |
| Q22      | Code graph: integrar `code-graph-rag` como **subproyecto propio del equipo** (refinado en Q28; histórico inicial decía "vendor Git submodule") — Dockerfile thin + wrapper HTTP ~150 LOC; 9 contenedores cuando codegraph on; Memgraph SoT + Qdrant; 10 lenguajes desde día 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | §18, §2.2                                                                                                                   |
| Q23      | Workflow concurrency: N=20 simultáneos, sin file locks (git lo maneja), handover voluntario + force-takeover stale; scope enforcement permisivo con `auto-expand` default + always-block list pequeña                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | §10.7-bis, §30                                                                                                              |
| Q24      | Privacy + GDPR: **DEFERRED a v3.x**. Plantea transcripts off-default, retention policies, right to access/forget, consent flow, DPIA template                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | §24.2                                                                                                                       |
| Q25      | Workflow types extensibles: phases cerradas (15), agency crea custom workflows + gates via `codi-workflow-creator` y `codi-gate-creator` skills builtin (51 total)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | §8.1, §30                                                                                                                   |
| Q26      | Aprendizajes externos (symfony-hexagonal-skill, ruflo, OpenSpec, ddd_skill.md): 6 skills DDD/Hexagonal builtin + 2 rules + 2 agents read-only; Codi v3 mismo con DDD táctico interno; patrones operacionales canónicos (stdin-jq-xargs, timeout-everywhere, three-layer instructions, base_hash fingerprint, Stop-as-prompt, manifest JSON canónico). Total skills 51 → 57, rules 10 → 12, agents 6 → 8, total artefactos 82 → 92. Roadmap 17 → 18 semanas con Fase 9-bis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | §8, §10.7-bis-pre, §11.2-bis, §29, §22                                                                                      |
| Q27      | Symphony (OpenAI harness engineering) — 8 patrones adoptados: SPEC normativa RFC 2119, WORKFLOW.md hot-reload, single-writer Orchestrator aggregate, continuation retries 1s, stall detection por eventos del agente, retry tokens UUID, path safety canonicalize, mandatory acknowledgement flag. **Sheets/xlsx descartados definitivamente**: persistencia única Postgres+Memgraph+Qdrant+Vaultwarden; export a JSON/CSV/MD via `/v1/data/export`. NO migrar a BEAM/Elixir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | §28, §6.2 (data export endpoints), §24.2                                                                                    |
| Q28      | **`code-graph-rag` es subproyecto propio del equipo** (NO vendor externo): co-evoluciona con Codi v3, cambios cross-repo permitidos, wrapper HTTP puede crecer según necesidad. **Compatibilidad de agentes en 2 tiers**: Tier 1 (Claude Code + Codex, compat verificada en 6 eventos compartidos: SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, Stop), Tier 2 (Cursor + Windsurf + Cline + Copilot, solo config generation estática), Tier 3 (resto evaluable case-by-case). 5 restricciones de compat dual verificadas contra docs oficiales (no usar permissionDecision:"ask"/"defer", no usar updatedInput en PreToolUse, etc.). Tool name aliasing: `apply_patch` ↔ `Edit`/`Write`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | §0, §18, §27                                                                                                                |
| Q29      | **Validación KB profunda Claude Code + Codex CLI**: 12 ajustes aplicados al plan. (1) Path asimetría skills nativas: Codex usa `.agents/skills/` (NO `.codex/skills/`). (2) Trust model Codex: `trust_level = "trusted"` obligatorio sin lo cual Codex skipea `.codex/` silenciosamente. (3) `commit_attribution = ""` obligatorio en Codex (default añade trailer AI). (4) `AGENTS.override.md` para Codex sin pisar `AGENTS.md` del proyecto. (5) Custom agents Codex en TOML (no Markdown YAML) — adapter traduce formato. (6) Plugin distribution model documentado como doble track con `codi generate` (default) + `codi plugin publish` (opt-in). (7) `pre-push` reclassificado como git hook fuera del Anthropic protocol; §10 dice "5 hooks runtime + 1 git hook". (8) Skills budget tiering A/B/C (10 always / 40 implicit-by-description / 7 explicit-only) para evitar truncate del ~2% context budget. (9) `codex_hooks` ya default true; documentar como "verificar". (10) Tool aliasing apply_patch ↔ Edit/Write/NotebookEdit normalizado en `_hook-handler.cjs` (Pattern A0 §10.7-bis-pre). (11) Granular approval policy + named permission profiles documentados en §10.9. (12) Tier 1 sub-split 1A (Claude Code) / 1B (Codex) con asimetrías declaradas. `codi-install` ahora 11 pasos (added step 11 Tier 1 agent paths + Codex trust setup).                                                                                                                                                                                                                                                                        | §8.0, §10 (header + 10.7 + 10.9), §10.7-bis-pre (Pattern A0), §16.1, §27 (sub-split + plugin)                               |
| Q30      | **SDD inner-loop reorg + 4-layer consistency** (post-análisis spec-kit + skills/ Matt Pocock + superpowers/ @obra). **Loop SDD canónico de 5 fases**: Clarify → Spec → Plan → Implement → Verify (más conciso que las 7 de spec-kit; descartadas tasks/checklist como fases separadas). **9 skills SDD core** + **4 skills SDD ortogonales** (brainstorming, prototype, architecture-review, evidence-gathering). **Cambios al catálogo**: 3 NEW (`codi-clarify`, `codi-spec-writer`, `codi-prototype`) + 4 DEPRECATED (`codi-codebase-onboarding`, `codi-test-suite`, `codi-pr-review`, `codi-receiving-code-review`) + 1 RENAMED (`codi-verification` → `codi-verify`). Net 57→56 skills, 92→91 artefactos. **Body de skill mínimo**: 4 secciones obligatorias (Trigger / Steps / Output / Skip when), resto condicional. **4-layer consistency fixes**: I1 cada gate declara criterio explícito + subagent (5 agent-fork gates mapeados a `reviewer`/`architect`/`compliance-reviewer`); I2 `gate-plan-coverage` chequea `spec_artifact` antes de `plan_artifact`; I3 tier C envía `(name, description)` en SessionStart para sugerencia natural; I4 PostToolUse + Stop hooks llaman `/v1/workflow/<id>/state-update` con `tasks_completed`, `outputs_produced`, `evidence_artifacts`; I5 los 5 agent-fork gates usan subagents existentes del catálogo §8.4 (no nuevos). **No añade**: workflows nuevos, modos sdd-strict/soft, frontmatter fields nuevos, HARD GATEs adicionales. Las 4 capas (Skills/Workflows/Gates/Hooks) son ortogonales con 3 puntos de contacto: `skills_by_phase`, `requires_gates`, `workflow_state` en BD. | §0, §7.3, §8.0, §8.1 (catálogo), §8.2 (criterios + subagents), §9.1-§9.7 (skills_by_phase), §10.5, §10.6, §26               |
| Q31      | **Revisión 5-ejes (DDD/Hexagonal + TDD + escalabilidad + local-cloud + apagar bloques)**. 13 fixes aplicados: **3 ALTA** (G3.1 §2.5 horizontal scaling: codi-app/codi-workers stateless con `--scale=N`, Memgraph/Qdrant/Postgres single-instance v3.0; G5.1 §16.0 install modes simple/standard/full con counts containers + RAM + use case + migration paths; G5.2 §14.7 feature flags granulares con 6 toggles ortogonales a tiers); **4 MEDIA** (G1.1 skills DDD/Hexagonal añadidas a `skills_by_phase` de feature/refactor en plan + verify; G2.2 nuevo gate opt-in `gate-test-first-commit` deterministic activable via `invariants.tdd_strict: true`; G3.5+G4.1+G4.2 K8s/Terraform/multi-region declarados out-of-scope v3.0 explícitamente §24.2 #10-12; G5.3 Tier 4 Baseline = single-user single-project sin auth/RLS — agencias multi-tenant requieren Tier ≤ 3); **6 BAJA** (G3.2 rate limiting per-user; G3.3 pg-boss DLQ; G3.4 índices Postgres scaling 50 projects × 20 workflows; G4.3 Vaultwarden cross-env + AWS KMS adapter v3.x; G4.4 `codi deploy --target vps` flow; G1.2 cross-context dependency-cruiser rule; G1.3 CQRS lite mention). +1 gate (`gate-test-first-commit` opt-in). Net catálogo: 91→92 artefactos (gates 14→15, resto igual). **No añade workflows nuevos, no rompe DDD/Hexagonal §29, no fuerza TDD por default — TDD strict es opt-in.**                                                                                                                                                                                                                                                       | §0, §2.5, §5.2, §6.1, §8.2 (gates 14+1), §9.2, §9.4, §13.3, §14.1, §14.3, §14.7, §16.0, §16.2, §29.2, §29.3, §24.2 (#10-14) |
| Q32      | **Baseline lite vs full** (separación esencial vs nice-to-have para agencia 4 devs). v3.0-lite = 3 containers + ~25 skills + 2 workflows + 8 gates + 6 rules + 4 agents = ~45 artefactos, ~1.2GB RAM, 10-12 sem roadmap. v3.0-full = catálogo completo (92 artefactos, 9 containers, 18 sem). v3.x = K8s/Terraform/multi-region/cluster modes (out-of-scope v3.0, ya en §24.2). DDD/Hexagonal interno (§29) NO es opcional en ningún tier. Install modes renombrados: `simple`→`lite` (alias deprecated en v3.0, removido v3.1). Default `--mode=lite`. Roadmap §22 reinterpretado: Fases 0-6 entregan lite, Fases 7-10 añaden módulos full aditivos. **No modifica catálogo §8 ni workflows §9 ya documentados — añade vista de gating progresivo.** Saneamiento documental aplicado en mismo turno: TOC actualizado con secciones §26-§31 antes faltantes; renumeración §22-bis\*→§27-§29, §24-bis→§30; tabla Constants al inicio como única fuente de counts; brand fixes Codi v2 (5x, antes "Kodi v2"); `vendor`/`vendored` references → "subproyecto propio del equipo" (5 lugares), alineado con Q28; conteos roadmap Fase 3 actualizados a 15 gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | §0 (Constants + TOC), §16.0, §22 (header), §31 (nueva), múltiples cleanups                                                  |

---

## 26. Cierre

Codi v3 es la unificación de Codi v2 + DevLoop con:

- **Reuso máximo** de código existente (code-graph-rag subproyecto propio, Vaultwarden, codi-brain patterns aplicables).
- **Big bang single-branch** monorepo: 18 semanas de desarrollo en una rama, validación local exhaustiva, merge atómico.
- **9 contenedores** Docker idénticos local/VPS/cloud con graceful degradation 5-tiers.
- **92 artefactos builtin** (56 skills + 15 gates + 12 rules + 8 agents + 1 preset), reorganizados en Q30 para alinear con SDD inner-loop de 5 fases (Clarify → Spec → Plan → Implement → Verify) + Q31 (1 gate opt-in TDD strict + 3 fixes ALTA escalabilidad/install modes/feature flags). Sin acquisition policy en v3.0 (defer a v3.1).
- **4 capas de control ortogonales** (Skills / Workflows / Gates / Hooks) con 3 puntos de contacto explícitos: `skills_by_phase` (skill ↔ workflow), `requires_gates` (workflow ↔ gate), `workflow_state` en BD (hook ↔ workflow). Cada capa resuelve un problema distinto sin solapar las otras.
- **Sin MCP propio**: skills enseñan al agente cómo invocar HTTP API.
- **Auto-mejora vía BD overrides**: SKILL.md base estable, improvements en `codi.skills_overrides`.
- **Compatibilidad Tier 1 dual** (Claude Code + Codex CLI) verificada contra KBs oficiales con 12 ajustes aplicados (Q29): path adapters asimétricos, trust model Codex explícito, plugin distribution model en doble track, skills budget tiering A/B/C, tool name normalization.

Las decisiones arquitectónicas están **lock**. Los detalles tácticos (DDL completo, UI design, CI/CD pipeline) se concretizan durante implementación con código real.

Para iniciar Fase 0: cerrar las 5 entradas de fricción documentadas en memoria del usuario sobre three-layer pipeline + crear los 5 ADRs base + ADR-0006 (DDD layout) + ADR-0007 (agent tiers 1A/1B/2/3) + ADR-0008 (plugin distribution doble track) + ADR-0009 (install modes lite/standard/full §31) + verificar que CI sobre `main` pasa con coverage ≥85%.

---

## 31. Baseline lite vs full (Q32 — separación esencial vs nice-to-have)

Para una agencia de 4 devs, el plan completo (92 artefactos, 9 contenedores, 18 semanas) tiene partes esenciales y partes ornamentales. Esta sección separa el **producto v3.0-lite** (lo CORE) del **producto v3.0-full** (lo CORE + nice-to-have) y de **v3.x** (lo defer-able). NO modifica el catálogo ni los workflows ya documentados — añade una vista de gating progresivo.

### 31.1 Filosofía

- **v3.0-lite es el producto que arranca con 4 devs** y entrega 80% del valor con 33% de la complejidad.
- **v3.0-full es v3.0-lite + módulos aditivos** que se prenden cuando la agencia los justifica.
- **DDD/Hexagonal interno (§29) NO es opcional en ningún tier** — es la disciplina que permite añadir lo demás progresivamente sin colapsar la codebase.

### 31.2 Tabla maestra (CORE / NICE-TO-HAVE / FUTURO)

| Subsistema                 | v3.0-lite (CORE)                                                                                                                                                                                                | v3.0-full (NICE-TO-HAVE)                                                                                                                                                                                                                                    | v3.x (FUTURO)                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Containers**             | 3: codi-app + codi-workers + codi-db (Postgres+pgvector)                                                                                                                                                        | + codi-graph (Memgraph), codi-vector (Qdrant), codi-indexer, codi-ui, caddy = 8                                                                                                                                                                             | + vaultwarden, cluster modes    |
| **Auth**                   | API token estático en `.codi/credentials`                                                                                                                                                                       | + multi-user JWT email/password                                                                                                                                                                                                                             | + RLS multi-agency              |
| **Workflows**              | 2: feature, bug-fix                                                                                                                                                                                             | + 5: project, refactor, migration, audit, review                                                                                                                                                                                                            | + workflows custom user-defined |
| **Gates**                  | 8 deterministic (intent-complete, plan-coverage[no-agent-fork variant], decompose-complete, self-review, verify-complete[deterministic], reproduce-complete[deterministic], baseline-tests-pass, scan-complete) | + 7 (los agent-fork: deep-modules, plan-coverage[agent-fork], verify-complete[agent-fork], reproduce-complete[agent-fork], data-validation-complete; analysis-complete, sync-complete, discover-complete, rollback-plan-present + opt-in test-first-commit) | + gates agencia-custom          |
| **Skills**                 | ~25 (foundation 4 + 2 workflows + SDD inner-loop core 9 + utility 4 + git 3 + commit + branch-finish + audit-fix)                                                                                               | + ~31 (resto del catálogo: 5 workflows, 6 DDD/Hexagonal, 4 meta-creators, dev-\* 3, content, observability, rotate-secrets, deploy, connect, etc.)                                                                                                          | + skills marketplace            |
| **Rules**                  | 6: iron-laws, output-discipline, security, error-handling, testing, git-workflow                                                                                                                                | + 6: workflow, recommend-pattern, documentation, improvement-dev, domain-driven, hexagonal-architecture                                                                                                                                                     | + rules custom                  |
| **Agents (subagent defs)** | 4: lead, worker, reviewer, scaffolder                                                                                                                                                                           | + 4: advisor, docs-lookup, architect, compliance-reviewer                                                                                                                                                                                                   | + agents custom                 |
| **LLM**                    | 1 provider (Anthropic) + override env var                                                                                                                                                                       | + routing 3 providers (OpenAI, Gemini) + cost tracking + budgets                                                                                                                                                                                            | + local LLM Ollama              |
| **Memory**                 | Notas + wikilinks + FTS5 Postgres                                                                                                                                                                               | + embeddings pgvector + similarity edges + Memgraph projection                                                                                                                                                                                              | + multi-vault export            |
| **Self-improvement**       | `codi feedback list/approve` simple (raw observations table)                                                                                                                                                    | + 3-stage cribado clustering + auto-mejora pipeline                                                                                                                                                                                                         | + cross-agency learning         |
| **Skills overrides**       | sin override layer (devs editan filesystem `.codi/skills/`, commit)                                                                                                                                             | + override BD + base_hash conflict detection + materialization endpoint                                                                                                                                                                                     | + per-tenant overrides          |
| **UI**                     | sin dashboard (`codi status`, `codi workflow list`, `codi feedback list`)                                                                                                                                       | + React 6-section dashboard                                                                                                                                                                                                                                 | + mobile UI                     |
| **Secrets**                | `.env` + sops/age key compartido                                                                                                                                                                                | + Vaultwarden self-hosted                                                                                                                                                                                                                                   | + AWS KMS / GCP Secret Manager  |
| **Hook metrics**           | 10-15 essentials (invocations, duration p50/p95, success_rate, timeout_rate, fallback_rate)                                                                                                                     | + 45+ detailed (las 60+ documentadas en §14.6)                                                                                                                                                                                                              | —                               |
| **CLI**                    | 15-20 commands (los 7 shortcuts top-level + login + status + workflow list/run + feedback list/approve + memory record/recall + commit + install/deploy)                                                        | + 30+ commands del set completo §17                                                                                                                                                                                                                         | + plugins user                  |
| **Plugin distribution**    | sin (`codi generate` overwrite, único modo)                                                                                                                                                                     | + `codi plugin publish` doble track                                                                                                                                                                                                                         | + marketplace público           |
| **Testing**                | unit + integration + 5-8 E2E + 70% coverage                                                                                                                                                                     | + 25 E2E + nightly chaos + 85% coverage                                                                                                                                                                                                                     | + mutation testing              |
| **DDD interno (§29)**      | full (no negociable)                                                                                                                                                                                            | full                                                                                                                                                                                                                                                        | full                            |

### 31.3 Métricas de reducción v3.0-lite vs v3.0-full

| Métrica                | v3.0-full | v3.0-lite | Reducción |
| ---------------------- | --------- | --------- | --------- |
| Contenedores           | 9         | 3         | -67%      |
| RAM                    | 3.5 GB    | 1.2 GB    | -66%      |
| Skills                 | 56        | ~25       | -55%      |
| Workflows              | 7         | 2         | -71%      |
| Gates                  | 15        | 8         | -47%      |
| Rules                  | 12        | 6         | -50%      |
| Agents                 | 8         | 4         | -50%      |
| Artefactos totales     | 92        | ~45       | -51%      |
| Roadmap                | 18 sem    | 10-12 sem | -33%      |
| LLM calls/sem en gates | ~60       | ~10       | -83%      |

### 31.4 Install modes alineados con lite/full (refina §16.0)

§16.0 originalmente proponía `simple/standard/full`. Con Q32 se renombran para reflejar la separación lite/full directamente:

| Mode             | Equivale a                              | Containers                            | Audiencia                                            |
| ---------------- | --------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| `lite` (default) | v3.0-lite                               | 3 (codi-app + codi-workers + codi-db) | Agencia de 4 devs, dev solo, evaluación inicial      |
| `standard`       | v3.0-lite + Memgraph + Qdrant + indexer | 6                                     | Agencia que quiere code graph pero no UI/Vaultwarden |
| `full`           | v3.0-full completo                      | 9                                     | Agencia con UI + Vaultwarden + multi-tenant heavy    |

`codi install --mode=lite` se convierte en el **default** del flow §16.1 step 2. `simple` queda como alias deprecated de `lite` durante v3.0 (warning en CLI, removido en v3.1).

### 31.5 Riesgos asumidos al elegir lite

Honesto sobre lo que se pierde:

| Sin...                   | Impacto real                                                                       | Mitigación lite                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Memgraph                 | Queries de grafo de código vía Postgres CTEs. Performance peor en grafos >100k LOC | Suficiente para repos típicos de 4 devs (10-50k LOC)                                       |
| Qdrant                   | Code embeddings van a pgvector (mismo modelo)                                      | Funciona equivalente                                                                       |
| Vaultwarden              | `.env` encriptado con sops + age key compartida                                    | Equivalente práctico, sin UI                                                               |
| UI Dashboard             | 4 devs viven con `codi status` CLI                                                 | La UI es bonita, no necesaria                                                              |
| Self-improvement 3-stage | Feedback queue simple, sin clustering automático                                   | OK con volumen bajo (<50 obs/sem)                                                          |
| Override layer BD        | Devs editan SKILL.md y commitean (git ya hace conflict resolution)                 | Solo se pierde valor en multi-tenant real                                                  |
| 5 workflows extras       | feature + bug-fix cubren 80%+ del trabajo                                          | Refactor formal va dentro de feature con `tdd_strict: true`; audit/review/migration ad-hoc |

### 31.6 Path de upgrade lite → full

`codi install --upgrade --mode=full` desde lite:

1. Pull imágenes adicionales (Memgraph, Qdrant, codi-indexer, codi-ui, caddy).
2. Migrar opcionalmente notas a Memgraph projection (background job).
3. Indexar codebase con code-graph-rag (background, ~10-30 min según tamaño).
4. Activar 5 workflows extras + 7 gates restantes + 31 skills nice-to-have.
5. UI Dashboard accesible en https://codi.local.

Reversible con `codi install --downgrade --mode=lite`: backup BD a `.codi/backups/<ts>.sql`, parar containers extras, mantener datos en BD core.

### 31.7 Decisión activa para Fase 0

El roadmap §22 actual asume **v3.0-full en 18 semanas**. Con Q32 el roadmap se reinterpreta como:

- **Fases 0-6 (10-12 semanas)**: entrega **v3.0-lite** funcional. Equivalente a "MVP Codi v3" para agencia 4 devs.
- **Fases 7-10 (4-6 semanas)**: entrega los módulos nice-to-have de v3.0-full (Memgraph + Qdrant + UI + workflows extras + DDD/Hexagonal skills + 5 tiers + auto-recovery).

Cada módulo de v3.0-full es **aditivo opcional** post-MVP. La agencia puede parar en lite si v3.0-lite cubre sus necesidades reales.
