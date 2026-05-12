# Codi Core Improvement — Iterative Roadmap

- **Date**: 2026-05-11 22:03
- **Document**: 20260511*220320*[ROADMAP]\_codi-core-improvement-iterative-plan.md
- **Category**: ROADMAP
- **Source audits consolidated**:
  - `20260511_213208_[AUDIT]_codi-full-audit.md` (66 findings — 1 CRIT / 18 HIGH / 22 MED / 25 LOW)
  - `20260511_214500_[AUDIT]_codi-v3-full-reaudit.md` (workflow + arch + sec + perf — 4 CRIT / many HIGH / MED)
  - `20260511_215554_[AUDIT]_codi-spine-audit.md` (spine focus — 2 CRIT / 13 HIGH / 8 MED / 12 LOW)
- **Total issues after dedup**: 100

---

## 1. Objetivo

Optimizar y mejorar el **core de Codi** para que sea herramienta top para equipos de desarrollo, cerrando los issues consolidados de los tres audits anteriores en un proceso iterativo controlado por humano.

## 2. Proceso iterativo — Protocolo

### Reglas del proceso

| Regla                                                                  | Detalle                                                                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Un issue a la vez**                                                  | No se trabaja sobre varios issues en paralelo. Solo se avanza al siguiente cuando el actual está cerrado y aprobado                 |
| **3 agentes por issue**                                                | Para cada issue se despliegan 3 sub-agentes con perspectivas distintas para validar/comprobar el issue y proponer solución conjunta |
| **Explicación previa al humano**                                       | El agente principal explica el issue al humano consolidando los outputs de los 3 sub-agentes                                        |
| **Aprobación humana antes de implementar**                             | No se escribe código hasta que el humano apruebe la solución propuesta                                                              |
| **Solo soluciones robustas + industry-standard + sin sobreingeniería** | PROHIBIDO proponer workarounds, quick hacks, abstracciones especulativas, o capas innecesarias                                      |
| **Cierre antes de siguiente**                                          | El issue debe quedar cerrado (commit + verify) antes de pasar al siguiente                                                          |

### Flujo por issue

```
[Issue actual] → Spawn 3 agentes paralelos
                  ├─ Agente A: revisor independiente (verifica que el issue existe y mide impacto)
                  ├─ Agente B: investigador de soluciones industry-standard
                  └─ Agente C: validador anti-sobreingeniería + revisor de propuesta
                  ↓
[Agente principal consolida outputs] → Explica issue al humano
                  ↓
[Humano aprueba solución propuesta] → Implementación
                  ↓
[Verificación] → tests + lint + manual smoke
                  ↓
[Commit + cerrar issue] → Siguiente issue
```

### Tipos de agente por issue (orientativo — puede cambiar según el dominio)

| Dominio del issue          | Agente A                     | Agente B                        | Agente C             |
| -------------------------- | ---------------------------- | ------------------------------- | -------------------- |
| Seguridad                  | `security-expert`            | `codi-security-analyzer`        | `codi-code-reviewer` |
| Performance                | `codi-performance-auditor`   | `vercel:performance-optimizer`  | `codi-code-reviewer` |
| Arquitectura               | `codi-codebase-explorer`     | `data-intensive-architect`      | `codi-refactorer`    |
| Workflow engine            | `codi-codebase-explorer`     | `codi-test-generator`           | `codi-code-reviewer` |
| Code quality / duplicación | `codi-refactorer`            | `codi-codebase-explorer`        | `codi-code-reviewer` |
| Testing                    | `codi-test-generator`        | `codi-code-reviewer`            | `general-purpose`    |
| API design                 | `codi-api-designer`          | `security-expert`               | `codi-code-reviewer` |
| Observabilidad / Brain     | `data-engineering-expert`    | `codi-codebase-explorer`        | `codi-code-reviewer` |
| AI / MCP / Skills          | `codi-ai-engineering-expert` | `codi-openai-agents-specialist` | `codi-refactorer`    |

