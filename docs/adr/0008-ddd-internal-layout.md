# ADR-v3ed0-008: DDD interno layout (7 bounded contexts + hexagonal)

- **Date**: 2026-05-08 14:09
- **Document**: 20260508*140930*[ARCHITECTURE]\_adr-v3ed0-008-ddd-internal-layout.md
- **Category**: ARCHITECTURE
- **Status**: Accepted
- **Source decision**: heredada de plan v3-consolidated ADR-0006 + Q26-Q31

## Context

Codi v3 ed.0 es un producto que crece — agencia 4 devs lo desarrollan y mantienen, expandiendo features durante años. Sin disciplina arquitectónica, la codebase colapsa al crecer.

Plan v3-consolidated §22-bis (post-Q26) propuso DDD táctico + Hexagonal con 7 bounded contexts internos, layout core/application/infrastructure/presentation, dependency rules enforcement.

## Decision

Adoptamos DDD táctico + Hexagonal architecture interno para Codi v3 ed.0.

### 7 bounded contexts internos

| Context         | Responsabilidad                                                           | Aggregate root                 |
| --------------- | ------------------------------------------------------------------------- | ------------------------------ |
| `notes`         | Capturas, observations, lessons, decisions, ADRs, plans, wikilinks        | `Note`                         |
| `workflows`     | Phase machines, gates, events, archives                                   | `Workflow`                     |
| `memory`        | Embeddings, retrieval, similarity edges                                   | `MemoryStore`                  |
| `codegraph`     | ACL al code-graph-rag (subproyecto propio del equipo, solo standard/full) | `CodeGraphProxy`               |
| `improvements`  | Auto-mejora 3 etapas (en lite+), overrides                                | `ImprovementCandidate`         |
| `auth`          | Multi-tenancy (lite+), RLS, sessions, secrets refs                        | `User`, `Project`, `Agency`    |
| `observability` | Tiers, metrics, audit, llm_calls                                          | (event-sourced, sin aggregate) |

### Layout por capas

```
src/
├── core/                                  # DOMAIN (sin deps externas)
│   ├── notes/
│   │   ├── entities/                      # Note (aggregate root), Link
│   │   ├── value-objects/                 # NoteId, Slug, Wikilink
│   │   ├── events/                        # NoteCreated, NoteLinked
│   │   ├── services/                      # WikilinkResolver
│   │   ├── repositories/                  # INoteRepository (interface port)
│   │   └── shared/
│   ├── workflows/                         # análogo
│   ├── memory/, codegraph/, improvements/, auth/, observability/
│   └── shared-kernel/                     # tipos cross-context (Tenant, Scope, Tier)
├── application/                           # APPLICATION (CQRS lite — command/query separation, sin event sourcing completo)
│   ├── commands/                          # CQRS write
│   ├── queries/                           # CQRS read
│   └── event-handlers/                    # cross-context reaction handlers
├── infrastructure/                        # INFRASTRUCTURE (adapters)
│   ├── repositories/sqlite/               # SqliteNoteRepository (zero)
│   ├── repositories/postgres/             # PostgresNoteRepository (lite+)
│   ├── adapters/llm/                      # OpenAIAdapter, AnthropicAdapter, GeminiAdapter
│   ├── adapters/vaultwarden/              # solo full
│   ├── adapters/code-graph-rag/           # solo standard/full
│   └── http/hono/                         # Hono routes
└── presentation/                          # PRESENTATION
    └── http/handlers/                     # request handlers que invocan use-cases
```

### Reglas de dependencia (enforced con dependency-cruiser pre-commit)

```js
// .dependency-cruiser.cjs
forbidden: [
  { from: { path: "^src/core" }, to: { path: "^src/(application|infrastructure|presentation)" } },
  { from: { path: "^src/application" }, to: { path: "^src/(infrastructure|presentation)" } },
  // anti-corruption layer entre bounded contexts
  {
    from: { path: "^src/core/(notes|workflows|memory|codegraph|improvements|auth|observability)" },
    to: { path: "^src/core/(notes|workflows|memory|codegraph|improvements|auth|observability)" },
    pathNot: "^src/core/$1",
    reason: "cross-context coupling. Use shared-kernel/ types o domain events.",
  },
];
```

### Use cases en 6 pasos

