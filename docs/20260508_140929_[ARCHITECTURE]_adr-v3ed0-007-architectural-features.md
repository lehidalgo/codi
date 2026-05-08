# ADR-v3ed0-007: 4 features arquitectónicas (SDD 5 fases + brain SQLite + plugin doble track + override DEFER)

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140929*[ARCHITECTURE]\_adr-v3ed0-007-architectural-features.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: Z8 (grilling final ed.0)

## Context

Cuatro features arquitectónicas pendientes de decidir si entran en v3 ed.0 o defer. Surgen del cruce entre plan v3-consolidated (Q1-Q31) y plan v3-zero (Q'1-Q'12).

### F8.1 — SDD inner-loop 5 fases (Clarify → Spec → Plan → Implement → Verify)

Plan v3-full Q30. Capa transversal aplicable dentro de feature/bug-fix/refactor workflows. Skills core C (8 skills) más ortogonales D (4 skills) — total 12 skills SDD.

### F8.2 — Capture markers + brain SQLite + UI Live observation

Plan v3-zero Q'1-Q'12. Cerebro persistente per-dev en `~/.codi/brain.db`. 10 tipos de captura via markers `|TIPO: "..."|`. UI Hono+HTMX para live observation + consolidación team.

### F8.3 — Plugin distribution dual track

Plan v3-consolidated Q29. Distribución como plugin oficial (`.claude-plugin/plugin.json` + `.codex-plugin/plugin.json`) en paralelo con `codi generate` overwrite mode.

### F8.4 — Override layer BD con base_hash conflict detection

Plan v3-consolidated Q13. Sistema de versionado de skills con detección de conflicts estilo git. base_hash SHA-256 del SKILL.md base al momento de aprobar override. Conflict markers cuando base cambia.

## Decision

### F8.1 — SDD inner-loop 5 fases: **SÍ incluir**

Aplica como capa transversal dentro de feature/bug-fix/refactor workflows. Skills SDD core (8) + ortogonales (4) ya están en bloque C+D del catálogo (ADR-v3ed0-006).

Mapeo phases-de-workflow → fases-SDD:

| Workflow phase    | Fase SDD canónica            |
| ----------------- | ---------------------------- |
| feature.intent    | 1 Clarify                    |
| feature.plan      | 2 Spec + 3 Plan (combinadas) |
| feature.decompose | 3 Plan (decompose detallado) |
| feature.execute   | 4 Implement                  |
| feature.verify    | 5 Verify                     |
| bug-fix.reproduce | extra (workflow-specific)    |
| refactor.baseline | extra (workflow-specific)    |

### F8.2 — Capture markers + brain SQLite + UI: **SÍ incluir**

Es la inversión principal de Codi v3 sobre v2. Sin esto, v3 = v2 con cambios menores.

- **Capture markers** `|TIPO: "..."|` MUST al final de cada turno con captura. 10 tipos.
- **Brain SQLite** `~/.codi/brain.db` cross-project con `project_id` discriminator. 11 tablas (9 captura + 2 workflow runtime).
- **UI Hono + HTMX** on-demand: Live observation default + Consolidación cuando dev encargado dropea SQLites externas.
- **Modo dual LLM** en consolidación: API directo (provider keys en UI) + agente coding via HTTP+SSE (patrón content-factory).

### F8.3 — Plugin distribution dual track: **SÍ incluir**

`codi generate` (default) + `codi plugin publish` (opt-in).

**Manifest Claude Code** `.claude-plugin/plugin.json`:

```json
{
  "id": "codi",
  "version": "3.0.0",
  "skills": ["skills/codi-*/SKILL.md"],
  "agents": ["agents/codi-*.md"],
  "rules": ["rules/codi-*.md"],
  "hooks": "hooks/hooks.json"
}
```

**Manifest Codex CLI** `.codex-plugin/plugin.json`: schema análogo, `skills` apunta a `.agents/skills/`, `agents` a `.codex/agents/*.toml`.

### F8.4 — Override layer BD: **DEFER a v3.1**

Para 4 devs editando filesystem + git, el override layer BD es overhead. Git ya hace conflict resolution. El sistema de overrides BD con base_hash conflict detection tiene sentido SOLO en multi-tenant heavy (multi-agency).

Re-evaluar cuando agencia con ≥10 devs lo justifique.

En v3 ed.0: skills/rules/agents se editan filesystem direct + commit + git merge resuelve conflicts. Modelo simple.

## Consequences

### F8.1 SÍ: positivas

- **Coherencia con plan v3-full Q30**: aprovecha grilling previo.
- **Skills SDD ya en catálogo**: no añade trabajo extra de skills.
- **Mapeo workflow→fases es documental**: no cambia runtime ni schema.

### F8.2 SÍ: positivas

- **Diferenciador real vs Codi v2**: el cerebro SQLite + capturas + UI consolidación es lo que justifica major version v3.
- **Inversión de equipo Tier 1**: hooks + brain + UI son features Tier 1 (Claude Code + Codex), Tier 2 lo hereda como config-only sin runtime.
- **SQLite single source of truth** (ADR-v3ed0-005) habilita esta capa naturalmente.

### F8.3 SÍ: positivas

- **Compat KB Claude Code + Codex**: ambos soportan plugin distribution oficial.
- **`codi generate` se mantiene default**: zero breaking change.
- **`codi plugin publish` opt-in**: agencias avanzadas distribuyen via marketplace privado.
- **Path para marketplace público v3.1**: foundation lista.

### F8.4 DEFER: positivas

- **Reduce scope MVP**: -1 feature compleja, -2 semanas trabajo aproximado.
- **Equipo de 4 devs no necesita override layer**: git resuelve conflicts.

### F8.4 DEFER: negativas

- **Multi-tenancy heavy users defer**: agencias hipotéticas con ≥10 devs editando misma skill en paralelo no tienen solución limpia hasta v3.1.

## Alternatives considered

### F8.4 incluir en MVP — descartada

- Pros: feature completa para multi-tenant.
- Contras: complejidad alta (SHA-256 fingerprint, conflict markers stylegit, materialization endpoint), 4 devs no lo necesitan, costo mantenimiento alto.

## Implementation

- **F8.1 SDD 5 fases**: Sprint 3 (semanas 5-6) — skills SDD core + ortogonales + mapeo workflow phases.
- **F8.2 Brain SQLite + UI**: Sprints 2-5 (semanas 3-11) — schema + parser + Hono server + consolidación pipeline.
- **F8.3 Plugin doble track**: Sprint 6 (semanas 12-13) — manifests + `codi plugin publish` command.
- **F8.4 Override layer**: NO en v3 ed.0. Re-evaluar con agencias usuarias en v3.1 planning.

## Related ADRs

- ADR-v3ed0-005: SQLite canonical (define brain SQLite layer).
- ADR-v3ed0-006: Catálogo 77 artefactos (incluye 12 skills SDD).
- ADR-v3ed0-009: Plugin distribution dual track (detalle implementación F8.3).
