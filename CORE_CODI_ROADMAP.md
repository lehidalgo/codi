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
| 3 | CORE-003 | Logger DI + de-singletonize | F | P0 | **Validado ✅** | — | CORE-007 | 0.5d |
| 4 | CORE-004 | Single-source Zod → JSON Schema (infrastructure) | F | P1 | **Validado ✅** | — | CORE-005 (tighter) | 2d |
| 4b | CORE-004b | Port manifest-event.schema.json (1031 LOC) a Zod | F | P2 | Pendiente | CORE-004 | confianza completa schemas | 0.5d |
| 5 | CORE-005 | Brain DB schema alignment CI guard | F | P0 | **Validado ✅** | (CORE-004) | — | 1d |
| 6 | CORE-006 | AdapterDefinition declarative + BaseAdapter | D | P1 | **Validado ✅** | CORE-003 | CORE-013, CORE-024 | 3-4d |
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
| 25 | CORE-025 | exists() helper extraction (fs-helpers) | S | P3 | **Validado ✅ (closed by CORE-006)** | CORE-006 | — | 1h |
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

## CORE-003 — Logger DI + de-singletonize **[RESUELTO]**

- **Nivel:** F
- **Prioridad:** P0
- **Estado:** Validado ✅
- **Depende de:** ninguno
- **Desbloquea:** CORE-007 (conflict-resolver), eliminación cycle utils→core→adapters→core
- **Effort:** ~0.5 día (actual: ~2h implementación + verificación)
- **Commits:** `538f3a24` (Logger interface + NULL_LOGGER), `c242c309` (conflict-resolver DI), `679b9edc` (adapters DI), `3a66ad21` (layering guard)

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

**Notas de decisión:**

Sintetizadas de 3 subagentes paralelos:

1. **`Logger` class queda en `core/output/logger.ts`** — no se mueve. 80+ callsites legítimos en cli/core/runtime usan el singleton.
2. **Interface mínimo extraída a `src/types/logger.ts`** — utils/ y adapters/ importan SOLO el tipo desde ahí (zero runtime dep).
3. **DI vía direct named param** (`log: Logger` o `options.log?: Logger`) — matches el precedente `hook-dep-installer.ts:134`.
4. **`NULL_LOGGER` default** — NO `Logger.getInstance()` fallback. El composition root (generator.ts, preset-applier.ts) inyecta `Logger.getInstance()` explícitamente.
5. **Scope: 8 boundary violation callsites** — el resto de los 80+ `Logger.getInstance()` en cli/core/runtime queda intocado.

**Resultado final:**

- ✅ Cero `Logger.getInstance()` en `src/utils/` y `src/adapters/` (verificado por grep).
- ✅ Cero `import { Logger }` value imports desde utils/adapters (solo `import type`).
- ✅ Guard de layering extendido con `FORBIDDEN_SYMBOL_IMPORTS` previene regresión — verificado contra inyección deliberada que dispara mensaje de remediation claro.
- ✅ Test suite: 3767 baseline → **3767 passing** (zero regresiones).
- ✅ Lint clean (6 guards + tsc).
- ✅ Build clean.

**Archivos modificados:**
- `src/types/logger.ts` (new, ~30 LOC) — Logger interface + NULL_LOGGER
- `src/types/agent.ts` (~+8 LOC) — GenerateOptions gana `log?: Logger`
- `src/core/output/logger.ts` (~+5 LOC) — `Logger implements LoggerInterface`
- `src/utils/conflict-resolver.ts` (~+5 / -3 LOC) — `import type`, log via options
- `src/adapters/codex.ts` (~+2 LOC) — `_options → options`, log from options
- `src/adapters/copilot.ts` (~+2 LOC) — same
- `src/adapters/skill-generator.ts` (~+12 LOC) — log threaded through 3 functions
- `src/core/generator/generator.ts` (~+5 LOC) — composition root injects log
- `src/core/preset/preset-applier.ts` (~+3 LOC) — passes log to resolveConflicts
- `src/cli/team.ts`, `src/cli/update.ts` (~+3 LOC) — pass log
- `scripts/guard-layering.mjs` (~+74 LOC) — FORBIDDEN_SYMBOL_IMPORTS rule
- `tests/unit/types/logger.test.ts` (new, ~50 LOC) — interface + NULL_LOGGER contract
- `tests/unit/adapters/codex.test.ts` (~+5 / -3 LOC) — replaced `spyOn(Logger.getInstance())` con capturing logger via DI

