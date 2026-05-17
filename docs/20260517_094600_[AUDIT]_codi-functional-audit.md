# Auditoría Funcional CODI

- **Inicio:** 2026-05-17
- **Branch:** `feature/codi-v3-harness`
- **Documento:** `20260517_094600_[AUDIT]_codi-functional-audit.md`
- **Categoría:** AUDIT
- **Auditor:** Claude (Opus 4.7) — coordinación iterativa con confirmación humana

## Alcance y objetivo

Auditoría funcional iterativa de las features core de CODI. Complementa (no reemplaza) la auditoría arquitectónica del **2026-05-15** (`docs/20260515_000000_[AUDIT]_core-architecture-review.md`) y el `CORE_CODI_ROADMAP.md`. Mientras la primera evalúa deuda técnica/arquitectura, esta auditoría verifica end-to-end que **cada feature core hace lo que su contrato declara** — desde CLI hasta efecto sobre disco, brain DB y agentes IA.

### Reglas operativas

- Avance estrictamente iterativo: una feature a la vez.
- Cada feature pasa por PASS / FAIL / BLOCKED / PARTIAL.
- Issue detectado → triple análisis (reproducibilidad / causa raíz / impacto) → diagnóstico consolidado → fix arquitectónicamente correcto → revalidación. Sin parches superficiales.
- Pruebas temporales convertidas a tests permanentes cuando aporten valor.
- Sin declarar "100% correcto" hasta que todas las features estén PASS o tengan justificación explícita.

---

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Estado general | 🟢 Baseline verde, Fase 2 lista para iniciar |
| Features inventariadas | 22 |
| Features auditadas | 0 (F1 lista para arrancar) |
| Features PASS | 0 |
| Features FAIL | 0 |
| Features BLOCKED | 0 |
| Features PARTIAL | 0 |
| Issues abiertos | 0 |
| Issues cerrados | 1 (ISSUE-001) |
| Baseline lint+build+test | ✅ `npm run lint` PASS · `npm run build` PASS · `npm test` 3996/6/0 (+14 vs roadmap baseline tras fix de ISSUE-001) |

---

## Inventario de funcionalidades core

22 features organizadas por área funcional. Criticidad medida en términos de impacto en la propuesta de valor de CODI ("one config, every agent, zero drift") + reversibilidad del fallo.

| Criticidad | Definición |
|---|---|
| **🔴 Crítica** | Si falla, CODI no entrega su propuesta de valor o produce daño (data loss, drift silencioso, comandos divergentes entre agentes) |
| **🟠 Alta** | Feature core esperada por usuarios; su fallo bloquea workflows comunes pero el producto sigue funcionando parcialmente |
| **🟡 Media** | Feature de apoyo o auxiliar; fallo degrada UX pero existen workarounds |
| **🟢 Baja** | Feature de conveniencia; fallo casi imperceptible para usuario final |

### Tabla de features

