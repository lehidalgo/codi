# Codi Core Architecture Review

- **Date:** 2026-05-15
- **Document:** 20260515_000000_[AUDIT]_core-architecture-review.md
- **Category:** AUDIT
- **Branch reviewed:** `feature/codi-v3-harness` @ commit `db9d5afa`
- **Test baseline:** 3736 passing / 6 skipped / 0 failed
- **Coverage baseline:** 83.54% statements / 71.35% branches / 87.61% functions / 85.78% lines

This document is the output of a 7-subagent parallel technical review covering: system map, feature inventory, practical validation, architecture, code quality, robustness, testing, scalability, and developer experience. Each finding is anchored to a concrete file or commit. The goal is to enable a serious refactor of the core while keeping the product shippable on every commit.

---

## A. Resumen ejecutivo

### Estado general

Codi es un proyecto **maduro pero arquitectónicamente conservador**. ~62K LOC de TypeScript distribuidos en core (46K), templates de usuario (29K) e infraestructura (13K). Cero código obsoleto identificado, mantenimiento disciplinado, suite de tests con 3736 pruebas, 5 guards de lint con provenance ISSUE-XXX, mensajes de error con códigos namespaced, Result-pattern aplicado en `core/`, transacciones SQLite en los puntos críticos del brain DB, y un workflow engine basado en event sourcing con reducer puro.

Sin embargo, **el core arrastra deuda técnica cuantificable** que limitará crecimiento a 100x sin un refactor planificado:

- **6 archivos críticos exceden el límite de 700 LOC** que el propio `CONTRIBUTING.md` declara, incluyendo un `init.ts` con una función god de 664 líneas.
- **16 dependencias circulares** detectadas por madge en el grafo de `cli/init-wizard*` y `cli/preset*`.
- **Adaptadores: 6 archivos × ~85% estructura idéntica = ~2,500 LOC de duplicación** sin un `BaseAdapter` que extraiga la plantilla.
- **Registries de hooks por lenguaje: 16 archivos × 71 LOC = 1,197 LOC** de datos codificados como código.
- **Reducer linear forever**: replay de todos los eventos en cada `loadEvents` + `reduce()`, sin snapshot table; con 12+ call sites por hook fire.
- **Dos fuentes de verdad** entre Drizzle ORM schema y raw SQL bootstrap del brain DB; entre Zod hook-events y `runtime/types.ts`; entre JSON Schema files y los Zod schemas.
- **`process.exitCode = 2` como retorno** desde un módulo en `utils/`, contradicho empíricamente por la validación práctica: el path nunca dispara en escenarios reales.
- **Reducer no valida payload en replay**: confirmado real con inyección de fault — un solo evento malformado en `workflow_events` produce `exit 1` en `codi workflow status`.
- **`src/runtime/` 17,048 LOC excluidos de ESLint** con un comentario stale "Sprint 2" — sin lint coverage para un tercio del core.

### Riesgos principales (ordenados por harm-reduction)

1. **Reducer crashea con payload malformado** (defecto real, reproducido). Severidad: alta. Cost-to-fix: 4 horas.
2. **Non-atomic generator commit** — files → state.json en dos pasos sin lock cruzado. Severidad: alta. Cost-to-fix: 1 día.
3. **Adapter sprawl boundary** — `utils → core → adapters → core` cycle vía `Logger.getInstance()` y `heartbeat-hooks`. Cost-to-fix: 2 días.
4. **Drizzle schema vs raw SQL bootstrap drift** — sin CI guard. Severidad: alta cuando brain DB salga de feature flag. Cost-to-fix: 1 día.
5. **Conflict resolver no honra contrato non-TTY documentado** — `exitCode = 2` jamás se observó en validación práctica. Severidad: media. Cost-to-fix: 2 horas.
6. **Race en lock de BrainEventLog** — `acquireLock` PID-based sin OS-level lock. Severidad: media. Cost-to-fix: 4 horas.
7. **`src/runtime/` sin lint** — silent regression risk para 17K LOC. Severidad: media-alta. Cost-to-fix: 3-5 días focal sprint.

### Prioridades recomendadas

| Prioridad | Trabajo | Razón |
|---|---|---|
| **P0 — esta semana** | Tasks 1, 2, 3 (reducer schema guard + atomic generator commit + conflict-resolver return signature) | Defectos reales de correctness + contratos rotos; bajo riesgo de refactor |
| **P1 — este sprint** | Tasks 4, 5, 6 (brain schema CI guard + Logger DI + adapter base + bounded p-limit) | Estructural; desbloquea growth a 100x sin reescrituras |
| **P2 — próximo trimestre** | Tasks 7, 8, 9 (event snapshot table + YAML language registry + ADR cleanup + runtime lint re-enable) | Estratégico; reduce el cliff de onboarding y prepara escala |
| **P3 — backlog evaluativo** | Reescritura del visitor pattern del reducer, event-sourced state.json, separación de meta-skills | No urgentes, alto coste, ROI incierto |

### Posición vs. los criterios del usuario

> **"si elimináramos todos los artefactos que no formen parte del core o de las meta-skills, la base restante siga siendo robusta, escalable, bien diseñada y fácil de evolucionar"**

- **Robusta:** parcialmente. El brain DB tiene transacciones; el generator pipeline no. Recovery se delega a "idempotent re-run" que NO siempre converge.
- **Escalable:** condicional. Funciona hasta ~150 skills × 6 adapters; reducer linear forever es el primer breaker.
- **Bien diseñada:** parcialmente. El workflow engine y artifact-types tienen abstracciones del-libro-de-texto; los adapters y el hook registry son boilerplate-heavy.
- **Fácil de evolucionar:** parcialmente. Añadir workflow type cuesta ~50 LOC; añadir adapter cuesta ~500 LOC; añadir hook event cuesta ~50 LOC; añadir artifact type cuesta ~500-1000 LOC porque el `ARTIFACT_LAYOUT` no es la única fuente de verdad.

---

## B. Mapa del sistema

Codi se compone de ~110 componentes significativos clasificados de acuerdo al criterio del usuario. La tabla de abajo lista los más relevantes; el detalle completo está en el output de Phase 1.

### B.1 Clasificación por bucket

| Bucket | Definición | LOC aprox. |
|---|---|---|
| **CORE** | Funcionalidad esencial sin la cual codi no entrega su propuesta de valor | ~46,000 |
| **META-SKILL** | Skills que codi usa para coordinar su propio desarrollo (`codi-tdd`, `codi-debugging`, `codi-dev-*`) | ~6,000 (subset de templates) |
| **NON-CORE ARTIFACT** | Templates que codi genera en proyectos de usuario (rules, skills, agents, presets, hooks templates) | ~29,000 |
| **INFRASTRUCTURE** | Tests, scripts, brain-ui, build, CI | ~13,000 |
| **OBSOLETE** | Código muerto, deprecated o superseded | **0** (no identificado) |

### B.2 Tabla de componentes (resumen)

