# Comparativa profunda: SpecKit vs Codi Core — Reporte Final

- **Date**: 2026-05-11 23:06
- **Document**: 20260511*230655*[RESEARCH]\_speckit-vs-codi-final-comparative.md
- **Category**: RESEARCH
- **Scope**: Fases 4-6 consolidadas + reporte final con la estructura del brief original (secciones 1-20)
- **Documentos de evidencia previos**:
  - `20260511_222954_[RESEARCH]_speckit-deep-audit.md` — Fase 1 (SpecKit dossier)
  - `20260511_224243_[RESEARCH]_codi-core-deep-audit.md` — Fase 2 (Codi core dossier)
  - `20260511_225849_[RESEARCH]_speckit-vs-codi-functional-matrix.md` — Fase 3 (matriz 114 funcionalidades)
- **Criterio de "Mejor opción"**: adopción por equipos de desarrollo (ponderación: estandarización + sincronización + baja fricción + calidad + extensibilidad + mejora continua)

---

## 1. Resumen ejecutivo

**SpecKit** (`github/spec-kit`, paquete PyPI `specify-cli@0.8.6.dev0`) y **Codi** (paquete npm `codi-cli@3.0.0`) **no son sustitutivos**. Operan en capas distintas del problema "adoptar agentes de código en un equipo":

- **SpecKit** es un **toolkit de Spec-Driven Development cross-agent**: define el ciclo cognitivo (constitution → specify → plan → tasks → implement → analyze), genera prompts canónicos para **29 agentes**, y orquesta runs con un workflow engine YAML rico en step primitives.
- **Codi** es una **plataforma de configuración + runtime de agentes**: unifica artefactos (rules, skills, agents, presets, workflows) bajo un pipeline 3-niveles, intercepta tool calls reales con hooks deterministas, persiste evidencia en `brain.db` (SQLite + FTS5), y mantiene un loop de mejora continua con módulos TypeScript.

**Para un equipo de desarrollo que prioriza estandarización, sincronización, calidad y mejora continua**, el ganador absoluto es **Codi** por márgen sustancial (Fase 3: 59 vs 22 vs 33 empates en 114 funcionalidades). **Para un equipo que prioriza adopción rápida, breadth de agentes y un flujo SDD culturalmente claro**, **SpecKit** tiene ventaja inicial.

**Recomendación principal**: si hay que elegir solo una, **Codi** — porque su capa de interceptor + memoria + linting es estructuralmente más difícil de añadir a SpecKit que viceversa, mientras que el flujo SDD de SpecKit se puede emular dentro de Codi como un set de skills con `user-invocable: true`. La pérdida (slash-commands canónicos, 23 agentes adicionales, marketplace community) es real pero recuperable con trabajo TS razonable.

**Modelo híbrido recomendado**: Codi como plataforma base + SpecKit slash-commands re-implementados como skills Codi (`codi-specify`, `codi-plan`, `codi-tasks`, `codi-implement`, `codi-clarify`, `codi-analyze`, `codi-checklist`, `codi-constitution`) ejecutándose dentro del workflow engine de Codi y emitiendo capturas a brain.db.

---

## 2. Qué es SpecKit

CLI Python oficial de GitHub (Copyright GitHub Inc., MIT, autor: github/spec-kit) para Spec-Driven Development. Tres pilares:

1. **9 slash-commands canónicos SDD** renderizados al formato nativo de 29 agentes (Claude, Copilot, Cursor, Gemini, Windsurf, Codex, Opencode, Roo, Devin, etc.).
2. **Workflow engine YAML** con 10 step primitives declarativos (`command`, `shell`, `prompt`, `gate`, `if`, `switch`, `while`, `do-while`, `fan-out`, `fan-in`) + `RunState` persistente JSON resumible.
3. **Three-axis extensibility**: integrations (adapter por agente), extensions (capacidades nuevas con hooks `before_*/after_*`), presets (override con priority stack 4-tier).

Modelo mental (`spec-driven.md:7`):

> _"Specifications don't serve code — code serves specifications. (…) SDD eliminates the gap by making specifications and their concrete implementation plans born from the specification executable."_

Estado: pre-1.0 (v0.8.x), 20.795 LOC Python, 1.335 funciones test, 140 commits/30d, GitHub Inc. backing, 80+ community extensions catalogadas.

Detalle completo: `docs/20260511_222954_[RESEARCH]_speckit-deep-audit.md`.

---

## 3. Qué es Codi Core

CLI TypeScript (paquete `codi-cli@3.0.0`, MIT, autor `lehidalgo`) para configuración unificada de agentes IA. Tres pilares:

1. **Pipeline 3 niveles** (`src/templates/` → `.codi/` → `.<agent>/`) con generación idempotente cross-agente para **6 agentes target** (Claude Code, Cursor, Codex, Windsurf, Cline, GitHub Copilot).
2. **Runtime con interceptor real**: 5 hook events nativos del agente (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `SessionStart`, `Stop`) con exit code 0/2 deterministas + Iron Laws 1-9 enforcement.
3. **Brain persistente**: `~/.codi/brain.db` SQLite con 11 tablas + FTS5, capturas Iron Law 9 (`|TYPE: "verbatim"|`), `corrections` table, `workflow_runs/events`, brain-UI Hono local en `localhost:4477`.

Modelo mental (`README.md:6,10`):

> _"One config. Every AI agent. Zero drift."_
> _"Define your rules, skills, and workflows once in `.codi/` — Codi generates the correct configuration for Claude Code, Cursor, Codex, Windsurf, Cline, and GitHub Copilot automatically."_

Estado: v3.0.0, 66.260 LOC TS core + 147.747 LOC templates, 4.125 test cases en 295 archivos, 301 commits/30d, 1 mantenedor declarado.

Detalle completo: `docs/20260511_224243_[RESEARCH]_codi-core-deep-audit.md`.

---

## 4. Diferencia fundamental entre ambos

**En una frase**:

> SpecKit hace que el agente **sepa qué hacer** (instrucciones SDD canónicas cross-agent); Codi hace que la herramienta **controle qué hace** (interceptor de tool calls + brain + Iron Laws).

Desarrollo:

| Eje                      | SpecKit                                                    | Codi                                                               |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Plano de operación       | Plano cognitivo (prompts SDD)                              | Plano de plataforma (runtime + manifest + DB)                      |
| Mecanismo de gobernanza  | Declarativo: `constitution.md` + prompt-injected hooks     | Determinista: Iron Laws enforcer + exit code en `PreToolUse`       |
| Modelo de memoria        | Manifest SHA256 + workflow `RunState` JSON                 | Manifest contentHash + `brain.db` con FTS5 + captures + tool_calls |
| Relación con el agente   | Trust ("el LLM debe respetar la constitution y los hooks") | Intercept ("intentas Edit, el hook decide")                        |
| Unidad de extensibilidad | Extension (YAML + commands + hooks-as-text)                | Skill (TS template + frontmatter Zod + evals + references)         |
| Filosofía                | Specs son código fuente                                    | Manifest + captures + workflow_events son la verdad                |

**Implicación**: las herramientas no compiten por el mismo nicho. SpecKit compite con frameworks SDD (BDD/ATDD modernos) y wrappers de agente. Codi compite con plataformas de DevEx para agentes IA (categoría más joven; pocos competidores directos).

---

## 5. Mapa funcional lado a lado

Matriz completa con 114 funcionalidades evaluadas en 10 áreas: ver `docs/20260511_225849_[RESEARCH]_speckit-vs-codi-functional-matrix.md`.

**Resumen del recuento "Mejor opción para equipos"**:

| Área                | SpecKit | Codi   | Empate | Total   |
| ------------------- | ------- | ------ | ------ | ------- |
| 1. Propósito        | 0       | 1      | 5      | 6       |
| 2. Especificación   | 6       | 4      | 0      | 10      |
| 3. Agentes          | 4       | 5      | 2      | 11      |
| 4. Artefactos       | 1       | 6      | 4      | 11      |
| 5. Equipo           | 1       | 7      | 3      | 11      |
| 6. Calidad          | 0       | 9      | 2      | 11      |
| 7. Observabilidad   | 0       | 12     | 1      | 13      |
| 8. Extensibilidad   | 4       | 4      | 4      | 12      |
| 9. DX               | 4       | 4      | 5      | 13      |
| 10. Madurez técnica | 2       | 7      | 7      | 16      |
| **TOTAL**           | **22**  | **59** | **33** | **114** |

---

## 6. Solapamientos

Funcionalidades cubiertas por ambos con propósito equivalente (implementaciones distintas):

| Funcionalidad                               | SpecKit                                                              | Codi                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Multi-agente desde single source            | 29 integrations renderizan slash-commands                            | 6 adapters renderizan rules/skills/agents                                                        |
| Manifest con hash para preservar user edits | `IntegrationManifest` SHA256 file-level                              | `artifact-manifest.json` contentHash + `managed_by`                                              |
| Idempotent install + upgrade                | `specify integration upgrade`                                        | `codi update` con `upgrade-detector.ts`                                                          |
| Air-gapped por default                      | Bundle vía `force-include` en wheel                                  | Templates embebidos como strings TS                                                              |
| Preset system                               | 3 builtin (`lean`, `self-test`, `scaffold`) + catalog HTTP/git/local | 6 builtin (`minimal`, `balanced`, `strict`, `fullstack`, `dev`, `power-user`) + github/zip/local |
| Workflow engine con runs persistentes       | YAML + `RunState` JSON                                               | YAML + `workflow_runs/events` SQLite                                                             |
| Gates humanos                               | `gate` step con `on_reject:abort`                                    | Iron Law 4: `'ok'\|'OK'\|'Ok'` enforced                                                          |
| Resume de workflow interrumpido             | `specify workflow resume <id>`                                       | `codi workflow recover`                                                                          |
| Separación core ↔ artefactos reemplazables  | Priority stack 4-tier documentado                                    | Pipeline 3 niveles + `managed_by` ownership                                                      |
| Cross-platform                              | Bash + PowerShell scripts mirror                                     | Node ESM + scripts shell                                                                         |
| CLI conversacional + headless               | typer + rich, flags non-interactive                                  | commander + @clack/prompts, `--json` global                                                      |
| Versionado de artefactos                    | semver por extension/preset/workflow                                 | int monotonic por skill/rule/agent                                                               |
| Validación de schemas                       | Per-area validation (workflows, extensions, presets)                 | Zod schemas centralizados + JSON Schemas runtime                                                 |
| Documentation site                          | docs/ + GitHub Pages                                                 | docs/ + Astro + typedoc + pagefind                                                               |
| CI matriz cross-OS                          | Ubuntu + Windows × Python 3.11-3.13                                  | Test + Release + back-merge + installer-test + pages                                             |
| Licencia MIT permissive                     | GitHub Inc.                                                          | lehidalgo                                                                                        |

---

## 7. Diferencias clave

| Dimensión                    | SpecKit                                                                                                                                | Codi                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Cobertura agentes            | 29 builtin integrations                                                                                                                | 6 adapters                                                         |
| Slash-commands canónicos     | 9 (`/speckit.specify`, `/plan`, `/tasks`, `/implement`, `/clarify`, `/analyze`, `/checklist`, `/constitution`, `/taskstoissues`)       | 0 canónicos; skills con `user-invocable: true`                     |
| Constitution artefacto       | Sí — `constitution.md` con principios del proyecto                                                                                     | No artefacto; Iron Laws + `team-charter` skill                     |
| Step primitives YAML         | 10 declarativos (`command`, `shell`, `prompt`, `gate`, `if`, `switch`, `while`, `do-while`, `fan-out`, `fan-in`) + expresiones `{{ }}` | 0 declarativos; fases+gates+chains+TS adapter callbacks            |
| Hooks model                  | `before_*/after_*` trust-based: prompt instruye al LLM a emitir `EXECUTE_COMMAND:`                                                     | 5 runtime events deterministas con exit code 0/2                   |
| Memoria persistente          | RunState JSON por workflow                                                                                                             | brain.db SQLite 11 tablas + FTS5 + vec0 placeholder                |
| Captura de prompts/responses | "Planned enhancement"                                                                                                                  | Iron Law 9: `\|TYPE: "verbatim"\|` con 11 tipos + dedupe           |
| Loop mejora continua         | Manual (PRs)                                                                                                                           | `feedback-collector` + `skill-improver` + `skill-stats` TS modules |
| UI observabilidad            | No                                                                                                                                     | Hono server local en `:4477` + 7 HTML pages + REST v1 + SSE        |
| Lint pre-PR específico       | Validación per-area                                                                                                                    | `codi contribute lint` (9 checks)                                  |
| Pre-commit hooks instalados  | No instala git hooks                                                                                                                   | husky + ~17 hooks generados                                        |
| Catalog público              | 80+ extensions community catalogadas                                                                                                   | No marketplace público (infra lista)                               |
| `<agent>rules` mono-archivo  | No genera                                                                                                                              | Genera `.cursorrules`, `.windsurfrules`, `.clinerules`             |
| Verification token           | No mecanismo declarado                                                                                                                 | `codi verify` + token en `CLAUDE.md`                               |
| Backup/revert                | No mecanismo built-in                                                                                                                  | `codi backup` + `codi revert <timestamp>`                          |
| Adapter writing effort       | Subclase Python `IntegrationBase` ~30-50 LOC                                                                                           | TS class ~100-600 LOC                                              |
| Audit trail                  | Manifest + git history                                                                                                                 | `audit-log.jsonl` + `operations-ledger.json` + `workflow_events`   |
| Bus factor                   | Alto (GitHub Inc.)                                                                                                                     | Bajo (1 mantenedor declarado)                                      |
| Madurez nominal              | Pre-1.0 (v0.8.x)                                                                                                                       | v3.0.0                                                             |

