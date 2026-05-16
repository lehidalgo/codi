# ADR-v3ed0-010: Install modes zero/lite/standard/full

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140932*[ARCHITECTURE]\_adr-v3ed0-010-install-modes-zero-lite-standard-full.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: heredada de Q31.G5.1 (v3-consolidated) + plan v3-zero

## Context

Codi v3 ed.0 atiende perfiles distintos:

- Dev solo evaluando Codi por primera vez.
- Agencia 4 devs sin Docker en su workflow normal.
- Agencia ≤10 devs con BD shared via Docker.
- Agencia con code graph + multi-tenant.
- Agencia heavy con UI dashboard + secrets manager.

Plan v3-full original tenía 3 modes (lite/standard/full). Plan v3-zero introdujo un cuarto modo más liviano (zero, sin Docker). Plan ed.0 master adopta los 4 modes.

## Decision

`codi install --mode=<zero|lite|standard|full>` con 4 niveles progresivos:

### Tabla maestra

| Mode         | Containers | Daemon | Storage                            | Workflows runtime                   | Multi-tenant     | LLM                         | Use case primario                                             |
| ------------ | ---------- | ------ | ---------------------------------- | ----------------------------------- | ---------------- | --------------------------- | ------------------------------------------------------------- |
| **zero**     | 0          | no     | SQLite local                       | feature, bug-fix (subset funcional) | no (1 dev)       | API directo + agente coding | Dev solo, agencia 4 devs sin infra Docker, evaluación inicial |
| **lite**     | 3          | sí     | Postgres + pgvector                | full 5 workflows                    | optional via JWT | + routing 3 providers       | Agencia ≤10 devs con BD shared                                |
| **standard** | 6          | sí     | Postgres + Memgraph + Qdrant       | full 5                              | sí RLS           | full                        | Agencia con code graph + multi-tenant                         |
| **full**     | 9          | sí     | + Vaultwarden + UI dashboard React | full 5                              | full             | full                        | Agencia heavy con UI + secrets manager                        |

### Containers por mode

**zero** (0): solo binario CLI + SQLite local en `~/.codi/brain.db`.

**lite** (3):

- `codi-app` (Hono daemon)
- `codi-workers` (pg-boss async jobs)
- `codi-db` (Postgres 17 + pgvector + FTS)

**standard** (6 = lite + 3):

- `codi-graph` (Memgraph)
- `codi-vector` (Qdrant para code embeddings dedicados)
- `codi-indexer` (Python wrapper de code-graph-rag subproyecto propio)

**full** (9 = standard + 3):

- `codi-ui` (React 19 + Vite dashboard 6-section)
- `caddy` (reverse proxy + TLS automático)
- `vaultwarden` (secrets management + LLM keys)

### Comandos

```bash
# Install limpio
codi install --mode=zero          # default minimalista
codi install --mode=lite          # 3 containers
codi install --mode=standard      # 6 containers
codi install --mode=full          # 9 containers

# Upgrade entre modes (preserva datos)
codi install --upgrade --mode=lite        # zero → lite (migra SQLite → Postgres)
codi install --upgrade --mode=standard    # lite → standard (añade Memgraph + Qdrant + indexer)
codi install --upgrade --mode=full        # standard → full (añade UI + caddy + vaultwarden)

# Downgrade (preserva datos via backup)
codi install --downgrade --mode=zero      # cualquier → zero (backup BD + para containers)
```

### Migration paths

**zero → lite**:

1. Verifica Docker disponible (`docker --version`); si no, prompt instalar.
2. Pull images: codi-app, codi-workers, codi-db.
3. Bootstrap Postgres schema (mismo que SQLite + columnas RLS opcional `agency_id`).
4. Migrar datos: leer `~/.codi/brain.db` row por row → INSERT Postgres preservando IDs.
5. Backup SQLite a `~/.codi/backups/pre-upgrade-<ts>.db`.
6. Update `.codi/codi.yaml`: `mode: zero` → `mode: lite`.
7. Restart sesión Claude Code/Codex; hooks ahora usan HTTP API en lugar de SQLite directo.

**lite → standard**: pull Memgraph + Qdrant + indexer images, start containers, dispara reindex codebase background.

**standard → full**: pull UI + caddy + vaultwarden images, configure TLS automático, bootstrap vault.

**Reverse migration** (downgrade): backup BD a SQL/SQLite, para containers, restore datos en mode menor.

## Consequences

### Positivas

- **Adopción progresiva**: dev solo arranca zero <30s, escala a lite/standard/full cuando justifica.
- **Reversible**: agencia puede downgradar sin pérdida de datos (backup automático).
- **Misma arquitectura**: schema 11 tablas idéntico zero ↔ lite ↔ standard ↔ full. Solo cambia el driver (SQLite vs Postgres).
- **Infra mínima zero**: no Docker, no daemon, RAM <100MB, instalación inmediata.
- **Path claro**: README explica qué mode elegir según equipo size + features needed.

### Negativas

- **Testing matrix**: 4 modes × tests = 4x combinaciones. Mitigación: zero tests sobre filesystem, lite/standard/full sobre Docker compose CI.
- **Docs por mode**: README + getting-started por mode. Mitigado con docs Diataxis.
- **Bug surface**: bugs en migration path zero→lite o reverse pueden corromper datos. Mitigación: tests E2E de migration + backup automático antes de cualquier upgrade.

## Alternatives considered

### A — Solo 2 modes (zero / full)

- Pros: simplicidad.
- Contras: gap muy grande entre 0 containers y 9. Agencias intermedias no tienen path.

### B — 1 mode único (siempre Docker)

- Pros: codebase único.
- Contras: barrier alta para evaluación (instalar Docker), excluye dev solo en macOS Apple Silicon con Docker Desktop pesado.

### C — Continuous configuration (sin modes nombrados, dev compone containers)

- Pros: flexibilidad máxima.
- Contras: complejidad alta, dev tiene que entender qué hace cada container.

## Implementation

Sprint 7 del roadmap (semanas 14-18):

1. `codi install --mode=zero`: bootstrap SQLite + crear `~/.codi/`.
2. `codi install --mode=lite`: docker compose con 3 containers + bootstrap Postgres schema.
3. `codi install --mode=standard`: docker compose con +3 containers + reindex codebase.
4. `codi install --mode=full`: docker compose con +3 containers + caddy + vaultwarden bootstrap.
5. Migration scripts:
   - `migrate_zero_to_lite.ts`: SQLite → Postgres preservando IDs.
   - `migrate_lite_to_standard.ts`: añade Memgraph + Qdrant + indexer.
   - `migrate_standard_to_full.ts`: añade UI + caddy + vaultwarden.
6. Reverse migrations (`migrate_<higher>_to_<lower>.ts`).
7. Tests E2E migration cycle: zero → lite → standard → full → standard → zero (preservando datos).

## Related ADRs

- ADR-v3ed0-005: SQLite canonical + ExternalSyncer (define persistence layer in zero).
- ADR-v3ed0-008: DDD interno layout (define repository ports que cambian SqliteRepo ↔ PostgresRepo).
- ADR-v3ed0-007: 4 features arquitectónicas (brain SQLite es F8.2, presente en todos los modes con backend distinto).
