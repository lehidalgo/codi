# ADR-v3ed0-004: Workflows como artefactos editables (5 DevLoop strictos + sistema editable)

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140926*[ARCHITECTURE]\_adr-v3ed0-004-workflows-as-artifacts.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decisions**: Z4 + Z5 (grilling final ed.0)

## Context

DevLoop tiene 5 workflows phase-locked: project, feature, bug-fix, refactor, migration. Plan v3-full original tenía 7 (añadía audit + review). Codi v2 NO tiene workflows phase-locked; sus equivalentes son skills ad-hoc.

La directiva del usuario fue: "todos los workflows de DevLoop sin omitir, ni añadir cosas que no estaban" + "los workflows son artefactos editables, fácil de crear, modificar, con skills para generarlos, medir, registrar sus datos/logs, modificar sus flags".

Surge la pregunta: ¿cuántos workflows? ¿qué shape tienen?

### Z4 — workflow count

- **A — 5 estrictos DevLoop**: project, feature, bug-fix, refactor, migration.
- **B — 7 (DevLoop + audit + review)**: añade workflows phase-locked para auditorías.
- **C — 5 + 1 consolidación-workflow**: añade workflow específico para flujo consolidación cerebro.

### Z5 — workflow shape

- **A — Workflow = SKILL.md con `mode: workflow`**: convención existente Codi v2 + DevLoop.
- **B — Workflow = YAML separado** en `.codi/workflows/`.
- **C — Workflow = directorio con `workflow.yaml` + sub-files por phase**.

## Decision

### Z4 = A: 5 workflows DevLoop estrictos

Adoptamos los 5 workflows de DevLoop sin omitir ni añadir.

`audit` y `review` viven como **skills ad-hoc**, no workflows phase-locked:

- `codi-pr-review` (skill existente)
- `codi-code-review` (skill existente, bidireccional)
- `codi-receiving-code-review` (skill existente)
- `codi-audit-fix` (skill existente)
- `codi-security-scan` (skill existente)

Razón: audit/review NO son lifecycle eventos estructurados. Son tareas ortogonales que ocurren cualquier momento. Forzar phases artificiales suma overhead sin beneficio.

### Z5 = A: Workflow = SKILL.md con `mode: workflow`

Adoptamos la convención existente de Codi v2 (4 modes: skill | gate | workflow | install) + DevLoop (skills mode: workflow con phases declaradas).

Path: `.codi/skills/codi-<type>-workflow/SKILL.md`. Frontmatter declara phases + transitions + skills_by_phase + invariants + flags.

### Workflows como artefactos editables

Los 5 workflows son **first-class artifacts**: editables, medibles, versionables.

**Skills creators**:

- `codi-workflow-creator`: crear workflow custom con phases + transitions + gates.
- `codi-gate-creator`: crear gate custom (deterministic SQL o agent-fork).

**Métricas en SQLite** (tabla `workflow_metrics` materializada o queries derivadas):

- Per workflow: `total_runs`, `completion_rate`, `avg_duration_minutes`, `most_failed_gate`, `most_skipped_phase`.

**Flags editables runtime/per-project** en `workflow_runs.metadata` JSON:

- `scope_enforcement_mode`: strict | warn | auto-expand | off
- `tdd_strict`: bool (activa gate-test-first-commit opt-in)
- `hooks_override`: per-workflow hook config

**UI `/workflows`**: lista + edit + métricas en dashboard Hono+HTMX.

## Consequences

### Positivas

- **Coherente con DevLoop**: directiva "todos los workflows sin omitir" cumplida.
- **Tooling reusable**: `codi validate`, `codi skill diff`, `codi-skill-creator`, `codi-skill-audit` funcionan sobre workflows sin código nuevo.
- **Schema único**: agente discovery skills por description match; workflows aparecen igual con su trigger.
- **Editable**: dev edita SKILL.md como cualquier skill, o vía UI `/workflows/:name`.
- **Sistema extensible**: agency puede crear workflow types custom via `codi-workflow-creator` sin tocar core.

### Negativas

- **Frontmatter complejo**: workflows tienen 5+ campos extras (phases, transitions, etc) vs skills normales. Mitigable con Zod schema validation.
- **audit/review como skills sueltas**: pierden coherencia phase-locked. Trade-off aceptable: la realidad es que audits NO son phase-locked.

## Alternatives considered

### Z4.B (7 workflows) — descartada

- Pros: cobertura completa de tareas.
- Contras: contradice directiva "sin añadir", overhead phase-locked en tareas que no son lifecycle eventos.

### Z4.C (5 + consolidación) — descartada

- Pros: flujo consolidación rastreado phase-by-phase.
- Contras: añade complejidad. La UI lineal cubre el orden. Promote a workflow solo si se vuelve repetitivo (defer v3.0.1).

### Z5.B (YAML separado) — descartada

- Pros: separación cleaner.
- Contras: agente recibe SKILL.md por descripción para activar — workflow YAML separado requiere protocolo aparte.

### Z5.C (directorio con sub-files) — descartada

- Pros: instrucciones por phase separadas.
- Contras: 6+ archivos por workflow × 5 = 30+ files. Discovery más complejo.

## Implementation

Sprint 3 del roadmap (semanas 5-6):

1. Copy 5 workflows DevLoop a `src/templates/skills-devloop/codi-<type>-workflow/SKILL.md` (parte de ADR-v3ed0-002).
2. Validar frontmatter Zod: `mode: workflow` + phases + transitions + skills_by_phase.
3. Implementar `codi-workflow-creator` y `codi-gate-creator` skills.
4. Tabla SQLite `workflow_runs` + `workflow_events` (parte de ADR-v3ed0-005).
5. UI `/workflows` page con métricas + edit flags.

## Related ADRs

- ADR-v3ed0-002: DevLoop copy+adapt (define source de los 5 workflows).
- ADR-v3ed0-005: SQLite canonical (define `workflow_runs` + `workflow_events` tables).
- ADR-v3ed0-006: Catálogo 77 artefactos (incluye codi-workflow-creator + codi-gate-creator).