| ID | Módulo | Funcionalidad | Criticidad | Prueba automática | Prueba humana | Criterio de aceptación | Estado |
|---|---|---|---|---|---|---|---|
| F1 | Configuration | Carga + parsing + resolución + persistencia atómica de `.codi/` | 🔴 Crítica | Script: crear .codi/ sandbox, modificar manifest, `resolveConfig()`, verificar `state.json` post-write. Tests: `tests/unit/config/`, `tests/unit/core/config/` | No requerida | `resolveConfig()` retorna `NormalizedConfig` válido; `state.json` mutado vía `atomicMutate` con `.lock`; 3 procesos paralelos → 1 gana sin corrupción | PENDING |
| F2 | Generation | `codi generate` → 6 adapters → archivos en disco con verification token | 🔴 Crítica | Script: init sandbox + `codi generate` + diff esperado por adapter; tests: `tests/unit/adapters/*.test.ts`, `tests/integration/adapter-generation.test.ts` | Inspeccionar visualmente CLAUDE.md, .cursorrules, AGENTS.md, etc. en proyecto real | Cada adapter produce su instruction file + artifact dirs sin error; token SHA256 consistente; `p-limit(32)` impide EMFILE; `state.json` queda coherente | PENDING |
| F3 | Drift | `codi status` detecta Synced/Drifted/Missing comparando hashes | 🟠 Alta | Sandbox: generate → mutar archivo generado → `codi status` reporta Drifted; eliminar archivo → reporta Missing | No requerida | Exit code coherente con flag `drift_detection` (off=0, warn=0+warn, error=non-zero); detección hash-based estable | PENDING |
| F4 | Backup | `openBackup → append → finalise` lifecycle + `codi revert` restaura | 🔴 Crítica | Script: generate → modificar config → revert → verificar restore; tests: `tests/unit/core/backup/*`, `tests/integration/backup*`. Verificar `MAX_BACKUPS=50` retention, `pruneIncompleteBackups` | Confirmar UX de retention interactivo | Backup v2 manifest escrito último; revert pre-snapshot creado; archivos pre-existing capturados con flag; eviction no destruye trabajo en curso | PENDING |
| F5 | Watch | `codi watch` regenera al editar `.codi/` (debounce 500ms) | 🟡 Media | Sandbox + watch background; touch artifact; verificar re-generate sin loop | No requerida | Sólo dispara con `auto_generate_on_change: true`; ignora `state.json` + `audit.jsonl`; debounce funciona; no infinite loop | PENDING |
| F6 | Hooks | Detección (husky/pre-commit/lefthook/standalone) + install + ejecución | 🔴 Crítica | Sandbox por framework: instalar codi en cada uno, generate, simular commit; tests: `tests/unit/core/hooks/*`, `tests/integration/hooks*`. Verificar always-on vs flag-controlled | Ejecutar commit real con secret intencional + assert que hook bloquea | Cada framework integra hooks correctamente; auto-restage post-fix funciona; advisory vs blocking respeta convención; 16 registries por lenguaje aplican condicionalmente | PENDING |
| F7 | Flags | 16 flags, 6 modos, 3 capas (preset/repo/user) con override y locked:true | 🟠 Alta | Script: combinaciones de presets+repo flags; verificar resolved + source + locked correctos; tests: `tests/unit/core/flags/*` | No requerida | locked:true halts subsequent layers; modo `conditional` aplica sólo bajo conditions; source tracking exacto | PENDING |
| F8 | Presets | 6 built-in + install/create/export/validate desde GitHub/ZIP con lockfile | 🟠 Alta | Script: install cada uno de los 6 presets en sandbox limpio; export → install desde ZIP; preset-lock.json invariants | Validar UX wizard `codi preset` interactivo | Cada preset genera artifacts esperados; preset-lock.json registra checksums; import desde URL GitHub valido | PENDING |
| F9 | Artifacts | `codi add rule/skill/agent/brand/workflow`, frontmatter Zod, versionado | 🟠 Alta | Add de cada tipo en sandbox; verificar frontmatter válido; `codi update` clasifica original/modified/new/removed/user-managed | Verificar UX selección de artifacts en wizard | Cada tipo se añade con frontmatter correcto; platform-aware filtering por agent funciona; user-managed skips updates | PENDING |
| F10 | Init wizard | `codi init` 4-step wizard interactivo + Command Center | 🟠 Alta | E2E: `codi init --preset minimal --agents claude-code --force` non-interactive; tests: `tests/e2e/v3-zero-cli.test.ts` | Validación humana del UX Clack: backward Ctrl+C, color theme, narrowing por filtros | Init no-interactive funciona en CI; wizard interactivo navegable; estado idempotente en re-init | PENDING |
| F11 | Validation/Doctor | `codi validate`, `codi doctor`, `codi compliance`, `codi ci` con exit codes | 🟠 Alta | Cada comando en proyecto válido + inválido; assert exit codes match `exit-codes.ts`; assert error codes match `error-catalog.ts` (29) | No requerida | Doctor detecta env issues; validate falla con schema mismatch; compliance compone los 3; ci exit non-zero on issues | PENDING |
| F12 | Verify | `codi verify` echo + check token SHA256 desde manifest+agents+rules+skills+mcp+flags | 🟡 Media | Sandbox: generate → leer token de CLAUDE.md → `codi verify --check <token>` retorna OK; mutar config → verify falla | No requerida | Token cambia si artefactos cambian; --check programático retorna exit 0/non-zero coherente | PENDING |
| F13 | MCP | `codi.mcp.yaml` + 33 server templates + per-agent native formats | 🟠 Alta | Add 3 server templates; generate; verificar .mcp.json, .cursor/mcp.json, .codex/config.toml válidos; .mcp.env.example listing | No requerida | Cada server llega a su agent con format correcto; instructions inline presentes; env example accurate | PENDING |
| F14 | Skills | `codi skill` (export 4 formatos + evolve + stats) + evals + run-eval + run-loop | 🟠 Alta | Export por formato; tests: `src/templates/skills/.../evals/evals.json` runs; skill-resource [[/path]] hook | Revisar UX wizard `codi skill export` | Cada formato genera archivo deseado; evals runnable; resource markers validados pre-commit | PENDING |
| F15 | Brain DB + Capture | SQLite better-sqlite3, Drizzle schema, FTS5, walk-up project ID, capture pipeline | 🔴 Crítica | Tests: `tests/runtime/brain*`, `tests/runtime/capture*`; CI guard schema alignment Drizzle vs raw SQL; UNIQUE constraints capturas | Validar inspección manual UI brain DB tras sesión real con agente | Migrations idempotentes; walk-up bounded 64 dirs; FTS5 búsqueda; UNIQUE(session_id, turn_id) impide duplicados; lock externo manejado | PENDING |
| F16 | Workflows | `codi workflow run/status/quick`, reducer puro, gate-runner, 7 tipos | 🔴 Crítica | Cada tipo de workflow: run + transitions + status; tests: `tests/runtime/reducer*`, `tests/runtime/gate*`, `tests/runtime/workflows/*` | Validar UX `codi workflow status` por tipo | Reducer determinista; eventos malformados manejados con ReducerError (CORE-001); gates dispatch deterministic/agent; transitions coherentes | PENDING |
| F17 | Update + Conflicts | `codi update` artifactVersion classifier + conflict-resolver Result signature (CORE-007) | 🟠 Alta | Sandbox con artifacts modificados; `codi update`; assert clasificación + exit code non-TTY 2; tests: `tests/unit/utils/conflict-resolver.test.ts` | Validar UX interactivo conflict resolver | exit 2 en non-TTY observable (post-CORE-007); user-managed skip; force/keepCurrent/unionMerge strategies funcionan | PENDING |
| F18 | Onboard | `codi onboard` print self-contained guide a stdout | 🟡 Media | Run `codi onboard`; assert output contiene catalog + presets + playbook 7-step; no errors | Pegar output en Claude Code real y validar que ejecuta el flow | Output válido markdown; catalog completo de artifacts; playbook accionable | PENDING |
| F19 | Contribute/Team | `codi contribute` PR + ZIP, `codi team join`, `codi brain export-for-team` | 🟡 Media | Sandbox con repo git remoto fake; contribute → assert branch+PR creados; team join merge `.codi/` desde dir; brain export → archivo válido | Validar contribución a repo real privado con `gh auth` | Detect default branch correctamente; empty repo bootstrap; private repo `gh auth refresh -s repo` reportado | PENDING |
| F20 | Docs | `codi docs --catalog` + `docs-update` + `docs-stamp` + `docs-check` | 🟡 Media | npm run docs:build; assert site se genera; docs --catalog produce JSON; docs-update sync OK; docs-stamp signatures válidas; docs-check sin drift | Inspección visual del site Astro generado | Pagefind search funciona; catalog renderiza 100% artifacts; doc-check exit non-zero si docs stale | PENDING |
| F21 | Brain UI | `codi brain` launcher → Hono server port 4477 read-only + SSE | 🟢 Baja | Launch background; curl health endpoint; assert routes responden | Inspección visual de la UI en browser; verificar htmx interactions | Server arranca sin colisión de puerto; SSE eventos en vivo; UI navegable | PENDING |
| F22 | Clean/Backup/Plugin/Migrate | Comandos restantes: clean, backup (list/delete/prune), plugin packaging, migrate v2→v3 | 🟡 Media | Cada comando en sandbox apropiado; tests existentes en `tests/unit/cli/*` | Validar UX por comando interactivo | clean reversible vía revert; backup CLI list/delete; plugin pack ZIP; migrate v2→v3 plan + execute correcto | PENDING |

