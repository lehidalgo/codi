# Codi — Audit completo: estado actual vs plan team-workflow

- **Date**: 2026-05-09 20:15
- **Document**: 20260509*201518*[AUDIT]\_codi-team-readiness-vs-plan.md
- **Category**: AUDIT
- **Refs**: `docs/20260509_195526_[PLAN]_codi-team-workflow-model.md`, `docs/20260509_175013_[RESEARCH]_codi-coding-agent-team-standardization-patterns.md`

> Auditoría exhaustiva de Codi contra el modelo team-workflow validado en grilling. 4 subagentes especializados leyeron 60+ archivos críticos (preset/init/update/contribute, hooks/adapters/generator, CLI surface, brain/audit/templates). Consolida hallazgos en gaps, anti-features, deuda y roadmap revisado.

---

## 1. Resumen ejecutivo

**El plan T1 es alcanzable en 4 semanas** — 80% del plumbing existe. Pero **3 supuestos del plan son falsos contra el código real**, y la deuda técnica es mayor de lo asumido. Antes de construir las 3 acciones T1, hay que **resolver 5 inconsistencias arquitectónicas** que de otro modo se compondrían sobre la implementación.

**Hallazgos en 1 línea cada uno**:

1. **`extends:` declarativo top-level NO existe en `.codi/codi.yaml`** — solo en `preset.yaml` (preset-to-preset). El plan asume sintaxis no implementada.
2. **`codi update --from-source` y `codi contribute --to-source` NO existen** — el plan los menciona como "renaming" pero los originales (`--from-hub`, `--to-hub`) tampoco existen. Hay que crear de cero, no renombrar.
3. **`codi audit` NO existe como comando** — el namespace está libre. `codi compliance` cubre otra cosa (drift `.codi/`↔`.claude/`, no contra git source remoto).
4. **`OperationsLedger` es la pieza más cercana al `audit --source` del plan** — es un install manifest tipo apt/npm. Reusable.
5. **`installFromGithub` ya implementa el 90% del flow `extends`**, incluyendo lockfile, security scan, parsing `github:org/repo@v1.2.0`. Falta integrarlo con un `extends:` declarativo que se lea automático.
6. **`pullFromSource` (en `update.ts --from <repo>`) NO corre security scan** — gap de seguridad real, contradice el modelo defense-in-depth.
7. **El "registry" centralizado** (`presetRegistry`, `cloneRegistry`, `presetSearchHandler`) está sobre-construido vs el modelo "git repo cualquiera". Default apunta a un repo fantasma (`codi-registry/presets` no existe).
8. **`hub` como concepto en código (Command Center TUI)** colisiona con el lenguaje del plan ("el hub no existe"). Renaming bloqueado por acoplamiento a `core/docs/docs-generator.ts`.
9. **6 archivos cerca o sobre 700 LOC** — `init-wizard-paths.ts` excede el cap explícito.
10. **Capability matrix miente sobre 4 adapters** (Cursor, Copilot, Cline, Windsurf). Drift entre `matrix.ts` y la realidad de `*.ts` adapter — institucionalizado por un test.
11. **Brain DB es per-dev local SQLite** (`~/.codi/brain.db`), sin export OTel/SIEM, sin retención, sin federación team. Para modelo squad es **gap crítico de observabilidad**.
12. **Iron Laws hardcoded en TS** — no configurables por preset. Squad enterprise vs starter no pueden ajustar sin parchear código.
13. **Presets son por intensidad (minimal/balanced/strict), NO por arquetipo de stack** — el plan recomendaba lo contrario.
14. **Workflows YAML son single-dev** — sin fases peer-review, handoff, gates de PR approval. Falta `team-feature.yaml`.
15. **`audit-log.ts` (JSONL CLI macro events) sin readers** — escribe pero nadie consume. Huérfano.

**Veredicto operativo**: el plan T1 (3 acciones, 4 semanas) es factible pero **debe ampliarse a 4 acciones** para incluir: (a) crear `audit.ts` desde cero, (b) extender `ProjectManifestSchema` con `extends:`, (c) deprecar el "registry" centralizado, (d) sincronizar capability matrix con realidad. Sin estos cuatro, las 3 acciones del plan se construyen sobre primitivas inestables.

---

## 2. Mapa de lo que existe vs lo que falta (capa por capa)

### 2.1 Capa 1 — `src/templates/` (defaults built-in)

| Aspecto                                           | Estado                                    | Ubicación                      |
| ------------------------------------------------- | ----------------------------------------- | ------------------------------ |
| Rules                                             | ✅ 30 rules                               | `src/templates/rules/`         |
| Skills                                            | ✅ 86 skills                              | `src/templates/skills/`        |
| Agents                                            | ✅ 22 agents                              | `src/templates/agents/`        |
| Presets builtin                                   | ⚠️ 6 (por intensidad, no por arquetipo)   | `src/templates/presets/`       |
| Workflows YAML                                    | ⚠️ 5 (single-dev only)                    | `src/templates/workflows/`     |
| MCP servers                                       | ✅ presentes                              | `src/templates/mcp-servers/`   |
| Hooks runtime templates                           | ⚠️ 5 `.sh` huérfanos del adapter pipeline | `src/templates/hooks/runtime/` |
| Hook catalog declarativo (`catalog.yaml` plan T1) | ❌ NO existe                              | —                              |

