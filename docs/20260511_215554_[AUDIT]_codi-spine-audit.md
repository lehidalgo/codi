# Auditoría de la columna vertebral de Codi

- **Date**: 2026-05-11 21:55
- **Document**: 20260511*215554*[AUDIT]\_codi-spine-audit.md
- **Category**: AUDIT

---

## Executive Summary

- Codi v3.0.0 es un CLI Node/TS de generación estática multi-agente con runtime SQLite + capture pipeline + workflow engine + sync layer.
- Spine identificado: `core/config + generator + scaffolder + adapters + schemas + version + verify` (estático) + `runtime/brain + capture + reducer + workflows + iron-laws-enforcer` (dinámico) + `core/hooks` (harness).
- 35 hallazgos clasificados (2 críticos bloqueantes, 13 altos, 8 medios, 12 bajos/informativos).
- 2 problemas estructurales que invalidan la promesa "plataforma para equipos":
  1. **Sync layer (6.6K LOC, 27 archivos) desconectado del CLI principal** (H-01).
  2. **Metaskills implementadas como artefactos en `.codi/skills/codi-*` sin convención `codi-dev-*` aplicada** — solo 3/10 cumplen hoy (H-02).
- Reconstrucción zero-artifact = **PARCIAL** — Codi reconstruye shapes vía scaffolders pero pierde calidad/guía LLM.
- Preparación equipos = **BÁSICA** — sync existe pero solo Google + sin ownership por artefacto + sin team brain.
- Brain implementación = **SÓLIDA + parcialmente automatizada** — schema, capture y UI maduros; mejora continua sigue híbrida humano+LLM.

## 1. Qué es Codi realmente

| Plano                | Definición                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Producto declarado   | "One config. Every AI agent. Zero drift." Generador estático multi-agente (6 agentes)                      |
| Implementación real  | CLI + runtime + brain SQLite + capture pipeline + workflow lifecycle + sync layer + plugin manifest        |
| 3 niveles operativos | N1 source (maintainers), N2 `.codi/` proyecto (equipo), N3 salida generada (agentes)                       |
| Núcleo conceptual    | Mecanismos que crean / generan / validan / sincronizan / observan / mejoran artefactos — no los artefactos |

## 2. Anatomía de Codi

```
src/cli.ts (Commander entry, 99 LOC)
   │
   ├─ src/core/* (150 archivos) — Plataforma estática
   │    ├─ config/        → resolveConfig (NormalizedConfig)
   │    ├─ generator/     → 2-phase render+I/O, conflict resolver
   │    ├─ scaffolder/    → rule/skill/agent/mcp creation
   │    ├─ preset/        → Bundles flags+artifacts
   │    ├─ flags/         → 16 flags + modos resolución
   │    ├─ version/       → artifact-manifest + hash registry
   │    ├─ verify/        → token + checksum
   │    ├─ hooks/         → multi-runner harness (Husky/pre-commit/Lefthook/raw)
   │    ├─ backup/audit/security/migration/output/external-source/capabilities/docs
   │    └─ skill/         → metaskill primitives (improver/stats/evals/feedback)
   │
   ├─ src/adapters/* (13) — 6 traductores + 7 helpers
   │
   ├─ src/runtime/* (133 archivos) — Plataforma dinámica
   │    ├─ brain/         → SQLite + Drizzle + FTS5 (12 tablas + virtual FTS5)
   │    ├─ brain-event-log → workflow runs/events
   │    ├─ capture/       → Iron Law 9 markers (11 types)
   │    ├─ reducer/event-factory/replay → event sourcing puro
   │    ├─ workflows/     → 5 adapters + phase-walker genérico (22 LOC)
   │    ├─ cli-handlers/  → workflow lifecycle
   │    ├─ iron-laws-enforcer + gate-runner + classifier → harness
   │    ├─ sync/          → 27 archivos Google Sheets/xlsx (desconectado del CLI)
   │    ├─ brain-ui/      → HTTP+SSE local server (16+ rutas REST)
   │    └─ tokens/        → cost aggregation (real + estimate)
   │
   ├─ src/cli/* (58) — CLI handlers (capa fina)
   ├─ src/schemas/* (12) — Zod en cada borde
   ├─ src/utils/* (14)
   └─ src/templates/* (3867 archivos) — Artefactos default (no spine)
```