## 3. Restricciones absolutas sobre las soluciones propuestas

- **Robusta**: cubre edge cases, no introduce regresiones, mantiene `Result<T>` discipline.
- **Industry-standard**: usar patrones bien establecidos (no inventar). Ejemplos: `Promise.all + p-limit` para concurrencia, `crypto.randomUUID` para IDs, `Zod safeParse` en bordes, single SQLite transaction para writes atómicos, `AbortSignal.timeout` para exec timeouts.
- **No sobreingeniería**: no introducir abstracciones especulativas, no diseñar para requirements hipotéticos, no agregar feature flags innecesarios, no crear nuevos sistemas si el ajuste cabe en el existente.
- **Mínima superficie de cambio**: editar el menor número de archivos posible. Reuse antes que reinvent.
- **Tests primero o junto**: cada fix entrega su test de regresión.
- **Sin force-push, sin `--no-verify`, sin `// @ts-ignore`, sin `as any`**.

## 4. Issue list consolidada (100 issues, severidad-ordenada)

Leyenda fuente: `A1` = `codi-full-audit.md` · `A2` = `codi-v3-full-reaudit.md` · `A3` = `codi-spine-audit.md`

### P0 — Bloqueantes (cerrar antes de cualquier release)

| ID        | Título                                                                                                            | Severidad |
| --------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| ISSUE-001 | Path-traversal en brain-ui restore endpoints (`:hash`/`:ts` flow into path.join) [A1:C1]                          | CRIT-SEC  |
| ISSUE-002 | Workflow engine — dos `gatesForPhase` divergentes (workflow-graph vs gate-runner-bridge) [A2:W-C1]                | CRIT-CORR |
| ISSUE-003 | Workflow engine — `approveTransition` 4 txns separadas (cross-call atomicity rota) [A2:W-C2]                      | CRIT-CORR |
| ISSUE-004 | Workflow engine — race en `runWorkflow` stale-active cleanup [A2:W-C3]                                            | CRIT-CORR |
| ISSUE-005 | Sync layer (27 archivos, 6.6K LOC) desconectada del CLI principal [A2:B11 / A3:H-01]                              | CRIT-ARCH |
| ISSUE-006 | Metaskills sin convención `codi-dev-<name>` aplicada (solo 3/10) — bloquea reconstrucción zero-artifact [A3:H-02] | CRIT-PROD |
| ISSUE-007 | Hooks via `tsx` JIT — 400-600ms × cada hook fire (8-12s wasted per turn) [A2:P-F01]                               | CRIT-PERF |

### P1 — Seguridad alta

| ID        | Título                                                                   | Severidad |
| --------- | ------------------------------------------------------------------------ | --------- |
| ISSUE-008 | `marked.parse` sin sanitiser → stored XSS en brain-ui [A2:S-H1]          | HIGH-SEC  |
| ISSUE-009 | `Origin === undefined` CSRF bypass en brain-ui [A2:S-H2]                 | HIGH-SEC  |
| ISSUE-010 | `descriptor.ref` → `git clone --branch` arg-injection latente [A2:S-H3]  | HIGH-SEC  |
| ISSUE-011 | `fast-uri@3.1.0` aún hoisted pese a `pnpm.overrides >=3.1.2` [A2:S-H4]   | HIGH-SEC  |
| ISSUE-012 | `unsafeMode(true)` permanente en brain DB connection [A2:S-M1 / A3:H-06] | HIGH-SEC  |

### P1 — Arquitectura / código quality