| Path | Bucket | Responsabilidad | LOC |
|---|---|---|---|
| `src/cli.ts` | CORE | Entry-point Commander.js, registro de comandos | 100 |
| `src/cli/init.ts` | CORE | Wizard de inicialización (god function 664 LOC) | 799 |
| `src/cli/workflow.ts` | CORE | CLI del workflow engine (29× boilerplate handleOutput) | 799 |
| `src/cli/update.ts` | CORE | Update con conflict resolution | 799 |
| `src/cli/preset-handlers.ts` | CORE | Aplicación de presets | 678 |
| `src/cli/contribute.ts` | CORE | Wizard de contribución | 727 |
| `src/cli/init-wizard-paths.ts` | CORE | Selección multi-step de paths | 755 |
| `src/cli/hub-handlers.ts` | CORE | Command Center (menú TUI) | 696 |
| `src/cli/brain.ts` | CORE | Launcher de brain UI | 645 |
| `src/core/config/parser.ts` | CORE | Parser YAML + frontmatter | 449 |
| `src/core/config/state.ts` | CORE | State manager (parse/validate/persist) | 526 |
| `src/core/config/validator.ts` | CORE | Validación Zod + AJV | 323 |
| `src/core/config/resolver.ts` | CORE | Dependency resolver | 54 |
| `src/core/generator/generator.ts` | CORE | Pipeline de generación (Phase 1 in-memory + Phase 2 to disk) | 270 |
| `src/core/generator/apply.ts` | CORE | Apply + state reconciliation | 162 |
| `src/core/generator/adapter-registry.ts` | CORE | Registry de adapters (DI seam) | 60 |
| `src/core/hooks/hook-installer.ts` | CORE | Orquestador git/husky/pre-commit | 636 |
| `src/core/hooks/hook-config-generator.ts` | CORE | Constructor de `.husky/` y `.pre-commit-config.yaml` | 607 |
| `src/core/hooks/hook-templates.ts` | CORE | Templates de scripts de hooks | 716 |
| `src/core/hooks/hook-registry.ts` + 16 lang registries | CORE | Definiciones de hooks por lenguaje | ~1,500 |
| `src/runtime/brain/db.ts` | CORE | Apertura SQLite better-sqlite3 + walk-up | 214 |
| `src/runtime/brain/schema.ts` | CORE | Drizzle ORM schema | 264 |
| `src/runtime/brain/migrate.ts` | CORE | Migration runner + raw SQL bootstrap | 547 |
| `src/runtime/brain/seed-workflows.ts` | CORE | Seeding de workflow_definitions | 201 |
| `src/runtime/reducer.ts` | CORE | State reducer (pure function) | 271 |
| `src/runtime/workflow-graph.ts` | CORE | Phase DAG builder | 90 |
| `src/runtime/gate-runner.ts` | CORE | Gate executor (deterministic + agent checks) | 643 |
| `src/runtime/gate-registry.ts` | CORE | Registro de gate definitions | 130 |
| `src/runtime/workflows/<7 types>/` | CORE | Adapters per-workflow-type | ~700 |
| `src/runtime/workflows/registry.ts` | CORE | Workflow adapter registry | 80 |
| `src/runtime/capture/{persist,session,stop-hook,markers,agent-memory}.ts` | CORE | Pipeline de captura desde transcripts | ~1,500 |
| `src/runtime/hook-logic.ts` | CORE | Runtime evaluator de hooks | 603 |
| `src/runtime/brain-event-log.ts` | CORE | Append/load de eventos | 423 |
| `src/runtime/brain-ui/` | INFRASTRUCTURE | Hono server (read-only inspection) | ~2,000 |
| `src/adapters/index.ts` | CORE | Adapter registry, AgentId union | 90 |
| `src/adapters/claude-code.ts` | CORE | Claude Code emitter | 602 |
| `src/adapters/codex.ts` | CORE | Codex emitter | 447 |
| `src/adapters/copilot.ts` | CORE | Copilot emitter | 434 |
| `src/adapters/cursor.ts` | CORE | Cursor emitter | 239 |
| `src/adapters/windsurf.ts` | CORE | Windsurf emitter | 145 |
| `src/adapters/cline.ts` | CORE | Cline emitter | 144 |
| `src/adapters/skill-generator.ts` | CORE | Skill artifact generator | 402 |
| `src/adapters/section-builder.ts` | CORE | Shared sections builder | 282 |
| `src/utils/conflict-resolver.ts` | CORE | Git-diff UX para conflictos | 539 |
| `src/utils/diff.ts` | CORE | Diff renderer + conflict markers | ~300 |
| `src/schemas/{agent,skill,rule,manifest,...}.ts` | CORE | Zod schemas | ~900 |
| `src/types/{config,agent,result,flags}.ts` | CORE | Type contracts | ~600 |
| `src/templates/skills/` (73 dirs) | NON-CORE ARTIFACT | Skill templates emitidos a usuarios | ~28,978 |
| `src/templates/rules/` | NON-CORE ARTIFACT | Rule templates | ~800 |
| `src/templates/agents/` | NON-CORE ARTIFACT | Agent templates | ~500 |
| `src/templates/presets/` | NON-CORE ARTIFACT | Preset bundles | ~400 |
| `src/templates/workflows/` | NON-CORE ARTIFACT | Workflow definitions YAML | ~100 |
| `scripts/guard-*.mjs` | INFRASTRUCTURE | 5 guards de lint (layering, barrels, identity, literals, console) | ~1,500 |
| `scripts/setup-husky-hooks.mjs` | INFRASTRUCTURE | Husky hook installer (template source of truth) | ~100 |
| `tests/` (309 files) | INFRASTRUCTURE | Suite de tests (200 unit / 22 integration / 8 e2e / 69 runtime / 10 misc) | ~10,000 |

### B.3 Grafo de dependencias top-level

```
constants → types → schemas → utils → core → runtime → adapters → cli
                                ▲       ▲                ▲
                                └── usado por ─────────┘  (VIOLACIONES)
```

**Layering achievements:**
- `types/` y `schemas/` son puros (no upward deps — verificado).
- La mayoría de `utils/` es puro.
- `adapter-registry.ts` es un DI seam limpio.

**Layering violations** (8 confirmadas):

1. `src/utils/conflict-resolver.ts:13` importa `Logger` de `core/output/logger.js` (utils → core)
2. `src/core/config/state.ts:80` importa de `core/hooks/registry` (config → hooks)
3. `src/core/config/validator.ts:15` importa `findConflictMarkers` de `core/hooks/conflict-markers.js`
4. `src/adapters/claude-code.ts:42-43`, `codex.ts:43`, `copilot.ts:46` importan de `core/hooks/heartbeat-hooks.js` (adapter → core hooks)
5. `src/runtime/brain-ui/routes-api.ts:23` importa de `core/backup/backup-manager.js` (runtime → core)
6. `src/core/{validator,docs,backup,preset,skill,prune-empty-adapter-dirs}` importan `ALL_ADAPTERS` directamente de `adapters/index.js` (core → adapters)
7. `src/core/audit/resolve-actor.ts:27` importa `Author` de `runtime/types.js` (core → runtime)
8. `src/core/preset/preset-applier.ts:11` y `core/skill/skill-export.ts:10` importan `SKIP_DIRS, SKIP_FILES, buildSkillMd` de `adapters/skill-generator.js`

---

## C. Inventario de features core

Detalle ampliado en el output de Phase 2. Resumen:

| # | Feature | Estado | Riesgos principales | Tests | Recomendación |
|---|---|---|---|---|---|
| 1 | **Configuration management** (parse YAML, validate, persist `state.json`) | 4/5 maduro | Sin cross-process locking; `EMPTY_STATE.lastGenerated` stale; sync FS en ctor | `tests/unit/config/parser.test.ts` (425 LOC) + `tests/unit/core/config/validator.test.ts`. Falta corrupt-state recovery test | Añadir lock file `.codi/state/.lock`, corregir EMPTY_STATE timestamp |
| 2 | **Artifact generation pipeline** (config → adapters → disk) | 4/5 | Non-atomic two-phase commit; unbounded `Promise.all`; sin rollback de Phase 2 → state | `tests/unit/core/generator/apply.test.ts` + `tests/integration/adapter-generation.test.ts` | Two-phase commit con lock; `p-limit(32)`; Backup mandatory en cada apply |
| 3 | **Conflict resolution UI** (git-diff-like) | 3/5 | Side-effect `process.exitCode=2` que no dispara en práctica; muta inputs; mixes UX/IPC/FS en 539 LOC | `tests/unit/utils/conflict-resolver.test.ts` (297 LOC, exit-2 cubierto en línea 124) | Cambiar return signature a typed result; split en `interactive`/`auto`/`headless` |
| 4 | **Hook system** (install + execute + advisory) | 3/5 | 16 lang registries duplicados; 3 paths divergentes (husky/lefthook/standalone); advisory-vs-block convention | 59 archivos de test (~7,161 LOC) — buena cobertura | YAML-driven language registry; consolidate writeHookFile() |
| 5 | **Workflow engine** (phase state machine, gates, transitions) | 4/5 | Reducer linear replay forever; gate checks O(events × files); FS reads dentro del runner | 15 tests (~1,973 LOC); falta malformed-payload | Snapshot table cada K=50 eventos; cachear `loadEvents` per-process |
| 6 | **Brain state + capture** (SQLite + transcripts) | 4/5 | Schema drift Drizzle vs raw SQL; UNIQUE constraints faltantes en captures; `unsafeMode(true)` permanente | 17 tests (~2,392 LOC); concurrency tests existen | CI guard schema-alignment; UNIQUE(turn_id, raw_marker) constraint |
| 7 | **Per-target adapter system** (6 platforms) | 3/5 | ~85% estructura duplicada; copy-pasted exists() helper × 6; heartbeat-hooks reach-in × 3 | 17 tests (~5,017 LOC); per-adapter unit tests existen | `BaseAdapter` con declarative `AdapterDefinition` |
| 8 | **Schema validation** (Zod + AJV) | 4/5 | Sin schema versioning beyond `v1`; reducer bypass; JSON Schema duplica Zod | 8 tests (~1,257 LOC) | Generate JSON Schemas desde Zod en build time |

### C.1 Cross-cutting observations

Aplicables a más de una feature:

- **Two-sources-of-truth** se repite tres veces: brain schema (Drizzle vs SQL), event types (Zod vs runtime/types.ts), JSON Schemas en `schemas/runtime/` no derivados de Zod.
- **No transactional boundary across feature boundaries.** El generator hace Phase 1 in-memory, Phase 2 escribe a disco; si crashea entre estas dos fases, no hay rollback. La excepción positiva: `BrainEventLog.initWorkflow` con `BEGIN IMMEDIATE` es la transacción mejor diseñada del codebase.
- **Advisory-vs-block convention-encoded.** El runtime hook system bloquea solo `rm -rf /`, `git push --force`, `git reset --hard`; todo lo demás es advisory. Un agente que ignora advisories es indetectable desde la capa de hooks.
- **Side-effect coupling cross-layer.** `conflict-resolver.ts` (utils!) importa `Logger` de core. Los adapters reach into `core/hooks/heartbeat-hooks.js`. El boundary `utils → core → adapters → runtime` no se aplica y fluye en ambas direcciones.
- **Boilerplate-heavy duplication en adapters y hook registries.** 6 adapters × ~250 LOC promedio de estructura similar; 16 per-language hook registries con la misma `HookSpec` shape; 6 copias del helper `exists(path)`.
- **Missing rollback / state-versioning.** Pre Phase 3c se asumía que no había rollback; el reviewer encontró que `src/cli/revert.ts` + `src/core/backup/backup-manager.ts` SÍ existen — pero no están integrados al pipeline de `applyConfiguration`.

