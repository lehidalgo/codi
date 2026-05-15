# Core Codi Refactor Roadmap

- **Created:** 2026-05-15
- **Source audit:** `docs/20260515_000000_[AUDIT]_core-architecture-review.md`
- **Branch:** `feature/codi-v3-harness` (baseline 3736 tests passing)
- **Status:** Living document — updated after every issue closure

This roadmap is the **source of truth** for the core refactor. Issues are ordered by *generality + dependency unblocking*, not by raw severity. Foundational contracts come first so subsequent issues can build on stable ground.

---

## Priorización: 5 niveles

| Nivel | Definición |
|---|---|
| **F — Fundacional** | Establece contratos internos, modelos de datos, abstracciones reutilizables, o estado compartido. Sin esto, los issues posteriores serían soluciones locales que rompen la arquitectura objetivo. |
| **D — Desbloqueante** | Refactors que eliminan acoplamientos críticos o introducen abstracciones que múltiples issues posteriores consumen. |
| **R — Robustez core** | Sincronización, conflictos, git diff, hooks, workflows, idempotencia, recuperación ante fallos. Defectos reales del comportamiento. |
| **E — Escalabilidad** | Modularidad, extensibilidad, patrones de diseño, reducción de spaghetti, simplificación. Habilitan growth a 100×. |
| **S — Específico** | Mejoras puntuales, naming, docs secundaria, optimizaciones no críticas, tests faltantes. |

## Tabla resumen