---

## 8. Capacidades únicas de SpecKit (no en Codi)

1. **9 slash-commands SDD canónicos cross-agent** con manifesto cultural detrás (`/speckit.specify` ↔ `/speckit.plan` ↔ `/speckit.tasks` ↔ `/speckit.implement` + `/clarify`, `/analyze`, `/checklist`, `/constitution`, `/taskstoissues`).
2. **23 agentes adicionales** sin equivalente en Codi: agy, amp, auggie, bob, codebuddy, cursor-agent, devin, forge, gemini, generic, goose, iflow, junie, kilocode, kimi, kiro-cli, opencode, pi, qodercli, qwen, roo, shai, tabnine, trae, vibe.
3. **10 step primitives YAML declarativos** que permiten escribir workflows complejos sin tocar código (`if/switch/while/do-while/fan-out/fan-in` + expresiones `{{ }}`).
4. **`constitution.md` como artefacto de proyecto** — un dev abre `/speckit.constitution`, edita el archivo y el agente lo respeta declarativamente en cada fase SDD.
5. **Catalog community con 80+ extensions** ya catalogadas — ecosistema en formación con curación HTTP/git/local.
6. **Manifesto SDD (`spec-driven.md`, 25 KB)** — narrativa coherente que facilita adopción cultural ("specs son el código fuente"; "code is the last mile").
7. **Bus factor institucional**: respaldo de GitHub Inc. — mantenibilidad de largo plazo más predecible.
8. **Branch numbering schemas** (sequential/timestamp) en la extension `git` para spec-tree por feature.
9. **Spec-tree filesystem** (`specs/<NNN>-<slug>/{spec,plan,tasks,research}.md`) — artefactos SDD por feature visibles en repo, navegables sin tooling.
10. **`SkillsIntegration` específica para Claude Code skills format** — generación de SKILL.md con subdirectorios.

---

## 9. Capacidades únicas de Codi (no en SpecKit)

1. **PreToolUse/PostToolUse interceptor real con exit code** — bloquea `Edit`, `Write`, `NotebookEdit`, `Bash` en runtime, no por instrucción al LLM. Diferenciador cardinal.
2. **brain.db SQLite (11 tablas + FTS5 + vec0 placeholder)** — persistencia estructurada de sesiones, prompts, turns, captures, tool_calls, corrections, artifacts_used, workflow_runs, workflow_events, workflow_definitions.
3. **Iron Law 9 capture marker system** — formato estricto `|TYPE: "verbatim"|` con 11 tipos canónicos, parser conservativo, dedupe idempotente por `(turn_id, raw_marker)`.
4. **Iron Laws 1-9 enforcement runtime** — Law 4 (gate `'ok'`), Law 7 (git mutation `'ok'`), Law 9 (captures), Law 8 (caveman output mode), etc.
5. **Loop mejora continua con código TS** — `evals-manager`, `feedback-collector`, `skill-stats`, `skill-improver`, `version-manager`, `skill-export` (módulos en `src/core/skill/`).
6. **Brain-UI Hono local en `:4477`** — 7 HTML pages (dashboard, sessions, captures, tool-calls, workflows, artifacts, settings, shell) + REST v1 API + SSE.
7. **`codi contribute lint` con 9 checks** específicos de Codi (no edits to generated, evals required, description ≤1500, chains declared, no `--no-verify`, doc naming, etc.).
8. **17+ pre-commit hooks instalados via husky + `setup-husky-hooks.mjs`** — gitleaks, secret-scan, ruff, bandit, shellcheck, skill YAML validate, brand skill validate, artifact validate, template wiring.
9. **`<agent>rules` mono-archivo** generation para Cursor (`.cursorrules`), Windsurf (`.windsurfrules`), Cline (`.clinerules`) — soporte de formato legacy.
10. **`codi backup` + `codi revert <timestamp>`** — snapshots de `.codi/` y artefactos generados con restore selectivo.
11. **`audit-log.jsonl` append-only + `operations-ledger.json`** — auditoría event-sourced de cada generate/update/install.
12. **Verification token** en `CLAUDE.md` + `codi verify` — mecanismo declarativo para confirmar adopción.
13. **`codi plugin publish`** — empaquetado como Claude Code plugin para distribución.
14. **Heartbeat hooks** específicos de Codex (`isHeartbeatEnabled` en codex adapter).
15. **`codi quick`** — workflow trivial sin overhead de phase chain (categorías cerradas: typo, comment, dep-bump, format, doc-tweak).
16. **`team-consolidation` workflow** — workflow específico para alinear/consolidar artefactos cross-developer.

---

## 10. Evaluación para equipos (Fase 5 — scoring 1-5)

Escala: 1 (ausente o malo) · 2 (parcial / requiere effort) · 3 (cumple) · 4 (sólido) · 5 (excelente / clase A).