## 3. Definición de la columna vertebral

> **Spine = todo lo que permite crear, operar, generar, sincronizar, observar y mejorar artefactos, independiente de los artefactos default.**

| Bloque core                            | Archivos clave                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline generación + traducción       | `core/config/*` + `core/generator/*` + `adapters/*` + `core/verify/*`                                                                         |
| Creación programática                  | `core/scaffolder/*` + `core/external-source/*` + `core/preset/*`                                                                              |
| Validación estructural                 | `core/config/validator.ts` + `schemas/*` + hooks pre-commit                                                                                   |
| Hooks críticos + harness               | `core/hooks/*` + `runtime/hook-logic.ts` + `runtime/iron-laws-enforcer.ts` + `runtime/gate-runner*.ts` + `runtime/classifier*.ts` + `.husky/` |
| Workflow engine (metaworkflows)        | `runtime/workflows/{types,registry,phase-walker}.ts` + 5 adapters + `runtime/cli-handlers/*`                                                  |
| Brain + observabilidad                 | `runtime/brain/*` + `runtime/brain-event-log.ts` + `runtime/capture/*` + `runtime/reducer.ts` + `runtime/tokens/*` + `runtime/brain-ui/*`     |
| Sincronización equipo                  | `runtime/sync/*` (debe conectarse al CLI principal)                                                                                           |
| Versioning + audit + backup + security | `core/version/*` + `core/audit/*` + `core/backup/*` + `core/security/*`                                                                       |
| Metaskill primitives                   | `core/skill/*`                                                                                                                                |
| Plugin packaging                       | `core/capabilities/*` + `cli/plugin.ts`                                                                                                       |
| Metaskills siempre presentes           | `src/templates/skills/dev-*` (hoy solo 3, deben crecer)                                                                                       |

**Fuera del spine**: todos los `templates/skills/<no-dev>`, `templates/rules/*`, `templates/agents/*`, `templates/workflows/*` específicos de dominio.

## 4. Evaluación del core (pipeline estático)

| Eje            | Calificación | Evidencia                                                         |
| -------------- | ------------ | ----------------------------------------------------------------- |
| Diseño         | A            | `Result<T>` en cada frontera, Zod en cada borde, 2-fase generator |
| Extensibilidad | A            | `AgentAdapter` interface + `ALL_ADAPTERS` + register pattern      |
| Mantenibilidad | B            | `hook-templates.ts: 716` viola regla 700 (H-03)                   |
| Testabilidad   | B            | Unit 186, integration 22; **adapters 1, cli 1** (H-04, H-05)      |
| Escalabilidad  | A            | Pipeline puro in-memory; binarios vía `copyFile`                  |

## 5. Evaluación de metaskills

| Eje                                         | Calificación                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Convención `codi-dev-<name>` aplicada       | F — solo 3/10 cumplen (`codi-dev-docs-manager`, `codi-dev-e2e-testing`, `codi-dev-operations`) |
| Cobertura de capacidades core (10 listadas) | C — 8 existen, 2 faltan (`hook-creator`, `workflow-creator`)                                   |
| Programáticas vs scripts ad hoc             | B — `core/skill/*` ofrece primitivas; el "cómo mejorar bien" sigue siendo artefacto            |
| Reutilizables                               | B — diseñadas con frontmatter + evals.json + skill-test.ts                                     |
| Extensibles                                 | C — falta scaffolder `codi add skill dev-<name>` que aplique convención automáticamente        |

**Skills `codi-*` que parecen metaskills pero NO cumplen convención**: `codi-dev-agent-creator`, `codi-dev-artifact-contributor`, `codi-audit-fix`, `codi-dev-compare-preset`, `codi-dev-refine-rules`, `codi-dev-rule-creator`, `codi-dev-skill-creator`, `codi-architecture-review`, `codi-dev-init-knowledge-base`, `codi-dev-brand-creator`, `codi-dev-preset-creator`, `codi-mcp-ops`.