---

## D. Hallazgos por subagente

Resumen ejecutivo de cada subagente; el detalle completo está en los outputs respectivos.

### D.1 Arquitectura (Phase 3a)

**Riesgos top-3:**

1. **Non-atomic generator commit** (`apply.ts:144-156`). Files → state.json en dos pasos. Si state write falla en `:149`, orphans están eliminados de disco pero state aún los lista. El comentario en `:152` admite incompletitud. **Cost-to-fix: medio.** Two-phase commit con `state.json.next` + atomic rename.

2. **Adapter sprawl boundary** (`adapters/claude-code.ts:42`, mirrored × 3). El `utils → core → adapters → core` cycle existe vía `Logger.getInstance()` y `heartbeat-hooks`. Añadir 7º adapter fuerza tocar `constants.ts`, `adapters/index.ts`, y copy-paste de wiring de heartbeat en tres lugares. **Cost-to-fix: medio.** Logger DI + adapters declaran `requestedHooks` en lugar de importar.

3. **Drizzle schema vs raw SQL bootstrap drift** (`runtime/brain/schema.ts` vs `migrate.ts:21-`). 14 tablas duplicadas. Sin CI guard. **Cost-to-fix: bajo.** Test que abre in-memory DB y diffea `PRAGMA table_info` por cada tabla.

**Extension cost matrix:**

| Extensión | Files a tocar | LOC | Acoplamiento oculto |
|---|---|---|---|
| Nuevo adapter | `adapters/<id>.ts` (new), `adapters/index.ts`, `constants.ts`, `skill-generator.ts:24-78` (PLATFORM_SKILL_FIELDS) | 300-500 | Hook integration copy-paste × 3 |
| Nuevo workflow type | `runtime/workflows/<id>/`, `registry.ts:14`, `types.ts`, `manifest-event.schema.json` | 50-200 | DUPLICATE source of truth en JSON schema |
| Nuevo artifact type | `core/artifact-types.ts` + `CapabilityType` + `LedgerEntryType` + `CapturedArtifactType` + every adapter | 500-1000 | 3 unions paralelos que driftear |
| Nuevo gate check | `gate-registry.ts:87` + cuerpo en `gate-runner.ts` | 20 | El agent branch es dead code (ISSUE-085 pendiente) |
| Nuevo language hook | `hooks/registry/<lang>.ts` (new), `registry/index.ts:4-19,21-36` | 60-100 | Boilerplate puro |

**Patrones bien aplicados:**
- Workflow adapter registry (`runtime/workflows/registry.ts`) — gold standard.
- Strategy via const map (`core/artifact-types.ts:86` + `satisfies Record<ArtifactType, ...>`).
- Result<T,E> en `core/`.
- Reducer pattern (`runtime/reducer.ts`) — pure function, determinista.
- Section builders en adapters (`adapters/section-builder.ts`).

**Patrones mis-applied o missing:**
- Singleton service locator masking dependency: `Logger.getInstance()` 12+ veces.
- No transaction/unit-of-work boundary en el generator.
- Side-effect-as-return-value en conflict-resolver.
- Missing Visitor/dispatch para `ManifestEvent` — el switch + casts en reducer.
- Registry de adapters bypassed por 7 callsites que importan `ALL_ADAPTERS` literal.
- Missing event-sourced state para `state.json`.

### D.2 Calidad de código (Phase 3b)

**Top 5 fixes por ROI:**

| # | File:line | Problema | Fix | ΔLOC |
|---|---|---|---|---|
| 1 | `core/hooks/hook-installer.ts:87-215` | 14 if-blocks repetidos emitiendo .mjs scripts | Table-driven `AUX_HOOKS = [{key,slug,body},...]` | -90 |
| 2 | `runtime/gate-runner.ts:207-573` | 13 inline `payload as { kind?: string }` + 8 find-decision-by-kind loops | `findDecisionByKind` helper + `DecisionKind` union | -60 |
| 3 | `cli/workflow.ts:295-379, 482-556` | 5-branch adapter-builder dispatch duplicado | `WORKFLOW_BUILDERS: Record<WorkflowType, (flags) => Result<...>>` | -100 |
| 4 | `adapters/{cursor,windsurf,claude-code,cline,codex,copilot}.ts:~30` | `async function exists(path)` copy-pasted × 6 | Extract `adapters/fs-helpers.ts` | -40 |
| 5 | `core/hooks/hook-installer.ts:217-252, 396-513` | 4 sibling installX funcs con misma estructura | `writeHookFile(projectRoot, runner, kind, content)` | -80 |

**Otros findings:**
- **`init.ts:105`** función `initHandler` con **664 LOC** — claro candidato a split en 5-7 phases con `Result` types.
- **`conflict-resolver.ts:313`** `resolveConflicts` función de **226 LOC** mezcla 5 strategies (force, keepCurrent, unionMerge, non-TTY, interactive) en un if-chain.
- **`decision_recorded.kind` taxonomy** — 8 string literals spread across gate-runner.ts, agent templates, reducer. Sin type, sin union, sin lista central. Un typo silently rompe gates.
- **10 explicit `as unknown as` casts** clusters around 3 áreas: Zod `_def` walking, brain migration handles, YAML doc mutation. Load-bearing tech debt.
- **16 circular dependency cycles** detectadas por madge:
  - 7 en producción (`cli/init-wizard*`, `cli/preset*`, `core/preset/*`).
  - 9 en `src/templates/skills/dev-*/` (bridge.ts imports barrel).
- **8 files exceed 700 LOC** (rule en `CONTRIBUTING.md`): `init.ts` (799), `update.ts` (799), `workflow.ts` (799), `init-wizard-paths.ts` (755), `contribute.ts` (727), `hub-handlers.ts` (696), `brain.ts` (645), `hook-installer.ts` (636). Sin guard que lo enforce.
- **`MIGRATED_HANDLES as unknown as { _store?: never })._store = undefined`** (`brain/migrate.ts:546`) — production code escribiendo a campo falso via `as unknown` para defeat un private-store invariant. Likely test escape hatch leaked into runtime.

### D.3 Robustez (Phase 3c)

**Tabla de verificación de las 13 concerns levantadas en Phase 2:**

| # | Concern | Status | Severidad |
|---|---|---|---|
| 1 | Non-transactional state writes en apply.ts | Confirmed real | high |
| 2 | No cross-process lock en state.json | Confirmed real | med |
| 3 | Reducer schema bypass at replay (11 unchecked casts) | Confirmed real | med |
| 4 | Conflict resolver muta inputs | Confirmed real | med |
| 5 | `process.exitCode = 2` side-effect | Confirmed real | med |
| 6 | Unbounded Promise.all | Confirmed real, mitigated by comment only | med |
| 7 | No rollback mechanism | **REFUTED** — `cli/revert.ts` + `core/backup/backup-manager.ts` existen | low |
| 8 | `unsafeMode(true)` permanente | Confirmed real con caveat (migrate.ts:430 viola "no template-literal" invariant) | high |
| 9 | `EMPTY_STATE.lastGenerated` stale | Confirmed real | low |
| 10 | Sync FS ops en constructors | Confirmed real | low |
| 11 | Brain DB walk-up wrong project | Confirmed real bounded | med |
| 12 | stop-hook reads transcript outside transaction | Confirmed real intentional | low |
| 13 | Capture race parallel processes | Real at code level, no UNIQUE constraint en schema | med |

**NEW findings:**
- **Reducer throw silently swallowed** en `stop-hook.ts:84` — `reduce(events)` puede throw on malformed log; empty catch causa que workflow tag/phase silently sean null.
- **Prune-empty-adapter-dirs runs BEFORE state write** (`apply.ts:142`).
- **86+ empty catches** distribuidos por todo el codebase. "Fail silent, degrade quietly" culture without telemetry.

**Error handling inconsistency:** Result<T,E> en `core/`, 171 throws en `runtime/`. Mismatched boundary cross-layer.

**Top 5 robustness fixes:**

| Rank | Fix | Cost | Blast radius |
|---|---|---|---|
| 1 | UNIQUE(session_id, turn_id, raw_marker) en captures + UNIQUE(session_id, turn_no) en prompts | 1h + migration | Schema-layer ironclad |
| 2 | Atomic state mutate con `.lock` sentinel | 1 day | Refactor write sites |
| 3 | Validar event payloads at write-time AND inject Zod schema en reduce() | 4h | Runtime depends on Zod |
| 4 | Strip `process.exitCode=2` side-effect del conflict-resolver | 2h | Signature change |
| 5 | Replace BrainEventLog.acquireLock con `proper-lockfile` o sentinel-file | 4h | Workflow CLI behavior |