| ID        | Título                                                                                                                                                               | Severidad |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| ISSUE-013 | 9 archivos sobre 700-LOC cap (cli/init, cli/workflow, cli/update, sessions, init-wizard-paths, hook-templates, contribute, 2 skills) [A1:L10 / A2:§1 / A3:H-03,H-15] | HIGH-QUAL |
| ISSUE-014 | 27 barrel `index.ts` files violan `codi-typescript` rule [A2:Q-1 / A1:M6]                                                                                            | HIGH-ARCH |
| ISSUE-015 | 4 violaciones de capa `core/ → cli/` (layer inversion) [A2:A-3]                                                                                                      | HIGH-ARCH |
| ISSUE-016 | Agent-identity drift en 4 fuentes (`SUPPORTED_PLATFORMS` ≠ `ALL_ADAPTERS` ≠ `TARGET_IDS` ≠ `SUPPORTED_AGENT_TYPES`; `codex-cli` vs `codex`) [A2:A-2]                 | HIGH-CORR |
| ISSUE-017 | `.codi` literal hardcoded en 30+ sitios pese a `PROJECT_DIR` constante [A2:Q-2]                                                                                      | HIGH-QUAL |
| ISSUE-018 | `ARTIFACT_TYPES` redefinido en 3 sitios con valores diferentes [A2:Q-3]                                                                                              | HIGH-CORR |
| ISSUE-019 | 4 scaffolders (skill/agent/rule/mcp) duplicados ~80% [A1:H6]                                                                                                         | HIGH-DUP  |
| ISSUE-020 | `migration/{claude-md,agents-md}.ts` byte-for-byte idénticos [A1:H7]                                                                                                 | HIGH-DUP  |
| ISSUE-021 | Dual frontmatter parser (`gray-matter` vs `parseFrontmatter`) en ~17 archivos [A1:H9,M1]                                                                             | HIGH-DUP  |
| ISSUE-022 | `deriveProjectId` copy-pasted en 3 hook files (drift risk en `project_id`) [A1:H15]                                                                                  | HIGH-DUP  |
| ISSUE-023 | 240+ `console.*` en lugar de `Logger` (worst: `runtime/sync/cli*.ts`) [A2:Q-4]                                                                                       | HIGH-QUAL |
| ISSUE-024 | Artifact-layout map duplicado en 5 archivos [A2:§6]                                                                                                                  | HIGH-DUP  |
| ISSUE-025 | Snake↔camel adapter mapping triplicado en 3 archivos [A2:§6]                                                                                                         | HIGH-DUP  |

### P1 — Performance alta

| ID        | Título                                                                              | Severidad |
| --------- | ----------------------------------------------------------------------------------- | --------- |
| ISSUE-026 | `applyMigrations` corre en cada hook fire (×2 en UserPromptSubmit) [A2:P-F02]       | HIGH-PERF |
| ISSUE-027 | PostToolUse abre 2 brain handles por tool call [A2:P-F03]                           | HIGH-PERF |
| ISSUE-028 | Generator phase 1 secuencial entre 6 adapters (~6× sub-utilizado) [A2:P-F04]        | HIGH-PERF |
| ISSUE-029 | Generator phase 2 lee 7000 files serialmente [A2:P-F05]                             | HIGH-PERF |
| ISSUE-030 | Eager skill-registry barrel infla cold start (~100-200ms × `codi <cmd>`) [A2:P-F06] | HIGH-PERF |

### P1 — Workflow / runtime

| ID        | Título                                                                                 | Severidad |
| --------- | -------------------------------------------------------------------------------------- | --------- |
| ISSUE-031 | Iron-Laws hooks confían `StopHookInput` sin Zod validation [A1:H12]                    | HIGH-CORR |
| ISSUE-032 | `readActiveWorkflowId` abre 3× fresh `BrainEventLog`+`Database` por Stop fire [A1:H13] | HIGH-PERF |
| ISSUE-033 | Stop hook 6-8 writes sin `raw.transaction()` (orphan turn rows on crash) [A1:H14]      | HIGH-CORR |
| ISSUE-034 | Agent-typed gates declarados pero nunca ejecutados [A2:W-H1]                           | HIGH-CORR |
| ISSUE-035 | `team-consolidation.yaml` 7 gates sin deterministic checkers (silent pass) [A2:W-H2]   | HIGH-CORR |
| ISSUE-036 | `getStatus` cwd-filters / transitions no → workflow invisible aprobable [A2:W-H3]      | HIGH-CORR |
| ISSUE-037 | `workflow_runs.__codi_session__` singleton overload (lock+state+workflows) [A3:H-07]   | HIGH-ARCH |
| ISSUE-038 | Reducer pass-through eventos `sheet_*` sin proyección de estado [A3:H-08]              | HIGH-ARCH |