**Tests ejecutados:**
- `npx vitest run tests/unit/types/logger.test.ts` → 4/4 pass
- `npx vitest run tests/unit/adapters/codex.test.ts` → 32/32 pass
- `npm run lint && npm test` → 3767 pass / 6 skipped / 0 failed
- Guard regression: deliberate violation → guard fires con remediation message clara

**Riesgos restantes:**
- `scan-prompt.test.ts:124,138` aún usa `vi.spyOn(Logger.getInstance(), "warn")` — funciona porque `scan-prompt.ts` está en `core/security/`, fuera del scope CORE-003. Está OK.
- `templates/rules/code-style.ts:84` propaga `Logger.getInstance()` antipattern a user projects — out of scope, flagged para follow-up.
- 80+ `Logger.getInstance()` callsites en cli/core/runtime intactos — intencional. CORE-003 cerró solo la boundary violation. Full DI migration sería un esfuerzo mucho mayor (potencial CORE-017+ scope).
- Adapter unit tests que llamen directamente a `codex.generate(...)` sin pasar `log` reciben `NULL_LOGGER` — warns silenciados. Sólo el codex test re-instrumentado captura warns. Otros tests no asertaban contenido de warn de todas formas.

---

## CORE-004 — Single-source Zod schemas con derived JSON Schema **[RESUELTO]**

- **Nivel:** F
- **Prioridad:** P1
- **Estado:** Validado ✅
- **Depende de:** ninguno
- **Desbloquea:** CORE-005 (mismo patrón aplica a Drizzle/raw SQL), schema evolution con confianza
- **Effort:** ~2 días estimado (actual: ~1.5h con scope ajustado)
- **Commits:** `b316a0f6` (drift reconciliation) + `93a0ef29` (generator + gate-result pilot) + `26fd9411` (CI guard + docs)

**Notas de decisión:**

Sintetizadas de 3 subagentes paralelos + ajuste de scope mid-implementation:

1. **Zod canonical → JSON Schema generated → ambos committed.** Runtime sigue usando Ajv (no migración Zod-at-runtime — out of scope, perf, $id externos).
2. **Zod v4 native `z.toJSONSchema()`** — Zod 4.3.6 ya instalado, cero nuevas deps.
3. **Canonical JSON output** (sorted keys, 2-space indent, trailing newline) para que CI diff no se balancee en orden de inserción.
4. **Scope ajustado:** la port completa de `manifest-event.schema.json` (1031 LOC, 45 variants) movida a **CORE-004b** durante implementación. Razón: ROI dominante de CORE-004 ya está entregado (drift reconciliation + generator infra + CI guard); el manifest-event port añade complejidad sin valor proporcional. Mejor un follow-up dedicado.
5. **Drift reconciliación primero (Commit 1):** Subagent 2 surfaced que ya había drift bidireccional pre-existing. Si no se reconciliaba, el CI guard fallaría desde día uno por bugs que CORE-004 no se le pidió arreglar.

**Resultado final:**

- ✅ **Drift bidireccional cerrado:** `EVENT_TYPES` ahora incluye los 5 sheet_* events; schema `workflowType` enum incluye `team-consolidation`.
- ✅ **Generator infrastructure:** `scripts/generate-json-schemas.mjs` con `--check` mode + canonical JSON serialization.
- ✅ **gate-result.schema.json regenerated** desde Zod source (`src/schemas/runtime/gate-result.ts`); Ajv en `subagent-runner.ts` valida sin cambios.
- ✅ **CI guard wired:** `.github/workflows/ci.yml` ejecuta `npm run schemas:check` post-lint.
- ✅ **Docs updated:** `src/schemas/runtime/migrations/README.md` "Adding a new event type" refleja nuevo workflow.
- ✅ Test suite: 3767 baseline → **3770 passing** (+3 codegen tests), 0 failed.
- ✅ Lint clean, build clean.