| Criterio                                          | Peso | SpecKit | Codi  | Ganador | Justificación                                                                                                                                                          |
| ------------------------------------------------- | ---- | ------- | ----- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Facilidad de adopción por developers              | 5    | **4**   | **3** | SpecKit | SpecKit: 7 conceptos, `init` un comando, 9 slash-commands evidentes. Codi: ~15 conceptos, Command Center rica pero requiere internalizar 3-layer pipeline + Iron Laws. |
| Baja fricción en el día a día                     | 5    | **4**   | **3** | SpecKit | SpecKit: slash-commands naturalmente conversacional. Codi: Iron Law 4 estricto (`'ok'` exact) + vocabulario amplio.                                                    |
| Sincronización entre miembros                     | 5    | **3**   | **4** | Codi    | Ambos via git + manifest. Codi añade `managed_by` ownership + verification token + auto-merge back-merge + AGENTS.md auto-gen.                                         |
| Estándares compartidos                            | 5    | **3**   | **5** | Codi    | SpecKit: constitution declarativa + priority stack. Codi: Iron Laws 1-9 enforced + 31 rules + 9-check lint + pre-commit hooks.                                         |
| Capacidad de evolucionar iterativamente           | 4    | **2**   | **5** | Codi    | SpecKit: manual via PRs. Codi: `evolve`, `feedback`, `stats`, `improver` con TS modules.                                                                               |
| Onboarding de nuevos developers                   | 4    | **4**   | **3** | SpecKit | SpecKit: manifesto + 9 comandos = curva clara. Codi: Command Center + presets, pero ~15 conceptos a digerir.                                                           |
| Gobernanza sin burocracia excesiva                | 4    | **3**   | **4** | Codi    | SpecKit: constitution + gates (declarativo). Codi: Iron Laws + 9-check lint + audit ledger — más enforcement, también más reglas a entender.                           |
| Calidad sin bloqueo innecesario                   | 4    | **3**   | **4** | Codi    | Codi: hooks con exit code 2 puede bloquear, pero fail-open por timeout. SpecKit: gates abortan workflow.                                                               |
| Compatibilidad con flujos Git                     | 4    | **4**   | **5** | Codi    | Codi: 17+ pre-commit hooks integrados, contribute lint, branch protection cultural. SpecKit: scripts git-aware vía extension, no pre-commit.                           |
| Compatibilidad con CI/CD                          | 3    | **4**   | **4** | Empate  | Ambos profesionales: matriz multi-OS, lint, codeql/gitleaks, publish gating.                                                                                           |
| Claridad de ownership                             | 4    | **3**   | **5** | Codi    | SpecKit: SHA file-level. Codi: `managed_by` declarativo + manifest + provenance (`github:org/repo@sha`).                                                               |
| Trazabilidad de cambios                           | 4    | **2**   | **5** | Codi    | SpecKit: git history + manifest. Codi: audit-log.jsonl + operations-ledger + workflow_events + captures + tool_calls.                                                  |
| Capacidad de escalar a varios equipos             | 3    | **4**   | **3** | SpecKit | SpecKit: catalog HTTP/git/local + community ecosystem 80+. Codi: external-source listo, marketplace ausente.                                                           |
| Capacidad de adaptarse a distintos agentes        | 4    | **5**   | **3** | SpecKit | SpecKit: 29 builtin + adapter Python ~30-50 LOC. Codi: 6 builtin + adapter TS ~100-600 LOC.                                                                            |
| Riesgo de que el equipo no adopte (anti-adopción) | 5    | **3**   | **3** | Empate  | SpecKit: gaps "planned enhancement" + hooks trust-based pueden frustrar a senior. Codi: Iron Laws estrictas + vocabulario amplio pueden frustrar a junior.             |
| Mejora continua del propio tooling                | 4    | **2**   | **5** | Codi    | Codi: TS modules + brain queries + skills declarativas (`codi-skill-reporter`, `codi-dev-refine-rules`). SpecKit: PRs manuales.                                        |
| Observabilidad operacional                        | 4    | **1**   | **5** | Codi    | SpecKit: 0 telemetría built-in. Codi: brain.db + brain-UI + REST + SSE.                                                                                                |
| Bus factor / sostenibilidad a largo plazo         | 3    | **5**   | **2** | SpecKit | GitHub Inc. backing vs 1 dev declarado.                                                                                                                                |
| Madurez nominal                                   | 2    | **3**   | **4** | Codi    | v0.8.x pre-1.0 vs v3.0.0 estable.                                                                                                                                      |
| Cobertura de test del propio core                 | 2    | **4**   | **5** | Codi    | 1.335 vs 4.125 test cases.                                                                                                                                             |

**Puntuación ponderada** (suma de `peso × score`):

- **SpecKit**: 5×4 + 5×4 + 5×3 + 5×3 + 4×2 + 4×4 + 4×3 + 4×3 + 4×4 + 3×4 + 4×3 + 4×2 + 3×4 + 4×5 + 5×3 + 4×2 + 4×1 + 3×5 + 2×3 + 2×4 = 20+20+15+15+8+16+12+12+16+12+12+8+12+20+15+8+4+15+6+8 = **254**
- **Codi**: 5×3 + 5×3 + 5×4 + 5×5 + 4×5 + 4×3 + 4×4 + 4×4 + 4×5 + 3×4 + 4×5 + 4×5 + 3×3 + 4×3 + 5×3 + 4×5 + 4×5 + 3×2 + 2×4 + 2×5 = 15+15+20+25+20+12+16+16+20+12+20+20+9+12+15+20+20+6+8+10 = **311**

**Resultado ponderado**: **Codi 311 vs SpecKit 254** (~22% ventaja a favor de Codi para el caso de uso "equipo de desarrollo con prioridad a sincronización + calidad + mejora continua").

**Subtotales por bloque**:

| Bloque                                                 | SpecKit                                                         | Codi                | Ganador            |
| ------------------------------------------------------ | --------------------------------------------------------------- | ------------------- | ------------------ |
| Adopción / DX (criterios 1, 2, 6)                      | 12+8+6 = 26                                                     | 8+6+6 = 20 (peor)   | SpecKit            |
| Sincronización / Estándares / Calidad (3, 4, 7, 8, 11) | 12+8+4+5+5 = pesos 5+5+4+4+4=22 → ponderado 15+15+12+12+12 = 66 | 20+25+16+16+20 = 97 | Codi               |
| Trazabilidad / Observabilidad / Mejora (5, 12, 16, 17) | 8+8+8+4 = pesos 4+4+4+4=16 → ponderado 8+8+8+4 = 28             | 20+20+20+20 = 80    | Codi               |
| Agentes / Escalabilidad (13, 14)                       | 12+20 = 32                                                      | 9+12 = 21           | SpecKit            |
| Madurez / Bus factor (18, 19, 20)                      | 15+6+8 = 29                                                     | 6+8+10 = 24         | SpecKit (marginal) |

Lectura: **SpecKit gana en adopción inicial, breadth de agentes y bus factor; Codi gana en todo el bloque operativo (sincronización, estándares, calidad, trazabilidad, observabilidad, mejora continua)** por márgen amplio.

---

## 11. Fricción de adopción