### P1 — CLI / DX

| ID        | Título                                                                 | Severidad |
| --------- | ---------------------------------------------------------------------- | --------- |
| ISSUE-039 | `execFileAsync` git/gh sin timeout (24 sitios) [A1:H1]                 | HIGH-DX   |
| ISSUE-040 | `git clone --depth` sin timeout [A1:H2]                                | HIGH-DX   |
| ISSUE-041 | `cli/brain.ts:440,451,469` no propaga exit code (CI returns 0) [A1:H3] | HIGH-CORR |
| ISSUE-042 | `cli/migrate.ts:106` no propaga exit code [A1:H4]                      | HIGH-CORR |
| ISSUE-043 | `codi add` duplica `--all` + name validation + regenerate 4× [A1:H5]   | HIGH-DUP  |

### P1 — Testing

| ID        | Título                                                                                                        | Severidad |
| --------- | ------------------------------------------------------------------------------------------------------------- | --------- |
| ISSUE-044 | 30+ `vi.mock` contra `#src/core/*` y `#src/cli/*` (viola `codi-testing` "no mock module under test") [A1:H16] | HIGH-TEST |
| ISSUE-045 | Tests asertan `toHaveBeenCalledTimes/With` vs outputs (implementation-coupled) [A1:H17]                       | HIGH-TEST |
| ISSUE-046 | Adapters: 13 archivos / 1 test file [A3:H-04]                                                                 | HIGH-TEST |
| ISSUE-047 | CLI handlers: 58 archivos / 1 test file [A3:H-05]                                                             | HIGH-TEST |
| ISSUE-048 | Concurrency tests faltan para workflow engine [A2:§12]                                                        | HIGH-TEST |

### P1 — Observabilidad / Brain

| ID        | Título                                                                              | Severidad |
| --------- | ----------------------------------------------------------------------------------- | --------- |
| ISSUE-049 | Sin join `corrections ↔ artifacts_used` → no atribuye defecto a artefacto [A3:H-28] | HIGH-OBS  |
| ISSUE-050 | Sin tabla `eval_runs` — resultados evals.json no persisten [A3:H-29]                | HIGH-OBS  |
| ISSUE-051 | Sin scheduler de pain-point detection [A3:H-30]                                     | HIGH-OBS  |
| ISSUE-052 | Falta `actor_id` en `corrections` + `operations-ledger` [A3:H-33]                   | HIGH-OBS  |
| ISSUE-053 | Falta `team_id` en sessions/captures/workflow_runs (multi-tenant) [A3:H-35]         | HIGH-OBS  |
| ISSUE-054 | Schema dice "11 tablas" vs 12 reales (workflow_definitions) [A3:H-11]               | MED-DOC   |

### P1 — Equipos

| ID        | Título                                                                    | Severidad |
| --------- | ------------------------------------------------------------------------- | --------- |
| ISSUE-055 | Sin team brain agregado — Brain local-only [A3:H-24]                      | HIGH-TEAM |
| ISSUE-056 | Sin ownership/CODEOWNERS por artefacto ni RBAC [A3:H-22]                  | HIGH-TEAM |
| ISSUE-057 | Sync solo Google; sin git-native/GitHub/S3 [A3:H-21]                      | HIGH-TEAM |
| ISSUE-058 | `openai` + `@google/generative-ai` dead deps [A2:§1 / A1:H18]             | HIGH-DEP  |
| ISSUE-059 | Drizzle-kit, pdf-lib, pptxgenjs, jsdom, pagefind candidatos dead [A1:H18] | MED-DEP   |