```typescript
class RecordNote {
  async run(cmd: RecordNoteCommand): Promise<Result<NoteId, RecordNoteError>> {
    // 1. Validate command (Zod)
    const validated = RecordNoteCommandSchema.safeParse(cmd);
    if (!validated.success) return err({ code: "validation_failed", issues: validated.error });

    // 2. Load aggregates via repository ports
    const project = await this.projectRepo.findById(cmd.projectId);
    if (!project) return err({ code: "not_found" });

    // 3. Execute business logic (en domain entity)
    const note = Note.create({
      /* ... */
    });

    // 4. Persist via repository ports
    await this.noteRepo.save(note);

    // 5. Publish events
    await this.eventBus.publish(note.pullEvents());

    // 6. Return DTO
    return ok({ noteId: note.id.value });
  }
}
```

### Domain events tipados

```typescript
abstract class DomainEvent {
  abstract readonly eventId: string;
  abstract readonly aggregateId: string;
  abstract readonly occurredOn: Date;
  abstract readonly eventVersion: number; // forward compatibility
}

class NoteCreated extends DomainEvent {
  constructor(
    readonly noteId: string,
    readonly type: NoteType,
    readonly scope: Scope,
    readonly createdBy: UserId,
  ) {
    super();
  }
}
```

### In-memory adapters por port

Cada port tiene 2 adapters: real + in-memory para tests.

```typescript
class InMemoryNoteRepository implements INoteRepository {
  private notes = new Map<string, Note>();
  async save(note: Note) {
    this.notes.set(note.id.value, note);
  }
  async findById(id: NoteId) {
    return this.notes.get(id.value) ?? null;
  }
}
```

Tests unitarios usan in-memory; tests integration usan real con tmp SQLite (zero) o testcontainers (lite+).

## Consequences

### Positivas

- **Mantenibilidad a v3.x**: la disciplina previene colapso al crecer.
- **Testabilidad alta**: in-memory adapters por port permiten TDD real.
- **Migration zero → lite limpia**: solo cambia el adapter (SqliteNoteRepository → PostgresNoteRepository), domain layer intacto.
- **Bounded contexts respetados**: dependency-cruiser bloquea pre-commit cross-context coupling accidental.
- **CQRS lite**: command/query separation sin overhead de event sourcing completo.
- **Coherencia con codi-domain-driven + codi-hexagonal-architecture rules**: las rules opt-in del catálogo (preset codi-extended) se enforce en el propio Codi.

### Negativas

- **Curva de aprendizaje**: equipo de 4 devs debe aprender DDD táctico si no lo conoce.
- **Verbosity**: use cases en 6 pasos + value objects + repository ports añaden boilerplate.
- **Layout inicial pesado**: 4 capas × 7 contexts × 5+ subdirs = ~150 directorios potenciales.

Mitigación: scaffolder genera estructura inicial. Code reviewer skill detecta violaciones layout.

## Alternatives considered

### A — Sin DDD, layout flat (Codi v2 actual)

- Pros: cero curva.
- Contras: colapso al crecer, ya documentado en plan original como riesgo.

### B — DDD estricto con Event Sourcing completo

- Pros: replay total, audit perfecto.
- Contras: complejidad extrema, no se necesita rebuild-from-events para v3, overkill.

## NO aplicamos

- NO `final readonly class` obsesivo: TS readonly types suficientes.
- NO Aggregate boundaries por reglas de transacción estrictas: SQLite/Postgres con OCC `_rev` cubre.
- NO Saga / Process Manager complejos en v3.0: workflow event log + reducer puro lo cubre.
- NO Event Sourcing completo: solo event log auditable, no rebuild-from-events. State materializado en tablas SoT.

## Implementation

Sprint 1-2 del roadmap (semanas 1-4):

1. Bootstrap directory structure `src/core/` + `src/application/` + `src/infrastructure/` + `src/presentation/`.
2. Setup `.dependency-cruiser.cjs` con reglas pre-commit.
3. Bootstrap shared-kernel types (Tenant, Scope, Tier).
4. Implementar `notes` bounded context completo como template (entity, value-objects, events, services, repository, in-memory + sqlite adapters, command + query, http handler).
5. Tests E2E del notes context end-to-end.
6. Replicate template para los otros 6 bounded contexts en sprints siguientes.

## Related ADRs

- ADR-v3ed0-005: SQLite canonical (define repositorio default zero).
- ADR-v3ed0-010: Install modes (define cuándo Postgres reemplaza SQLite).
