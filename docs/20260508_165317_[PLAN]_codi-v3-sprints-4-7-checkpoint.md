# Plan: Codi v3 ed.0 — Sprints 4-7 checkpoint

- **Date**: 2026-05-08 16:53
- **Document**: 20260508*165317*[PLAN]\_codi-v3-sprints-4-7-checkpoint.md
- **Category**: PLAN
- **Estado**: pending implementation
- **Source of truth**: master plan `docs/20260508_133556_[PLAN]_codi-v3-ed0-master.md` §17.1
- **Naturaleza**: detalle ejecutable de los 4 sprints restantes para retomar en sesiones futuras. No reemplaza el master plan; lo complementa con el siguiente nivel de granularidad por sprint.

---

## Status post Sprint 3

### Done (commits en `feature/codi-v3-harness`)

| Sprint                      | Commits                          | Resumen                                                        |
| --------------------------- | -------------------------------- | -------------------------------------------------------------- |
| 0 Foundation                | `42f6ceff` … `a036e404`          | Branch + 10 ADRs + deps base                                   |
| 1 DevLoop merge             | `2f302be5` `1d4bb36c`            | libs / hooks / schemas / tests / scripts importados            |
| 1.5 Skills migration        | `94af28ad` `cd77a9e8` `0b4f47d6` | 22 DevLoop skills migradas (1 piloto + 18 batch + 4 conflicts) |
| 2 Runtime + SQLite (lite)   | `689c4e60` `da52390b`            | Tests integration + sheets deps + lint baseline                |
| 2 Runtime + SQLite (proper) | (este sprint)                    | Drizzle + 11 tablas + FTS5 + ExternalSyncer interface          |
| 3 Workflows + capture       | (este sprint)                    | Capture markers parser + rule + UserPromptSubmit reinforcement |

### Pending (this doc)

Sprints 4 (UI Live), 5 (Consolidación), 6 (Multi-target + plugin), 7 (Migration v2→v3 + Release).

Estimación combinada: 8-12 semanas para 1 dev TS dedicado.

---

## Sprint 4 — UI Live (~2 semanas)

### Objetivo

Levantar el servidor `codi-brain-server` (Hono + HTMX) que sirve como ventana en tiempo real al brain DB. Ciclo spawn-or-attach: la skill `brain-ui` arranca el server si no existe, comparte el mismo proceso si ya está corriendo.

### Entregables

1. **Server skeleton** (`src/runtime/brain-ui/server.ts`)
   - Hono app con rutas estáticas + API
   - Pidfile en `~/.codi/brain-ui.pid` para detectar instance existente
   - Health endpoint `GET /healthz` → `{ ok, schema_version, brain_path }`
   - Graceful shutdown via SIGTERM

2. **Páginas (HTMX + Tailwind via CDN para zero-build)**
   - `GET /` → home con session list (últimas 20)
   - `GET /live` → vista live del session activo (poll WAL cada 2s)
   - `GET /findings` (stub) → lista placeholder de propuestas; rellena en Sprint 5
   - `GET /workflows` → lista de workflow_runs activos por proyecto

3. **API HTTP** (13 endpoints `api/v1/*` per master plan §11)
   - `GET  /api/v1/projects`
   - `GET  /api/v1/projects/:id/sessions`
   - `GET  /api/v1/sessions/:id`
   - `GET  /api/v1/sessions/:id/captures?type=&since=`
   - `GET  /api/v1/sessions/:id/turns`
   - `GET  /api/v1/sessions/:id/tool-calls`
   - `GET  /api/v1/captures/search?q=` (FTS5)
   - `GET  /api/v1/workflows`
   - `GET  /api/v1/workflows/:id/events`
   - `POST /api/v1/captures/:id/redact` (Sprint 5+)
   - `GET  /api/v1/proposals` (Sprint 5)
   - `POST /api/v1/proposals/:id/accept` (Sprint 5)
   - `POST /api/v1/proposals/:id/reject` (Sprint 5)

4. **Polling WAL + SSE**
   - `GET /api/v1/live/stream` → Server-Sent Events
   - Backend abre el SQLite en read-only WAL mode, observa el último `capture_id` cada 1s
   - Fallback a polling cuando el cliente no soporta SSE

5. **Skill `brain-ui`**
   - Nueva skill en `src/templates/skills/brain-ui/`
   - Comando `codi brain ui [--port 4477]`
   - Spawn-or-attach: si el pidfile apunta a un PID vivo y healthz responde, usa esa instancia

6. **Tests**
   - `tests/runtime/brain-ui-server.test.ts` con `supertest` o equivalente
   - Smoke: arranca server, hits `/healthz`, hits cada endpoint con tmp brain populated

### Dependencias a añadir

