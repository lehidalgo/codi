# src/schemas/ — Canonical Zod schemas + generated JSON Schema mirrors

The single source of truth for every persisted document codi
emits or consumes. Each schema is declared in TypeScript using
Zod v4; the matching JSON Schema is regenerated from the Zod
definition via `scripts/generate-json-schemas.mjs`. CI guards
the two stay in sync (`schemas:check`).

## Layout

- **`agent.ts`** — agent artefact frontmatter shape.
- **`evals.ts`** — skill evaluation document.
- **`feedback.ts`** — skill feedback entry.
- **`flag.ts`** — flag definition (catalog + presets).
- **`hook-events.ts`** — hook event payloads (Claude pre/post/stop).
- **`hooks.ts`** — installable hook descriptor.
- **`manifest.ts`** — `.codi/codi.yaml` shape.
- **`mcp.ts`** — MCP server config entry.
- **`preset.ts`** — preset definition (artifact selection + flags).
- **`rule.ts`** — rule artefact frontmatter.
- **`runtime/`** — schemas for brain-DB payloads (gate results,
  manifest events). Lives in a subdir so the lint guards know to
  exclude `src/runtime/**` here too.
- **`skill-test.ts`** — skill test invocation shape.
- **`skill.ts`** — skill artefact frontmatter (the largest schema —
  user-invocable / disable-model-invocation / brand-skill rules
  all encoded here).

## How the canonical → JSON Schema pipeline works (CORE-004)

```
src/schemas/<thing>.ts  ── Zod v4 schema
    │
    │ scripts/generate-json-schemas.mjs
    │   uses z.toJSONSchema()
    ▼
dist/schemas/<thing>.schema.json
```

- **Edit Zod, never JSON Schema directly.** The JSON Schema files
  in `dist/schemas/` are build artifacts — overwriting them by hand
  is reverted on the next regen.
- **CI guard**: `npm run schemas:check` (also wired into the
  release pipeline) regenerates and exits non-zero if the
  committed `dist/` differs from the regenerated output. Add to
  `npm run schemas:generate` workflow for fresh installs.
- **Why not bundle Zod at runtime?** JSON Schema is the wire
  format consumers (TypeScript editors, IDE extensions, manifest
  hosts) expect. Zod is the authoring DX.

## Conventions

- **Zod v4**: use `z.toJSONSchema()` (no `zod-to-json-schema`
  npm package). Schemas are TS objects with `.parse()` for
  validation at every boundary that ingests user-supplied data.
- **Tight types**: prefer `z.literal(...)` unions over open
  `z.string()` whenever the field has a known enum (every
  artifact `kind`, every `managed_by` value, etc.).
- **Branded types** for opaque IDs (workflow_id, session_id) so
  the type-system distinguishes them from raw strings.
- **Discriminated unions** for event/payload schemas (see
  `runtime/manifest-event` for the canonical shape).

## Coverage threshold

`vitest.config.ts` enforces `src/schemas/** branches: 100,
functions: 100`. Schemas have no real branches; the threshold
keeps regression risk near-zero.

## Pending work

- **CORE-004b** — port the legacy `manifest-event.schema.json` to a
  Zod canonical (currently the only JSON-first schema; everything
  else is Zod → JSON Schema).