### D.4 Testing (Phase 3d)

**Estado real:** El test suite está **substancialmente más saludable** de lo que Phase 2 sugirió.

- 309 archivos de test: 200 unit / 22 integration / 8 e2e / 69 runtime / 10 misc.
- Coverage: 83.54% statements / 71.35% branches / 87.61% functions / 85.78% lines (matches baseline).
- **Phase 2 missing-tests claims fueron stale:**
  - `tests/unit/config/parser.test.ts` (425 LOC) — existe, exhaustivo.
  - `tests/unit/core/generator/apply.test.ts` (151 LOC) — existe.
  - Per-adapter tests `tests/unit/adapters/{claude-code,cline,codex,copilot,cursor,windsurf}.test.ts` — existen.
  - `tests/unit/utils/conflict-resolver.test.ts` (297 LOC) — existe, cubre exit-2 en línea 124.

**Positive patterns (verified):**
- Zero internal-module mocks (`vi.mock(['\"]\./...` returns empty). Tests use real fs, real SQLite, real CLI binary.
- 106 test files exercise subprocesses (high integration confidence).
- Concurrency tests deterministicos (no sleeps).
- ~30 files exempt from coverage thresholds (vitest.config.ts:50-118), all UI-clack or network-boundary — honest debt acknowledgment.

**Anti-patterns:**
- `tests/e2e/v3-zero-cli.test.ts:23-24` — `SUITE_RETRY = 2` papering over spawn-cost flake.
- `src/utils/**` branch threshold at 92.0% vs measured 92.7% — **0.7 puntos de headroom**.
- Snapshot-only tests en `__snapshots__/version-{bump,verify-pre-push}-template.test.ts.snap` sin parallel inline assertions.

**5 escenarios críticos untested:**
1. State.json corruption recovery (malformed JSON).
2. Brain DB locked por proceso externo (sqlite-browser open).
3. Reducer con malformed event payload (CONFIRMED real bug en validation práctica).
4. Hook installer cuando usuario ya tiene lefthook/pre-commit-framework setup.
5. Dos `codi generate` paralelos.

**Top 5 testing improvements:**

| # | Gap | Effort |
|---|---|---|
| 1 | Malformed-event-payload tests al reducer | 1h |
| 2 | State.json corruption tests | 30min |
| 3 | Raise `src/utils/**` branch threshold a 95% (backfill primero) | 2h |
| 4 | Parallel-generate concurrency test | 2h |
| 5 | Semantic assertions en snapshot tests | 1.5h × 2 files |

### D.5 Escalabilidad (Phase 3e)

**Scaling axes:**

| Axis | Today | Rating | Limit |
|---|---|---|---|
| Skills | 73 dirs | ⚠️ degrades | EMFILE a ~150-200 skills × 6 adapters (macOS default RLIMIT_NOFILE=256) |
| Workflow types | 7 YAMLs | ✅ scales | Database-driven, gated by WeakSet |
| Hooks (lenguajes) | 16 files × 71 LOC | ⚠️ boilerplate | Pure data, deberia ser YAML-driven |
| Hooks (events) | ~20 | ✅ scales | Schema-driven dispatch |
| Adapters | 6 × ~250 LOC | ❌ breaks | Pure copy-modify, ~85% structural duplicate |
| Events en brain DB | linear replay | ❌ breaks | Replay of all events on each `loadEvents`. JSON.parse domina a >5000 events |
| Monorepos | bounded walk-up 64 | ✅ scales | Sin cache per-process; statSync × 64 per call |
| Procesos concurrentes | SQLite busy_timeout 5s | ⚠️ degrades | One global lock per brain DB; 4 processes serialize |

**Quantitative projections:**
- Reducer replay: ~100ns/event. **5000 events ≈ 5ms reducer + 5-50ms JSON.parse**. >10K events crosses hot-hook threshold.
- Generator I/O: unbounded Promise.all OK hoy at ~150 archivos; **EMFILE a ~250 skills × 6 adapters** en macOS.
- 16 per-language registries: ~1,197 LOC total, 95% structural duplication.
- 6 adapters: ~2,985 LOC con 85% overlap — `cursor.ts` (239) y `windsurf.ts` (145) comparados side-by-side comparten exists() helper, sections.push pattern, brand-filter wiring, skill-generator call.

**Top 5 scalability improvements:**

| # | Fix | Effort | Headroom |
|---|---|---|---|
| 1 | Workflow event snapshot table | 1-2 días | 100× growth en eventos |
| 2 | BaseAdapter declarative pattern | 3-4 días | Adapter cost flat forever |
| 3 | YAML-driven language hook registry | 2 días | Elimina 1,100 LOC boilerplate |
| 4 | `p-limit(32)` en generator | 1 hora | Previene EMFILE en macOS |
| 5 | Cache `loadEvents` + `findProjectBrainPath` per-process | 0.5 días | Hot hook fire ~3× faster |

### D.6 Developer experience (Phase 3f)

**Onboarding cliff: 3.5/5.**

**Positives:**
- `CONTRIBUTING.md` con tabla "How binary resolution works" + "Adding a Rule Template / Skill Template / Adapter".
- `src/runtime/README.md` — gold standard module README.
- Guard scripts con header comments excellent (ISSUE-XXX provenance + remediation).
- Pre-push hook source-of-truth en `scripts/setup-husky-hooks.mjs` (no en .husky/ que está gitignored).
- Error messages con códigos namespaced (`E_CONFIG_NOT_FOUND`, `W_DOCS_STALE`) + hints actionable.
- Solo 13 `@ts-ignore | : any | as any` en 369 non-template files — **0.04 por archivo, excelente**.
- Conventional commits seguidos near-100% por humanos.

**DX anti-patterns (5):**
1. **`src/runtime/` excluded from ESLint** (eslint.config.js:19-22). 17,048 LOC, 112 files, stale "Sprint 2" comment.
2. **`docs/adr/` directory empty** con README declarando convención NNNN-kebab — pero las 10 ADRs reales viven en `docs/` con prefix de fecha. Misleading.
3. **`docs/` flat con 148+ date-stamped files** mezclando roadmaps, plans, audits, research — sin INDEX.
4. **8 files exceed 700-LOC rule** sin guard.
5. **No README en 5 de 6 `src/` subdirectories** (cli/, core/, adapters/, templates/, utils/, schemas/).

**"Adding a new X" ratings:**
- New CLI subcommand: 5/5 (obvio del patrón).
- New rule/skill/agent/adapter: 4-5/5.
- New flag: 3/5 (add to 6 presets es rote y unenforced).
- **New hook: 2/5** (split entre `templates/hooks/`, `core/hooks/`, `runtime/capture/`; solo documentado en plan de fecha).
- **New workflow type: 2/5** (solo en `src/runtime/README.md`).

**Top 5 DX improvements:**

| # | Mejora | Effort |
|---|---|---|
| 1 | Re-enable ESLint en `src/runtime/` | 3-5 días sprint |
| 2 | `docs/INDEX.md` + per-layer READMEs en `src/{cli,core,adapters,templates,utils,schemas}/` | 1 día |
| 3 | Resolve docs/adr/ paradox (move/symlink real ADRs) | 2h |
| 4 | `guard-file-size.mjs` advisory (warn >700 LOC) | 0.5 día |
| 5 | Adding-Hook + Adding-Workflow guides en CONTRIBUTING | 0.5 día |

---

## E. Resultados de validación práctica

### E.1 Comandos ejecutados

| Comando | Exit | Tiempo | Resultado |
|---|---|---|---|
| `npm run lint` | 0 | 4.1s | 6 guards + tsc --noEmit clean |
| `npm run build` | 0 | 6.4s | ESM + DTS + 144 skill assets + 7 workflow defs + 2 vendor files |
| `npm test` | 0 | 39.5s | **3736 passed / 6 skipped / 0 failed** |
| `bash .husky/pre-push` | 0 | ~25-30s | Coverage 83.54%/71.35%/87.61%/85.78% — todos los thresholds met |
| `node dist/cli.js --help` | 0 | <1s | Catalog renderiza, zero pnpm refs |
| `node dist/cli.js doctor` (sandbox) | 0 | <1s | `allPassed: true` en proyecto inicializado |

### E.2 Flujos críticos simulados

| Flow | Resultado | Defecto |
|---|---|---|
| `codi init --preset minimal --agents claude-code --force` | exit 0 | none |
| `codi generate --check` | flag inexistente | **Documentation mismatch** — `--check` es `status` |
| `codi doctor` | exit 0 (sandbox) | none |
| `codi workflow run feature "test scope"` | exit 0 (after `docs/CONTEXT.md` creado) | **First call returned exit 0 despite [FAIL] status** — exit code semantic gap |
| `codi workflow status` | exit 0 | none |
| `codi generate` con local edit (conflict) | exit 0 | **`process.exitCode=2` NEVER fired** even con hard line-overlap conflict — documented contract broken |
| `codi clean --force` | exit 0 | none |

