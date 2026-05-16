# Architecture Decision Records

ADRs live here. Each ADR is **immutable**: to replace a decision,
write a new ADR that supersedes the old one (link both ways in the
header).

## Naming

`NNNN-<kebab-title>.md`, where `NNNN` is a four-digit zero-padded
sequence number. The number is the next free integer in the
directory; titles are kebab-case (`hello-world`, not `Hello World`).

## When to write one

Apply the **triple test** — write an ADR when the decision is:

1. **Hard to reverse** (schema, wire format, exit-code semantics,
   public API shape).
2. **Surprising without context** (someone reading the code six
   months later would ask "why this and not the obvious
   alternative?").
3. **The result of a real trade-off** (you considered ≥2 viable
   approaches and chose one for reasons that future-you should
   remember).

Skip the ADR when any of those three are missing.

## Index

Series `v3ed0` — the v3 zero-baseline architecture (CORE-001..038 ran
on top of these decisions).

| # | Title | Subject |
|---|---|---|
| [0001](./0001-rebrand-in-place.md) | Rebrand in-place v2→v3.0.0 | Why v3 reused the existing repo / package name rather than splitting. |
| [0002](./0002-devloop-copy-adapt.md) | Dev-loop copy-adapt model | Why meta-skills (codi-* + dev-*) ship as templates a user copies + adapts. |
| [0003](./0003-tiered-capabilities.md) | Tiered capabilities | Tier 1A / 1B / 2 target classification + what each unlocks. |
| [0004](./0004-workflows-as-artifacts.md) | Workflows as artifacts | Workflow definitions ship as user-editable YAML, not hardcoded TS. |
| [0005](./0005-sqlite-canonical-external-syncer.md) | SQLite canonical + external syncer | Why brain.db is the canonical store; Google Sheets is one sync target. |
| [0006](./0006-catalog-77-artifacts.md) | Catalog of 77 artifacts | The initial v3 catalog scope; how additions flow. |
| [0007](./0007-architectural-features.md) | Architectural features | The 24 v3-baseline features (F1..F24) mapped to modules. |
| [0008](./0008-ddd-internal-layout.md) | DDD internal layout | Why `cli` / `core` / `runtime` / `adapters` / `utils` / `schemas` and the layering invariants. |
| [0009](./0009-plugin-distribution-dual-track.md) | Plugin distribution dual-track | `.claude-plugin/` (Tier 1A) + `.codex-plugin/` (Tier 1B) emission strategy. |
| [0010](./0010-install-modes.md) | Install modes zero / lite / standard / full | The four bootstrap profiles offered by `codi init`. |

## Writing one

1. `cp 0001-rebrand-in-place.md NNNN-<your-title>.md` (use the next
   free integer).
2. Replace the header with `# ADR-NNNN: <Title>`, `**Date**`, and
   `**Status**: Accepted`.
3. Body: `## Context` → `## Decision` → `## Consequences`
   (positive / negative / unknown).
4. If you're superseding an earlier ADR, set its status to
   `Superseded by [ADR-NNNN](./NNNN-…)` and link back.
5. Append a row to the table above. Commit both.