| Aspecto                           | SpecKit                                                                  | Codi                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Comando inicial                   | `specify init`                                                           | `codi init` (wizard)                                                                        |
| Vocabulario nuevo                 | ~7 conceptos                                                             | ~15 conceptos                                                                               |
| Primer comando útil               | `/speckit.specify "..."`                                                 | `codi workflow run feature "..."` o `/codi-plan-writing`                                    |
| Curva post-init                   | Media (entender SDD + workflow YAML + presets)                           | Alta (entender 3 layers + Iron Laws + brain)                                                |
| Confusion frecuente               | "¿Cuándo `/clarify` vs `/specify`?", "¿qué hace cada hook before/after?" | "¿Por qué `codi generate` no recoge mi edit?" (Layer 1 vs Layer 2), "¿qué dice Iron Law 4?" |
| Tiempo a primer commit productivo | < 1 día                                                                  | 1-3 días                                                                                    |
| Reversibilidad de errores         | Manual (git revert)                                                      | `codi revert <timestamp>` + `codi backup`                                                   |
| Documentación inicial recomendada | `README.md` + `spec-driven.md`                                           | `README.md` + `CLAUDE.md` + AGENTS.md fragmento                                             |

**Veredicto**: SpecKit tiene menos fricción **el día 1**; Codi tiene menos fricción **el día 30** (porque sus mecanismos preventivos reducen errores acumulados). Para equipos pequeños y proyectos cortos: ventaja SpecKit. Para equipos medianos+ y proyectos largos: ventaja Codi.

---

## 12. Sincronización y estándares

**SpecKit**:

- `.specify/` versionado en git como source of truth.
- Priority stack 4-tier: overrides > presets > extensions > core.
- `IntegrationManifest` SHA256 preserva user edits en upgrades.
- Catalog HTTP/git/local para distribuir presets/extensions/workflows entre equipos.
- Constitution declarativa que el agente respeta (sin enforcement programático).

**Codi**:

- `.codi/` versionado + `artifact-manifest.json` con `contentHash` + `managed_by` + provenance (`github:org/repo@sha`, `zip:`, `local:`).
- `codi update` detect-only con clasificación `up-to-date/outdated/new/removed/user-managed`.
- `codi contribute lint` (9 checks) bloquea PRs anti-pattern.
- Iron Laws 1-9 enforced runtime: el equipo no puede violar gobernanza accidentalmente.
- Verification token en `CLAUDE.md` para confirmar adopción.
- `back-merge.yml` auto-merge main→develop.
- AGENTS.md auto-generado (149 KB) como catálogo navegable.

**Veredicto**: **Codi tiene capa de sincronización significativamente más sofisticada** (ownership declarativo + enforcement runtime + lint específico + auto-merge + auditoría). SpecKit tiene capa de distribución más madura (community catalog 80+) pero menos enforcement.

---

## 13. Calidad y gobernanza

| Mecanismo                 | SpecKit                              | Codi                                                                    |
| ------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| Reglas declarativas       | Constitution + presets + extensions  | 31 rules + Iron Laws 1-9                                                |
| Enforcement runtime       | No (trust-based hooks)               | PreToolUse exit code 2 + Iron Laws enforcer                             |
| Schema validation         | YAML + JSON Schemas parciales        | Zod schemas + JSON Schemas runtime + `validate-codi-artifacts` (4/9 v1) |
| Lint pre-PR               | Per-area (`validate_workflow`, etc.) | `codi contribute lint` 9 checks                                         |
| Pre-commit hooks          | No instala                           | husky + 17 hooks                                                        |
| Tests density             | 1.335 cases / 56 archivos            | 4.125 cases / 295 archivos                                              |
| Quality gates en workflow | `gate` step con `on_reject:abort`    | Iron Law 4 `'ok'` strict                                                |
| Captura de defectos       | No                                   | `corrections` table + `DEFECT` capture type                             |
| Auditoría                 | Manifest + git history               | audit-log.jsonl + operations-ledger + workflow_events                   |

**Veredicto**: **Codi tiene plataforma de calidad sustancialmente más completa**. SpecKit confía en cultura + git workflow; Codi confía en runtime enforcement + lint + auditoría event-sourced.

---

## 14. Extensibilidad y evolución

| Eje                       | SpecKit                                                     | Codi                                                      |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| Plugin model              | Extensions con `extension.yml` + commands + hooks + scripts | Skills + agents + rules + presets + `codi plugin publish` |
| Hooks declarativos        | `before_*/after_*` YAML por fase SDD (trust-based)          | `hooks.json` con 5 events runtime + TS handlers           |
| Workflows custom          | YAML con 10 step types declarativos                         | YAML phases + TS adapter                                  |
| Catalog público           | HTTP/git/local con 80+ community ya catalogadas             | Infra externa (external-source) sin marketplace público   |
| Adapter para agente nuevo | Subclase Python `IntegrationBase` ~30-50 LOC                | TS class implementando Adapter ~100-600 LOC               |
| API programable           | No (solo CLI)                                               | REST v1 + SSE en `:4477`                                  |
| Versionado semver         | Sí (extension/preset/workflow)                              | int monotonic por artefacto                               |
| Plugin packaging          | Extensions distribuibles via catalog                        | Codi plugin (Claude Code plugin format)                   |

**Veredicto**: **SpecKit más fácil de extender a nuevos agentes**; **Codi más fácil de extender programáticamente** (API REST + SSE). Para equipos que quieren plugins community: SpecKit. Para equipos que quieren integrar con tooling propio (dashboards, CI custom): Codi.

---

## 15. Observabilidad y mejora continua

**SpecKit**:

- 0 telemetría built-in.
- "Full stdout/stderr capture is a planned enhancement" (`steps/command/__init__.py:25`).
- Sin loop de feedback.
- Sin métricas.
- Mejora via PRs manuales.

**Codi**:

- brain.db SQLite con 11 tablas + FTS5: `sessions`, `prompts`, `turns`, `captures`, `tool_calls`, `corrections`, `artifacts_used`, `workflow_runs`, `workflow_events`, `workflow_definitions`, `_codi_schema_version`.
- Iron Law 9 capture markers: 11 tipos canónicos persistidos por turn.
- Brain-UI Hono en `localhost:4477`: 7 HTML pages + REST v1 + SSE.
- `src/core/skill/`: `evals-manager`, `feedback-collector`, `skill-stats`, `skill-improver`, `version-manager`, `skill-export`.
- `codi skill {feedback, stats, evolve, versions, export}`.
- `team-consolidation` workflow para alinear cross-developer.
- Audit-log.jsonl event-sourced.