### E.3 Stress points verified

- **Race state.json en 2-5 procesos paralelos:** ambos exit 0, state.json parseable. No observable corruption en este load. NO ruled out bajo load mayor.
- **Reducer malformed event:** **CONFIRMED REAL BUG.** Insertar payload `{this is not json` en `workflow_events` → `codi workflow status` exit 1 con `Expected property name or '}' in JSON at position 1`. El reducer hace `JSON.parse` sin try/catch.
- **Non-TTY conflict exit code:** **NOT observed as documented.** Dos escenarios independientes (append-only, in-place token rewrite). El JSON `{"type":"conflicts",...}` se escribe a stderr pero `process.exitCode` queda en 0.

### E.4 Errores encontrados

1. **`codi workflow status` crashea con exit 1** ante un solo evento malformado en `workflow_events.payload`. Causa: `reducer.ts` calls `JSON.parse` sin try/catch.
2. **Non-TTY conflict resolver no honra contrato `process.exitCode = 2`.** Confirmado en escenarios reales. CI consumers que dependen de este código de salida fallan silently.
3. **`codi workflow run` returns exit 0 despite [FAIL] status** en al menos un caso. Exit code semantic gap.
4. **`codi generate --check` flag doesn't exist** (plan documentation drift).

### E.5 Limitaciones de la validación

- Race-condition stress: solo 2×/5× parallelism en un host. NO rules out: heavier contention, slower disks, distintos filesystems, fault injection mid-write.
- Solo non-TTY conflict path testado. Interactive TTY paths + `--on-conflict keep-current|keep-incoming` no exercised.
- No se probaron: malformed state.json, missing brain.db, corrupted FTS5 index.

---

## F. Arquitectura objetivo

### F.1 Diagrama (textual)

```
                                ┌──────────────────────────┐
                                │  cli/  (commander chains)│  ← user interaction
                                └────────────┬─────────────┘
                                             │ delegates
                                             ▼
                          ┌──────────────────────────────────┐
                          │  core/orchestration/             │  ← pure orchestration
                          │  (commit, generate, apply, etc.) │
                          └──┬────────────────┬──────────────┘
                             │                │
                  reads/writes via            uses ports
                             │                │
                             ▼                ▼
         ┌───────────────────────┐  ┌─────────────────────────┐
         │  core/state/          │  │  core/ports/            │  ← interfaces
         │  (state.json,         │  │  (Adapter, Hook,        │
         │   brain.db facade)    │  │   Workflow, Schema)     │
         └──┬────────────────────┘  └─────┬───────────────────┘
            │                             │
            │ atomic mutations            │ implemented by
            │ (lock + tx)                 │
            │                             ▼
            ▼                ┌──────────────────────────────────┐
   ┌─────────────────┐       │  adapters/{claude-code, ...}/   │
   │ brain/          │       │  (BaseAdapter + decl AdapterDef) │
   │  - event log    │       └──────────────────────────────────┘
   │  - snapshots    │
   │  - reducer      │       ┌──────────────────────────────────┐
   │  - persist      │       │  hooks/                           │
   │  (transactional)│       │   - registry (YAML-driven)        │
   └─────────────────┘       │   - installer (single writeHookFile)│
                             │   - executor (advisory + block)  │
                             └──────────────────────────────────┘

         ┌─────────────────────────────────────────────────────────┐
         │  schemas/  (Zod single-source — JSON Schemas DERIVED)   │
         │  types/    (TS contracts — generated from Zod)          │
         │  utils/    (pure helpers — NO upward imports)           │
         └─────────────────────────────────────────────────────────┘

         meta-skills/        ← codi-tdd, codi-debugging, codi-dev-*
                              (codi's own coordination skills)

         templates/           ← user-emitted: rules, skills, agents, presets
                              (lockfile-auto-detect for npm/pnpm/yarn)
```

### F.2 Módulos objetivo

| Módulo | Responsabilidad | Interfaz pública |
|---|---|---|
| `cli/` | UX, commander chains, terse handlers; cero lógica de dominio | `program.action(runHandler)` |
| `core/orchestration/` | Pipeline orchestration (generate, apply, init, sync). Pure functions o transacciones explícitas | `applyConfiguration(config, opts): Result<ApplyOutcome>` |
| `core/ports/` | Interfaces (Adapter, HookProvider, WorkflowEngine, SchemaValidator). Cero implementaciones | `interface Adapter { id, capabilities, generate(config) }` |
| `core/state/` | Transactional state mutations with lock + temp+rename + recovery | `StateManager.atomicMutate(fn): Result<T>` |
| `brain/` | Event log + snapshots + reducer + persistence. SQL hidden behind facade | `EventLog.append(event): Result; EventLog.loadSince(snapshotId): events` |
| `adapters/` | Per-target implementations vía `BaseAdapter` + declarative `AdapterDefinition` | `AdapterDefinition { id, paths, capabilities, customEmitters[] }` |
| `hooks/` | YAML-driven language registry + single `writeHookFile()` installer | `HookRegistry.allFor(stack): Hook[]` |
| `schemas/` | Single-source Zod; JSON Schemas derivados en build time vía `zod-to-json-schema` | `EventSchema = z.discriminatedUnion("event_type", [...])` |
| `utils/` | Puros, sin imports upward. Logger pasado por DI cuando necesario | `function exists(path): Promise<boolean>` |
| `templates/` | User-emitted artifacts con auto-detect del package manager del proyecto target | `PackageManagerDetector.detect(projectRoot): "npm"\|"pnpm"\|"yarn"` |
| `meta-skills/` | Skills internas de codi para coordinar su propio desarrollo. Aisladas en `src/templates/skills/codi-*` y `dev-*` con tag explícito | (filesystem convention) |

### F.3 Contratos clave

**Port: AdapterDefinition** (replaces 6 hand-written adapter classes):

```ts
interface AdapterDefinition<Id extends AgentId> {
  readonly id: Id;
  readonly paths: { configRoot: string; instructionFile: string; mcpConfig?: string };
  readonly capabilities: {
    skills: boolean;
    rules: boolean;
    agents: boolean;
    hooks: boolean;
    mcp: boolean;
    slashCommands: boolean;
    uiIntegration: boolean;
  };
  readonly requestedHooks?: readonly RuntimeHookName[];
  readonly sectionOrder?: readonly SectionId[]; // override default order
  readonly customEmitters?: readonly CustomEmitter[]; // platform-specific files
}
```

**Port: HookProvider**:

```ts
interface HookProvider {
  readonly name: HookName;
  readonly stage: "pre-commit" | "commit-msg" | "pre-push";
  readonly languages: readonly Language[];
  readonly tool: ToolSpec; // { binary, version, installHint }
  render(ctx: HookContext): HookScript;
}
```

**Port: SchemaValidator** (single-source Zod):

```ts
const EventSchema = z.discriminatedUnion("event_type", [
  InitEventSchema,
  PhaseStartedEventSchema,
  ScopeProposedEventSchema,
  // ...
]);
type ManifestEvent = z.output<typeof EventSchema>;
// JSON Schema generated at build time:
// scripts/generate-json-schemas.mjs runs zod-to-json-schema
```

**Port: StateManager** (atomic mutations):

```ts
class StateManager {
  async atomicMutate<T>(
    fn: (state: StateData) => Promise<StateData & { result: T }>
  ): Promise<Result<T, StateError>>;
  // Acquires .codi/state/.lock, reads state, applies fn, writes temp+rename, releases lock
}
```

### F.4 Patrones recomendados

- **Result<T,E> uniforme cross-layer.** Eliminar el split "core uses Result, runtime throws". Runtime throws → Result wraps.
- **Dependency injection para Logger.** Eliminar `Logger.getInstance()`. Pass via `{ logger }` ctx.
- **Declarative adapters.** Replace per-adapter classes with `AdapterDefinition` objects + `BaseAdapter.run(def, config)`.
- **YAML/JSON-driven registries.** Hook language registries, gate checkers, workflow definitions → loaded once, cached per-process.
- **Snapshot-and-replay reducer.** Append `workflow_snapshots(workflow_id, last_event_id, reduced_state)` every K=50 events. Replay only delta.
- **Single-source schemas with derived JSON Schemas.** Zod is canonical; JSON Schema files generated by `zod-to-json-schema` at build.
- **Transactional apply.** Two-phase commit: write `state.json.next` + write files (with `p-limit`) + atomic rename of state.

### F.5 Flujos críticos

**Flujo ideal de sincronización (`codi generate`):**

```
1. Read config + state (acquire .codi/state/.lock)
2. Resolve dependencies, validate schemas (Result<NormalizedConfig>)
3. Phase 1 (in-memory): pure render via adapter pipeline → GeneratedFile[]
4. Phase 2 (atomic commit):
   a. Write state.json.next (with planned manifest)
   b. Write files via p-limit(32) (with BackupHandle capturing pre-state)
   c. Atomic rename state.json.next → state.json
   d. Release lock
5. On crash: next run reads state.json (untouched if step 4c didn't complete)
              → planned manifest .next gets discarded → idempotent re-run
6. On error during step 4b: BackupHandle.restore() restores pre-state
              → state.json never updated → consistent
```