### Mapeo a issues conocidos del roadmap

Cada feature lleva referencias a CORE-XXX del `CORE_CODI_ROADMAP.md` cuya resolución debe quedar verificada en esta auditoría funcional (todos figuran como "Validado ✅" en el roadmap, pero la auditoría debe **reproducir el escenario corregido** end-to-end):

| Feature | CORE-XXX que verifica |
|---|---|
| F1 | CORE-002 (atomic mutate + lock), CORE-026 (EMPTY_STATE lazy), CORE-030 (state.json corruption test) |
| F2 | CORE-002 (p-limit), CORE-006 (BaseAdapter), CORE-018 (ARTIFACT_LAYOUT), CORE-025 (exists helper) |
| F4 | Backup v2 manifest (no CORE-XXX directo) |
| F6 | CORE-010 (YAML hook registry), CORE-013 (writeHookFile), CORE-014 (aux scripts table-driven), CORE-037 (mixed-runner test) |
| F12 | CORE-007 (conflict-resolver Result), CORE-021 (split) |
| F15 | CORE-005 (schema alignment), CORE-011 (UNIQUE constraints), CORE-012 (proper-lockfile), CORE-023 (no template-literal SQL), CORE-027 (cache project path), CORE-038 (locked external test) |
| F16 | CORE-001 (reducer guard), CORE-008 (DecisionKind), CORE-009 (snapshot table), CORE-019 (workflow builders), CORE-028 (git status collapse) |
| F17 | CORE-007, CORE-021 |
| Cross | CORE-003 (Logger DI), CORE-004/004b (Zod), CORE-015 (empty catches), CORE-016/017 (runtime ESLint+Result), CORE-020 (init split), CORE-022 (file-size guard), CORE-024/036 (meta-skill isolation + smoke test), CORE-029 (utils branches), CORE-031/032/033 (docs), CORE-034 (semantic snapshots), CORE-035 (msw) |