**Veredicto**: **No hay comparación**. Codi gana 12-0 en esta área. SpecKit no tiene observabilidad operacional; Codi tiene plataforma completa. Si el equipo quiere aprender del uso, **solo Codi lo soporta**.

---

## 16. Madurez técnica

| Métrica                           | SpecKit                                                                       | Codi                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Versión                           | 0.8.6.dev0 (pre-1.0)                                                          | 3.0.0                                                                                       |
| LOC core                          | 20.795 Python                                                                 | 66.260 TS                                                                                   |
| Tests                             | 1.335 funciones / 56 archivos                                                 | 4.125 cases / 295 archivos / 54.084 LOC                                                     |
| Ratio test/code                   | ~0.07 (funciones por LOC)                                                     | ~0.82 (LOC test / LOC core)                                                                 |
| Frameworks                        | pytest + ruff + markdownlint + CodeQL                                         | vitest + pytest + tsc + eslint + prettier + ruff + bandit + shellcheck + gitleaks + codecov |
| Commits 30d                       | 140                                                                           | 301                                                                                         |
| CI workflows                      | 8 (test, lint, codeql, docs, release, release-trigger, catalog-assign, stale) | 5 (ci, release, back-merge, installer-test, pages)                                          |
| Mantenedores declarados           | GitHub Inc. + community PRs                                                   | 1 (`lehidalgo`) + 0 community visible                                                       |
| Comentarios "planned/TODO" en src | ≥3 explícitos                                                                 | 24                                                                                          |
| Bus factor                        | Alto (institucional)                                                          | Bajo (1 dev)                                                                                |
| Documentación                     | README 56k + manifesto 25k + docs site                                        | README 15k + AGENTS 149k auto-gen + CHANGELOG 78k + Astro docs                              |
| Cross-platform                    | Bash + PowerShell mirror explícito                                            | Node ESM cross-OS + scripts shell                                                           |
| Actions pinneadas SHA             | Sí                                                                            | Sí                                                                                          |

**Veredicto**: **Codi más maduro técnicamente** (3× LOC, 3× tests, ratio test/code superior, schemas Zod estrictos, v3 estable). **SpecKit más maduro institucionalmente** (GitHub Inc. backing, community catalog, ecosistema). Ambos tienen riesgos: SpecKit por pre-1.0 + gaps planned; Codi por bus factor de 1.

---

## 17. Complementariedad o sustitución (Fase 4)

**Relación recomendada**: **complementariedad en capas**, no sustitución.

**Justificación basada en evidencia**:

1. **Capa cognitiva (SpecKit) vs capa operativa (Codi)** — operan en planos diferentes del problema "adoptar agentes IA en equipo". Un equipo necesita ambas:
   - Capa cognitiva: ¿cuál es el flujo SDD? ¿cuándo specs, cuándo plan, cuándo tasks? ¿cuándo el agente debe pausar para review?
   - Capa operativa: ¿cómo enforce esa cultura? ¿cómo medimos compliance? ¿cómo aprendemos de defectos?

2. **Tests del solapamiento — ¿podría SpecKit reemplazar a Codi?**
   - SpecKit no tiene PreToolUse interceptor → pierdes enforcement determinista.
   - SpecKit no tiene brain.db → pierdes memoria y mejora continua.
   - SpecKit no tiene `<agent>rules` mono-archivo → pierdes generación para Cursor/Cline/Windsurf legacy.
   - SpecKit no tiene `codi contribute lint` → pierdes 9 checks específicos.
   - **Respuesta**: No. Faltan capacidades estructurales.

3. **Tests del solapamiento — ¿podría Codi reemplazar a SpecKit?**
   - Codi no tiene los 9 slash-commands SDD canónicos → pierdes cultura SDD nombrada.
   - Codi no tiene 23 agentes adicionales → pierdes breadth.
   - Codi no tiene step primitives YAML → pierdes `if/switch/fan-out` declarativos.
   - Codi no tiene constitution-as-artifact → pierdes documento de "ley del proyecto" legible por humanos.
   - **Respuesta**: Parcialmente. Las brechas son recuperables con trabajo: crear skills `codi-specify`, `codi-plan`, etc.; escribir nuevos TS adapters; emular step primitives con sub-workflows. **No es trivial, pero es factible**.

4. **Asimetría de costos de integración**: añadir Codi-features a SpecKit (interceptor + brain) requiere **reescribir la arquitectura runtime** de SpecKit; añadir SpecKit-features a Codi (slash-commands SDD + más agentes) requiere **agregar skills + adapters** — trabajo aditivo, no arquitectural. Esta asimetría favorece elegir Codi como base si se va a integrar una sola.

**Recomendación**: Codi como **base plataforma**; SpecKit como **patrón a internalizar** dentro de Codi.

---

## 18. Recomendación si hay que elegir una

**Si hay que elegir una sola herramienta para un equipo de desarrollo: → Codi**.

**Razones (Fase 5 ponderada confirma)**:

1. **311 vs 254 puntos ponderados** (~22% ventaja Codi).
2. **Codi gana 59-22-33 en 114 funcionalidades** (Fase 3).
3. **Capa operativa irrecuperable**: enforcement runtime, brain persistente, loop mejora — no se puede emular con SpecKit.
4. **Capa cognitiva de SpecKit recuperable**: los 9 slash-commands se pueden implementar como skills Codi en 2-4 semanas de trabajo.
5. **Madurez técnica nominal superior** (v3 vs pre-1.0; 3× tests; 2× commits/30d).
6. **Asimetría a favor**: añadir SpecKit-features a Codi es aditivo; añadir Codi-features a SpecKit es arquitectural.

**Qué se pierde al elegir Codi solo (gaps a mitigar)**:

| Pérdida                                        | Severidad para equipo                       | Mitigación posible                                                                           |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 9 slash-commands SDD canónicos                 | Alta (cultural)                             | Reescribir como `codi-specify`, `codi-plan`, etc. en `src/templates/skills/`                 |
| Constitution-as-artifact                       | Media                                       | Crear `codi-constitution` skill + rule `codi-constitution-enforcement`                       |
| 23 agentes target adicionales                  | Variable (depende del stack del equipo)     | Escribir TS adapters caso por caso                                                           |
| Step primitives YAML (`if/switch/fan-out/...`) | Media (para autores de workflows complejos) | Emular vía sub-workflows + adapter callbacks; o añadir step primitives al runtime de Codi    |
| Catalog community 80+ extensions               | Media                                       | Construir registry público o usar `external-source/connectors` con repos GitHub privados     |
| Bus factor (1 dev)                             | Alta                                        | Mitigación social, no técnica: contribuciones community, fork interno, contractar mantenedor |
| Manifesto SDD cultural                         | Baja (recuperable)                          | Documentar "Codi SDD" pattern internamente                                                   |