**Flujo ideal de resolución de conflictos:**

```
1. Generator detects diff (incoming vs current)
2. resolveConflicts(conflicts, options, { logger, tty }) returns:
   - Result<ConflictResolution> with explicit shape:
     { accepted: Conflict[], skipped: Conflict[], merged: Conflict[],
       unresolvable: Conflict[] }
3. Caller (generator) checks `unresolvable.length`:
   - Interactive mode: re-prompt, user can re-merge
   - Non-TTY: return Result.err({ code: "E_UNRESOLVED_CONFLICTS", files })
     and CLI translates to exit code 2 at the entry point
4. NO mutation of input ConflictEntry objects; resolver returns new entries
5. NO `process.exitCode` global side-effect from inside the library
```

**Modelo recomendado para hooks:**

```
src/hooks/
├── registry/                   # YAML files, one per language
│   ├── python.yaml
│   ├── typescript.yaml
│   └── ...
├── runtime/                    # Single executor
│   ├── advisory.ts             # advisory checks
│   └── block.ts                # hard blocks (rm -rf, force push, etc.)
└── installer/                  # Single installer
    └── writeHookFile.ts        # parametric by stage + tool
```

Hook definition (YAML):
```yaml
# src/hooks/registry/python.yaml
- name: python.format
  stage: pre-commit
  tool:
    binary: ruff
    version: ">=0.1.0"
    installHint: "pip install ruff"
  command: "ruff format"
- name: python.lint
  ...
```

**Modelo recomendado para workflows:**

Workflows ya están bien diseñados (gold standard). Mantener:
- `src/runtime/workflows/<type>/index.ts` con `WorkflowAdapter<T>`.
- YAML en `src/templates/workflows/<type>.yaml`.
- Registry en `src/runtime/workflows/registry.ts`.

Refactor: agregar snapshot reducer + cachear `loadEvents` per-process.

### F.6 Estrategia para aislar artefactos no-core del core

**Convención de directorios:**

```
src/
├── cli/, core/, runtime/, adapters/, utils/, schemas/, types/  # CORE
├── templates/
│   ├── skills/codi-*/, skills/dev-*/                           # META-SKILLS
│   ├── skills/<other>/, rules/, agents/, presets/, hooks/       # NON-CORE ARTIFACTS
│   └── workflows/                                                # DATA (read by core)
└── ...
```

**Reglas de import:**

- Core NO importa de `templates/` (excepto `templates/workflows/*.yaml` cargados como data via `seed-workflows.ts`).
- Templates NO importan de `core/` ni de `runtime/`.
- Meta-skills pueden importar de `cli/` (CLI helpers en `src/cli/shared.ts`) pero no de `core/`.
- Aislamiento enforced via `scripts/guard-layering.mjs` (ya existe; agregar regla para templates).

**Test de aislamiento:**

Un test debería poder: borrar `src/templates/skills/<NON-CORE>` (e.g., `codi-secret-scan`) y aún:
1. `npm run lint && npm run build && npm test` green.
2. `codi init --preset minimal` funciona (sin esa skill).
3. `codi doctor` reporta el missing skill como advisory, no error.

Hoy esto NO se puede verificar — el `tests/` no tiene un "remove-non-core" smoke. Añadir.

---

## G. Plan de refactor incremental

10 fases. Cada fase es shippable (test green, build green) y se puede revertir independientemente.

### Phase 0: Safety net (1 día)

**Objetivo:** Pre-requisitos de seguridad antes de tocar code.

**Cambios:**
- Tag baseline: `pre-core-refactor-2026-05-15`.
- Snapshot de coverage en `/tmp/codi-baseline-coverage.json`.
- Verify build + test green.

**Tests necesarios:** Existing suite.
**Criterio de aceptación:** Tag existe, suite green.
**Rollback:** Trivial.

### Phase 1: Reducer schema validation guard (P0, 4 horas)

**Objetivo:** Fixear el defecto real de Phase 4: `codi workflow status` crashea con malformed event payload.

**Cambios:**
- `src/runtime/reducer.ts:30-88`: wrap `JSON.parse` (en `loadEvents` upstream o aquí) con try/catch → `ReducerError`.
- Inject Zod schema validation en `applyEvent`: `EventSchema.safeParse(event)`.
- Tests: `tests/runtime/reducer-malformed-payload.test.ts` cubriendo missing field, wrong type, invalid JSON.

**Archivos afectados:**
- `src/runtime/reducer.ts` (modify)
- `src/runtime/brain-event-log.ts:398-403` (loadEvents — add safe-parse layer)
- `tests/runtime/reducer.test.ts` (new test block)

**Riesgo:** Bajo. Pure-function changes, contained.
**Tests:** Existing 279 LOC + new 50 LOC malformed-payload tests.
**Criterio de aceptación:**
- `codi workflow status` con malformed payload → exit clean con `[ERR] E_EVENT_CORRUPT` y hint.
- Suite still 3736+ passing.
**Rollback:** `git revert`.

### Phase 2: Atomic generator commit (P0, 1 día)

**Objetivo:** Fixear non-atomic state.json write + race-prone parallel runs.

**Cambios:**
- `src/core/config/state.ts`: añadir `atomicMutate(fn)` con `.codi/state/.lock` (proper-lockfile).
- `src/core/generator/apply.ts`: reordenar Phase 1/Phase 2 con state.next + atomic rename.
- Wrap toda la apply pipeline en `atomicMutate`.

**Archivos afectados:**
- `src/core/config/state.ts` (add atomicMutate)
- `src/core/generator/apply.ts:119-156` (reorder)
- `src/core/generator/generator.ts:182-213` (Promise.all → p-limit(32))
- `package.json`: add `proper-lockfile` + `p-limit`

**Riesgo:** Medio. Toca el hot path de `codi generate`.
**Tests:**
- New: `tests/runtime/concurrency/generate-parallel.test.ts` — dos `applyConfiguration()` paralelos asserting one wins.
- New: `tests/integration/state-recovery.test.ts` — crash mid-Phase-2 + re-run → idempotent recovery.
- Existing 3736 must still pass.
**Criterio de aceptación:**
- Parallel-generate test passes.
- Mid-write crash recoverable (manual: kill -9 mid `apply`, re-run, state consistent).
- Suite still 3736+ passing.
**Rollback:** `git revert`.

### Phase 3: Conflict-resolver return signature + de-singleton Logger (P0, 1 día)

**Objetivo:** Fixear contrato `process.exitCode=2` broken + de-couple `utils → core`.

**Cambios:**
- `src/utils/conflict-resolver.ts`: cambiar return type a `Result<ConflictResolution, ConflictError>`; ConflictResolution incluye `unresolvable: ConflictEntry[]`.
- Eliminar `process.exitCode = 2` global side-effect.
- Eliminar mutación in-place de `conflict.incomingContent`.
- Pasar `logger` por DI en options.
- `src/core/generator/generator.ts:198-215`: consumir el nuevo Result.
- Mover `Logger` a `src/utils/logger.ts` o pasar como DI.

**Archivos afectados:**
- `src/utils/conflict-resolver.ts` (modify return signature)
- `src/core/generator/generator.ts` (callsite)
- `src/cli/team.ts`, `src/cli/update.ts`, `src/core/preset/preset-applier.ts`, `src/utils/codi-dir-diff.ts` (other callsites)
- `tests/unit/utils/conflict-resolver.test.ts` (update expectations)

**Riesgo:** Medio. Breaking change interno, pero todos los callers están en repo.
**Tests:**
- Existing 297 LOC test file + update.
- New test: assert `process.exitCode` NEVER set from inside the library.
**Criterio de aceptación:**
- `codi generate` con conflict reporta exit 2 a CI consumers (via CLI entry point translation, NO via global state).
- Suite 3736+ passing.
**Rollback:** `git revert`.

### Phase 4: Brain DB schema CI guard (P1, 1 día)

**Objetivo:** Prevent Drizzle vs raw SQL drift.

**Cambios:**
- New test: `tests/integration/brain-schema-alignment.test.ts` — opens in-memory DB via `BOOTSTRAP_STATEMENTS` AND via Drizzle, diffs `PRAGMA table_info` por cada tabla, fails on mismatch.
- Update CI to run this test on every PR.

**Archivos afectados:**
- `tests/integration/brain-schema-alignment.test.ts` (new)
- `.github/workflows/ci.yml` (no change — runs as part of `npm test`)

**Riesgo:** Bajo. Pure test addition.
**Tests:** The new test itself.
**Criterio de aceptación:**
- New test passes on current main.
- Test catches drift if a column is added to one source but not the other (verify by deliberate temporary mismatch).
**Rollback:** Trivial.

### Phase 5: UNIQUE constraints en captures + prompts (P1, 1 día)