### P2 — Medios

| ID        | Título                                                                                                                         | Severidad |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | -------- |
| ISSUE-060 | FTS5 MATCH query forwarded unbounded → DoS [A2:S-M2]                                                                           | MED-SEC   |
| ISSUE-061 | CDN scripts sin SRI / sin CSP [A2:S-M3]                                                                                        | MED-SEC   |
| ISSUE-062 | `Math.random()` para temp-dir suffix (5 sitios) [A2:S-M4]                                                                      | MED-SEC   |
| ISSUE-063 | `session-start.sh` grep YAML en lugar de parser [A2:S-M5]                                                                      | MED-SEC   |
| ISSUE-064 | `runner-template.ts` construye shell desde JSON config [A2:S-M6]                                                               | MED-SEC   |
| ISSUE-065 | SSE sin per-IP cap [A2:S-M7]                                                                                                   | MED-SEC   |
| ISSUE-066 | 10 `catch {}` vacíos concentrados en hooks subsystem [A2:Q-5]                                                                  | MED-QUAL  |
| ISSUE-067 | `hook-installer.ts: 668`, `hook-config-generator.ts: 666` zona de riesgo 700 [A3:H-15]                                         | MED-QUAL  |
| ISSUE-068 | Deep imports remanentes pese a regla anti-deep-imports [A3:H-20]                                                               | MED-QUAL  |
| ISSUE-069 | `brain-event-log` ejecuta `git rev-parse` sync por sesión [A3:H-14]                                                            | MED-PERF  |
| ISSUE-070 | `as unknown as` double-casts (~6 sitios) [A1:H11]                                                                              | MED-QUAL  |
| ISSUE-071 | `schema-renderers.ts:22-211` `any` casts con `eslint-disable` [A1:H10]                                                         | MED-QUAL  |
| ISSUE-072 | `cli/init-helpers` + `update.ts` aún usan `gray-matter` directo [A1:M1]                                                        | MED-DUP   |
| ISSUE-073 | `cli/docs.ts:119,131` `--json` colisiona con flag global [A1:M2]                                                               | MED-DX    |
| ISSUE-074 | `cli/hooks-list.ts` escribe a stdout bypaseando `handleOutput` [A1:M3]                                                         | MED-DX    |
| ISSUE-075 | `cli/hooks.ts:95-105` `hooks reinstall` shells out en lugar de llamar a `regenerateConfigs` [A1:M4]                            | MED-QUAL  |
| ISSUE-076 | `cli/agent-hooks.ts:423-428` re-parsea `--agent` dead [A1:M5]                                                                  | LOW-QUAL  |
| ISSUE-077 | Funciones >30 LOC `codi-code-style` cap (3 ejemplos: `scanDirectory:133`, `ensureDocProjectDir:120`, `fixDocSync:100`) [A1:M7] | MED-QUAL  |
| ISSUE-078 | `external-source/installer.ts` `throw` dentro contexto Result [A1:M8]                                                          | MED-QUAL  |
| ISSUE-079 | Hardcoded `.codi/`, `artifact-manifest.json` en 6+ files (deberían ser constants) [A1:M9]                                      | MED-DUP   |
| ISSUE-080 | `evals-manager.writeEvals`, `feedback-collector.readRuleFeedback` solo usados en unit test propio (dead) [A1:M10]              | MED-DEAD  |
| ISSUE-081 | `brain-ui/sessions.ts:143-150` p50/p90 percentile mislabel                                                                     | MED-CORR  |
| ISSUE-082 | `brain-ui/sse.ts` long-poll sin max client lifetime [A1:M12]                                                                   | MED-PERF  |
| ISSUE-083 | `brain-ui/server.ts:39` `busy_timeout = 5000` set después de migrations [A1:M13]                                               | MED-CORR  |
| ISSUE-084 | `brain-ui` sin `CODI_BRAIN_UI_PORT` env override [A1:M14]                                                                      | LOW-DX    |
| ISSUE-085 | `team-consolidation.yaml` 4 fases con `chains: []` vacíos [A1:M15]                                                             | MED-QUAL  |
| ISSUE-086 | `team-consolidation-workflow` skill sin `evals/evals.json` [A1:M16]                                                            | MED-QUAL  |
| ISSUE-087 | Sin scaffolder `hook` ni `workflow` + sin `codi add hook                                                                       | workflow` | HIGH-EXT |
| ISSUE-088 | Conflict resolver no cubre `.codi/` ↔ `.codi/` entre humanos [A3:H-23]                                                         | MED-TEAM  |
| ISSUE-089 | Onboarding sin `codi team join` [A3:H-27]                                                                                      | MED-TEAM  |
| ISSUE-090 | Operations-ledger no captura `actor` [A3:H-26]                                                                                 | MED-OBS   |
| ISSUE-091 | Sin GitHub Action oficial publicada [A3:H-25]                                                                                  | MED-ADOPT |

