# ADR-v3ed0-001: Rebrand in-place v2→v3.0.0

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140923*[ARCHITECTURE]\_adr-v3ed0-001-rebrand-in-place.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: Z1 (grilling final ed.0)

## Context

El plan Codi v3 edición 0 unifica Codi v2 (multi-target generation + skill catalog + presets) + DevLoop (workflows phase-locked + hooks runtime + Iron Laws) con capacidades nuevas (cerebro SQLite, capture markers, UI consolidación). Surge la pregunta: ¿dónde vive el código?

Tres opciones evaluadas durante grilling:

- **A — Rebrand in-place**: el repo `/Users/laht/projects/codi/` (Codi v2) se rebrand a v3 in-place. Major version bump npm 2.x → 3.0.0. Tag `v2.x-final-frozen` para histórico.
- **B — Fork a repo nuevo**: nuevo repo `codi-v3` desde cero. Codi v2 queda en mantenimiento solo para fixes.
- **C — Monorepo dos versiones**: `packages/v2/` + `packages/v3/` en mismo repo, releases paralelos.

## Decision

Adoptamos **Opción A — Rebrand in-place**.

- Branch `feature/codi-v3-harness` (existente, ya con 108 commits) sirve como base.
- Tag `v2.14.x-final-frozen` antes del merge final a main al release v3.0.0.
- Major version bump npm `2.x → 3.0.0` con CHANGELOG breaking documentado.
- Migration script automático `codi migrate v2-to-v3` para users existentes.

## Consequences

### Positivas

- **Preserva inversión**: 108 commits de trabajo v2 reciente (backup overhaul, Codecov, quality gates, pre-push hook) continúan disponibles en la base.
- **Continuidad git history**: blame, log, contributors permanecen.
- **Continuidad GitHub**: stars, issues, PRs, watchers se mantienen.
- **Continuidad npm**: `codi-cli` package mantiene URL + descargas históricas.
- **Migration automática**: users con `npm update codi-cli` reciben prompt v3 con migrate script.
- **Single codebase**: un product, un changelog, un equipo de mantenimiento.

### Negativas

- **Breaking changes inevitables**: 28 skills + 18 agents + 5 presets se descartan o defer (documentar en CHANGELOG).
- **Risk de retrocompat**: users que dependen de targets Tier 2 con runtime hooks (que Cursor/etc nunca tuvieron formalmente) reciben warnings.
- **Branch acumulada**: `feature/codi-v3-harness` lleva mucho cambio; merge final a main requiere review extensa.

## Alternatives considered

### Opción B (Fork nuevo) — descartada

- Pros: limpieza arquitectónica.
- Contras: pierdes git history (o haces `git clone --mirror` con complicaciones), npm package nuevo `codi3-cli` confunde users, dual maintenance.

### Opción C (Monorepo) — descartada

- Pros: users pueden elegir versión activa.
- Contras: dual CI/CD, dual tests, dual releases, equipo pequeño (4 devs) no puede mantener dos productos.

## Implementation

```bash
cd /Users/laht/projects/codi
git checkout feature/codi-v3-harness     # already on this branch
# tags al hacer release final, no ahora:
# git tag v2.14.x-final-frozen
# git tag devloop-v0.9.x-archived (en repo DevLoop)
```

## Related ADRs

- ADR-v3ed0-002: DevLoop copy+adapt (depends on this rebrand decision).
- ADR-v3ed0-010: Install modes zero/lite/standard/full (consequence of major version bump).