```json
"hono": "^4.x",
"@hono/node-server": "^1.x"
```

### Riesgos

- **R4.1**: Lock contention con readonly WAL si el agente está escribiendo intensivamente. Mitigación: BEGIN IMMEDIATE en escrituras del agente, retry exponencial en el server.
- **R4.2**: HTMX + Tailwind via CDN en zero mode rompe en air-gapped. Mitigación: Sprint 4.5 puede empaquetar bundles offline.

---

## Sprint 5 — Consolidación (~2 semanas)

### Objetivo

Pipeline 5-stages que detecta patrones en N captures y propone cambios accionables a artefactos (rules / skills / agents).

### Entregables

1. **Scratch DB con ATTACH multi**
   - `scratch_db.ts`: abre tmp SQLite, hace `ATTACH DATABASE 'brain.db' AS brain`, `ATTACH 'plugin.db' AS plugin`
   - Permite JOIN entre captures (brain) y artifacts_used (brain) y plugin metadata
   - Limpieza automática post-pipeline

2. **8 patterns SQL detection** (P1-P8 per master plan §10)
   - P1 Repeated correction → propose RULE
   - P2 Skill never selected → propose DEPRECATE
   - P3 Skill always co-fires con otro → propose MERGE
   - P4 Two rules contradicting → propose RESOLVE_CONFLICT
   - P5 New consistent pattern (≥3 occurrences) → propose CREATE_NEW
   - P6 Skill timing exceeds threshold → propose OPTIMIZE
   - P7 Capture cluster sin home rule → propose CREATE_NEW
   - P8 Rule referenced never triggered → propose DEPRECATE

3. **Prompt templates editables** (`src/templates/consolidation/`)
   - 8 prompts (uno por pattern) en `.md.tmpl`
   - User-editable via `codi consolidation edit-prompt p3`

4. **6 tipos de propuesta** (per master plan §5.x)
   - PROMOTE_TO_RULE
   - MERGE_SIMILAR
   - RESOLVE_CONFLICT
   - DEPRECATE_ARTIFACT
   - CREATE_NEW_ARTIFACT
   - OPTIMIZE_EXISTING_ARTIFACT

5. **UI `/proposals`**
   - Tabla agrupada por tipo de propuesta
   - Acciones: accept (apply patch), edit (open in inline editor), reject (with reason)
   - Stage 5: aprobaciones acumuladas → `codi consolidation generate-package` → `.zip`

6. **Modo external LLM + modo agent**
   - Endpoints separados (content-factory pattern):
     - `POST /api/v1/consolidation/run-with-llm` (server llama a OpenAI/Anthropic con prompt+data)
     - `POST /api/v1/consolidation/run-with-agent` (server retorna prompt+data; agente externo ejecuta y POSTea result)

7. **Tests**
   - `tests/runtime/consolidation-patterns.test.ts` por pattern
   - Fixture: 4 mock SQLites con captures pre-generados, validar propuestas esperadas

### Dependencias

- Ninguna nueva (todo SQL + JS)

### Riesgos

- **R5.1**: Pattern detection tiene falsos positivos altos en sesiones cortas. Mitigación: thresholds configurables + minimum-evidence count.

---

## Sprint 6 — Multi-target + plugin distribution (~2 semanas)

### Objetivo

Unificar generación per-agent bajo Capabilities Matrix (Tier 1 full vs Tier 2 config-only) y publicar como plugin nativo de Claude Code y Codex CLI.

### Entregables

1. **Capabilities Matrix runtime** (`src/core/capabilities/matrix.ts`)
   - Por cada target: `{ skills, rules, agents, hooks, slashCommands, mcp }: bool`
   - Tier 1A (Claude Code): todo true
   - Tier 1B (Codex CLI): todo true except UI integration
   - Tier 2 (Cursor / Windsurf / Cline / Copilot / Gemini): solo `{ rules, skills, mcp }: true`
   - Generators consultan matrix antes de emitir