### 2.2 Capa 2 — `.codi/` (project source-of-truth)

| Aspecto                             | Estado                                                                              | Ubicación                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `codi.yaml` manifest                | ✅ con `name`, `version`, `agents`, `layers`, `engine`, `presetRegistry`, `presets` | `src/schemas/manifest.ts:10-72`            |
| `flags.yaml`                        | ✅ 22 flags definidas                                                               | `src/core/flags/`                          |
| Lockfile `preset-lock.json`         | ✅ con `version`, `source`, `sourceType`, `commit` SHA, `installedAt`               | `src/core/preset/preset-registry.ts:35-45` |
| Validación lockfile                 | ❌ no Zod-validated, JSON cast sin verificación                                     | `preset-registry.ts:67`                    |
| `extends:` top-level                | ❌ NO existe en `ProjectManifestSchema`                                             | —                                          |
| `extends:` en `preset.yaml`         | ✅ existe (preset-to-preset)                                                        | `src/schemas/preset.ts:38`                 |
| `state.json` (drift detection)      | ✅ hashes per-artifact en `<configDir>/state.json`                                  | `init-helpers.ts:179-217`                  |
| `operations.json` (rollback ledger) | ✅ install manifest tipo apt/npm                                                    | `core/audit/operations-ledger.ts`          |
| `audit.jsonl` (CLI macro events)    | ⚠️ escribe sin readers                                                              | `core/audit/audit-log.ts`                  |

### 2.3 Capa 3 — Generated (`.claude/`, `.codex/`, etc.)

| Adapter     | Tier | Rules                             | Skills                                                | Agents                                 | MCP                                     | Hooks runtime                                           | Plugin manifest                 |
| ----------- | ---- | --------------------------------- | ----------------------------------------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| claude-code | 1A   | ✅ con globs                      | ✅ `.claude/skills/<name>/SKILL.md`                   | ✅ frontmatter rico                    | ✅ `.mcp.json`                          | ✅ `.claude/settings.json` (InstructionsLoaded+Stop)    | ✅ `.claude-plugin/plugin.json` |
| codex       | 1B   | ⚠️ inline en AGENTS.md            | ⚠️ `.agents/skills/` (NO `.codex/`)                   | ✅ TOML                                | ⚠️ stdio only (filtra HTTP/SSE)         | ⚠️ Stop only                                            | ✅ `.codex-plugin/plugin.json`  |
| cursor      | 2    | ✅ `.mdc` con frontmatter         | ✅                                                    | ❌ matrix=false pero adapter NO genera | ✅                                      | ⚠️ matrix=false pero **SÍ genera** `.cursor/hooks.json` | ❌                              |
| cline       | 2    | ⚠️ inline en `.clinerules`        | ✅ pero bug (renderiza brand 2x)                      | ❌                                     | ❌ matrix=true pero adapter NO genera   | ❌                                                      | ❌                              |
| copilot     | 2    | ✅ scoped `.github/instructions/` | ✅ duplicado (`.github/skills/` + `.github/prompts/`) | ⚠️ matrix=false pero **SÍ genera**     | ✅ `.vscode/mcp.json` (clave `servers`) | ⚠️ matrix=false pero **SÍ genera**                      | ❌                              |
| windsurf    | 2    | ⚠️ inline                         | ✅ pero bug (brand 2x)                                | ❌                                     | ❌ matrix=true pero adapter NO genera   | ❌                                                      | ❌                              |
| gemini      | 2    | —                                 | —                                                     | —                                      | —                                       | —                                                       | ❌ adapter NO existe            |

**Capability matrix mintiendo**: 5/7 targets divergen entre lo declarado en `matrix.ts:84-112` y lo que el `*.ts` adapter realmente emite. Test institucionaliza el drift (`matrix.ts:32`).

---

## 3. Path crítico T1 — gaps concretos vs plan

### 3.1 Acción 1 — Estandarizar `extends:` + alias de comandos

**Estado real vs lo que el plan asumía**:

| Elemento del plan                                               | Estado real                                     | Ubicación                                     | Esfuerzo                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `extends: github:acme/codi-presets@v1.2.0` en `.codi/codi.yaml` | ❌ **NO existe campo top-level**                | `src/schemas/manifest.ts:10-72` no lo declara | **Bajo** — agregar campo opcional al schema, propagar al loader                     |
| Parser `github:org/repo@v1.2.0`                                 | ✅ existe `parsePresetIdentifier`               | `src/core/preset/preset-resolver.ts:26-50`    | Reusar                                                                              |
| Resolución `@latest`                                            | ❌ NO soportado — branch default si vacío       | `preset-github.ts:84,89`                      | Bajo                                                                                |
| Wrapper `codi update --from-source`                             | ❌ NO existe                                    | —                                             | **Bajo** — crear flag que lea `extends:` automático y delegue a `installFromGithub` |
| `codi update --from <repo>` (no estandarizado)                  | ✅ existe                                       | `update.ts:768`                               | Reusar                                                                              |
| `codi contribute --to-source`                                   | ❌ NO existe — `--to-hub` tampoco existió jamás | —                                             | **Bajo** — agregar flag que lea `extends:` y prepopule `--repo`/`--branch`          |
| `codi contribute --repo owner/repo`                             | ✅ existe                                       | `contribute.ts:685`                           | Reusar                                                                              |
| Renaming `preset-lock.json` → `codi.lock`                       | ⚠️ código usa nombre verbose                    | `constants.ts:149`                            | **Bajo** — rename + migration shim                                                  |
| Documentación "el hub es cualquier git repo"                    | ❌ falta                                        | docs/                                         | Medio                                                                               |