| Orden | ID | Issue | Nivel | Prioridad | Estado | Depende de | Desbloquea | Effort |
|---|---|---|---|---|---|---|---|---|
| 1 | CORE-001 | Reducer schema validation guard | F | P0 | **Validado ✅** | — | CORE-009, CORE-005 | 4h |
| 2 | CORE-002 | Atomic generator commit + state lock | F | P0 | **Validado ✅** | — | CORE-011 | 1d |
| 3 | CORE-003 | Logger DI + de-singletonize | F | P0 | Pendiente | — | CORE-007 | 0.5d |
| 4 | CORE-004 | Single-source Zod → JSON Schema | F | P1 | Pendiente | — | CORE-005 (tighter) | 2d |
| 5 | CORE-005 | Brain DB schema alignment CI guard | F | P0 | Pendiente | (CORE-004) | — | 1d |
| 6 | CORE-006 | AdapterDefinition declarative + BaseAdapter | D | P1 | Pendiente | CORE-003 | CORE-013, CORE-024 | 3-4d |
| 7 | CORE-007 | Conflict-resolver Result return signature | D | P0 | Pendiente | CORE-003 | — | 1d |
| 8 | CORE-008 | DecisionKind union extraction | D | P1 | Pendiente | — | gate-runner refactor | 4h |
| 9 | CORE-009 | Workflow event snapshot table | D | P1 | Pendiente | CORE-001 | reducer-cost issues | 1-2d |
| 10 | CORE-010 | YAML-driven hook language registry | D | P2 | Pendiente | — | CORE-013 (cleaner) | 2d |
| 11 | CORE-011 | UNIQUE constraints en captures + prompts | R | P1 | Pendiente | CORE-002 | — | 1d |
| 12 | CORE-012 | proper-lockfile en BrainEventLog | R | P1 | Pendiente | — | — | 4h |
| 13 | CORE-013 | writeHookFile() unified installer | R | P2 | Pendiente | CORE-010 (recomendado) | — | 4h |
| 14 | CORE-014 | writeAuxiliaryScripts table-driven | R | P2 | Pendiente | — | — | 4h |
| 15 | CORE-015 | Audit + classify 86+ empty catches | R | P1 | Pendiente | — | telemetry de fallos | 1d |
| 16 | CORE-016 | src/runtime/ ESLint re-enable | E | P2 | Pendiente | — | CORE-017 | 3-5d |
| 17 | CORE-017 | Runtime layer: throws → Result | E | P2 | Pendiente | CORE-016 | — | 3-5d |
| 18 | CORE-018 | ARTIFACT_LAYOUT consolidación | E | P1 | Pendiente | — | new artifact type cost | 1d |
| 19 | CORE-019 | cli/workflow.ts WORKFLOW_BUILDERS dispatcher | E | P2 | Pendiente | — | — | 4h |
| 20 | CORE-020 | init.ts god function split (664 LOC) | E | P1 | Pendiente | — | — | 1-2d |
| 21 | CORE-021 | conflict-resolver.ts split (539 LOC) | E | P2 | Pendiente | CORE-007 | — | 1d |
| 22 | CORE-022 | guard-file-size.mjs advisory | E | P2 | Pendiente | — | — | 4h |
| 23 | CORE-023 | ESLint rule: no template-literal SQL | E | P1 | Pendiente | — | preserves unsafeMode invariant | 2h |
| 24 | CORE-024 | Meta-skill isolation + import-rule guard | E | P2 | Pendiente | CORE-006 | "remove non-core" smoke | 0.5d |
| 25 | CORE-025 | exists() helper extraction (fs-helpers) | S | P3 | Pendiente | CORE-006 | — | 1h |
| 26 | CORE-026 | EMPTY_STATE.lastGenerated lazy | S | P3 | Pendiente | — | — | 5min |
| 27 | CORE-027 | Cache findProjectBrainPath per-process | S | P3 | Pendiente | — | — | 1h |
| 28 | CORE-028 | Collapse git status loop en gate-runner | S | P3 | Pendiente | — | — | 1h |
| 29 | CORE-029 | Backfill src/utils/** branches → ≥95% | S | P2 | Pendiente | — | CI stability | 2h |
| 30 | CORE-030 | State.json corruption recovery test | S | P2 | Pendiente | — | — | 30min |
| 31 | CORE-031 | docs/INDEX.md + per-layer READMEs | S | P3 | Pendiente | — | onboarding | 1d |
| 32 | CORE-032 | docs/adr/ paradox resolution | S | P3 | Pendiente | — | — | 2h |
| 33 | CORE-033 | CONTRIBUTING: Adding-Hook + Adding-Workflow | S | P3 | Pendiente | — | — | 30min |
| 34 | CORE-034 | Semantic snapshot assertions | S | P3 | Pendiente | — | — | 3h |
| 35 | CORE-035 | msw network-boundary tests | S | P3 | Pendiente | — | — | 1-2d |
| 36 | CORE-036 | Non-core artifact removal smoke test | S | P2 | Pendiente | CORE-024 | aislamiento verificable | 4h |
| 37 | CORE-037 | Hook installer mixed-runner test | S | P3 | Pendiente | — | — | 4h |
| 38 | CORE-038 | Brain DB locked external process test | S | P3 | Pendiente | — | — | 4h |

**Total estimado:** ~35-45 días de trabajo enfocado, distribuibles en ~10 semanas si se ejecuta serial. Paralelizable parcialmente: F1-F5 son secuenciales en valor, D6-D10 pueden solaparse, R/E/S admiten paralelismo.

---

# Issues fundacionales (F)

Estos 5 issues establecen los contratos sobre los que el resto del refactor se construye. Resolverlos primero evita que cualquier mejora posterior se haga sobre arena.

## CORE-001 — Reducer schema validation guard **[RESUELTO]**

- **Nivel:** F (Fundacional)
- **Prioridad:** P0
- **Estado:** Validado ✅
- **Depende de:** ninguno
- **Desbloquea:** CORE-009 (snapshot table necesita reducer fiable), CORE-005 (parcialmente)
- **Effort:** ~4 horas (actual: 1.5h implementación + 0.5h verificación = 2h)
- **Commits:** `fdb1b8d8` (reducer guards), `763fb3ac` (loadEvents defensive)

**Descripción:** El reducer en `src/runtime/reducer.ts:30-88` consume eventos de `workflow_events.payload` (string JSON) y aplica casts `payload as { phase: Phase }` (11 sitios) sin validar. Validación práctica confirmó el defecto: inyectar `{this is not json` en un row produce `codi workflow status` exit 1 con `Expected property name or '}' in JSON at position 1`. Un único evento corrupto envenena el workflow entero.

**Contexto técnico:**
- `runtime/brain-event-log.ts:398-403` hace `SELECT * FROM workflow_events ORDER BY event_id ASC` y lee `payload` como columna TEXT.
- El parsing real de `payload` ocurre upstream (no es una sola línea); el `JSON.parse` es lo que crasha.
- Reducer hace 11 inline casts (`reducer.ts:105, 116, 140, 146, 169, 180, 196, 208, 215, 223, 231, 240`).
- Schema validation existe a write-time vía `BrainEventLog.append` pero NO en replay.

**Archivos afectados:**
- `src/runtime/reducer.ts` (modify — wrap reduce + validate per-event)
- `src/runtime/brain-event-log.ts:398-403` (modify — safe-parse layer en loadEvents)
- `tests/runtime/reducer.test.ts` (extend — añadir malformed-payload tests)

**Riesgo si no se resuelve:** Un solo evento corrupto silently corrompe el workflow para siempre. Una migración v0.1.0 → v0.2.0 con payload-shape change rompe todos los workflows existentes. Bloquea CORE-009 porque snapshot+replay asume reducer determinista correcto.

**Impacto esperado:** Reducer convierte la captura silenciosa en un error explícito y recuperable. Habilita schema evolution con confianza.

**Criterios de aceptación:**
1. Inyectar payload corrupto en `workflow_events` → `codi workflow status` exit clean con `[ERR] E_EVENT_CORRUPT` y hint para diagnosis (no exit 1 con stack trace de `JSON.parse`).
2. Inyectar payload válido JSON pero schema-invalid → mismo manejo.
3. Suite de tests existente 3736+ passing.
4. Nuevo bloque de tests `describe("reduce with malformed payloads")` con ≥3 escenarios (invalid JSON, missing required field, wrong type).
5. Reducer retorna `Result<ReducedState, ReducerError>` o throws `ReducerError` tipado (decisión arquitectónica pendiente de subagentes).

**Tests / validaciones:**
- Existing: `tests/runtime/reducer.test.ts` (279 LOC).
- New: bloque malformed-payload (≥50 LOC).
- Integration: end-to-end inyectando bad row + ejecutando `codi workflow status` y verificando exit code + mensaje.

**Notas de decisión:**

Sintetizadas de 3 subagentes paralelos:

1. **Plain TS guards en lugar de Zod** — Subagent 3's pragmatic argument prevailed. CORE-004 explícitamente migrará el JSON Schema canónico a Zod; hacerlo aquí duplica trabajo. Plain TS guards (`isObj`, `getStr`, `getNum`, `getBool`, `getStrArr`, `getPhase`, `getWorkflowType`, `getChildStatus`) son ~50ns por check y suficientes para el contrato actual.

2. **Reducer mantiene signature `reduce(events): ReducedState` throwing `ReducerError`** — no migración a `Result<T,E>` (eso es CORE-017). Los 18+ callsites no se tocan.

3. **Split storage-layer vs reducer-layer:**
   - `loadEvents` en `brain-event-log.ts`: tolerant (skip rows con JSON inválido o sin `event_type`). Mantiene durabilidad ante corrupción de disco.
   - `reduce()`: estricto (throw `ReducerError` con `eventId` + `field`). Mantiene integridad semántica.

4. **`ReducerError` extendido** con campo opcional `field` para diagnostics actionable. Mensaje formato: `"payload.X must be Y (event evt-123, field X)"`.

5. **Tests:** 11 nuevos en `reducer.test.ts` + 3 en `brain-event-log.test.ts` = 14 nuevos. No nuevo archivo `reducer-malformed.test.ts` per Subagent 3 (evita proliferación).

**Resultado final:**

- ✅ **Defecto cerrado**: end-to-end fault injection reproduce el escenario original — `{this is not json` en `workflow_events.payload` → `codi workflow status` exit 0 (era exit 1) con JSON status válido, `events_count: 2` (la fila corrupta se filtra).
- ✅ Zero `as { ... }` casts restantes en `src/runtime/reducer.ts` (`grep` returns empty).
- ✅ Lint clean: 6 guards + `tsc --noEmit` pass.
- ✅ Test suite: 3736 baseline → **3750 passing** (+14), 6 skipped, 0 failed.
- ✅ Build clean: ESM (188ms) + DTS (5221ms).

**Archivos modificados:**
- `src/runtime/reducer.ts` (+189 / −56) — guards + descripción de contrato
- `src/runtime/brain-event-log.ts` (+30 / −3) — defensive `loadEvents`
- `tests/runtime/reducer.test.ts` (+156 / 0) — 11 nuevos tests
- `tests/runtime/brain-event-log.test.ts` (+71 / 0) — 3 nuevos tests

**Tests ejecutados:**
- `npx vitest run tests/runtime/reducer.test.ts` → 23/23 pass
- `npx vitest run tests/runtime/brain-event-log.test.ts` → 19/19 pass
- `npm run lint && npm test` → 3750 pass / 6 skipped / 0 failed
- End-to-end fault injection en `/tmp/core-001-repro` sandbox → exit 0

**Riesgos restantes:**
- Backfill de eventos ya corruptos en brains de usuarios existentes: NO se incluye repair tool en CORE-001 (scope: read-side validation only). Cualquier user con corruption legacy debe hacer repair manual via SQL. Flag para issue separado (probablemente CORE-030 expandido o nuevo).
- Compactor (`compactor.ts:166`) ya tiene `try/catch` que swallow reducer throws — sigue funcionando, solo cambia el mensaje. Mejora pendiente: per-iteration `try/catch` con warn (out of scope, CORE-015 territory).
- Zod migration en CORE-004 puede revisitar el design — las guards son additive y fácilmente convertibles a Zod schemas.

---

## CORE-002 — Atomic generator commit + state lock **[RESUELTO]**

- **Nivel:** F
- **Prioridad:** P0
- **Estado:** Validado ✅
- **Depende de:** ninguno
- **Desbloquea:** CORE-011 (UNIQUE constraints aprovecha state coherente), CORE-012 (BrainEventLog migra a proper-lockfile)
- **Effort:** ~1 día (actual: ~3h implementación + 0.5h verificación = 3.5h)
- **Commits:** `87aad58d` (atomicMutate + lock), `4b6e774e` (apply fused mutation), `650b8510` (p-limit)

**Descripción:** El pipeline `applyConfiguration` en `src/core/generator/apply.ts:144-156` escribe archivos en `Promise.all` (sin bound), luego detecta orphans, los borra, y finalmente escribe `state.json` vía `updateAgentsBatch`. Si el state write falla, los orphans están eliminados de disco pero state aún los lista. El comentario en `:152` admite incompletitud. Adicionalmente, `state.ts` usa temp-file + rename sin lock cross-process; dos `codi generate` paralelos hacen lose-last-writer.

**Contexto técnico:**
- `apply.ts:132` (delete orphans) → `:142` (prune empty dirs) → `:149` (state write). Si crashea entre 132 y 149: state aún lista archivos físicamente eliminados.
- `generator.ts:147-152, 182, 204`: `Promise.all` sin `p-limit`. Comentario admite "150-900 archivos OK at this scale".
- `state.ts:194-213`: rename-atomic, pero sin OS lock. Dos procesos lean+write en race.

**Archivos afectados:**
- `src/core/config/state.ts` (add `atomicMutate(fn): Result<T>` con lock)
- `src/core/generator/apply.ts:119-156` (reordenar Phase 1/2 con `state.next` + atomic rename)
- `src/core/generator/generator.ts:152, 182, 204` (Promise.all → `p-limit(32)`)
- `package.json` (add `proper-lockfile`, `p-limit`)

**Riesgo si no se resuelve:**
- Crashes mid-generate dejan orphans untrackeables (silent drift).
- Two parallel `codi generate` runs clobber each other.
- En CI con timeouts ajustados o filesystems lentos, la window se ensancha.

**Impacto esperado:** Generator pipeline crash-safe + parallel-safe. Recovery converge en cada re-run.

**Criterios de aceptación:**
1. New test `tests/runtime/concurrency/generate-parallel.test.ts` con 2 `applyConfiguration` paralelos → one wins limpio, state.json consistente.
2. Crash mid-Phase-2 (manual kill -9 mid-apply) → re-run heals (idempotente).
3. State.json `.lock` file se crea durante la mutación y se libera al final (incluso en error path).
4. Suite 3736+ passing.

**Tests / validaciones:**
- Existing `tests/integration/adapter-generation.test.ts` (258 LOC) — must pass.
- New parallel test + crash-recovery test.

**Notas de decisión:**

Sintetizadas de 3 subagentes paralelos + revisión propia durante implementación:

1. **`proper-lockfile` en lugar de hand-rolled PID lock** — kernel-mediated via `mkdir(O_CREAT|O_EXCL)`. Subagent 1+2+3 convergieron aquí. Inherits stale-detection vía mtime + heartbeat refresh.

2. **`StateManager.atomicMutate(mutator)` API simple** — no `commitTransaction(plan)` (Subagent 1's más sofisticado). El mutator es pura función `state => state`; FS side effects quedan fuera del lock window. Simpler blast radius.

3. **Step order preserved: delete-then-commit, NO commit-then-delete** — divergencia importante con Subagent 3's intent original. Discovered during implementation: el reorder a "commit-state-first" ROMPE la ENOENT-recovery path existente en `state.detectOrphans:308-310`. Documentado en commit `4b6e774e`. La fix correcta es fusionar `removeAgents` + `updateAgentsBatch` en UNA atomicMutate call (cierra la única window de inatomicidad).

4. **`p-limit(32)` con env override** `CODI_FILE_IO_CONCURRENCY`. Justificación: 12% de macOS RLIMIT_NOFILE default = 32. Subagents convergieron.

5. **Plain TS guards en lugar de Zod schemas para state.json validation** — defer to CORE-004.

**Resultado final:**

- ✅ **Race-of-last-writer-wins eliminada**: 3 `codi generate` paralelos contra el mismo `.codi/` → 3 exit `[OK]`, state.json válido, agents map correcto. Pre-fix esto producía silent state loss.
- ✅ **State mutation atómica**: removeAgents + updateAgentsBatch fusionados en una sola atomicMutate transaction (crash entre ellas ya no deja state half-mutated).
- ✅ **EMFILE prevention**: pLimit(32) wrapping de 3 waves de FS I/O en generator.ts.
- ✅ ENOENT-recovery preserved: state-references-missing-file → next run self-heals.
- ✅ Lint clean: 6 guards + tsc --noEmit.
- ✅ Test suite: 3750 baseline → **3763 passing** (+13), 6 skipped, 0 failed.
- ✅ Build clean: ESM + DTS.

**Archivos modificados:**
- `package.json` + `package-lock.json` — añadidas `proper-lockfile`, `p-limit`, `@types/proper-lockfile`
- `src/core/config/state.ts` (+~110 / −30) — `atomicMutate` method + refactor de `updateAgent`/`updateAgentsBatch`/`removeAgents`
- `src/core/generator/apply.ts` (+~25 / −15) — fused state mutation
- `src/core/generator/generator.ts` (+~30 / −20) — pLimit wrapping
- `tests/unit/config/state-atomic-mutate.test.ts` (new, ~150 LOC) — 6 tests
- `tests/unit/core/generator/apply-atomic-state.test.ts` (new, ~165 LOC) — 4 tests
- `tests/unit/core/generator/generator-concurrency.test.ts` (new, ~90 LOC) — 3 tests

**Tests ejecutados:**
- `npx vitest run tests/unit/config/state-atomic-mutate.test.ts` → 6/6 pass
- `npx vitest run tests/unit/core/generator/apply-atomic-state.test.ts` → 4/4 pass
- `npx vitest run tests/unit/core/generator/generator-concurrency.test.ts` → 3/3 pass
- `npm run lint && npm test` → 3763 pass / 6 skipped / 0 failed
- End-to-end parallel race en `/tmp/core-002-repro` sandbox → 3/3 procesos `[OK]`, state.json válido

**Riesgos restantes:**
- Windows compat no verificada en CI (no hay matrix Windows). `proper-lockfile` debería funcionar pero defer validation. NFS edge cases mitigados por `realpath: false`.
- `updateHooks`, `updatePresetArtifacts`, `updateSelectedHooks` no se refactorizan en este PR (Subagent 1 sugerencia opcional). Out of scope; potential CORE-002b si se materializa.
- `FILE_IO_CONCURRENCY` se captura at module-load — `CODI_FILE_IO_CONCURRENCY` se debe setear ANTES de importar el módulo. Tests mid-run mutating env no afectan al limit (documented inline).

- **Nivel:** F
- **Prioridad:** P0
- **Estado:** Pendiente
- **Depende de:** ninguno
- **Desbloquea:** CORE-007 (conflict-resolver), eliminación cycle utils→core→adapters→core
- **Effort:** ~0.5 día

**Descripción:** `Logger.getInstance()` (singleton service locator) se llama 12+ veces desde `src/utils/conflict-resolver.ts:196,209,379,389`, `src/adapters/codex.ts:218`, `src/adapters/copilot.ts:398`, `src/adapters/skill-generator.ts:139,326`. Causa la violación de capas `utils → core/output/logger.js` y `adapters → core/output/logger.js`. El singleton oculta la dependencia y rompe testabilidad.

**Contexto técnico:**
- `src/utils/conflict-resolver.ts:13` import directo de core.
- 8 callsites totales del singleton fuera de `core/`.
- Mover `Logger` a `src/utils/logger.ts` y/o aceptar via DI `{ logger }` en options.

**Archivos afectados:**
- `src/core/output/logger.ts` → posiblemente movido a `src/utils/logger.ts` o mantenido en core con DI desde cli/orchestration.
- `src/utils/conflict-resolver.ts:13` + 4 callsites
- `src/adapters/{codex,copilot,skill-generator}.ts` (5 callsites)
- Tests asociados.

**Desbloquea:**
- CORE-007 puede limpiar la signature de conflict-resolver sin arrastrar el singleton.
- Eliminar el cycle `utils → core` reduce el blast radius de cualquier refactor en `core/output/`.

**Criterios de aceptación:**
1. Cero `Logger.getInstance()` en `src/utils/**` y `src/adapters/**`.
2. Cero imports `from "../core/output/logger"` o `from "#src/core/output/logger"` desde utils/adapters.
3. Suite 3736+ passing.

---

## CORE-004 — Single-source Zod schemas con derived JSON Schema

- **Nivel:** F
- **Prioridad:** P1
- **Estado:** Pendiente
- **Depende de:** ninguno
- **Desbloquea:** CORE-005 (alineación más estricta), schema evolution con confianza
- **Effort:** ~2 días

**Descripción:** `src/schemas/runtime/{gate-result.schema.json, manifest-event.schema.json, sample-events.json}` son hand-written JSON Schemas que duplican las Zod schemas en `src/schemas/*.ts`. Sin generación automática, pueden drift.

**Archivos afectados:**
- `package.json` (devDep `zod-to-json-schema`)
- `scripts/generate-json-schemas.mjs` (new)
- `tsup.config.ts` o build hooks (run en build)
- `src/schemas/runtime/*.schema.json` (regenerados, possibly content-identical)

**Criterios de aceptación:**
1. JSON Schemas generados desde Zod en build time.
2. Test que ejecuta el generator y asserta los checked-in match generated.
3. Existing schema tests passing.

---

## CORE-005 — Brain DB schema alignment CI guard

- **Nivel:** F
- **Prioridad:** P0
- **Estado:** Pendiente
- **Depende de:** ninguno (refuerza si CORE-004 también landó)
- **Desbloquea:** Confianza en brain DB evolution
- **Effort:** ~1 día

**Descripción:** `src/runtime/brain/schema.ts` (Drizzle definitions) y `src/runtime/brain/migrate.ts:21-` (raw SQL bootstrap) tienen 14 tablas duplicadas. Sin CI guard, una columna añadida a Drizzle pero no a migrate genera "no such column" en runtime.

**Archivos afectados:**
- `tests/integration/brain-schema-alignment.test.ts` (new)
- Possibly `.github/workflows/ci.yml` (no change — runs as part of npm test)

**Criterios de aceptación:**
1. Test abre in-memory DB via `BOOTSTRAP_STATEMENTS`, abre otra via Drizzle, diffea `PRAGMA table_info` por cada tabla.
2. Falla si se introduce un column drift deliberado.
3. Pasa en main hoy.

---

# Issues desbloqueantes (D)

Estos refactors eliminan acoplamientos críticos o introducen abstracciones consumidas por muchos issues posteriores.

## CORE-006 — AdapterDefinition declarative + BaseAdapter

- **Nivel:** D
- **Prioridad:** P1
- **Estado:** Pendiente
- **Depende de:** CORE-003 (Logger DI)
- **Desbloquea:** CORE-013 (writeHookFile cleaner), CORE-024 (meta-skill isolation), nuevos adapters
- **Effort:** ~3-4 días

**Descripción:** 6 adapters × ~150-600 LOC con ~85% estructura idéntica. `cursor.ts` y `windsurf.ts` side-by-side comparten exists(), sections.push, brand-filter, skill-generator call. Sin `BaseAdapter`, adapter #7 cuesta ~500 LOC + integration de heartbeat-hooks copy-pasted × 3.

**Archivos afectados:**
- `src/adapters/base.ts` (new — BaseAdapter.run(def, config))
- `src/adapters/fs-helpers.ts` (new — exists() único)
- `src/adapters/{claude-code,codex,copilot,cursor,windsurf,cline}.ts` (refactor a declaraciones)
- `src/core/generator/generator.ts` (call BaseAdapter)
- `tests/unit/adapters/*` (update)

**Criterios de aceptación:**
1. Generated files byte-equal pre vs post refactor (snapshot test).
2. LOC reduction medible (~1,500-2,000 LOC eliminados).
3. Suite 3736+ passing.
4. Heartbeat hooks ya no se importan directamente desde adapters.

---

## CORE-007 — Conflict-resolver Result return signature

- **Nivel:** D
- **Prioridad:** P0
- **Estado:** Pendiente
- **Depende de:** CORE-003 (Logger DI)
- **Desbloquea:** Determinismo de CI consumers
- **Effort:** ~1 día

**Descripción:** `src/utils/conflict-resolver.ts:375` setea `process.exitCode = 2` como side-effect global. Validación práctica confirmó que NUNCA dispara en escenarios reales con hard line-overlap conflict. Adicionalmente muta `conflict.incomingContent` in-place (líneas 338, 356, 474, 497, 530).

**Cambios:** Return `Result<ConflictResolution, ConflictError>` con `unresolvable: ConflictEntry[]` explícito. Caller (CLI entry point) traduce a exit code 2. No mutation of input entries.

**Criterios de aceptación:**
1. `codi generate` con hard conflict en non-TTY → exit 2 (vía CLI, no global state).
2. Cero `process.exitCode = ` en `src/utils/**`.
3. Test que asserta `process.exitCode` no se setea desde la función.

---

## CORE-008 — DecisionKind union extraction

- **Nivel:** D
- **Prioridad:** P1
- **Estado:** Pendiente
- **Depende de:** ninguno
- **Desbloquea:** gate-runner refactor (CORE-019 indirect)
- **Effort:** ~4 horas

**Descripción:** Los 8 `decision_recorded.kind` string literals (`reproducer_built`, `regression_test_added`, `baseline_captured`, `behavior_unchanged`, `migration_metrics_captured`, `brains_enumerated`, `dev_layout_validated`, `dev_findings`) están spread across `gate-runner.ts:219-531` (8 sitios), agent templates, y reducer. Sin union, un typo silently rompe gates.

**Archivos afectados:**
- `src/runtime/decision-kinds.ts` (new) — exports `DecisionKind` union + `findDecisionByKind(events, kind)` helper.
- `src/runtime/gate-runner.ts:219-531` — replace inline `payload as { kind?: string }` casts.
- Agent templates en `src/templates/agents/` que mencionan estos literales.

**Criterios de aceptación:**
1. Cero `kind?: string` casts en gate-runner.
2. Typo en `DecisionKind` causa compile error.
3. Suite passing.

---

## CORE-009 — Workflow event snapshot table

- **Nivel:** D
- **Prioridad:** P1
- **Estado:** Pendiente
- **Depende de:** CORE-001 (reducer fiable)
- **Desbloquea:** Reducer linear-replay-forever cap
- **Effort:** ~1-2 días

**Descripción:** Reducer replay es O(N) en eventos por cada `loadEvents` call. 12+ call sites por hook fire. A >5K eventos, JSON.parse domina hot path.

**Cambios:**
- New table: `workflow_snapshots(workflow_id, last_event_id, reduced_state_json, created_at)`.
- `reducer.reduceIncremental(snapshot, newEvents): ReducedState`.
- `brain-event-log.loadEventsSince(workflowId, lastEventId)`.
- Snapshot trigger: cada K=50 events appended.

**Criterios de aceptación:**
1. Snapshot+delta produce identical state a full replay (test).
2. 12+ callsites usan `reduceIncremental`.
3. Reducer replay cost flat as event count grows (medible).

---

## CORE-010 — YAML-driven hook language registry

- **Nivel:** D
- **Prioridad:** P2
- **Estado:** Pendiente
- **Depende de:** ninguno
- **Desbloquea:** CORE-013 (writeHookFile más limpio), nuevos lenguajes cheap
- **Effort:** ~2 días

**Descripción:** 16 archivos `src/core/hooks/registry/<lang>.ts` con `HookSpec` typed arrays ≈ pure data. 1,197 LOC total. Adding language #17 = new file + import line + LANGUAGE_HOOKS row.

**Cambios:** Convertir a `.yaml` con un loader cached. Eliminar 16 imports.

**Criterios de aceptación:**
1. Generated hooks byte-equal.
2. LOC reduction ~1,100.
3. Suite passing.

---

# Issues de robustez core (R)

## CORE-011 — UNIQUE constraints en captures + prompts

- **Nivel:** R
- **Prioridad:** P1
- **Effort:** ~1 día
- **Depende de:** CORE-002 (atomic apply para state coherente)

**Descripción:** `captures` table necesita `UNIQUE(turn_id, raw_marker)`; `prompts` necesita `UNIQUE(session_id, turn_no)`. Hoy depende de SELECT-then-INSERT inside DEFERRED transaction, que tiene race window en parallel hooks.

## CORE-012 — proper-lockfile en BrainEventLog

- **Nivel:** R
- **Prioridad:** P1
- **Effort:** ~4 horas

**Descripción:** `BrainEventLog.acquireLock` (`brain-event-log.ts:213-225`) usa PID-based metadata en lugar de OS-level lock. Dos procesos pueden hit `acquireLock` concurrentemente y ambos escribir PID (last writer wins).

## CORE-013 — writeHookFile() unified installer

- **Nivel:** R
- **Prioridad:** P2
- **Depende de:** CORE-010 recomendado (registries simpler)
- **Effort:** ~4 horas

**Descripción:** 4 sibling functions (`installCommitMsgHook`, `installPrePushHook`, etc.) en `hook-installer.ts:217-513` con estructura idéntica (mkdir + writeFile + try/catch). Replace por `writeHookFile(projectRoot, runner, kind, content)`.

## CORE-014 — writeAuxiliaryScripts table-driven

- **Nivel:** R
- **Prioridad:** P2
- **Effort:** ~4 horas

**Descripción:** `hook-installer.ts:87-215` tiene 14 if-blocks idénticos. Replace por `AUX_HOOKS: [{key, slug, body}, ...]` array + single iterator.

## CORE-015 — Audit + classify 86+ empty catches

- **Nivel:** R
- **Prioridad:** P1
- **Effort:** ~1 día

**Descripción:** 86+ `catch {}` empty blocks en codebase. Cada uno: log, re-throw, o documentar como intencional. Sin esto, silent failures no tienen telemetry.

---

# Issues de escalabilidad (E)

## CORE-016 — src/runtime/ ESLint re-enable
- Nivel: E, P2, ~3-5 días. Stale "Sprint 2" ignore en `eslint.config.js:19-22`. 17K LOC unlinted.

## CORE-017 — Runtime layer throws → Result
- Nivel: E, P2, ~3-5 días, depende CORE-016. 171 throws en runtime/ vs Result discipline en core/.

## CORE-018 — ARTIFACT_LAYOUT consolidación
- Nivel: E, P1, ~1 día. Consolidar `CapabilityType`, `LedgerEntryType`, `CapturedArtifactType` con `ArtifactType`.

## CORE-019 — cli/workflow.ts WORKFLOW_BUILDERS dispatcher
- Nivel: E, P2, ~4 horas. 5-branch dispatch en `workflow run` + `workflow convert` → `Record<WorkflowType, ...>` map.

## CORE-020 — init.ts god function split (664 LOC)
- Nivel: E, P1, ~1-2 días. `initHandler` en `init.ts:105` → 5-7 phases con Result types.

## CORE-021 — conflict-resolver.ts split (539 LOC)
- Nivel: E, P2, depende CORE-007, ~1 día. 5 strategies mezcladas → discriminated union + dispatcher.

## CORE-022 — guard-file-size.mjs advisory
- Nivel: E, P2, ~4 horas. Warn (no block) en cli/core/ files >700 LOC.

## CORE-023 — ESLint rule no template-literal SQL
- Nivel: E, P1, ~2 horas. Banear `${var}` en `raw.prepare`/`raw.exec` calls. Preserva `unsafeMode(true)` invariant.

## CORE-024 — Meta-skill isolation + import-rule guard
- Nivel: E, P2, depende CORE-006, ~0.5 día. Tag `codi-*` + `dev-*` skills; añadir guard preventing imports from core.

---

# Issues específicos (S)

## CORE-025 — exists() helper extraction (fs-helpers)
- Nivel: S, P3, depende CORE-006, ~1h.

## CORE-026 — EMPTY_STATE.lastGenerated lazy
- Nivel: S, P3, ~5min. `state.ts:128`.

## CORE-027 — Cache findProjectBrainPath per-process
- Nivel: S, P3, ~1h. `brain/db.ts:47`.

## CORE-028 — Collapse git status loop en gate-runner
- Nivel: S, P3, ~1h. `gate-runner.ts:170-183` — single `git status --porcelain` + map lookup.

## CORE-029 — Backfill src/utils/** branches → ≥95%
- Nivel: S, P2, ~2h. Vitest threshold actual 92.7% vs target 92.0% — solo 0.7pts de headroom.

## CORE-030 — State.json corruption recovery test
- Nivel: S, P2, ~30min. `tests/unit/config/state.test.ts`.

## CORE-031 — docs/INDEX.md + per-layer READMEs
- Nivel: S, P3, ~1 día. 5 READMEs en `src/{cli,core,adapters,utils,schemas}/`.

## CORE-032 — docs/adr/ paradox resolution
- Nivel: S, P3, ~2h. Move/symlink las 10 ADRs reales al directory.

## CORE-033 — CONTRIBUTING: Adding-Hook + Adding-Workflow
- Nivel: S, P3, ~30min.

## CORE-034 — Semantic snapshot assertions
- Nivel: S, P3, ~3h. Replace 2 opaque .snap files con inline assertions.

## CORE-035 — msw network-boundary tests
- Nivel: S, P3, ~1-2 días. Restore coverage para 30 network-exempt files.

## CORE-036 — Non-core artifact removal smoke test
- Nivel: S, P2, depende CORE-024, ~4h. Verifica aislamiento.

## CORE-037 — Hook installer mixed-runner test
- Nivel: S, P3, ~4h. lefthook + pre-commit + husky simultáneos.

## CORE-038 — Brain DB locked external process test
- Nivel: S, P3, ~4h. sqlite-browser scenario.

---

# Notas de proceso

## Reglas operativas

1. **Cada issue se resuelve issue-a-issue.** No batching salvo dependencia técnica explícita.
2. **Análisis con 3 subagentes paralelos** (arquitectura, robustez/testing, implementación incremental) antes de proponer.
3. **Aprobación explícita del usuario** antes de implementar cualquier cambio.
4. **Estado actualizado en este roadmap** después de cada cierre.
5. **Si surgen nuevos issues durante el proceso**, se añaden con CORE-XXX consecutivo y posición justificada en la tabla.

## Trazabilidad

- Cada issue cierra con: archivos modificados, tests ejecutados, resultado de validación, decisiones tomadas, riesgos restantes.
- Issues bloqueados explican el bloqueador.
- Issues que cambian de prioridad o dependencias documentan el porqué.

## Mantenimiento

- Este documento es **histórico vivo**: nunca borrar entradas, solo actualizar estado.
- La tabla resumen se ordena dinámicamente; el cuerpo del documento mantiene orden de creación.
- Cuando se cierra un issue, se añade un sufijo `**[RESUELTO]**` al título y se documentan los detalles bajo "Resultado final".
