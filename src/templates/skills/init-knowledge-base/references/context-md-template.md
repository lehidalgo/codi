# `docs/CONTEXT.md` template

Canonical format for the project glossary. Every workflow reads this file.

## Template

```markdown
# Project Context

This file is the canonical glossary of domain terms. Every workflow reads it. Updates happen inline during workflows, not in batch.

## Language

**<Term>**:
<Definition>
_Avoid_: <terms to avoid using interchangeably>

**<Term>**:
<Definition>

## Relationships

- A <Term> has many <Term>
- A <Term> belongs to one <Term>

## Flagged ambiguities

- <unresolved term> — <why it is ambiguous>
```

## Section purposes

| Section                 | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| **Language**            | Per-term entries. Bold term → definition → optional Avoid.          |
| **Relationships**       | High-level cardinality and ownership between entities.              |
| **Flagged ambiguities** | Terms the team has not yet agreed on. Inline updates resolve these. |

## `docs/adr/` placeholder

If `docs/adr/` is empty after bootstrap, write a placeholder `docs/adr/README.md`:

```markdown
# Architecture Decision Records

ADRs live here. Each ADR is immutable. To replace a decision, write a new ADR that supersedes the old one.

Naming: `NNNN-<kebab-title>.md`, where `NNNN` is a four-digit zero-padded sequence number.

When to write an ADR: a decision is hard to reverse, would be surprising without context, and was the result of a real trade-off (the triple test).
```

## What never goes in `CONTEXT.md`

- Implementation details (those live in code).
- Specific code paths or function names (those live in `references/` per skill or in the code).
- Decisions and rationale (those live in `docs/adr/`).
- Workflow state or active task lists (those live in the manifest / TodoWrite).

`CONTEXT.md` is the glossary. Keep it small, sharp, and used.