**Estimación realista Acción 1**: 1.5 semanas (vs 1 semana del plan original).

### 3.2 Acción 2 — Wizard `codi init` con git repo como primera pregunta

**Estado real**:

| Elemento                                       | Estado                                              | Ubicación                      |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------ |
| Wizard 4 pasos (lang/agents/source/path)       | ✅ existe                                           | `init-wizard.ts:61-269`        |
| Opción "Import from GitHub"                    | ✅ existe en step 3                                 | `init-wizard.ts:199-203`       |
| Es la **primera** pregunta                     | ❌ es la 3ra dentro de 5                            | —                              |
| Graba `extends:` en `codi.yaml`                | ❌ NO — solo registra entrada en `preset-lock.json` | `preset-github.ts:245-253`     |
| Acepta `org/repo`, `github:org/repo@v1.0`, URL | ✅ todos                                            | `init-wizard-paths.ts:226-227` |

**Esfuerzo**: bajo (reordenar prompts + escribir `extends:` durante el flow).

### 3.3 Acción 3 — `codi audit --source` (drift contra git source)

**Estado real**:

| Elemento                              | Estado                                                | Ubicación                              |
| ------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Comando `codi audit`                  | ❌ NO existe                                          | —                                      |
| Comando relacionado `codi compliance` | ⚠️ existe pero cubre OTRO drift (`.codi/`↔`.claude/`) | `cli/compliance.ts:54-191`             |
| Lockfile reader                       | ✅ `readLockFile`                                     | `core/preset/preset-registry.ts:57-65` |
| `OperationsLedger` reader             | ✅ JSON read tipado                                   | `core/audit/operations-ledger.ts`      |
| `git ls-remote --tags <repo>`         | — debe usar `execFileAsync`                           | helper genérico                        |
| State manager para artifact hashes    | ✅ existe                                             | `core/config/state.ts`                 |
| `extends:` lectura                    | ❌ falta (depende de Acción 1)                        | —                                      |

**Esfuerzo**: medio (1.5 semanas). Único comando completamente nuevo del plan T1. Se beneficia de toda la infra existente.

---

## 4. Inconsistencias arquitectónicas que bloquean el plan

Estas 5 deben resolverse **antes o durante** el T1, o se compondrán sobre las nuevas features.

### 4.1 Schema desincronizado (`extends:` no existe top-level)

`ProjectManifestSchema` no tiene campo `extends`. Hoy el código usa `presetRegistry: { url, branch }` (`schemas/manifest.ts:57-65`) que es OTRA cosa (apunta a un repo con `index.json` central). Estos dos conceptos coexistirían si no se decide.

**Decisión necesaria**: o (a) deprecar `presetRegistry` y reemplazar con `extends`, o (b) mantener ambos con semánticas distintas (y documentar el split). Recomendación: deprecar `presetRegistry` en favor de `extends`, ya que el modelo team-first no necesita un registry central.

### 4.2 Inconsistencia `PRESET_SOURCE_TYPES` vs `PresetLockEntry.sourceType`

`constants.ts:113` declara 4 tipos (`builtin | zip | github | local`). `preset-registry.ts:38` agrega 5to (`registry`). Lockfile actual puede tener entries con un tipo no declarado en el alias canónico — **bug de tipos pasivo**.

**Fix**: borrar `"registry"` del lockfile entry tipo (junto con la deprecación del registry de §4.1) o agregarlo a `PRESET_SOURCE_TYPES`.

### 4.3 Capability matrix vs adapters reales

5/7 adapters divergen del declarado en `matrix.ts`. Esto rompe la confianza en cualquier check basado en capabilities. El test de governance (`tests/unit/core/capabilities-governance.test.ts`) institucionaliza el drift al verificar que adapters Tier 2 NO importan del módulo de capabilities.

**Fix**: o (a) actualizar matrix para reflejar realidad (cursor/copilot tienen hooks, copilot tiene agents, etc.) o (b) refactorizar adapters para honrar matrix. Recomendación: (a) — la realidad gana, la matrix es documentación.

### 4.4 `hub` vs el lenguaje del plan