**Archivos modificados:**
- `src/runtime/types.ts` (+5 entries) — drift fix
- `src/runtime/reducer.ts` (+5 case arms) — pass-through for sheet_* events
- `src/schemas/runtime/manifest-event.schema.json` (+1 enum entry) — drift fix
- `src/schemas/runtime/gate-result.ts` (new, ~25 LOC) — Zod source
- `src/schemas/runtime/gate-result.schema.json` (regenerated, canonical format)
- `scripts/generate-json-schemas.mjs` (new, ~120 LOC) — generator
- `package.json` — scripts `schemas:generate` + `schemas:check`
- `tests/unit/scripts/schema-codegen.test.ts` (new, ~60 LOC, 3 tests)
- `.github/workflows/ci.yml` (+1 step) — CI guard
- `src/schemas/runtime/migrations/README.md` (+/-9 LOC) — updated docs

**Tests ejecutados:**
- `npm run schemas:generate` → idempotent
- `npm run schemas:check` → exit 0
- Deliberate drift simulation → exit 1 con mensaje claro
- `npm run lint && npm test` → 3770 / 6 skipped / 0 failed

**Riesgos restantes (cubiertos por CORE-004b):**
- `manifest-event.schema.json` (1031 LOC, 45 variants) sigue siendo hand-written. CI guard no aplica a este file todavía. Drift posible.
- Cuando CORE-004b land, el regenerated `manifest-event.schema.json` será sintácticamente distinto al committed (sorted keys, additionalProperties placement, oneOf without discriminator) — semánticamente equivalente. Validation: all sample-events must parse under both old + new schemas.

---

## CORE-004b — Port manifest-event.schema.json a Zod canonical

- **Nivel:** F
- **Prioridad:** P2
- **Estado:** Pendiente
- **Depende de:** CORE-004 (infrastructure ya in place)
- **Desbloquea:** confianza completa en el contrato de eventos
- **Effort:** ~0.5d (~3-5h de port + validación)

**Descripción:** Migrar `src/schemas/runtime/manifest-event.schema.json` (1031 LOC, 45 oneOf variants) a un Zod source canonical (`src/schemas/runtime/manifest-event.ts`) y regenerar el JSON Schema desde ahí. Hoy es el único `.schema.json` aún hand-written; el CI guard de CORE-004 no lo cubre.

**Trabajo concreto:**
1. Write `src/schemas/runtime/manifest-event.ts` con `ManifestEventSchema = z.discriminatedUnion("event_type", [...])`.
2. Define ~8 shared types ($defs equivalents): EventIdSchema, SchemaVersionSchema, AuthorSchema, PhaseSchema (re-use PHASES enum), WorkflowTypeSchema (re-use WORKFLOW_TYPES enum), etc.
3. 45 variants × ~15 LOC each = ~700 LOC Zod.
4. Add manifest-event entry to `GENERATORS` array in `scripts/generate-json-schemas.mjs`.
5. Regenerate JSON. Diff vs committed (sintáctico, no semántico).
6. Validate: every event in `sample-events.json` validates under regenerated schema (Ajv).
7. Validate: regression suite passes (no event-writer fails validation).
8. Accept regenerated JSON as new canonical, commit.

**Criterios de aceptación:**
1. `manifest-event.ts` Zod source compiles + matches the existing schema's 45 variants.
2. `schemas:check` covers manifest-event after this issue lands.
3. Sample-events round-trip: every fixture passes under regenerated schema.
4. Test suite green (~3770+ passing).
5. The `EventType` TS type can be derived from Zod (`z.infer<typeof ManifestEventSchema>["event_type"]`) and matches `EVENT_TYPES` const exactly (zero drift test).