2. **Plugin manifests**
   - `.claude-plugin/plugin.json` con skills/rules/agents/hooks listados (Codi v3 format, no DevLoop's)
   - `.codex-plugin/plugin.json` similar (subset Codex acepta)
   - Auto-generated por `codi generate` desde el manifest interno

3. **`codi plugin publish` doble track**
   - Track A (default): `codi generate` produces local config files (current behavior)
   - Track B (opt-in): `codi plugin publish --target=claude-code-marketplace` empaqueta y publica
   - Includes: manifest, hooks, skills, rules, agents, configs/

4. **Tests Codi-specific plugin layout**
   - Reemplazo de `tests/runtime/skills.test.ts` (excluido en Sprint 2.1)
   - Validar que `.claude-plugin/plugin.json` generated cumple Codi schema (no DevLoop's)
   - Validar que team-charter session-start hook se emite a `.claude/hooks/session-start.sh`

5. **Migrar Codi v2 generators a usar Capabilities Matrix**
   - `src/adapters/claude-code/`, `src/adapters/cursor/`, etc.
   - Cada adapter consulta matrix antes de copiar

### Dependencias

- Ninguna nueva

### Riesgos

- **R6.1**: Breaking changes para users de Cursor/Windsurf si el subset cambia. Mitigación: ADR-003 ya garantiza que Tier 2 mantiene generators activos. Solo afecta si añadimos nuevos artefactos.

---

## Sprint 7 — Migration v2→v3 + Release (~2-4 semanas)

### Objetivo

Script idempotente de migración Codi v2 → v3 + dogfooding interno + release v3.0.0.

### Entregables

1. **`codi migrate v2-to-v3`** (CLI command)
   - Detecta layout v2 (`.codi/` con artefactos managed_by: codi v2)
   - Backup `.codi/` → `.codi.v2.backup-<ts>/`
   - Bootstrap brain DB (idempotent si ya existe)
   - Reescribe `.codi/codi.yaml` con nuevo schema (mode: zero|lite|standard|full)
   - Mapea skills/rules/agents v2 → v3 catálogo (77 artefactos)
   - Reporta diff: artefactos añadidos / removidos / cambiados

2. **Dogfooding interno**
   - Run `codi migrate v2-to-v3` sobre el repo `lehidalgo/codi` mismo
   - Verificar que `pnpm test` sigue pasando post-migration
   - Capture markers funcionan en sesiones reales con Claude Code + Codex CLI

3. **CHANGELOG**
   - `CHANGELOG.md` con sección v3.0.0 detallando: breaking changes, new features, deprecations, migration path

4. **Docs**
   - `docs/guides/upgrade-from-v2.md` (Diataxis: how-to)
   - `docs/explanation/codi-v3-architecture.md` (Diataxis: explanation, basado en master plan)
   - `docs/reference/cli-commands.md` (Diataxis: reference, listado completo)

5. **Polish**
   - `pnpm lint && pnpm test && pnpm build` verde sin warnings
   - Coverage thresholds met (75% global, 100% en src/utils, src/schemas)
   - All TODO/FIXME en código removed o ticketed

6. **Release**
   - Tag `v3.0.0`
   - `npm publish` (CI automático en merge a main, NO ejecutar manualmente)
   - GitHub Release notes pegando del CHANGELOG
   - Anuncio en repo + comunidades (manual)

### Dependencias

- Ninguna nueva

### Riesgos

- **R7.1**: Dogfooding revela bugs no vistos. Mitigación: 1-2 semanas de buffer en estimación (de ahí 2-4 semanas).
- **R7.2**: Migración v2→v3 destruye datos en repos reales si el script tiene bugs. Mitigación: backup obligatorio + dry-run mode + tests de integration con repos v2 sintéticos.

---

## Cronograma sugerido

| Semana | Sprint                  | Hito                          |
| ------ | ----------------------- | ----------------------------- |
| 1-2    | 4 UI Live               | M4 — UI funcional en browser  |
| 3-4    | 5 Consolidación         | M5 — pipeline end-to-end      |
| 5-6    | 6 Multi-target + plugin | M6 — plugin publish funcional |
| 7-10   | 7 Migration + Release   | M7 — release v3.0.0           |

Total: 8-10 semanas (mínimo) — 12 semanas con buffer.

---

## Decisiones diferidas (revisar al arrancar cada sprint)

- **Sprint 4**: ¿HTMX + Tailwind via CDN o bundled? (zero mode quiere CDN; air-gapped quiere bundled)
- **Sprint 5**: ¿Llamadas LLM dentro del server o siempre via agente externo? Master plan dice ambos modos; orden de implementación = agente primero (más seguro).
- **Sprint 6**: ¿Mantener `codi generate` por defecto o cambiar default a `codi plugin generate`? Probablemente mantener `generate` para no breaking.
- **Sprint 7**: ¿Release como `v3.0.0` directo o `v3.0.0-rc.1` primero? Recomendación: RC primero, dogfood 2 semanas, luego v3.0.0 GA.

---

## Cómo retomar

1. Verificar branch: `git status` → `feature/codi-v3-harness`, working tree clean
2. Verificar tests: `pnpm test` → 257 files / 3156 passed (post Sprint 3)
3. Leer este doc + master plan §17 + ADRs relevantes (`docs/20260508_140923_[ARCHITECTURE]_adr-v3ed0-*.md`)
4. Empezar por Sprint 4 sub-tarea 1 (server skeleton). Test-first per Codi's TDD rule.