---

## Cola de auditoría

### Pendientes

- [ ] Baseline lint + build + test
- [ ] F1 — Configuration Management
- [ ] F2 — Generation Pipeline + Adapters
- [ ] F3 — Drift Detection
- [ ] F4 — Backup + Revert
- [ ] F5 — Watch Mode
- [ ] F6 — Hook System
- [ ] F7 — Flag System
- [ ] F8 — Preset System
- [ ] F9 — Artifact System
- [ ] F10 — Init Wizard + Command Center
- [ ] F11 — Validation/Doctor/Compliance/CI
- [ ] F12 — Verification Tokens
- [ ] F13 — MCP Integration
- [ ] F14 — Skill Subsystem
- [ ] F15 — Brain DB + Capture
- [ ] F16 — Workflow Engine
- [ ] F17 — Update + Conflict Resolver
- [ ] F18 — Onboard
- [ ] F19 — Contribute + Team
- [ ] F20 — Docs Pipeline
- [ ] F21 — Brain UI
- [ ] F22 — Clean/Backup/Plugin/Migrate

### En progreso

(ninguna)

### Completadas

(ninguna)

### Bloqueadas

(ninguna)

---

## Registro de pruebas

(Vacío — se llenará a partir de la Fase 2 con un bloque por feature siguiendo este esquema)

### Plantilla — Funcionalidad: [nombre]
- **ID:**
- **Estado:**
- **Objetivo:**
- **Archivos revisados:**
- **Comandos/scripts ejecutados:**
- **Evidencia:** (logs, outputs, hashes)
- **Resultado:**
- **Intervención humana requerida:**
- **Conclusión:**

---