**Cuándo NO elegir Codi y sí SpecKit** (casos límite):

1. **Equipo pequeño (<5 devs) + proyecto corto (<3 meses)**: la curva de Codi (~15 conceptos) no se amortiza; SpecKit es más rápido a productividad.
2. **Stack diverso de agentes** (≥ 4 agentes target con ≥ 2 fuera del set Codi: gemini, opencode, devin, roo, etc.): SpecKit cubre out-of-the-box.
3. **Cultura SDD ya internalizada en el equipo**: SpecKit nombra lo que ya hacéis.
4. **Tolerancia baja a bus factor**: GitHub Inc. backing es razón legítima para preferir SpecKit.
5. **Necesidad de marketplace community ya formado**: 80+ extensions vs 0.

---

## 19. Roadmap recomendado

### 19.1 Adopción inmediata (semanas 1-2)

1. **Instalar Codi en el repo principal del equipo**:
   ```bash
   pnpm dlx codi-cli init --preset codi-balanced
   ```
2. **Generar para los 6 agentes target soportados** (Claude Code, Cursor, Codex, Windsurf, Cline, Copilot):
   ```bash
   codi generate
   ```
3. **Wirear hooks runtime** en `.claude/settings.local.json` (Codi lo hace automáticamente via `hook-installer.ts`).
4. **Establecer Iron Laws como cultura**: pegar `CLAUDE.md` + verification token + `team-charter` skill en el repo. Sesión de onboarding del equipo (1 hora) explicando 9 Iron Laws.
5. **Activar `codi contribute lint` en CI**:
   ```yaml
   - run: pnpm dlx codi-cli contribute lint --base main
   ```
6. **Lanzar brain-UI local** para que cada dev pueda inspeccionar sus sesiones:
   ```bash
   codi brain ui
   ```

**Hito**: cada PR pasa `codi contribute lint`; cada commit dispara hooks runtime; brain.db registra sesiones.

### 19.2 Corto plazo (semanas 3-8)

1. **Implementar SDD slash-commands en Codi** (gap principal vs SpecKit):
   - Crear 9 skills: `codi-specify`, `codi-plan`, `codi-tasks`, `codi-implement`, `codi-clarify`, `codi-analyze`, `codi-checklist`, `codi-constitution`, `codi-taskstoissues`.
   - Cada skill con `user-invocable: true`, `description ≤ 1500 chars`, `evals/evals.json`, frontmatter Zod-validada.
   - Ubicación: `src/templates/skills/codi-<verb>/template.ts` + `.codi/skills/codi-<verb>/` tras `codi add`.
2. **Crear `feature-sdd` workflow** que encadene los 9 slash-commands como `chains:` por fase:
   ```yaml
   id: feature-sdd
   phases:
     intent:
       chains: [{ skill: codi-specify, role: required }]
     clarify:
       chains: [{ skill: codi-clarify, role: optional }]
     plan:
       chains: [{ skill: codi-plan, role: required }]
     # ... tasks, implement, analyze
   ```
3. **Establecer `constitution.md` convention**: archivo `docs/[ADR]_constitution.md` con principios del proyecto. Skill `codi-constitution` lee y reinyecta en SessionStart.
4. **Auditar gaps de cobertura agentes**: si el equipo usa Gemini, opencode, devin → priorizar adapter TS.
5. **Activar pre-commit framework completo**:
   ```bash
   codi hooks add pre-commit codi-skill-yaml-validate
   codi hooks add pre-commit codi-secret-scan
   # ... rest
   ```

**Hito**: el equipo trabaja con `/codi-specify`, `/codi-plan`, `/codi-tasks` en Claude Code/Cursor/Codex con la misma cultura que SpecKit propone.

### 19.3 Medio plazo (meses 3-6)