**Metaskills core faltantes**: `codi-dev-hook-creator`, `codi-dev-workflow-creator`, `codi-dev-self-audit`, `codi-dev-consistency-check`.

## 6. Evaluación de hooks, arnés y runtime

| Eje                                                            | Calificación                                             |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| Detección multi-runner (Husky/pre-commit/Lefthook/standalone)  | A                                                        |
| Iron-Laws funciones puras + adapter scripts/runtime            | A                                                        |
| Capture pipeline idempotente                                   | A — `persist.ts:46-65` dedup por `(turn_id, raw_marker)` |
| Reducer event sourcing puro + exhaustive switch                | A — `never`-exhaustive                                   |
| Acoplamiento singleton `workflow_runs.__codi_session__` (H-07) | C — overload semántico                                   |
| Pass-through de eventos `sheet_*` sin proyección (H-08)        | C                                                        |
| Validador de calidad semántica de artefactos                   | F — no existe (solo estructural via Zod)                 |

## 7. Evaluación de traducción/adapters

| Eje                                                                             | Calificación                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Patrón `AgentAdapter` consistente                                               | A                                                               |
| Registry canónico                                                               | A (`adapters/index.ts:31-38`, `ALL_ADAPTERS`)                   |
| Helpers compartidos (`section-builder`, `skill-generator`, `flag-instructions`) | A                                                               |
| Markers `[[/path]]` con transformación per-platform                             | A                                                               |
| Test coverage                                                                   | F — 1 archivo en `tests/adapters/` para 13 archivos productivos |

## 8. Evaluación de sincronización y colaboración

| Eje                                            | Calificación                                     |
| ---------------------------------------------- | ------------------------------------------------ | ------------- |
| Backend sync                                   | C — solo Google Sheets / xlsx; sin git/GitHub/S3 |
| CLI principal expone sync                      | F — desconectado (H-01)                          |
| Ownership por artefacto                        | F — solo `managed_by: codi                       | user` binario |
| CODEOWNERS por carpeta artefacto               | F — único global owner `@lehidalgo`              |
| Conflict resolver entre humanos sobre `.codi/` | F — vía git generic                              |
| Team brain agregado                            | F — Brain local-only                             |
| Onboarding `codi team join`                    | F — no existe                                    |
| Operations-ledger captura `actor`              | F (H-26)                                         |

## 9. Evaluación de Brain y observabilidad

| Eje                                                  | Calificación                                      |
| ---------------------------------------------------- | ------------------------------------------------- |
| Schema 12 tablas + FTS5                              | A                                                 |
| Capture 11 types canónicos + auto-promote para typos | A                                                 |
| Tokens aggregator (real + estimate)                  | A                                                 |
| Brain-UI 16+ rutas REST                              | A                                                 |
| Soft delete + restore + bulk-delete                  | A                                                 |
| Trazabilidad uso→defecto→artefacto                   | F — no join `corrections ↔ artifacts_used` (H-28) |
| Persistencia de eval_runs                            | F (H-29)                                          |
| Detección automática pain-points                     | F (H-30)                                          |
| `actor.id` en corrections + ledger                   | F (H-33)                                          |
| `artifact_version` en `artifacts_used`               | F (H-34)                                          |

**Brain capture flow**:

```
Agent turn → markers en output
   ↓
stop-hook.ts → parse markers (markers.ts, 11 types canónicos)
   ↓
persist.ts → captures table (idempotent dedup turn_id+raw_marker)
   ↓
tokens/aggregator.ts → cost por sesión
   ↓
skill-stats.ts → aggregations
   ↓
skill-improver.ts → genera prompt para LLM
   ↓
codi-dev-refine-rules / codi-skill-evolver (artefacto) → guía LLM
   ↓
HUMANO revisa propuesta → escribe a .codi/
   ↓
codi generate → propaga
```

## 10. Separación core ↔ artefactos