**Riesgo:** subtle semantic divergences in 45 variants. Cada payload tiene su propio constraints; un missing `.strict()` o wrong `enum` puede ser silently wrong. Mitigation: full sample-events validation + old-schema cross-check.

---

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

## CORE-005 — Brain DB schema alignment CI guard **[RESUELTO]**

- **Nivel:** F
- **Prioridad:** P0
- **Estado:** Validado ✅
- **Depende de:** ninguno (refuerza si CORE-004 también landó)
- **Desbloquea:** Confianza en brain DB evolution; Sprint 3+ drizzle-kit migration
- **Effort:** ~1 día estimado (actual: ~1h)
- **Commits:** `51632a5c` (alignment guard + drift reconciliation in 1 atomic commit)

**Notas de decisión:**

Sintetizadas de 3 subagentes paralelos + scope ajustado durante implementación:

1. **Option C: 2 in-memory DBs + PRAGMA diff** (no drizzle-kit, no canonical flip).
2. **Drizzle DDL via `getTableConfig` from `drizzle-orm/sqlite-core/utils.js`** — public stable API. Hand-roll ~80 LOC `synthesizeCreateTable()` helper.
3. **Coverage:** `PRAGMA table_info` + `index_list` + `index_info`. Skip CHECK (zero declared), FK (codi runs with FK off, zero `.references()`), FTS5/triggers (Drizzle doesn't model).
4. **User chose Option A (fix all drift now) over Option B (ratchet)** durante mid-implementation cuando descubrí magnitud del drift acumulado por 15 versioned migrations.

**Resultado final:**

- ✅ **Drift acumulado por 15 versioned migrations RECONCILIADO** — 12+ columnas + 4 indexes + 1 PK fix + 1 missing table export añadidos a Drizzle.
- ✅ **Guard infrastructure landed**: 5 sub-tests cubriendo column structure, index list, index column ordering, FTS5 existence.
- ✅ Future drift entre Drizzle y BOOTSTRAP captured at CI time con mensaje actionable.
- ✅ Test suite: 3770 baseline → **3775 passing** (+5), 6 skipped, 0 failed.
- ✅ Lint clean, build clean.

**Archivos modificados:**
- `src/runtime/brain/schema.ts` (+~50 LOC, -1 import) — added missing columns to projects/sessions/turns/corrections, added `runtimeState` export, fixed `_codi_schema_version.version` PK form, added 4 missing indexes
- `tests/runtime/brain/_schema-alignment-helpers.ts` (new, ~160 LOC) — synthesizeCreateTable, indexStmtsFor, normalizers
- `tests/runtime/brain/schema-alignment.test.ts` (new, ~200 LOC) — 5 sub-tests

**Drift cerrado por tabla:**
- `projects`: +4 cols (git_user_name, git_user_email, host_user, host_machine) v7
- `sessions`: +10 cols (tokens_*, cost_usd, context_window, tokens_max_prefix, tokens_messages_count, tokens_preloaded) v4-v6
- `turns`: +4 cols (tokens_input/output/cache_create/cache_read) v4
- `corrections`: +1 col (actor_id) v14 + 2 indexes
- `prompts`: +1 index (idx_prompts_session_pid_desc) v3
- `captures`: +1 index (idx_captures_turn_marker) v3
- `workflow_runs`: +1 index (idx_workflow_runs_status_started) v3
- `_codi_schema_version`: composite PK → inline INTEGER PRIMARY KEY (matches BOOTSTRAP rowid-alias form)
- `runtime_state`: new Drizzle export (v11 ALTER was previously unmodeled)

**Tests ejecutados:**
- `npx vitest run tests/runtime/brain/schema-alignment.test.ts` → 5/5 pass
- `npm run lint && npm test` → 3775 / 6 skipped / 0 failed

**Riesgos restantes:**
- DESC index direction (idx_sessions_project_started, idx_prompts_session_pid_desc, idx_workflow_runs_status_started) NO se compara — drizzle-orm/sqlite-core <0.50 sin `.desc()` builder. PRAGMA index_info no reporta direction. Acceptable today; upgrade drizzle-orm cuando matters.
- CHECK constraints + FKs sin coverage — none declared. Defer to text-diff sobre `sqlite_master.sql` cuando land primer caso.
- Schema reflects current v15 baseline. Real production DBs con migrations older than v15 already-applied podrían tener orden de columnas distinto (PRAGMA cid order). Out of scope; CORE-038 podría cubrir.

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

## CORE-006 — AdapterDefinition declarative + BaseAdapter **[RESUELTO]**

- **Nivel:** D
- **Prioridad:** P1
- **Estado:** Validado ✅
- **Depende de:** CORE-003 (Logger DI)
- **Desbloquea:** CORE-013 (writeHookFile cleaner), CORE-024 (meta-skill isolation), nuevos adapters
- **Effort:** ~3-4 días estimado (real: ~3h en single-commit mode con baseline byte-equal guard)

**Descripción original:** 6 adapters × ~150-600 LOC con ~85% estructura idéntica. `cursor.ts` y `windsurf.ts` side-by-side comparten exists(), sections.push, brand-filter, skill-generator call. Sin `BaseAdapter`, adapter #7 cuesta ~500 LOC + integration de heartbeat-hooks copy-pasted × 3.

**Resultado final:**
- Nuevo módulo `src/adapters/base.ts` con `AdapterDefinition` declarativo + factory `defineAdapter()` que produce un `AgentAdapter` compatible (zero call-site change en `generator.ts`).
- `DetectSpec = { markers: string[] } | { fn }` — los 6 adapters declaran detección por markers (sustituye 6 copias de `async detect()` byte-idénticas).
- `src/adapters/fs-helpers.ts` consolida 6 duplicaciones de `exists()` + `existsAny()` + `readJsonIfExists()` → **cierra CORE-025**.
- `src/adapters/heartbeat-state.ts` consolida `readEnabledRuntimeHookNames` + `isHeartbeatEnabled` (eran 2 copias en claude-code y codex).
- `src/adapters/heartbeat-emission.ts` con `buildHeartbeatArtifacts({ emitTracker, emitObserver })` — único value-importer de `core/hooks/heartbeat-hooks.js` desde el layer de adapters. Sustituye 3 copias de tracker+observer+launcher emission (claude-code, codex, copilot).
- `src/adapters/claude-settings.ts` extrae 270 LOC de claude-code.ts (`buildSettingsJson`, `mergeSettings`, `readExistingClaudeSettings`, `ClaudeSettings` interface).
- `src/adapters/cursor-hooks.ts` extrae `buildCursorHooks` (testability + futuro CORE-021).
- `scripts/guard-layering.mjs` extendido con regla `FORBIDDEN_SYMBOL_IMPORTS` que bloquea `import ... from "core/hooks/heartbeat-hooks"` desde leaf adapters; `allowFiles: ["heartbeat-emission.ts", "claude-settings.ts"]` permite los 2 helpers centrales.
- Los 6 adapters convertidos a `defineAdapter({ id, name, paths, capabilities, detect: { markers: [...] }, async generate() })`.

**LOC delta:**
| Archivo | Pre | Post | Delta |
|---|---|---|---|
| claude-code.ts | 602 | 265 | −337 |
| codex.ts | 448 | 392 | −56 |
| copilot.ts | 435 | 391 | −44 |
| cursor.ts | 239 | 195 | −44 |
| windsurf.ts | 145 | 132 | −13 |
| cline.ts | 144 | 129 | −15 |
| **Subtotal leaf adapters** | **2,013** | **1,504** | **−509** |
| fs-helpers.ts (new) | — | 45 | +45 |
| heartbeat-state.ts (new) | — | 44 | +44 |
| heartbeat-emission.ts (new) | — | 89 | +89 |
| base.ts (new) | — | 79 | +79 |
| cursor-hooks.ts (new) | — | 40 | +40 |
| claude-settings.ts (new) | — | 284 | +284 |
| **Total** | **2,013** | **2,085** | **+72** |
| Tests nuevos | — | 245 | +245 |

Nota: el delta neto positivo refleja que los 270 LOC extraídos a `claude-settings.ts` no eran duplicación sino lógica adapter-específica que ahora vive en su propio archivo con tests dedicados. La duplicación REAL eliminada es ~600 LOC: 6×exists (≈48), 2×heartbeat-state (≈30), 3×heartbeat-emission (≈225), 1×claude-settings extract (≈270).

**Criterios de aceptación:**
1. ✅ **Generated files byte-equal pre vs post.** Baseline capturado a `/tmp/codi-snapshots/baseline/` con 163 archivos × 3 fixtures (minimal/full/brand) × 6 adapters antes de tocar nada. Diff post-refactor: **0 bytes diferencia**.
2. ✅ **LOC reduction medible.** Leaf adapters: −509 LOC. Duplicación estructural eliminada: ~600 LOC.
3. ✅ **Suite passing.** 3775 → 3796 (+21 nuevos: base.test.ts 6 casos, heartbeat-emission.test.ts 6 casos, fs-helpers.test.ts 9 casos). 0 regresiones.
4. ✅ **Heartbeat hooks ya no se importan directamente desde adapters.** Único importer permitido (`heartbeat-emission.ts`) detrás de `buildHeartbeatArtifacts()`. Layering guard activo bloqueando regresiones futuras.

**Notas de decisión:**
- **Single-commit mode** (el usuario eligió 1 commit vs 15 incrementales) tras síntesis de 3 subagentes paralelos. Baseline snapshot en `/tmp` actúa como contrato byte-equal sin commitear; el script standalone se borra al final.
- **`defineAdapter()` es factory, no clase.** Devuelve `AgentAdapter` válido, así `generator.ts` y `registerAllAdapters` sin cambios. Viejo y nuevo coexisten en el mismo commit con zero migration cost.
- **`section-pipeline.ts` NO se implementó.** Habría requerido un pipeline declarativo de secciones que cubra cursor (rules.mdc per-rule) + copilot (.prompt.md extra emitter) + codex (TOML config special-cased) + claude-code (settings deep-merge) sin riesgo de divergencia byte-equal en el orden/whitespace de cualquier sección. Defer a **CORE-006b** si se quiere maximizar reducción de LOC declarativo (estimado ~3-4d adicional). Hoy, la consolidación más importante (heartbeat emission + fs-helpers + settings extract) ya está en su sitio.
- **`base.ts` está listo para extensión futura.** Su contrato `AdapterDefinition` puede crecer con `sections: SectionSpec[]`, `rules: RuleSpec`, `skills: SkillSpec`, etc. en CORE-006b sin tocar consumers.

**Riesgos restantes:**
- `AdapterDefinition.detect.fn` (escape hatch) podría reabrir duplicación si futuros adapters lo usan en vez de declarar `markers`. Mitigación: revisar en PR review; documentar en CONTRIBUTING (CORE-033).
- `claude-settings.ts` mantiene el deep-merge complexity; aún es el archivo más denso del refactor. CORE-013 (writeHookFile cleaner) tocará esta área de nuevo.

**Commits:** single-commit final (este turno).

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

## CORE-025 — exists() helper extraction (fs-helpers) **[RESUELTO]**
- Nivel: S, P3, depende CORE-006, ~1h.
- **Estado:** Validado ✅ (cerrado como side-effect de CORE-006).
- **Resultado:** `src/adapters/fs-helpers.ts` con `exists()`, `existsAny()`, `readJsonIfExists()`. Las 6 duplicaciones byte-idénticas en cada leaf adapter fueron eliminadas. Tests: `tests/unit/adapters/fs-helpers.test.ts` (9 casos).

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