`src/cli/hub.ts` exporta `runCommandCenter`, `NORMAL_MENU`, `ADVANCED_MENU`, `HubTopLevelEntry`. Importado por `src/cli.ts:34` y por `core/docs/docs-generator.ts:23` y `core/docs/renderers/infrastructure-renderers.ts:6`. El plan dice "el hub no existe como entidad" — pero el código lo usa como sinónimo de Command Center.

**Fix**: rename `hub` → `command-center` (o `hub` mantenerlo solo como nombre interno y nunca user-facing). Refactor de 4 archivos. Coherencia conceptual prioritaria.

### 4.5 Dos sistemas de runtime hooks coexistiendo

- **Sistema A**: `src/core/hooks/hook-config-generator.ts` + adapters (`buildSettingsJson` en claude-code.ts, codex.ts, cursor.ts, copilot.ts) — emiten hooks de runtime via adapters per-target.
- **Sistema B**: `src/templates/hooks/runtime/*.sh` + `hooks.json` — scaffolding de un Claude Code plugin paralelo (rama `feature/codi-v3-harness`). NO los emite ningún adapter.

Coexistencia confusa. Hooks runtime declarados en dos lugares sin contrato unificado.

**Fix**: decidir si (a) los `runtime/*.sh` se fusionan al pipeline de adapters (recomendado), o (b) se mantienen separados con doc clara del por qué.

---

## 5. Anti-features para el modelo decidido

Cosas que el código tiene pero que el modelo team-first vuelve obsoletas o estorbo.

### 5.1 Registry centralizado de presets

`presetRegistry` schema, `cloneRegistry`, `readRegistryIndex`, `presetSearchHandler` (`cli/preset.ts:298-351`), `presetUpdateHandler` (`cli/preset.ts:353-489`). Default apunta a `<PROJECT_NAME>-registry/presets` (= `codi-registry/presets`) — **repo fantasma, no existe en `lehidalgo/`**.

**Plan §7 explícito**: "Marketplace cerrado de presets → no necesario, GitHub repos públicos es suficiente". El registry actual ES esto.

**Acción**: deprecar a 1 release vista. Conservar solo `installFromGithub` + lockfile + `audit --source`.

### 5.2 `migrate` v2→v3

`src/cli/migrate.ts:92` — one-shot upgrade. Una vez el ecosistema migre, dead code.

**Acción**: marcar `@deprecated` ahora, eliminar tras 2 releases.

### 5.3 `--from <repo>` legacy en `preset install`

`src/cli/preset.ts:528` — explícitamente `(legacy)`. Reemplazado por argumento posicional `<source>`.

**Acción**: eliminar tras 1 release.

### 5.4 `--interactive` legacy 7-option prompt

`generate.ts:32` y `update.ts:78` — anotado `legacy`.

**Acción**: confirmar si nuevo conflict resolver lo cubre, eliminar si sí.

### 5.5 `brands` deprecated

`src/schemas/preset.ts:29-30`, `core/preset/preset-loader.ts:166-167,227,403-423`, `core/preset/preset-validator.ts:93,149-152`. Todavía carga rama de código `loadLegacyBrandFromDir`.

**Acción**: eliminar rama, migrar consumidores a `skills/<name>/` con `category: brand`.

### 5.6 `audit-log.ts` sin readers

`core/audit/audit-log.ts` (18 líneas, 4 tipos de evento) escribe a `audit.jsonl`. Cero código consume.

**Acción**: o agregar reader (`codi audit log` command), o eliminar y migrar eventos a BrainEventLog.

### 5.7 Plugin manifest con `Date.now()`

`core/capabilities/plugin-manifest.ts:67` — `generatedAt: number` en ms. Cada `codi plugin publish` produce diff aunque nada cambió.

**Acción**: usar hash de contenido o omitir timestamp.

### 5.8 4 docs commands top-level

`docs`, `docs-update`, `docs-stamp`, `docs-check`. `docs --validate/--catalog/--generate` ya cubre. Ruido para consumer.

**Acción**: deprecar los 3 sub, mantener solo `docs` con flags.

### 5.9 `compliance` vs `ci` overlap

Ambos son "wrapper que corre todo lo demás". Solapamiento real.

**Acción**: consolidar — `ci` queda como alias de `compliance --ci` (exit non-zero).

### 5.10 gemini en matrix sin adapter

`matrix.ts:111` declara `gemini`, `adapters/index.ts:31-38` no lo incluye. `codi plugin publish --target gemini` explota.

**Acción**: o eliminar de matrix o implementar adapter. Recomendación: eliminar hasta que haya demanda.

---

## 6. Deuda técnica visible

### 6.1 Archivos sobre o cerca del límite 700 LOC (CLAUDE.md global)

| Archivo                             | LOC     | Estado            |
| ----------------------------------- | ------- | ----------------- |
| `src/cli/init-wizard-paths.ts`      | **755** | Excede límite     |
| `src/cli/contribute.ts`             | 695     | Cerca             |
| `src/cli/hub-handlers.ts`           | 691     | Cerca             |
| `src/cli/preset-handlers.ts`        | 678     | Cerca             |
| `src/cli/preset.ts`                 | 638     | Cerca             |
| `src/runtime/iron-laws-enforcer.ts` | 266     | OK pero hardcodes |