| Aspecto                                                        | Estado                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Pipeline core no depende de artefactos default                 | ✓                                                                                         |
| Scaffolders crean artefactos vacíos válidos sin templates      | ✓ (rule/skill/agent/mcp)                                                                  |
| Hooks core no requieren skill específica                       | ✓                                                                                         |
| Workflow runtime depende de yamls en `templates/workflows/`    | ✗ (acoplamiento)                                                                          |
| Brain capture depende de Iron Law 9 + metaskill `team-charter` | ✗ — markers son code-driven; team-charter es artefacto que enseña la convención al humano |
| Mejora continua depende de metaskills artefacto                | ✗ (H-02)                                                                                  |

## 11. Escenario de reconstrucción

> **PARCIAL.** Shapes reconstruibles vía scaffolders + schemas + `codi add`. Calidad y guía perdidas si se eliminan metaskills artefacto.

| Capacidad post-`rm -rf src/templates/`                 | Resultado                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------- | ----- | ---- | --- |
| `codi init` + `codi add rule                           | skill                                                         | agent | mcp` | ✓   |
| `codi add hook` / `codi add workflow`                  | ✗ — subcomandos no existen                                    |
| Pipeline `codi generate` con `.codi/` vacío            | ✓                                                             |
| Metaskills `codi-dev-*` regenerables programáticamente | ✗ — no hay bootstrap recovery                                 |
| Workflows runtime sin yamls templates                  | ✗ — adapters quedan colgantes (`seed-workflows.ts` lee yamls) |
| Calidad semántica de artefactos creados                | ✗ — sin LLM-judge                                             |
| Sincronización de equipo post-reset                    | ✗ — sync desconectada del CLI                                 |

## 12. Findings (35)