**Objetivo:** Schema-layer race protection.

**Cambios:**
- Add `UNIQUE(turn_id, raw_marker)` en captures table.
- Add `UNIQUE(session_id, turn_no)` en prompts table.
- Migration script para deduplicate existing data si lo hay.

**Archivos afectados:**
- `src/runtime/brain/schema.ts` (Drizzle definitions)
- `src/runtime/brain/migrate.ts` (BOOTSTRAP_STATEMENTS + new migration step)
- `tests/runtime/concurrency/stop-hook-parallel.test.ts` (verify uniqueness)

**Riesgo:** Medio. Migration step needs careful rollout for users with existing brain DBs.
**Tests:** Existing concurrency tests + new test that asserts INSERT conflicts produce 1 row, not 2.
**Criterio de aceptación:**
- Schema alignment test (Phase 4) still passes.
- Concurrency tests pass with stricter assertions.
**Rollback:** Migration step is one-way; rollback requires manual SQL drop unique. Document.

### Phase 6: Adapter base + declarative AdapterDefinition (P1, 3-4 días)

**Objetivo:** Eliminar boilerplate de 6 adapters.

**Cambios:**
- New: `src/adapters/base.ts` — `BaseAdapter.run(def: AdapterDefinition, config: NormalizedConfig)`.
- Convert each adapter (cline, windsurf, cursor, codex, copilot, claude-code) a `AdapterDefinition` objects.
- Extract `exists()` helper a `src/adapters/fs-helpers.ts`.
- Heartbeat hooks: adapters declare `requestedHooks: ["skill-tracker", ...]`; generator pipeline emits files.

**Archivos afectados:**
- `src/adapters/base.ts` (new)
- `src/adapters/fs-helpers.ts` (new)
- `src/adapters/{cline,windsurf,cursor,codex,copilot,claude-code}.ts` (refactor to declarations)
- `src/core/generator/generator.ts` (call BaseAdapter)
- `tests/unit/adapters/*.test.ts` (update)

**Riesgo:** Alto. Toca el hot path de generación. Posible diff visible en outputs si las nuevas reglas difieren sutilmente.
**Tests:**
- Existing per-adapter tests (17 files, ~5,017 LOC).
- Snapshot tests for `dist/cli.js init --preset full --agents all` output (verify byte-equality of generated files pre vs post refactor).
**Criterio de aceptación:**
- Generated files byte-equal pre-refactor (or differences explicitly approved).
- LOC reduction: ~2,000 LOC eliminated.
- Suite 3736+ passing.
**Rollback:** `git revert` (atomic single commit ideally; otherwise revert series).

### Phase 7: Workflow event snapshot table (P1, 1-2 días)

**Objetivo:** Capear reducer replay cost.

**Cambios:**
- New table: `workflow_snapshots(workflow_id, last_event_id, reduced_state_json, created_at)`.
- New: `reducer.reduceIncremental(snapshot, newEvents): ReducedState`.
- New: `brain-event-log.loadEventsSince(workflowId, lastEventId)`.
- Update 12+ callsites to use incremental path.
- Snapshot trigger: every 50 events appended OR every `loadEvents` if no snapshot yet.

**Archivos afectados:**
- `src/runtime/brain/schema.ts` + `migrate.ts` (new table)
- `src/runtime/reducer.ts` (add reduceIncremental)
- `src/runtime/brain-event-log.ts` (loadEventsSince, snapshot writes)
- All 12 callsites of `reduce(events)`

**Riesgo:** Medio. Tocar reducer es delicado.
**Tests:**
- Existing reducer tests (279 LOC).
- New: assert snapshot+delta produces identical result to full replay.
- Concurrency: ensure snapshot writes don't race with appends.
**Criterio de aceptación:**
- Reducer replay cost flat as event count grows.
- Suite 3736+ passing.
**Rollback:** Snapshots are additive; rollback = ignore snapshot table.

### Phase 8: YAML-driven language hook registry (P2, 2 días)

**Objetivo:** Eliminar 1,100 LOC de boilerplate.

**Cambios:**
- Convert `src/core/hooks/registry/<lang>.ts` (16 files) to `src/core/hooks/registry/<lang>.yaml`.
- New: `src/core/hooks/registry-loader.ts` — single YAML loader cached per-process.
- Delete the 16 .ts files + import lines in `registry/index.ts`.

**Archivos afectados:**
- `src/core/hooks/registry/*.ts` → `*.yaml` (16 files)
- `src/core/hooks/registry-loader.ts` (new)
- `src/core/hooks/registry/index.ts` (refactor)

**Riesgo:** Medio. Hook registry is hot.
**Tests:**
- Existing hook registry tests.
- Snapshot test: generated hooks byte-equal pre vs post.
**Criterio de aceptación:**
- Generated hooks byte-equal.
- LOC reduction: ~1,100 LOC eliminated.
- Suite 3736+ passing.
**Rollback:** `git revert`.

### Phase 9: Single-source Zod schemas (P2, 2 días)

**Objetivo:** Eliminar JSON Schema files duplicate.

**Cambios:**
- Add `zod-to-json-schema` as devDep.
- New script: `scripts/generate-json-schemas.mjs` runs at build time, emits `src/schemas/runtime/*.schema.json` desde Zod schemas.
- Update build pipeline.
- Delete hand-written JSON Schema files (now generated).

**Archivos afectados:**
- `package.json` (devDep + scripts)
- `scripts/generate-json-schemas.mjs` (new)
- `src/schemas/runtime/*.schema.json` (regenerated, possibly content-identical)
- `tsup.config.ts` or build hooks

**Riesgo:** Bajo. Generative; if generator works, drift impossible.
**Tests:**
- New: test that runs the generator and asserts checked-in JSON Schemas match generated.
- Existing schema tests.
**Criterio de aceptación:**
- JSON Schemas identical to current (or explicit diffs approved).
- Build pipeline succeeds with generation step.
**Rollback:** `git revert`.

### Phase 10: Re-enable ESLint on src/runtime/ (P2, 3-5 días sprint)

**Objetivo:** Lint coverage para 17K LOC.

**Cambios:**
- Remove runtime ignore from `eslint.config.js:19-22`.
- Fix violations en una batch focal (likely auto-fix mayoritariamente + manual review).
- Update CI.

**Archivos afectados:**
- `eslint.config.js`
- `src/runtime/**` (lint fixes — could be 100+ files)

**Riesgo:** Bajo en correctness, alto en time investment.
**Tests:** Existing suite must still pass after each commit.
**Criterio de aceptación:**
- `npm run lint` covers `src/runtime/`.
- CI green.
**Rollback:** Re-add ignore.

---

## H. Backlog priorizado

### H.1 Quick wins (≤1 día, alto ROI)

| # | Tarea | Archivo | Effort |
|---|---|---|---|
| 1 | `EMPTY_STATE.lastGenerated` lazy en lugar de module-load | `core/config/state.ts:128` | 5 min |
| 2 | Wrap `JSON.parse` en reducer con try/catch + Zod safeParse | `runtime/reducer.ts:30-88` | 4 hours |
| 3 | `p-limit(32)` en generator file ops | `core/generator/generator.ts:152,182,204` | 1 hour |
| 4 | Cache `findProjectBrainPath` per-process | `runtime/brain/db.ts:47` | 1 hour |
| 5 | Collapse `git status` loop a una invocación en gate-runner | `runtime/gate-runner.ts:170-183` | 1 hour |
| 6 | Add malformed-event reducer test | `tests/runtime/reducer.test.ts` | 1 hour |
| 7 | Add state.json corruption test | `tests/unit/config/state.test.ts` | 30 min |
| 8 | Backfill `src/utils/**` missing branches; raise threshold a 95% | `src/utils/*.ts` + `vitest.config.ts:151` | 2 hours |
| 9 | Document `Adding-Hook` + `Adding-Workflow` in CONTRIBUTING | `CONTRIBUTING.md` | 30 min |
| 10 | Add `guard-file-size.mjs` advisory (warn >700 LOC en cli/core) | `scripts/guard-file-size.mjs` | 4 hours |
| 11 | `docs/INDEX.md` + 5 per-layer READMEs | `docs/INDEX.md`, `src/{cli,core,adapters,utils,schemas}/README.md` | 1 day |
| 12 | Resolve `docs/adr/` paradox (move/symlink 10 ADRs) | `docs/adr/`, `docs/` | 2 hours |
| 13 | Replace 4 `installX` siblings con single `writeHookFile()` | `core/hooks/hook-installer.ts:217-252,396-513` | 4 hours |
| 14 | Eliminar `process.exitCode = 2` global side-effect | `utils/conflict-resolver.ts:375` | 2 hours |

### H.2 Refactors críticos (P0/P1, alto impacto)