**Acción**: refactor `init-wizard-paths.ts` ya (priority), monitor los demás.

### 6.2 Naming inconsistencies

- **3 `--from` distintos**: `update --from <repo>`, `preset install --from <repo>` (legacy), `workflow run --from-story <id>`. Tres semánticas, mismo flag.
- **`HookEntry` vs `HookSpec`**: alias deprecated coexistiendo (todos los callers usan el deprecated).
- **`installHooks`**: el verbo "install" se usa para 3 cosas distintas (runner, system tools, config en disco).
- **"hooks"**: significa pre-commit hooks / runtime hooks / plugin hooks / heartbeat hooks. Sin glosario.
- **`HOOKS_SUBDIR`** en `heartbeat-hooks.ts:36` colisiona con `src/templates/hooks/` y `.codi/hooks/`.

**Acción**: glossary doc + rename incremental.

### 6.3 Wizards UX inconsistente

- 4 archivos usan `wizard-prompts.ts` primitives (con back-nav).
- 13 archivos usan `@clack/prompts` directo (sin back-nav).
- Resultado: dos UX paralelas en CLI.

**Acción**: migrar 13 archivos a primitives, o documentar excepción explícita por archivo.

### 6.4 Generator side-effects sin warning

`apply.ts:122-138` borra orphans clean por default. Usuario que mete archivo custom en `.claude/` lo pierde silenciosamente en próximo `codi generate`. Footgun no documentado.

**Acción**: warn antes de borrar, o flag opt-in para preservar todo orphan.

### 6.5 Lefthook detection sin implementación

`hook-detector.ts:47-59` detecta lefthook, pero `hook-installer.ts:625` cae en `installStandalone` cuando se elige lefthook. **Bug**: dice que soporta lefthook, no genera lefthook.yml.

**Acción**: implementar generador lefthook o quitar detección.

### 6.6 Bug brand skills duplicados (Cline + Windsurf)

`cline.ts:131-140` y `windsurf.ts:130-139` usan `config.skills` completo (no `regularSkills`). Brand skills se renderizan dos veces (inline + en skills/).

**Acción**: usar `regularSkills` en ambos.

### 6.7 Cursor hooks frágil

`cursor.ts:194-239` script bash inline usa `grep -o '"command":"[^"]*"'` — rompe con escapes. Frágil.

**Acción**: usar parser JSON real.

### 6.8 `pullFromSource` sin security scan

`update.ts:270-361` clona y mergea sin pasar por `scanDirectory`. **Gap de seguridad real** — un repo en `--from` puede inyectar artifacts maliciosos sin pasar por el escáner que `installFromGithub` sí corre.

**Acción**: agregar `scanDirectory` antes de mergear.

### 6.9 Templates `.tmpl` fósiles

`src/templates/hooks/runner.js.tmpl`, `secret-scan.js.tmpl`, `file-size-check.js.tmpl` — NO referenciados por ningún `.ts`. La verdad activa son strings en `runner-template.ts`, `hook-templates.ts`. Los `.tmpl` son fósiles.

**Acción**: eliminar.

### 6.10 `recordPresetLock` doble entry

`init-helpers.ts:374-395` escribe DOS entradas en lockfile para el caso "preset builtin renombrado al guardar como custom" (líneas 386-393). Lockfile termina con keys duplicados-pero-distintos para el mismo evento.

**Acción**: consolidar a una entrada con metadata clara.

---

## 7. Templates inventory — gap para modelo team

### 7.1 Presets

| Preset actual | Tipo                                       | Plan team-first                                      |
| ------------- | ------------------------------------------ | ---------------------------------------------------- |
| `minimal`     | Por intensidad                             | Mantener — starter                                   |
| `balanced`    | Por intensidad                             | Mantener — default solo dev                          |
| `strict`      | Por intensidad                             | Mantener — enterprise                                |
| `fullstack`   | Por audiencia "language-agnostic"          | Refactor a `team-baseline` (foco process/team rules) |
| `power-user`  | Por audiencia "advanced solo dev"          | Mantener — squad lead                                |
| `codi-dev`    | Por audiencia "self-dev del proyecto Codi" | Mantener — internal                                  |

**Faltantes para modelo team**:

- `team-baseline` — rules cross-cutting + workflow team-aware + skills colaboración. Es el "starter pack" para `extends:` desde git repo.
- `frontend-next` — Next.js 15.5 + Biome + Tailwind + Vitest + Playwright + agents `nextjs-researcher`.
- `backend-api` — Hono/Fastify + Drizzle + Vitest + Testcontainers + agents `api-designer`.
- `python-fastapi` — uv + Ruff + mypy + pytest + agents `python-expert`.
- `python-data` — uv + Ruff + DVC/MLflow/dbt + agents `data-engineering-expert`, `data-science-specialist`.
- `mobile-rn` — RN + Biome + Vitest + agents mobile-development.

### 7.2 Workflows YAML