### P3 — Bajos / higiene

| ID        | Título                                                                          | Severidad |
| --------- | ------------------------------------------------------------------------------- | --------- |
| ISSUE-092 | `src/brain/` y `src/db/` README-only legacy [A3:H-09]                           | LOW-DEAD  |
| ISSUE-093 | `.codi_output*/` versionado en repo (16 carpetas + 456KB BKP) [A3:H-12 / A1:L6] | LOW-POLL  |
| ISSUE-094 | PENDING.md 56KB sin tracking → convertir a issues GH [A3:H-10]                  | LOW-PROD  |
| ISSUE-095 | `findProjectBrainPath` magic 64 sin constante [A3:H-13]                         | LOW-STYLE |
| ISSUE-096 | `quick`+`team-consolidation` sin adapter en registry [A3:H-16]                  | LOW-COMP  |
| ISSUE-097 | `capabilities/matrix.ts` mantenido a mano [A3:H-17]                             | LOW-DUP   |
| ISSUE-098 | FTS5 contentless sin runbook reindex [A3:H-18]                                  | LOW-OPS   |
| ISSUE-099 | `runtime/README` declara "Skeleton stage" obsoleto [A3:H-19]                    | LOW-DOC   |
| ISSUE-100 | `MIN_FEEDBACK_FOR_EVOLVE` fijo no adaptativo per-skill [A3:H-31]                | LOW-CFG   |

## 5. Orden recomendado de ejecución

### Fase A — Bloqueantes (issues 1-7)

Cerrar todos los P0 antes de cualquier otra cosa. Bloquean releases.

Orden sugerido:

1. ISSUE-001 (path-traversal security) — 1h
2. ISSUE-002, ISSUE-003, ISSUE-004 (workflow engine races) — 1 día combinado
3. ISSUE-007 (hooks tsx JIT) — 1 día
4. ISSUE-006 (metaskill rename) — 0.5 día
5. ISSUE-005 (sync CLI connection o gate experimental) — 0.5 día

### Fase B — Seguridad + correctness (issues 8-12, 31-38, 41-42)

Cerrar antes de exponer brain-ui a equipos.

### Fase C — Performance (issues 7, 26-30, 32, 69, 82)

Después de correctness para evitar optimizar código incorrecto.

### Fase D — Code quality / dedup / arquitectura (issues 13-25, 43, 70-80)

Refactors estructurales con tests cubriendo.

### Fase E — Testing (issues 44-48)

Cubrir antes de Fase F porque equipos confían en suite verde.

### Fase F — Observabilidad + Brain mejora continua (issues 49-54, 81, 83-86, 100)