| ID   | Hallazgo                                                                    | Área           | Severidad                 | Evidencia                                                                                       | Impacto                                                    | Recomendación                                                                     | Esfuerzo | Prioridad |
| ---- | --------------------------------------------------------------------------- | -------------- | ------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- | --------- |
| H-01 | `runtime/sync` desconectado del CLI principal (27 archivos, 6.6K LOC)       | Arquitectura   | CRIT                      | `grep sync src/cli.ts` → 0 matches; `src/runtime/sync/cli.ts` 598 LOC separado                  | Feature dark, 6.6K LOC mantenidos sin uso CLI              | Registrar `registerSyncCommand` en `src/cli.ts` o marcar `experimental` flag      | M        | P0        |
| H-02 | Metaskills como artefactos sin convención `codi-dev-*` aplicada (solo 3/10) | Producto       | CRIT                      | `ls .codi/skills/codi-dev-*` = 3; `templates/skills/dev-*` = 3; convention compliance           | Reconstrucción zero-artifact pierde guía LLM               | Rename + mover skills metaskill a `templates/skills/dev-*` con `managed_by: codi` | L        | P0        |
| H-03 | `core/hooks/hook-templates.ts: 716` viola regla 700 LOC                     | Mantenibilidad | ALTA                      | `wc -l hook-templates.ts` = 716                                                                 | Erosión cultural de regla auto-impuesta                    | Partition por tipo de hook en `core/hooks/templates/<name>.ts`                    | M        | P1        |
| H-04 | Adapters: 13 archivos / 1 test                                              | Testabilidad   | ALTA                      | `ls tests/adapters/` = 1 archivo                                                                | Regresión multi-agente no detectada                        | Golden snapshot test por adapter (6 mínimo)                                       | M        | P1        |
| H-05 | CLI handlers: 58 archivos / 1 test                                          | Testabilidad   | ALTA                      | `ls tests/cli/` = 1 archivo                                                                     | Surface CLI no auditada                                    | Tests sobre top 10 comandos críticos                                              | A        | P1        |
| H-06 | `unsafeMode(true)` permanente en brain DB                                   | Seguridad      | ALTA                      | `runtime/brain/db.ts:181` — DEFECT-007 workaround                                               | SQL injection latente si se añade SQL dinámico             | Encapsular FTS5 + linter prohíbe `raw.exec()`                                     | M        | P1        |
| H-07 | Overload singleton `workflow_runs.__codi_session__`                         | Abstracción    | ALTA                      | `brain-event-log.ts:75` + filtro defensivo `iron-laws-enforcer.ts:39-49`                        | Modelo mezclado: workflows+lock+session-state en una tabla | Nueva tabla `runtime_state(key, value, updated_at)`                               | L        | P1        |
| H-08 | Reducer pass-through eventos `sheet_*` sin proyección                       | Acoplamiento   | ALTA                      | `reducer.ts:265-269`                                                                            | Eventos cosidos al stream sin derivar estado               | Tabla `sync_events` separada                                                      | L        | P1        |
| H-09 | `src/brain/`, `src/db/` README-only legacy                                  | Código muerto  | MED                       | `ls src/brain/` = solo README                                                                   | Ruido arquitectónico — confusión sobre dónde vive brain    | Eliminar o mover a `docs/adr/`                                                    | L        | P2        |
| H-10 | PENDING.md 11+ pain points sin tracking                                     | Producto       | MED                       | `wc -l PENDING.md` = 56KB con bugs reales del creador                                           | Backlog vivo no trazado en issue tracker                   | Convertir a issues GitHub                                                         | L        | P2        |
| H-11 | Doc drift "11 canonical tables" vs 12 reales                                | Documentación  | BAJA                      | `migrate.ts:4` vs `schema.ts:189` `workflowDefinitions`                                         | Onboarding contributor confundido                          | Update string + README runtime                                                    | L        | P3        |
| H-12 | `.codi_output*` versionado en repo (16 carpetas históricas)                 | Pollution      | BAJA                      | `ls .codi_output*`                                                                              | Repo size + ruido en grep/find                             | `.gitignore` + `git rm --cached`                                                  | L        | P3        |
| H-13 | `findProjectBrainPath` magic 64 sin constante                               | Estilo         | BAJA                      | `runtime/brain/db.ts:42`                                                                        | Magic number                                               | Extraer `BRAIN_PATH_WALK_MAX = 64`                                                | L        | P3        |
| H-14 | `brain-event-log` ejecuta `git rev-parse` sync por sesión                   | Performance    | MED                       | `brain-event-log.ts:24-29` `execFileSync`                                                       | Bloqueo síncrono en cada session start                     | Cachear root o usar `simple-git` async                                            | M        | P2        |
| H-15 | `hook-installer.ts: 668`, `hook-config-generator.ts: 666` zona riesgo 700   | Mantenibilidad | MED                       | `wc -l`                                                                                         | Cercanos al cap, escalarán                                 | Partition preventivo                                                              | M        | P2        |
| H-16 | `quick` y `team-consolidation` sin adapter en registry                      | Completitud    | BAJA                      | `runtime/workflows/registry.ts:20-27`                                                           | Workflows yaml huérfanos                                   | Implementar adapters                                                              | L        | P3        |
| H-17 | `capabilities/matrix.ts` mantenido a mano                                   | Mantenibilidad | BAJA                      | `core/capabilities/matrix.ts:19`                                                                | Drift potencial con `artifact-types.ts`                    | Derivar de schema                                                                 | M        | P3        |
| H-18 | FTS5 contentless sin runbook de reindex documentado                         | Operaciones    | BAJA                      | `schema.ts:208-219`                                                                             | Sin procedimiento si FTS5 se corrompe                      | Runbook + script reindex                                                          | L        | P3        |
| H-19 | `runtime/README.md` declara "Skeleton stage" obsoleto                       | Documentación  | BAJA                      | `runtime/README.md` vs 133 archivos                                                             | Confusión maintainer                                       | Actualizar README                                                                 | L        | P3        |
| H-20 | Deep imports remanentes pese a regla anti-deep-imports                      | Estilo         | MED                       | PENDING.md menciona caso `../../../../src/core/security/scan-prompt.js`                         | Regla erosionada                                           | Audit + reemplazar por `#src/*` aliases                                           | M        | P2        |
| H-21 | Sync solo Google; sin git-native / GitHub Artifacts / S3                    | Flexibilidad   | ALTA                      | `runtime/sync/{sheets,xlsx}-syncer.ts`                                                          | Opinionated; bloquea adopción no-Google                    | Backend git-based vía `.codi/sync/` branch                                        | A        | P2        |
| H-22 | Sin ownership/CODEOWNERS por artefacto ni RBAC                              | Equipos        | ALTA                      | CODEOWNERS = `* @lehidalgo` global                                                              | Conflictos resolución manual; sin gobernanza               | Frontmatter `maintainers: [@user]` + Action validator                             | A        | P2        |
| H-23 | Conflict resolver no cubre `.codi/` ↔ `.codi/` entre humanos                | Equipos        | MED                       | `utils/conflict-resolver.ts` sólo source↔generated                                              | Merge conflicts artefactos sin asistencia                  | Extender resolver a `.codi/` diffs                                                | M        | P2        |
| H-24 | Sin team brain agregado — Brain local-only                                  | Equipos        | ALTA                      | `runtime/brain/db.ts:70-80` resuelve a `~/.codi/state/brain.db` o `<repo>/.codi/state/brain.db` | Cero visibilidad cross-miembro                             | ADR-005 Z6.D Postgres compartido                                                  | A        | P2        |
| H-25 | Sin GitHub Action oficial publicada                                         | Adopción       | MED                       | `.github/workflows/` solo internas; no marketplace                                              | Cada usuario reinventa CI                                  | Publicar `codi-cli/codi-action`                                                   | M        | P2        |
| H-26 | Operations-ledger no captura `actor`                                        | Auditoría      | MED                       | `core/audit/operations-ledger.ts` interfaces                                                    | Sin trazabilidad multi-miembro                             | Añadir `actor: string` en cada entry                                              | L        | P1        |
| H-27 | Onboarding nuevo miembro sin `codi team join`                               | Equipos        | MED                       | No existe comando en CLI                                                                        | Pasos manuales                                             | Implementar wizard                                                                | M        | P2        |
| H-28 | Sin join `corrections ↔ artifacts_used`                                     | Observabilidad | CRIT                      | Schema sin FK ni view                                                                           | Imposible atribuir defecto a artefacto                     | Nueva view SQL + índice ts proximity                                              | L        | P1        |
| H-29 | Sin tabla `eval_runs` — resultados de evals.json no persisten               | Observabilidad | ALTA                      | `core/skill/evals-manager.ts` lee evals pero no guarda runs                                     | Regresión skill silenciosa                                 | Tabla `eval_runs(run_id, skill, eval_id, passed, ts, version)`                    | M        | P1        |
| H-30 | Sin scheduler de pain-point detection                                       | Observabilidad | ALTA                      | Captures DEFECT/CORRECTION no agregados periódicamente                                          | Pain-points solo manuales vía FTS5                         | Comando `codi brain pain-points --since 7d`                                       | M        | P1        |
| H-31 | `MIN_FEEDBACK_FOR_EVOLVE` fijo no adaptativo                                | Configuración  | MED                       | `core/skill/skill-improver.ts` constante                                                        | Umbral inadecuado por dominio                              | Per-skill threshold en frontmatter                                                | L        | P2        |
| H-32 | `/dashboard/metrics` sin documentación de fórmulas                          | Documentación  | BAJA                      | `runtime/brain-ui/routes-api.ts:266`                                                            | Métricas opacas                                            | JSDoc + endpoint `/api/v1/dashboard/metrics.schema`                               | L        | P3        |
| H-33 | Falta `actor_id` en `corrections` + `operations-ledger`                     | Observabilidad | ALTA                      | Schema sin columna                                                                              | Sin atribución cross-equipo                                | Migration añadiendo columna                                                       | L        | P1        |
| H-34 | Falta `artifact_version` en `artifacts_used`                                | Observabilidad | MED                       | Schema sin columna                                                                              | No comparativa entre versiones                             | Migration añadiendo columna                                                       | L        | P2        |
| H-35 | Sin `team_id` en sessions/captures/workflow_runs (multi-tenant)             | Escalabilidad  | ALTA (si meta es equipos) | Schema                                                                                          | Brain no preparado multi-tenant                            | Migration + RBAC layer                                                            | M        | P2        |

