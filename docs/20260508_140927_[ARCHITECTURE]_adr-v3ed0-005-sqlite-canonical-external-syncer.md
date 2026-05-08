# ADR-v3ed0-005: SQLite canonical + ExternalSyncer (Sheets/xlsx opt-in)

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140927*[ARCHITECTURE]\_adr-v3ed0-005-sqlite-canonical-external-syncer.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: Z6 (grilling final ed.0)

## Context

DevLoop tiene `lib/sheets/` con backend Google Sheets API + `lib/xlsx/` con adapter Excel. Persistence en DevLoop es interface `Backend` con métodos `read/write/snapshot/sync/atomic-update` y adapters intercambiables.

Codi v3 ed.0 introduce SQLite local en `~/.codi/brain.db` como cerebro del agente (decisiones Q1-Q12 v3-zero). Surge la pregunta: ¿qué relación tienen SQLite vs Sheets/xlsx?

Opciones evaluadas:

- **A — Mantener interface `Backend` con `SqliteBackend` + `_deprecated/SheetsBackend`/`XlsxBackend`**: persistence intercambiable, SQLite default.
- **B — Eliminar interface, usar SQLite directo sin abstracción**: zero ceremony.
- **C — Mantener interface + Sheets opt-in via flag**: dual backend activable.
- **D — SQLite canonical + adapters export/sync direccionales**: SQLite siempre fuente de verdad, Sheets/xlsx son **destinos** de export/sync opt-in, NO backends alternativos.

## Decision

Adoptamos **Opción D — SQLite canonical + ExternalSyncer interface**.

### Modelo conceptual

- **SQLite es la verdad**. Todas las queries runtime van a SQLite. Single source of truth.
- **Sheets/xlsx son vistas espejo**. Lectoras-mayormente, escritoras-opcional. Activadas opt-in cuando el dev las necesita.
- **Sync direction**: SQLite → Sheets/xlsx (push) y opcionalmente Sheets/xlsx → SQLite (pull con OCC merge).
- **Sync trigger**: opt-in via config + manual command. NO automático.

### Interface

```typescript
// src/runtime/sync/types.ts
interface ExternalSyncer {
  push(brainDb: Database, opts: PushOptions): Promise<PushResult>;
  pull(brainDb: Database, opts: PullOptions): Promise<PullResult>;
  diff(brainDb: Database, external: ExternalRef): Promise<DiffResult>;
}
```

Adapters:

- `SheetsSyncer` — refactor de `lib/sheets/` (DevLoop). OAuth user auth.
- `XlsxSyncer` — refactor de `lib/xlsx/` (DevLoop). File output.
- (futuros) `PostgresSyncer` para upgrade lite/standard/full — pero eso es replicación, no replacement.

### Configuración

```yaml
# .codi/codi.yaml
external_sync:
  enabled: false # default off
  targets: [] # ['sheets', 'xlsx']
  sheets:
    spreadsheet_id: "<id>"
    direction: "push" # push | pull | bidirectional
    schedule: "manual" # manual | hourly | daily
    auth_method: "oauth_user"
  xlsx:
    output_path: "./codi-snapshot.xlsx"
    direction: "push"
    schedule: "manual"
```

### CLI

```bash
codi brain sync push --target=sheets    # SQLite → Google Sheets
codi brain sync pull --target=sheets    # Google Sheets → SQLite (merge OCC)
codi brain sync push --target=xlsx      # SQLite → .xlsx
codi brain sync status                  # estado de syncs configurados
```

## Consequences

### Positivas

- **SQLite mantiene single-writer simplicity**. Sin lock contention dual backend.
- **Sheets/xlsx funcionan como vistas espejo**: dev encargado puede ver capturas en Google Sheets para colaboración con stakeholders no-técnicos sin dejar Codi como source of truth.
- **Reusa código DevLoop**: `lib/sheets/` y `lib/xlsx/` se refactorizan a syncers, no se desperdician.
- **Path de upgrade limpio**: cuando v3 evoluciona a lite (Postgres), `PostgresSyncer` se enchufa para replicación cross-environment sin reescribir runtime.
- **Casos de uso reales para 4 devs**: PM ve snapshot mensual `.xlsx`, equipo dev edita reglas en Sheets si prefieren, sync push back.

### Negativas

- **Bidirectional sync requiere OCC**: si dev edita SQLite mientras dev encargado edita Sheets, hay conflict. Resolución: timestamps + checksums en `_codi_export_metadata`. Pull detecta divergencia → prompt manual.
- **Sheets API cuotas**: agencia con muchos pushes puede chocar quota Google. Mitigación: `schedule: hourly` o `daily` opt-in para batch.

## Alternatives considered

### Opción A (Backend interface intercambiable) — descartada

- Pros: pattern conocido, factory.
- Contras: implica que un dev podría elegir SheetsBackend como persistence principal. No queremos eso — SQLite debe ser canónico para single-writer simplicity y migration limpia a Postgres.

### Opción B (SQLite directo sin abstracción) — descartada

- Pros: zero ceremony, código mínimo.
- Contras: cuando llegue Postgres en v3-lite, hay que reescribir runtime. Y perdemos posibilidad de sync con Sheets/xlsx para casos PM/colaboración real.

### Opción C (Dual backend opt-in) — descartada

- Pros: zero breaking change para users DevLoop.
- Contras: tests matrix duplicada, mantenimiento dual, contradice "SQLite single source of truth".

## Implementation

Sprint 2 del roadmap (semanas 3-4):

1. Refactor `lib/sheets/` (DevLoop) → `src/runtime/sync/sheets-syncer.ts`. Mantener auth OAuth user.
2. Refactor `lib/xlsx/` (DevLoop) → `src/runtime/sync/xlsx-syncer.ts`.
3. Implementar interface `ExternalSyncer` en `src/runtime/sync/types.ts`.
4. CLI commands `codi brain sync push/pull/status`.
5. Config `.codi/codi.yaml` schema validation Zod (Q campo `external_sync`).

Sheets/xlsx legacy backends de DevLoop quedan en `src/runtime/_deprecated/` con README explicando "estos son los originales pre-refactor a syncer".

## Related ADRs

- ADR-v3ed0-002: DevLoop copy+adapt (define dónde vienen Sheets/xlsx originales).
- ADR-v3ed0-007: 4 features arquitectónicas (capture markers + brain SQLite — define el SQLite canonical).
- ADR-v3ed0-010: Install modes (define cuándo Postgres reemplaza SQLite en lite/standard/full).