1. **Completar `validate-codi-artifacts` v2** con los 5 checks pendientes (#1, #3, #6, #8, #9).
2. **Construir Codi internal registry** para distribuir skills/agents/workflows del equipo:
   - Repo `<org>/codi-registry` con `external-source/connectors.ts`.
   - `codi preset install github:<org>/codi-registry@v1.0.0`.
3. **Migrar brain.db a Postgres** (anunciado en `schema.ts:1-9`) si el equipo necesita brain compartido cross-developer:
   - `~/.codi/brain.db` por dev → backend Postgres con `project_id` + `git_remote` shared.
4. **Implementar step primitives YAML opcionales** en workflows runtime: traer `if`, `switch`, `fan-out` al workflow YAML schema de Codi para reducir necesidad de adapter TS para workflows simples.
5. **Catalogar skills/agents/workflows community**: lanzar `codi catalog` como SpecKit lo tiene (80+ extensions).
6. **Definir SLA de bus factor**: contratar segundo mantenedor o establecer governance abierta del repo Codi.

**Hito**: Codi tiene paridad con SpecKit en lo cognitivo (SDD) y ventaja sostenida en lo operativo.

### 19.4 Largo plazo (6-12 meses)

1. **Adoptar SpecKit como source de verdad SDD**:
   - Mantener `spec-kit/` como submodule en `/projs/spec-kit/`.
   - Crear `codi-speckit-bridge` skill que invoque `specify` CLI desde dentro de Codi cuando un dev prefiera el flujo nativo SpecKit.
2. **Cross-team brain federation**: agregación de brains de múltiples equipos para análisis cross-proyecto.
3. **Marketplace público de skills Codi** análogo al catalog SpecKit.
4. **Soporte oficial Gemini, opencode, devin, gemini-cli** (los 4 agentes más probables faltantes).
5. **Certificación interna**: badge "Codi-compliant" para repos que cumplan presets `strict` + lint + tests.

**Visión estratégica**: el equipo opera con **Codi como plataforma + cultura SDD interna (inspired by SpecKit)** + capacidad de invocar SpecKit nativo cuando un dev prefiera ese path para un feature concreto.

---

## 20. Veredicto final

**Herramienta recomendada para adoptar agentes de código en un equipo de desarrollo**:

> **Codi** como plataforma base, con **internalización del flujo SDD de SpecKit** vía skills `codi-{specify,plan,tasks,implement,clarify,analyze,checklist,constitution,taskstoissues}` en el corto plazo.

**Nivel de confianza**: **Alto** para la recomendación principal (Codi como base) — basado en evidencia cuantitativa (311 vs 254 ponderado, 59 vs 22 funcionalidades, 12-0 en observabilidad/mejora, ratio test/code 0.82 vs 0.07) y cualitativa (interceptor real vs trust-based, brain vs ningún sustrato persistente, loop mejora con código TS vs PRs manuales).

**Confianza media** para el roadmap de internalización SDD: depende de capacidad real del equipo de invertir 4-8 semanas en reescribir skills `codi-*` SDD.

**Confianza baja** para "Codi sin gaps": Codi tiene 1 mantenedor declarado, marketplace community ausente, validate-artifacts v1 incompleto.

**Principales riesgos**:

1. **Bus factor de Codi (1 dev)** — si `lehidalgo` se ausenta, el equipo debe asumir mantenimiento. **Mitigación**: fork interno preparado, contracting plan.
2. **Curva inicial de Codi (~15 conceptos)** — onboarding lento. **Mitigación**: sesión de 1 hora + cheatsheet + verification token visible en CLAUDE.md.
3. **Gap de breadth de agentes (6 vs 29)** — si el equipo adopta un agente nuevo, requiere TS adapter. **Mitigación**: priorizar adapters faltantes en backlog Q1.
4. **Iron Laws estrictas** — pueden frustrar a developers nuevos al equipo. **Mitigación**: documentar "por qué Iron Law 4: `'ok'` exact"; permitir override controlado.
5. **brain.db local** — falta de sync cross-team limita aprendizaje colectivo. **Mitigación**: migrar a Postgres cuando esté disponible en roadmap upstream.

**Condiciones para que la adopción funcione**:

1. **Apoyo del lead técnico del equipo** — el modelo Iron Laws + 3-layer pipeline requiere disciplina; un lead que no lo internalice condena la adopción.
2. **Inversión en onboarding** — 1 hora por dev mínima + cheatsheet impreso en zona de trabajo.
3. **CI integrado desde día 1** — `codi contribute lint` en cada PR, no opcional.
4. **Compromiso de cerrar gaps SDD en sprint 2-3** — reescribir slash-commands SpecKit como skills Codi.
5. **Plan de bus factor explícito** — segundo mantenedor identificado o fork interno preparado.
6. **brain.db backup periódico** — `codi brain export` semanal a almacenamiento compartido.

**Próxima acción recomendada**:

1. **Esta semana**: pilotar Codi en 1 repo del equipo con 2-3 developers voluntarios. Medir: tiempo a primer commit productivo, número de `corrections` capturadas, satisfacción cualitativa.
2. **Próximas 2 semanas**: si el piloto va bien, extender a 1 equipo completo. Si va mal, evaluar SpecKit como alternativa más liviana para ese contexto.
3. **Próximo mes**: lanzar el plan corto plazo (slash-commands SDD como skills Codi) si la adopción se confirma.

**Decisión final basada en objetivo**:

| Si el objetivo es…                                                                          | Elige…                             |
| ------------------------------------------------------------------------------------------- | ---------------------------------- |
| Adopción rápida con curva mínima                                                            | **SpecKit**                        |
| Plataforma robusta a largo plazo con enforcement + observabilidad                           | **Codi**                           |
| Reducir fricción del día 1 al máximo                                                        | **SpecKit**                        |
| Máxima gobernanza y calidad                                                                 | **Codi**                           |
| Breadth de agentes (29 vs 6)                                                                | **SpecKit**                        |
| Mejora continua del propio tooling                                                          | **Codi**                           |
| Bus factor / sostenibilidad institucional                                                   | **SpecKit**                        |
| **Equipo de desarrollo con visión a 6+ meses, prioridad sincronización + calidad + mejora** | **Codi** ← recomendación principal |

---

## Anexos

### Anexo A — Documentos de evidencia

- `docs/20260511_222954_[RESEARCH]_speckit-deep-audit.md` — Fase 1 SpecKit dossier (5k palabras evidencia)
- `docs/20260511_224243_[RESEARCH]_codi-core-deep-audit.md` — Fase 2 Codi core dossier (5k palabras evidencia)
- `docs/20260511_225849_[RESEARCH]_speckit-vs-codi-functional-matrix.md` — Fase 3 matriz 114 funcionalidades

### Anexo B — Repos auditados

- SpecKit: `/Users/laht/projects/codi/projs/spec-kit` (vanilla `github/spec-kit`, último commit `0f26551`, branch `main`)
- Codi: `/Users/laht/projects/codi` (branch `feature/codi-v3-harness`, último commit `5873abd8`)

### Anexo C — Tabla resumen de la decisión

| Criterio                | Peso (1-5) | SpecKit (1-5) | Codi (1-5) | Δ (Codi-SpecKit) × peso   |
| ----------------------- | ---------- | ------------- | ---------- | ------------------------- |
| Facilidad adopción      | 5          | 4             | 3          | -5                        |
| Baja fricción día a día | 5          | 4             | 3          | -5                        |
| Sincronización          | 5          | 3             | 4          | +5                        |
| Estándares compartidos  | 5          | 3             | 5          | +10                       |
| Evolución iterativa     | 4          | 2             | 5          | +12                       |
| Onboarding              | 4          | 4             | 3          | -4                        |
| Gobernanza              | 4          | 3             | 4          | +4                        |
| Calidad sin bloqueo     | 4          | 3             | 4          | +4                        |
| Git compat              | 4          | 4             | 5          | +4                        |
| CI/CD compat            | 3          | 4             | 4          | 0                         |
| Ownership claro         | 4          | 3             | 5          | +8                        |
| Trazabilidad            | 4          | 2             | 5          | +12                       |
| Escalabilidad equipos   | 3          | 4             | 3          | -3                        |
| Adaptación agentes      | 4          | 5             | 3          | -8                        |
| Anti-adopción           | 5          | 3             | 3          | 0                         |
| Mejora continua tooling | 4          | 2             | 5          | +12                       |
| Observabilidad          | 4          | 1             | 5          | +16                       |
| Bus factor              | 3          | 5             | 2          | -9                        |
| Madurez nominal         | 2          | 3             | 4          | +2                        |
| Test coverage core      | 2          | 4             | 5          | +2                        |
| **TOTAL Δ ponderado**   | —          | **254**       | **311**    | **+57 (a favor de Codi)** |