## 13. Risk Matrix

| Categoría         | Riesgo dominante                                                      | Probabilidad | Impacto |
| ----------------- | --------------------------------------------------------------------- | ------------ | ------- |
| Arquitectura      | Sync layer desconectada (carga mantenimiento + feature dark)          | Alta         | Alto    |
| Extensibilidad    | Falta scaffolder hook/workflow; sin `codi add` correspondiente        | Alta         | Medio   |
| Trabajo en equipo | Sin team brain, sin ownership artefacto, sin actor en ledger          | Alta         | Alto    |
| Observabilidad    | Sin atribución defecto↔artefacto; sin eval_runs persistido            | Alta         | Alto    |
| Seguridad         | `unsafeMode` permanente en SQLite                                     | Media        | Alto    |
| Mantenibilidad    | 700-cap erosionado en `core/hooks/`; metaskills mal-prefijadas        | Media        | Medio   |
| Escalabilidad     | Brain local-only; sync síncrono daemon foreground                     | Media        | Alto    |
| Producto          | Reconstrucción no autosostenible — guía LLM en artefactos eliminables | Alta         | Alto    |

## 14. Deuda técnica

| Tipo                          | Casos                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Duplicación                   | Workflow yamls en `templates/` + runtime adapters sin contrato explícito               |
| Acoplamiento                  | Metaskills artefacto ↔ core skill-improver; sync events ↔ reducer pass-through         |
| Sobreingeniería               | Sync 27 archivos sin uso CLI; `capabilities/plugin-manifest` tier matrix manual        |
| Complejidad                   | Singleton `__codi_session__` en `workflow_runs` + filtro defensivo en queries          |
| Magic numbers                 | `findProjectBrainPath: 64`, `PULL_FRESHNESS_MS: 60000`, `MIN_FEEDBACK_FOR_EVOLVE` fijo |
| Documentación drift           | "11 tablas", "Skeleton stage", PENDING.md sin trazado                                  |
| Pollution                     | `.codi_output*/`, `PENDING.md` 56KB en repo                                            |
| Deep imports remanentes       | PENDING.md menciona caso concreto                                                      |
| `unsafeMode(true)` permanente | DEFECT-007 workaround sin guard                                                        |

