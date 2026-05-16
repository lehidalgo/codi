# Manifest Event Schema Migrations

This directory holds migration scripts for evolving the manifest event schema while preserving readability of older archives.

## Versioning policy

The manifest event schema follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

| Bump  | Triggers                                                                                                                                | ADR required |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Patch | Pure documentation, comment, or `description` clarifications                                                                            | No           |
| Minor | Adding optional payload fields, adding new canonical event types                                                                        | Yes          |
| Major | Removing event types, renaming fields, changing field types, changing required fields, changing `commitable` value of an existing event | Yes          |

Every minor and major bump requires:

1. An ADR in `docs/adr/` of the consuming project explaining the rationale
2. A migration script in this directory named `vX.Y.Z-to-vA.B.C.ts`
3. Updated tests demonstrating that archives at the previous version remain readable

## Migration script contract

Each migration exports two functions:

```typescript
export function migrate(event: object): object;
export function unmigrate(event: object): object;
```

`migrate` upgrades a single event to the next version. `unmigrate` is the inverse and exists only when the change is reversible. The reducer applies `migrate` lazily when reading old archives.

## Compaction interaction

Compaction never alters individual event JSON. Migrations run on read, never on disk. Old archives stay byte-identical on disk; the reducer presents them in the current schema.

## Backward compatibility window

Migrations remain in this directory for at least 24 months after the version they upgrade from is replaced. After that window, an ADR may approve removing them, with archives older than the window required to be re-archived through the latest reducer if they need to be read.

## Adding a new event type

1. Open an ADR in `docs/adr/` titled `NNNN-add-event-<event_type>.md` covering: motivation, payload shape, commitable status, alternatives considered.
2. Bump schema version with minor bump.
3. Add the new entry to `EVENT_TYPES` in `src/runtime/types.ts` (the canonical TS source); if `commitable: true`, also add to `COMMITABLE_EVENT_TYPES`.
4. Add the new variant to `src/schemas/runtime/manifest-event.ts` Zod source once CORE-004b lands (today: `manifest-event.schema.json` `oneOf` directly).
5. Run `npm run schemas:generate` to regenerate the JSON Schema from Zod sources (CORE-004) — the CI `schemas:check` step will fail otherwise.
6. Add a sample to `src/schemas/runtime/sample-events.json`.
7. If the event affects existing reducer logic, add migration script + reducer case in `src/runtime/reducer.ts`.
8. Update consuming code: hooks, gates, CLI, reducer.
9. Run `npm test` — full suite green; the schemas-coverage test enforces parity between `EVENT_TYPES` and the schema `oneOf`.

## Removing or renaming an event type

Major bump. Always requires migration script with `migrate` and `unmigrate` if reversible. Document the reason and the deprecation period in the ADR. Archived events of the removed type remain readable through the migration script for the backward compatibility window.