| # | Tarea | Razón | Effort |
|---|---|---|---|
| R1 | Atomic generator commit con lock + state.next | Phase A diagnosis: non-atomic state writes | 1 día (Phase 2 del plan) |
| R2 | Conflict-resolver return signature → Result<T,E> | Documented contract broken (validation) | 1 día (Phase 3) |
| R3 | Logger DI; eliminar `Logger.getInstance()` | Layering violation utils → core | 0.5 día |
| R4 | Brain DB schema alignment CI guard | Two-sources-of-truth, drift risk | 1 día (Phase 4) |
| R5 | UNIQUE constraints en captures + prompts | Race window en parallel hooks | 1 día (Phase 5) |
| R6 | Adapter base + AdapterDefinition declarative | 2,985 LOC con 85% overlap | 3-4 días (Phase 6) |
| R7 | Workflow event snapshot table | Linear replay forever | 1-2 días (Phase 7) |

### H.3 Mejoras de robustez (P1/P2)

| # | Tarea | Effort |
|---|---|---|
| Rob1 | Replace BrainEventLog.acquireLock con `proper-lockfile` | 4 hours |
| Rob2 | Audit 86+ empty catches: log o re-throw vs intentional | 1 día |
| Rob3 | Migrate Runtime layer from throws to Result<T,E> | 3-5 días (parte del Phase 10) |
| Rob4 | ESLint rule `no-restricted-syntax` para banear template-literal SQL en `raw.prepare`/`raw.exec` | 2 hours |
| Rob5 | Add deliberate test for `unsafeMode(true)` invariant violation detection | 4 hours |

### H.4 Mejoras de tests

| # | Tarea | Effort |
|---|---|---|
| T1 | Malformed-payload reducer test | 1 hour |
| T2 | State.json corruption recovery test | 30 min |
| T3 | Parallel-generate concurrency test | 2 hours |
| T4 | Brain DB locked by external process test | 4 hours |
| T5 | Hook installer mixed-runner (lefthook/pre-commit/husky simultáneos) test | 4 hours |
| T6 | Replace snapshot-only template tests with semantic assertions | 1.5h × 2 files |
| T7 | Restore msw + introduce network-boundary tests para network-exempt files | 1-2 días |
| T8 | Non-core artifact removal smoke test (`tests/integration/non-core-removal.test.ts`) | 4 hours |

### H.5 Mejoras de arquitectura

| # | Tarea | Effort |
|---|---|---|
| A1 | Move `Logger` to `utils/logger.ts` o pass via DI | 0.5 día |
| A2 | Drop `getDefaultGitHookNames` import from `core/config/state.ts` | 2 hours |
| A3 | Adapters → AdapterDefinition declarative (Phase 6) | 3-4 días |
| A4 | Single-source Zod → JSON Schema (Phase 9) | 2 días |
| A5 | YAML-driven hook registry (Phase 8) | 2 días |
| A6 | DecisionKind union extraction (gate-runner.ts × 8 sites) | 4 hours |
| A7 | `ARTIFACT_LAYOUT` como única fuente de verdad — consolidar `CapabilityType`, `LedgerEntryType`, `CapturedArtifactType` | 1 día |
| A8 | Aislamiento de meta-skills con tag explícito + import-rule guard | 0.5 día |

### H.6 Tareas que deben evitarse por ahora

| # | Tarea | Razón para evitar |
|---|---|---|
| X1 | Reescritura completa del reducer con Visitor pattern | Big lift, no user-visible payoff. Mantener switch + Zod safeParse es suficiente. |
| X2 | Event-sourced state.json | Interesante pero state.json es small enough que el costo > beneficio hasta que el generator se vuelva incremental. |
| X3 | Migración full a drizzle-kit migrations | Mover a Phase 9; el CI guard de Phase 4 cubre el caso urgente. |
| X4 | Reescribir todos los CLI handlers con un super-helper | Riesgo de regresión sin payoff inmediato. Aplicar quick wins puntuales. |
| X5 | Lockfile auto-detection en user-emitted templates | Tarea grande aparte; el plan de npm migration lo difiere por diseño (Task 12 deferred). |
| X6 | Migrate a Vite/esbuild full bundler en lugar de tsup | Tsup funciona. No optimizar prematuramente. |

---

## Cierre

Codi está en una posición saludable para un refactor enfocado: tiene tests, guards, conventional commits, error codes, y un layering en gran parte consistente. Los 6 archivos que exceden el límite de 700 LOC son extraction-ready (especially `init.ts:initHandler` 664-LOC god function), las 16 dependencias circulares son acotadas a dos familias (`cli/init-wizard*` y `cli/preset*`), y las violaciones de layering están concentradas en 8 sitios bien identificados.

**Las dos cosas que más bloquean crecimiento a 100x son:**
1. Reducer linear replay forever (Phase 7 lo capea).
2. Adapter sprawl (Phase 6 lo colapsa).

**Las dos cosas que más erosionan confianza hoy son:**
1. Reducer crashea con malformed event (Phase 1 lo arregla en 4 horas).
2. Non-TTY conflict exit code contract broken (Phase 3 lo restaura).

**El producto está listo para shipping** — 3736 tests, todos los guards, build clean, husky pre-push verde, zero pnpm refs en user-visible CLI output. Los riesgos identificados son **deuda técnica concreta y accionable**, no fallas existenciales.

El backlog priorizado en H proporciona 14 quick wins (≤1 día cada uno, ~25 horas total) que entregan alto ROI sin tocar arquitectura, y 7 refactors críticos (Phases 1-7 del plan) que mueven la arquitectura hacia el target documentado en F sin reescrituras completas.

### Documentos referenciados

- `/home/lehidalgo/dev/rl3/codi/src/cli/init.ts` (init.ts:105 — 664-LOC god function)
- `/home/lehidalgo/dev/rl3/codi/src/cli/workflow.ts` (handleOutput pattern × 29)
- `/home/lehidalgo/dev/rl3/codi/src/core/config/state.ts` (atomicMutate target)
- `/home/lehidalgo/dev/rl3/codi/src/core/config/parser.ts`
- `/home/lehidalgo/dev/rl3/codi/src/core/config/validator.ts`
- `/home/lehidalgo/dev/rl3/codi/src/core/generator/apply.ts` (apply.ts:144-156 — non-atomic)
- `/home/lehidalgo/dev/rl3/codi/src/core/generator/generator.ts` (generator.ts:152,182,204 — unbounded Promise.all)
- `/home/lehidalgo/dev/rl3/codi/src/core/hooks/hook-installer.ts` (writeAuxiliaryScripts:87-215)
- `/home/lehidalgo/dev/rl3/codi/src/runtime/reducer.ts` (reducer.ts:30-88 — schema bypass)
- `/home/lehidalgo/dev/rl3/codi/src/runtime/brain-event-log.ts` (loadEvents:398-403)
- `/home/lehidalgo/dev/rl3/codi/src/runtime/brain/db.ts`
- `/home/lehidalgo/dev/rl3/codi/src/runtime/brain/schema.ts` (Drizzle source)
- `/home/lehidalgo/dev/rl3/codi/src/runtime/brain/migrate.ts` (raw SQL bootstrap)
- `/home/lehidalgo/dev/rl3/codi/src/runtime/gate-runner.ts` (decision_recorded × 8 sites)
- `/home/lehidalgo/dev/rl3/codi/src/runtime/workflows/registry.ts` (gold-standard pattern)
- `/home/lehidalgo/dev/rl3/codi/src/runtime/capture/persist.ts` (UNIQUE constraint candidate)
- `/home/lehidalgo/dev/rl3/codi/src/runtime/capture/stop-hook.ts` (empty catch:84)
- `/home/lehidalgo/dev/rl3/codi/src/utils/conflict-resolver.ts` (exitCode=2:375)
- `/home/lehidalgo/dev/rl3/codi/src/adapters/index.ts` (registry)
- `/home/lehidalgo/dev/rl3/codi/src/adapters/{cursor,windsurf,cline,codex,copilot,claude-code}.ts` (~85% overlap)
- `/home/lehidalgo/dev/rl3/codi/src/core/artifact-types.ts` (ARTIFACT_LAYOUT — extension point)
- `/home/lehidalgo/dev/rl3/codi/scripts/guard-*.mjs` (5 guards)
- `/home/lehidalgo/dev/rl3/codi/eslint.config.js:19-22` (runtime ignored)
- `/home/lehidalgo/dev/rl3/codi/CONTRIBUTING.md`
- `/home/lehidalgo/dev/rl3/codi/docs/adr/README.md` (empty paradox)

### Limitaciones del review

- No se inspeccionaron exhaustivamente los 73 skill templates en `src/templates/skills/` — la clasificación como non-core/meta-skill está basada en directorio + sampling.
- Race-condition stress: solo 2× y 5× parallelism en un host. Cargas reales pueden surface failure modes adicionales.
- No se midió latencia end-to-end en `codi generate` con N=100 skills. Las proyecciones de scalability son Fermi estimates.
- Algunos files en `src/runtime/` no fueron leídos completamente (gate-runner.ts:441-574 muestreados).
- El `agent` branch del gate-registry (dead code waiting on ISSUE-085) no fue verified más allá del comentario en el código.

Este documento se debería actualizar después de cada Phase del plan de refactor (G) para reflejar avances y revalidar las hipótesis.