| Workflow actual  | Team-aware?                |
| ---------------- | -------------------------- |
| `feature.yaml`   | ❌ sin peer-review/handoff |
| `bug-fix.yaml`   | ❌                         |
| `refactor.yaml`  | ❌                         |
| `migration.yaml` | ❌                         |
| `project.yaml`   | ❌                         |

**Faltantes**:

- `team-feature.yaml` — `feature.yaml` + fase `peer-review` con gate `pr_approved`.
- `team-spike.yaml` — fase `share-findings` con gate `documented`.
- Variables/metadata para asignar owner por fase.

### 7.3 Rules — categorización para "team-baseline"

| Categoría                                               | Rules                                                                                                                                     | En `team-baseline`? |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Cross-cutting universal                                 | architecture, code-style, error-handling, performance, security, simplicity-first, testing, documentation, api-design, production-mindset | ✅ Sí (10)          |
| Process / team                                          | git-workflow, workflow, agent-usage, output-discipline, capture-everything, improvement                                                   | ✅ Sí (6)           |
| Language-specific (typescript, python, golang, etc.)    | Per-arquetipo, no en baseline                                                                                                             | ❌                  |
| Framework-specific (nextjs, react, django, spring-boot) | Per-arquetipo, no en baseline                                                                                                             | ❌                  |
| Locale (`spanish-orthography`)                          | Marker `optional: true`                                                                                                                   | ⚠️                  |

**Acción**: crear preset `team-baseline` con las 16 rules cross-cutting + process.

### 7.4 Skills — overlaps a consolidar

- **`plan-writer` vs `plan-writing`** — dos skills con casi el mismo nombre. Inspeccionar y consolidar.
- **`refactoring` vs `refactor-workflow`** — overlap de propósito. Definir "Skip When" cruzados.
- **`code-review` vs `pr-review` vs `receiving-code-review`** — 3 skills de review. Posible solapamiento de triggers; necesitan "Skip When" cruzados.

**Acción**: audit triggers de cada par, fusionar si redundantes o agregar "Skip When".

### 7.5 Skills — single-dev a aislar

Para evitar ensuciar defaults squad:

- `brand-creator`, `codi-brand`, `theme-factory`, `frontend-design`, `canvas-design`, `algorithmic-art`, `slack-gif-creator` (~7 skills creative)
- `content-factory`, `claude-artifacts-builder`, `humanizer`, `audio-transcriber`, `notebooklm`, `pptx`, `docx`, `pdf`, `xlsx` (~9 skills content/docs)

**Acción**: marcar `category: brand` o `category: content`, crear preset `creative` opcional, excluir de presets squad-default.

---

## 8. Brain / observability — gap para modelo team

### 8.1 Lo que existe (sólido)

- **SQLite WAL** en `~/.codi/brain.db` con schema de 11 tablas + 35 event types + FTS5 (`brain/schema.ts`).
- **Validación Ajv** de cada evento contra `manifest-event.schema.json`.
- **Lock semantics** single-process via `workflow_runs.metadata.lock_held_pid`.
- **3 hooks Anthropic** (PromptSubmit, PostToolUse, Stop) capturando markers + lifecycle.
- **9 patrones de consolidation** detectados (P1-P9) con LLM enrichment opcional.
- **Iron Laws enforcer** (Laws 4, 5, 7, 8) en hooks pre-tool-use y user-prompt-submit.

### 8.2 Lo que falta (crítico para modelo team)

- ❌ **Cero export OTLP / SIEM**. `grep -r "OTLP\|OpenTelemetry\|otel"` → cero matches.
- ❌ **Cero retención** — `~/.codi/brain.db` crece sin límite.
- ❌ **Cero federación team** — DB es per-dev local. No agrega N developers.
- ❌ **Iron Laws hardcoded** — no configurables por preset (squad enterprise vs starter no pueden ajustar).
- ❌ **Postgres mode mencionado en comentarios** (`brain/schema.ts:1-9`) pero no implementado — solo SQLite.

### 8.3 Implicaciones

Para un squad real con compliance / auditoría centralizada, **el brain DB actual NO sirve a nivel squad**. Cada dev tiene su `brain.db` aislada. La regla `codi-production-mindset.md` exige instrumentación con OpenTelemetry desde el primer commit; el propio runtime no la cumple.

**Camino más corto**:

- T2: agregar OTLP exporter en `runtime/observability/otel-exporter.ts` que mapee `workflow_events` + `tool_calls` a OTel spans.
- T3: implementar Postgres mode en `openBrain()` (`brain/db.ts:9`) — el schema ya está pensado para soportarlo.

---

## 9. Roadmap revisado

### T1 (próximas 4 semanas) — REVISADO

Plan original: 3 acciones. Audit recomienda **4 acciones + 2 quick fixes de inconsistencias arquitectónicas**.