## 15. Recommendations — Roadmap

### Quick wins (1-2 días)

- H-02 rename: mover skills metaskill a `templates/skills/dev-*` + `managed_by: codi`
- H-09 eliminar `src/brain/README.md` y `src/db/README.md` (o mover a `docs/adr/`)
- H-12 `git rm -r --cached .codi_output*` + actualizar `.gitignore`
- H-11 fix string "11 canonical tables" en `migrate.ts:4`
- H-13 extraer constante `BRAIN_PATH_WALK_MAX = 64`
- H-19 actualizar `runtime/README.md` (quitar "skeleton stage")
- H-26 añadir campo `actor` en operations-ledger entries
- H-33 migration añadiendo `actor_id` en `corrections`
- H-34 migration añadiendo `artifact_version` en `artifacts_used`

### Corto plazo (1-2 semanas)

- H-01 conectar `runtime/sync/cli.ts` a `src/cli.ts` o marcar como experimental gate flag
- H-03 partition `hook-templates.ts` en `core/hooks/templates/<name>.ts`
- H-04 golden snapshot tests por adapter (6 tests mínimo)
- H-07 nueva tabla `runtime_state(key, value, updated_at)` + migrar singleton
- H-08 mover eventos sync a tabla `sync_events` separada
- H-28 view SQL: `corrections JOIN artifacts_used USING (session_id) WHERE ts_correction - ts_use < 5min`
- H-29 tabla `eval_runs(run_id, skill_name, eval_id, passed, ts, version)`
- H-30 comando `codi brain pain-points --since 7d`
- H-10 convertir PENDING.md a issues GitHub

### Medio plazo (1-2 meses)

- H-05 cobertura test sobre `cli/*` para top 10 comandos
- H-06 encapsular FTS5 ops + linter prohíbe `raw.exec()` dinámico
- H-16 implementar `quick` y `team-consolidation` adapters
- H-20 audit + reemplazo deep imports por `#src/*` aliases (cross-codebase)
- H-21 backend sync git-based via `.codi/sync/` branch protocol
- H-22 modelo ownership por artefacto en frontmatter + Action validator
- H-23 extender conflict resolver a `.codi/` diffs
- Crear `codi add hook <name>` + `hook-scaffolder.ts` + `dev-hook-creator` metaskill
- Crear `codi add workflow <type>` + `workflow-scaffolder.ts` + `dev-workflow-creator` metaskill
- Crear metaskills faltantes: `dev-self-audit`, `dev-consistency-check`
- H-32 documentar fórmulas de `/dashboard/metrics`