Habilita "Codi se mejora a sí mismo".

### Fase G — Equipos + sync + ownership (issues 5, 55-57, 87-89, 91)

Cierre de la promesa "plataforma para equipos".

### Fase H — Hygiene + low priority (issues 58-67, 92-99)

Batch final de housekeeping.

## 6. Plantilla por issue (uso en cada iteración)

```markdown
## ISSUE-NNN — <título>

**Severidad**: <CRIT|HIGH|MED|LOW>-<area>
**Fuente**: <audit1:Cx | audit2:Yx | audit3:Hxx>
**Fecha apertura**: YYYY-MM-DD HH:MM
**Estado**: PENDING REVIEW | UNDER REVIEW | AWAITING APPROVAL | APPROVED | IMPLEMENTING | VERIFYING | CLOSED

### Output de los 3 agentes

#### Agente A (<tipo>)

<resumen>

#### Agente B (<tipo>)

<resumen>

#### Agente C (<tipo>)

<resumen>

### Issue consolidado (explicación humano-legible)

- Qué pasa actualmente
- Por qué es problema
- Evidencia file:line
- Impacto medido

### Solución propuesta (industry-standard, robusta, no sobreingeniería)

- Cambios mínimos
- Archivos afectados
- Tests nuevos / actualizados
- Riesgos residuales

### Aprobación

- [ ] Humano aprueba — fecha:
- [ ] Implementación completa — commit hash:
- [ ] Tests verdes — `pnpm test` exit 0:
- [ ] Issue cerrado — fecha:
```

## 7. Tabla de tracking general

| ID        | Título corto                | Estado  | Aprobado | Commit |
| --------- | --------------------------- | ------- | -------- | ------ |
| ISSUE-001 | brain-ui path-traversal     | PENDING | —        | —      |
| ISSUE-002 | gatesForPhase divergence    | PENDING | —        | —      |
| ISSUE-003 | approveTransition atomicity | PENDING | —        | —      |
| ISSUE-004 | runWorkflow race            | PENDING | —        | —      |
| ISSUE-005 | sync CLI disconnect         | PENDING | —        | —      |
| ISSUE-006 | metaskill `codi-dev-*`      | PENDING | —        | —      |
| ISSUE-007 | hooks tsx JIT               | PENDING | —        | —      |
| ...       | (96 issues más, ver §4)     | PENDING | —        | —      |

## 8. Cómo arrancar

Para iniciar, el usuario indica:

> `arranca ISSUE-001`

El agente principal entonces:

1. Lanza 3 sub-agentes en paralelo según la tabla de §2 (en este caso security domain).
2. Espera resultados.
3. Consolida en formato §6.
4. Presenta al humano.
5. Espera aprobación.
6. Implementa.
7. Verifica.
8. Commit + cierra.
9. Espera "siguiente" del humano.

## 9. Antipatrones prohibidos (recordatorio constante)

- ❌ "Y de paso aprovecho a refactorizar X" — un issue es un issue, scope mínimo.
- ❌ "Voy a crear un sistema configurable para esto" — sobreingeniería sin demanda real.
- ❌ "Le añado una abstracción por si en el futuro..." — YAGNI.
- ❌ Suprimir tests o flags para que pase — solucionar el root cause.
- ❌ `--no-verify`, `// @ts-ignore`, `as any`, force-push.
- ❌ Soluciones que requieren documentación extensa para explicarse — son demasiado complejas.
- ❌ Implementar antes de aprobación humana.

## 10. Mejora continua del proceso

Este roadmap es un documento vivo. Cuando se cierra un issue:

1. Marcar `CLOSED` en §7 con commit hash.
2. Si el issue revela uno nuevo no listado, añadirlo al final con prefijo `ISSUE-101+`.
3. Si el orden de ejecución debe cambiar por dependencias descubiertas, actualizar §5.

---

**End of roadmap.**