| #                 | Acción                                                                                               | Esfuerzo | Por qué                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| **T1.A1**         | Estandarizar `extends:` top-level + crear comandos `update --from-source` y `contribute --to-source` | 1.5 sem  | Plan T1 — pero ahora claro que es CREAR (no renaming). Schema change + 2 nuevos flags + reusar `installFromGithub`. |
| **T1.A2**         | Wizard `codi init` con git repo como primera pregunta + grabar `extends:` en `codi.yaml`             | 0.5 sem  | Plan T1 — solo reordenar prompts y persistir el campo.                                                              |
| **T1.A3**         | `codi audit --source` (cli/audit.ts NEW)                                                             | 1.5 sem  | Plan T1 — única feature 100% nueva. Combina `OperationsLedger` + `readLockFile` + `git ls-remote --tags`.           |
| **T1.A4** (NUEVO) | Sincronizar capability matrix con realidad de adapters                                               | 0.5 sem  | Audit §4.3 — bloquea cualquier check basado en capabilities.                                                        |
| **T1.A5** (NUEVO) | Deprecar `presetRegistry` (registry centralizado) — anti-feature                                     | 0.5 sem  | Audit §5.1 — conflictúa con modelo "git repo cualquiera".                                                           |
| **T1.A6** (NUEVO) | Renaming `preset-lock.json` → `codi.lock` con migration shim                                         | 0.5 sem  | Plan §6.3 — alineamiento con npm/Cargo. Migration shim para compat.                                                 |

**Total T1 revisado**: ~5 semanas (vs 4 del plan original). Aceptable: el extra cubre fundamentos que de otro modo se rompen en T2.

### T2 (3 meses) — REVISADO

Plan original: 6 features. Audit añade fixes de seguridad.

| #              | Acción                                                                                                                            | Esfuerzo | Por qué                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| T2.A1          | Modo `--git-mergetool` en conflict resolver                                                                                       | 0.5 sem  | Plan §6 — invocar `git mergetool` literal.                          |
| T2.A2          | GitHub Action template para CI weekly opt-in                                                                                      | 1 sem    | Plan §5 — `.github/workflows/codi-source-check.yml.tmpl`.           |
| T2.A3          | Notificación en issue tracker cuando hay updates                                                                                  | 1 sem    | Plan §5 — Action que abre/actualiza issue.                          |
| T2.A4 (NUEVO)  | Security scan en `pullFromSource` (`update.ts --from`)                                                                            | 0.5 sem  | Audit §6.8 — gap de seguridad real.                                 |
| T2.A5 (NUEVO)  | OTLP exporter en `runtime/observability/`                                                                                         | 2 sem    | Audit §8 — sin esto el modelo team no tiene observabilidad.         |
| T2.A6 (NUEVO)  | Crear preset `team-baseline` + 4 arquetipos (frontend-next, backend-api, python-fastapi, mobile-rn)                               | 2 sem    | Audit §7.1 — los presets actuales son por intensidad, no arquetipo. |
| T2.A7 (NUEVO)  | Workflow `team-feature.yaml` con fase peer-review                                                                                 | 1 sem    | Audit §7.2 — workflows actuales son single-dev.                     |
| T2.A8 (NUEVO)  | Refactor `init-wizard-paths.ts` (>700 LOC) + 5 archivos cerca                                                                     | 1 sem    | Audit §6.1 — cap CLAUDE.md.                                         |
| T2.A9 (NUEVO)  | Iron Laws configurables por preset                                                                                                | 1 sem    | Audit §8.2 — squads no pueden ajustar.                              |
| T2.A10 (NUEVO) | Eliminar anti-features deprecated (registry, brands, --from legacy, --interactive legacy, audit-log.ts huérfano, gemini fantasma) | 1 sem    | Audit §5 — limpieza.                                                |

**Total T2 revisado**: ~10-11 semanas distribuidas en 3 meses.

### T3 (12 meses)

| #     | Acción                                             |
| ----- | -------------------------------------------------- |
| T3.A1 | Postgres mode para BrainEventLog (federación team) |
| T3.A2 | Marketplace de presets via GitHub Pages index      |
| T3.A3 | DORA exporter desde BrainEventLog                  |
| T3.A4 | Cross-agent context server (MCP server de Codi)    |
| T3.A5 | Compliance dashboard local (`codi audit --html`)   |
| T3.A6 | Retención / pruning de brain.db                    |

---

## 10. Decisiones que el user debe tomar antes de implementar T1

Antes de empezar a codear, hay 5 decisiones binarias que cambian el alcance.

### D1 — `presetRegistry` vs `extends:` (Audit §4.1)

¿Deprecar `presetRegistry` (modelo registry centralizado) en favor de `extends` (modelo git repo cualquiera)? O mantener ambos con semánticas distintas.

**Recomendación**: deprecar `presetRegistry`. El plan team-first no lo necesita y simplifica el modelo conceptual.

### D2 — `hub` rename (Audit §4.4)

¿Renombrar `hub.ts` → `command-center.ts` y exports asociados? Refactor de 4 archivos pero coherencia conceptual con el plan.

**Recomendación**: sí, renombrar. Plan dice "el hub no existe", código no debería contradecir.

### D3 — Capability matrix vs adapters (Audit §4.3)

¿Actualizar matrix para reflejar realidad (Cursor SÍ tiene hooks, etc.) o refactor adapters para honrar matrix?

**Recomendación**: actualizar matrix. La realidad gana.