### Largo plazo (3-6 meses)

- H-24 team brain agregado — Postgres compartido (ADR-005 Z6.D)
- H-25 publicar `codi-cli/action` para GitHub Marketplace
- H-27 `codi team join <id>` wizard
- H-30 scheduler con pain-point alerts vía webhook
- H-35 `team_id` en sessions/captures/workflow_runs + RBAC layer
- LLM-judge validator de calidad semántica de artefactos creados
- Bootstrap recovery: `codi bootstrap` regenera metaskills core desde fuente embebida
- Reescribir `runtime/sync/` o extraer a paquete `@codi/sync` separado

## 16. Veredicto final

| Eje                                               | Calificación                                                                                       | Confianza                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Estado de la columna vertebral                    | B+ — bien diseñada, parcialmente expuesta                                                          | Alta (lectura directa código)                            |
| Nivel de riesgo                                   | Medio                                                                                              | Alta — 2 críticos + 13 altos identificados con evidencia |
| Capacidad de escalar individualmente              | A — pipeline puro escala local                                                                     | Alta                                                     |
| Capacidad de ser usado por equipos                | C — falta team brain + ownership + RBAC + GitHub Action                                            | Alta                                                     |
| Capacidad de reconstruir artefactos sin templates | C+ — shapes sí, calidad no                                                                         | Alta                                                     |
| Madurez ingeniería                                | B — `Result<T>`, Zod, pure reducer, adapter pattern; 700-cap erosionado                            | Alta                                                     |
| Madurez producto                                  | B- — sync no-CLI + metaskills sin convención = promesa "plataforma equipos" no totalmente cumplida | Alta                                                     |

**Recomendación final**:

1. Cerrar H-01 (sync CLI) y H-02 (metaskill rename + relocate) ANTES de marketing como "plataforma para equipos". Son las dos brechas estructurales que invalidan la promesa central.
2. Cerrar H-28 + H-29 + H-33 simultáneamente — son la base mínima para que el Brain pase de "observabilidad" a "mejora continua atribuible".
3. Crear `dev-hook-creator` y `dev-workflow-creator` + scaffolders correspondientes para cerrar reconstrucción zero-artifact.
4. Quick wins (1-2 días) entregables hoy con bajo riesgo.
5. La columna vertebral es **suficientemente sólida para ser fundación de una plataforma extensible**. Lo que falta no es rediseño — es **completar el último 20% de cableado** entre componentes ya implementados.

## 17. Fortalezas confirmadas

| Área                                | Por qué es ejemplar                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Result<T>` pattern                 | Toda función falible retorna `Result<T>`; no thrown exceptions cruzan boundaries                               |
| `WorkflowAdapter<A>` contract       | `types.ts:53-85` interfaz mínima + `phase-walker.ts` 22 LOC genérico — agregar workflow = puro additive change |
| Reducer pure FP                     | `reducer.ts:271-273` `never`-exhaustive switch — compilador atrapa eventos faltantes                           |
| `ExternalSyncer` + `SyncerRegistry` | Interfaz limpia + lazy registry excluye deps pesadas hasta uso                                                 |
| Iron-Laws puras + adapter scripts   | `iron-laws-enforcer.ts` + `scripts/runtime/hook-*.ts` — testable sin Anthropic protocol                        |
| Capture idempotente                 | `persist.ts:46-65` dedup `(turn_id, raw_marker)`                                                               |
| Verify token + checksum             | Agente verifica que cargó config correcto                                                                      |
| Backup v2 manifest commit marker    | Manifest escrito último, `pruneIncompleteBackups` limpia crashes                                               |
| Adapter registry                    | `ALL_ADAPTERS` + `registerAllAdapters` — alta cohesión, dependency injection real                              |
| Generator 2-fase render+I/O         | Todo en memoria, luego write atómico con conflict detection                                                    |

---

**End of audit.**