## Issues detectados

### ISSUE-001: brain-ui `/settings` lee `~/.codi/archive/` fuera del fixture de test — RESUELTO ✅

- **ID:** ISSUE-001
- **Funcionalidad afectada:** F21 (Brain UI) — handler `/settings` y endpoint `POST /api/v1/backups/archive/:hash/:ts/restore`
- **Severidad:** Media (test flaky bajo paralelismo) + High latente en producción (DoS UX en usuarios con muchos archives) + Medium security (symlink follow + JSON.parse sin tamaño máximo)
- **Estado:** Cerrado el 2026-05-17
- **Reproducción:** En el baseline, primer `npm test` reportó `tests/runtime/brain-ui-pages.test.ts > settings page renders project + brain sections` con `Error: Test timed out in 10000ms`. Tests aislados pasaban en 1.1s. Causa raíz: ruta lee `~/.codi/archive/` (271 MB / 1389 manifests en el host del developer), bajo `fileParallelism: true` de vitest la contención IO ocasional disparaba timeout. CI con archive vacío nunca lo vería.
- **Evidencia:**
  - Run 1: `1 failed | 3981 passed | 3 skipped`
  - Reruns: 0 failed (3 runs consecutivos del suite completo)
  - Tests aislados: 3/3 PASS en ~1.1s
  - Tamaño real: `~/.codi/archive/` = 271 MB, 1387 hash dirs, 1389 manifests
- **Análisis Agente 1 — Reproducibilidad:** Flaky, no determinista. CI-safe. Coste real `listProjectArchives()` = 34ms — el timeout no es por costo amortizado sino race-condition bajo paralelismo de vitest.
- **Análisis Agente 2 — Causa raíz:** Asimetría arquitectónica. `listLocalBackups(brain)` deriva path correctamente del `BrainHandle`; `listProjectArchives()` hardcodea `homedir()+PROJECT_DIR+EXTERNAL_ARCHIVE_DIR`. Responsabilidad pertenece a `core/backup/backup-manager.ts` (donde ya vive `externalArchiveRoot(projectRoot)`). 3 sitios afectados.
- **Análisis Agente 3 — Impacto:** Production HIGH (sin LIMIT/pagination, browser hang con 1000+ archives), Security MEDIUM (`statSync` sigue symlinks, `JSON.parse(readFileSync)` sin límite), test pollution. Otros leaks `homedir()` en código hermético: solo estos 3 — el resto (pidfile, fallbacks, caches) son intencionales.
- **Diagnóstico consolidado:** El handler de `/settings` mezcla render con enumeración de archives globales. Falta: (a) DI del archive root para tests herméticos, (b) ownership en core/backup, (c) safety hardening (`lstat`, `MAX_MANIFEST_BYTES`, pagination), (d) abstracción de paginación. Convergencia entre los 3 agentes: inyectar `archiveRoot` y mover ownership.
- **Solución implementada:**
  1. **Nuevo módulo en `src/core/backup/backup-manager.ts`**: `listProjectArchives({ archiveRoot, limit, offset })` + `defaultArchiveRoot()` + `ArchiveListEntry` + `DEFAULT_ARCHIVE_PAGE_SIZE=50` + `MAX_ARCHIVE_PAGE_SIZE=500` + `MAX_MANIFEST_BYTES=10MB`. Usa `lstatSync` (no follow symlinks), tolera manifests faltantes/malformados con placeholder best-effort, marca oversized.
  2. **DI en `src/runtime/brain-ui/server.ts`**: `BuildAppOptions.archiveRoot?` threadeable a `registerPages` y `registerApiRoutes`. Default = `defaultArchiveRoot()`, producción inalterada.
  3. **Refactor `src/runtime/brain-ui/pages/settings.ts`**: borra el `listProjectArchives` local; consume el nuevo de core; `listLocalBackups` también usa `lstat` + size guard; backup detail route usa `archiveRoot` inyectado en vez de `homedir()`; añade `?page=` query + nav Prev/Next cuando `totalPages > 1`.
  4. **Refactor `src/runtime/brain-ui/routes-api.ts`**: `ApiRoutesOptions.archiveRoot?`, usa default si undefined.
  5. **Fixture hermético en `tests/runtime/brain-ui-pages.test.ts`**: crea `<tmpDir>/archive` y se lo pasa a `buildApp()`. Soporta `seedArchives` para tests que necesitan entries específicas.
