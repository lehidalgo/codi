# src/runtime/ — Codi v3 ed.0 runtime

DevLoop integration target (per ADR-v3ed0-002).

## Purpose

Codi v3 ed.0 is "static config generator (Codi v2 way) + runtime SQLite-backed hooks (DevLoop way)". This module hosts the runtime layer:

- **procedures/** (sprint 1) — event log + reducer (from `devloop/lib/procedures/`)
- **classifier/** (sprint 1) — incidental vs scope (from `devloop/lib/classifier/`)
- **gates/** (sprint 1) — gate runner + 14+1 gate definitions (from `devloop/lib/gates/`)
- **sync/** (sprint 2) — `ExternalSyncer` interface + SheetsSyncer + XlsxSyncer adapters (refactored from `devloop/lib/sheets/` + `devloop/lib/xlsx/`)
- **\_deprecated/** (sprint 1) — Sheets/xlsx legacy backends preserved for reference

## Status

**Skeleton stage** — empty until sprint 1 (DevLoop merge per ADR-v3ed0-002).

## Related

- ADR-v3ed0-002: DevLoop copy + adapt
- ADR-v3ed0-005: SQLite canonical + ExternalSyncer
- ADR-v3ed0-008: DDD internal layout (this lives in src/runtime/, distinct from src/core/)
