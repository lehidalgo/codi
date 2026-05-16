# ADR-v3ed0-002: DevLoop copy + adapt (no submodule)

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140924*[ARCHITECTURE]\_adr-v3ed0-002-devloop-copy-adapt.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: Z2 (grilling final ed.0)

## Context

Codi v3 ed.0 absorbe íntegramente la lógica de DevLoop: 5 workflows phase-locked, 5 hooks runtime, classifier incidental vs scope, gate runner, event-sourced audit. Surge la pregunta: ¿cómo se trae ese código al repo Codi?

Tres opciones evaluadas:

- **A — Copy + adapt**: `cp -r devloop/lib/ ./src/runtime/`. DevLoop deja de existir como producto separado. Tag final `devloop-v0.9.x-archived` antes de archivar repo.
- **B — Git submodule**: `git submodule add devloop projects/devloop`. DevLoop sigue siendo repo independiente.
- **C — Git subtree**: `git subtree add` con history preserved.

## Decision

Adoptamos **Opción A — Copy + adapt**.

Estructura post-merge:

```
src/runtime/
├── procedures/         ← copy de devloop/lib/procedures/ (event log + reducer)
├── classifier/         ← copy de devloop/lib/classifier/
├── gates/              ← copy de devloop/lib/gates/
├── sync/               ← copy de devloop/lib/sheets/ + xlsx/ refactorizados como ExternalSyncer
└── _deprecated/        ← Sheets/xlsx legacy backends (preserved by ADR-v3ed0-005)

src/templates/
├── hooks-devloop/      ← copy de devloop/hooks/
└── skills-devloop/     ← copy de devloop/skills/
```

## Consequences

### Positivas

- **Una sola codebase**: equipo no aprende submodule/subtree workflows.
- **Refactor cross-cutting libre**: renames, types, deps en una sola operación.
- **Tests E2E unificados**: workflow tests Codi + DevLoop corren juntos sin coordinación cross-repo.
- **Tag preserva trazabilidad**: `devloop-v0.9.x-archived` + commit message "import devloop@<sha>" en Codi v3.

### Negativas

- **Pierde git blame de DevLoop original**: las contribuciones quedan atribuidas al commit de import, no a sus autores originales. Mitigación: comentario en files importados con referencia al SHA original + tag.
- **DevLoop repo se archiva**: contribuciones futuras solo via Codi v3.

## Alternatives considered

### Opción B (Submodule) — descartada

- Pros: git history preserved per-file.
- Contras: dual maintenance, pulls dobles, divergencia si se evolucionan en paralelo, refactor cross-boundary doloroso, equipo de 4 devs no escala con 2 productos.

### Opción C (Subtree) — descartada

- Pros: history preserved + en mismo repo.
- Contras: subtree commands complejos, equipo requiere training, raro en producción.

## Implementation

Sprint 1 (semanas 2-3 del roadmap):

```bash
# Backup DevLoop final state
cd /Users/laht/projects/devloop
git tag devloop-v0.9.x-archived
git push --tags

# Copy a Codi v3
cd /Users/laht/projects/codi
mkdir -p src/runtime src/templates/hooks-devloop src/templates/skills-devloop src/schemas/_devloop

cp -r ../devloop/lib/procedures/   src/runtime/
cp -r ../devloop/lib/classifier/   src/runtime/
cp -r ../devloop/lib/gates/        src/runtime/
cp -r ../devloop/hooks/            src/templates/hooks-devloop/
cp -r ../devloop/skills/           src/templates/skills-devloop/
cp -r ../devloop/schemas/          src/schemas/_devloop/

# Sheets + xlsx refactor a ExternalSyncer (ver ADR-v3ed0-005)
mkdir -p src/runtime/sync
mv src/runtime/sheets/ src/runtime/sync/sheets-syncer-source/  # refactor pendiente
mv src/runtime/xlsx/   src/runtime/sync/xlsx-syncer-source/

git add src/runtime src/templates/hooks-devloop src/templates/skills-devloop src/schemas/_devloop
git commit -m "feat(runtime): import devloop@<sha> as src/runtime base"
```

Resolver `pnpm install` post-merge: ambos repos usan TS+Node+pnpm — compat alta esperada.

## Related ADRs

- ADR-v3ed0-001: Rebrand in-place (defines context donde se hace copy).
- ADR-v3ed0-005: SQLite canonical + ExternalSyncer (refactor de Sheets/xlsx backend a sync adapter).
- ADR-v3ed0-006: Catálogo 77 artefactos (skills DevLoop entran al catálogo).