### D4 — Sistema A vs B de runtime hooks (Audit §4.5)

¿Fusionar `src/templates/hooks/runtime/*.sh` al pipeline de adapters, o mantenerlos separados como "Claude plugin paralelo"?

**Recomendación**: fusionar. Dos sistemas confunden y duplican.

### D5 — Lockfile rename `preset-lock.json` → `codi.lock`

¿Renombrar ahora con migration shim, o postponer a v2 mayor?

**Recomendación**: renombrar ahora. Migration shim es trivial. Alineamiento con npm/Cargo es valioso para la UX team.

---

## 11. Conclusiones

1. **El plan T1 es factible pero subestimaba el esfuerzo en 25%** (4 semanas → 5 semanas) por gaps reales no anticipados (extends top-level no existe, audit no existe, --to-hub jamás existió).

2. **El 80% del plumbing existe**: `installFromGithub`, lockfile, conflict resolver, `OperationsLedger`, parser de identifiers, security scanner, contribute con gh CLI. Reusar antes de crear.

3. **5 inconsistencias arquitectónicas deben resolverse junto con T1**: schema sin `extends:`, `presetRegistry` vs `extends`, capability matrix mintiendo, `hub` colisión semántica, dos sistemas de hooks runtime. Sin esto, T1 se construye sobre primitivas inestables.

4. **Anti-features deprecables**: 10 candidatos identificados. La limpieza paga compounding dividends para reducir surface area.

5. **Brain/observability es el gap más grande para modelo team REAL**: SQLite per-dev sin federación + sin OTel. Path crítico T2 incluye OTLP exporter.

6. **Presets actuales (por intensidad) NO encajan con el modelo arquetipo del plan** — falta `team-baseline` + 4-5 arquetipos. T2.A6.

7. **Workflows actuales son 100% single-dev** — falta `team-feature.yaml` con peer-review. T2.A7.

8. **Deuda técnica gestionable**: 6 archivos cerca/sobre 700 LOC, 3 overlaps de skills, 13 wizards con UX paralela, 1 bug de seguridad (`pullFromSource` sin scan), 1 bug menor (Cline/Windsurf brand skills 2x). Todo accionable en T2.A8/A10.

9. **Los 4 audit subagents llegaron a hallazgos consistentes** — alta confianza en el reporte.

10. **El próximo paso operativo correcto** es: (a) que el user resuelva las 5 decisiones D1-D5 de §10, (b) desglosar T1.A1 en tasks atómicas siguiendo el workflow `feature` de Codi, (c) empezar implementación.

---

## Apéndice A — Mapa de archivos auditados

**Preset/Source/Init/Contribute (Audit subagent #1)**:

- `src/cli/init.ts`, `init-wizard.ts`, `init-wizard-paths.ts`, `init-wizard-modify-add.ts`, `init-helpers.ts`
- `src/cli/preset-github.ts`, `preset.ts`, `preset-handlers.ts`, `preset-wizard.ts`
- `src/cli/update.ts`, `update-check.ts`
- `src/cli/contribute.ts`, `contribute-git.ts`, `onboard.ts`
- `src/core/preset/preset-applier.ts`, `preset-loader.ts`, `preset-registry.ts`, `preset-resolver.ts`, `preset-source.ts`, `preset-validator.ts`, `preset-zip.ts`
- `src/schemas/manifest.ts`, `preset.ts`
- `src/types/config.ts`, `src/constants.ts`, `src/utils/conflict-resolver.ts`

**Hooks/Adapters/Generator (Audit subagent #2)**:

- `src/core/hooks/` (28 archivos: hook-spec, hook-config-generator, hook-installer, hook-detector, heartbeat-hooks, registry/, renderers/, pre-commit-framework, stack-detector, auto-detection, hook-logic/)
- `src/templates/hooks/` (runner.js.tmpl, secret-scan.js.tmpl, file-size-check.js.tmpl, runtime/\*.sh, runtime/hooks.json)
- `src/adapters/` (claude-code, codex, cursor, cline, copilot, windsurf + permission-builder, section-builder, skill-generator, flag-instructions, brand-filter, generated-header, index)
- `src/core/generator/` (adapter-registry, apply, generator, prune-empty-adapter-dirs, index)
- `src/core/capabilities/` (matrix, plugin-manifest, publish, index)

**CLI surface (Audit subagent #3)**:

- `src/cli.ts` (entrypoint)
- 51 archivos en `src/cli/*.ts` (todos los comandos, wizards, helpers)

**Brain/Audit/Templates (Audit subagent #4)**:

- `src/runtime/brain-event-log.ts`, `iron-laws-enforcer.ts`, `event-factory.ts`, `reducer.ts`, `replay.ts`, `brain/`, `brain-ui/`, `capture/`, `consolidate/`, `cli-handlers/`, `llm/`
- `src/cli/audit/` (no existe), `src/cli/compliance.ts`
- `src/core/audit/audit-log.ts`, `operations-ledger.ts`
- `src/templates/{rules,skills,agents,presets,workflows,mcp-servers,consolidation,hooks}/` (inventario)