- **Tests añadidos:**
  - `tests/unit/core/backup/list-project-archives.test.ts` — **9 tests**: empty root, sort descending, pagination (offset/limit), clamping a `MAX_ARCHIVE_PAGE_SIZE`, invalid limit fallback, symlink no-follow, oversized manifest, malformed/missing manifest tolerance, defaultArchiveRoot path.
  - `tests/runtime/brain-ui-pages.test.ts` — **5 tests nuevos**: hermeticidad (assert sólo `archiveRoot` inyectado es leído), pagination con 60 archives, symlink no-follow en el route, oversized manifest, plus el test originalmente fallido ahora pasa con repro determinista.
- **Revalidación:**
  - `npm run lint`: PASS (13 guards, 0 nuevas advisories)
  - Tests dirigidos: 22/22 pass en 1.4s
  - Suite completo: 3996/6/0 (era 3982/6/0 → +14 tests nuevos, 0 regresiones)
- **Resultado final:** ✅ Issue cerrado con fix arquitectónicamente correcto. Tests herméticos + safety hardening + pagination + ownership corregido. Sin parches: la ruta ya no toca el home del developer, los 3 vectores de DoS están bloqueados, y la responsabilidad de listar archives vive ahora junto a `externalArchiveRoot()` en core/backup.
- **Archivos modificados:**
  - `src/core/backup/backup-manager.ts` (+147 LOC) — nuevo API
  - `src/runtime/brain-ui/server.ts` (+10/-2) — DI
  - `src/runtime/brain-ui/pages.ts` (+8/-3) — propagación
  - `src/runtime/brain-ui/pages/settings.ts` (~+50/-65) — refactor + pagination + lstat
  - `src/runtime/brain-ui/routes-api.ts` (+9/-5) — DI
  - `tests/runtime/brain-ui-pages.test.ts` (+125 LOC) — fixture + 5 tests
  - `tests/unit/core/backup/list-project-archives.test.ts` (new, 175 LOC) — 9 tests
- **Issues residuales documentados al roadmap:** ninguno. Todos los hallazgos derivados (pagination, lstat, JSON.parse guard, ownership) fueron resueltos en este mismo fix.

---

### Plantilla — Issue: [título]

### Plantilla — Issue: [título]
- **ID:**
- **Funcionalidad afectada:**
- **Severidad:** crítica / alta / media / baja
- **Estado:** abierto / en diagnóstico / en fix / en revalidación / cerrado
- **Reproducción:** (pasos exactos)
- **Evidencia:**
- **Análisis Agente 1 — Reproducibilidad:**
- **Análisis Agente 2 — Causa raíz:**
- **Análisis Agente 3 — Impacto:**
- **Diagnóstico consolidado:**
- **Solución implementada:**
- **Tests añadidos/actualizados:**
- **Revalidación:**
- **Resultado final:**

---

## Notas metodológicas

- **Sandboxes:** cada feature se prueba en un directorio temporal bajo `/tmp/codi-audit-fXX-<scenario>/` aislado de este repo (excepto cuando la prueba requiere tocar `src/`, donde se crea worktree o branch).
- **No mocks:** siguiendo la convención existente del codebase (Phase 3d del audit anterior), las pruebas funcionales usan binario CLI real, fs real, SQLite real.
- **Convertir a permanente:** scripts ad-hoc que reproduzcan defectos se convierten en tests bajo `tests/qa/` o el directorio apropiado.
- **Triple análisis para issues:** usar `Agent` tool con 3 subagentes independientes (reproducibilidad / causa raíz / impacto) y reconciliar.
- **Soluciones de largo plazo:** alineadas con la arquitectura objetivo descrita en Section F del audit del 2026-05-15. Sin parches.
