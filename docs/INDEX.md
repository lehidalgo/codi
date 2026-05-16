# Codi docs — index

Codi v3 source layout, layer-by-layer. Each layer ships its own README
with conventions, layering invariants, and "how to add a new X"
guidance. This index links them all + the top-level operational docs.

## Source layout

| Layer | Path | What lives there |
|---|---|---|
| **CLI** | [`src/cli/`](../src/cli/README.md) | Commander entry points, interactive wizards, `codi <command>` registration. Returns `CommandResult<T>` to `handleOutput`. |
| **Core** | [`src/core/`](../src/core/README.md) | Pure domain logic — config parsing, generator pipeline, scaffolders, hook composer, preset registry, audit ledger, output shaping. No CLI / no brain. |
| **Adapters** | [`src/adapters/`](../src/adapters/README.md) | Per-agent renderers. One file per supported agent (`claude-code`, `codex`, `cursor`, `cline`, `copilot`, `windsurf`). Declarative via `defineAdapter` (CORE-006). |
| **Utils** | [`src/utils/`](../src/utils/README.md) | Side-effect-free helpers (paths, fs, hash, semver, diff, frontmatter, exec wrappers). Consumable from any layer. |
| **Schemas** | [`src/schemas/`](../src/schemas/README.md) | Canonical Zod schemas + generated JSON Schema mirrors. Edit Zod; CI regenerates JSON. |
| **Runtime** | [`src/runtime/`](../src/runtime/README.md) | Agent-facing runtime: brain (SQLite), capture hooks, workflow engine, brain-UI HTTP server. |

## Layering invariants

```
cli/ ─────► core/ ──┬──► adapters/ ──► utils/
                    └──► utils/
runtime/ ────────► core/ ──► utils/
adapters/ ───────► core/output (Logger DI only)
```

- **`scripts/guard-layering.mjs`** enforces: no upward imports
  (`core/` cannot import from `cli/`; `utils/` cannot import from
  `core/`; etc.).
- **`scripts/guard-meta-skill-isolation.mjs`** enforces (CORE-024):
  `src/templates/skills/<codi-*|dev-*>/` cannot import from
  `core`, `cli`, `runtime`, `utils`, or `adapters`.
- The full lint chain (12 guards as of CORE-024) runs in `npm run
  lint` and on every commit.

## Operational docs

- **[CORE_CODI_ROADMAP.md](../CORE_CODI_ROADMAP.md)** — every refactor
  ticket (CORE-001..038) with status, scope, closure notes, real
  effort vs estimate.
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — contribution flow,
  branch naming, commit conventions, "Adding-Hook" / "Adding-Workflow"
  recipes (CORE-033).
- **[docs/adr/](./adr/)** — architecture decision records (resolved
  in CORE-032).

## Test layout

- **`tests/unit/`** — fast, deterministic. One test file per source
  module wherever practical. No real network, no real `~/.codi/`.
- **`tests/integration/`** — multi-module flows (full init pipeline,
  preset roundtrip, hook installer mixed-runner).
- **`tests/e2e/`** — black-box CLI invocations against tmp dirs.
  Uses real `node dist/cli.js` subprocess spawn.
- **`tests/runtime/`** — brain-backed tests against isolated tmp
  brain DBs (via the `createIsolatedBrain` helper).

## Schema regeneration

```bash
npm run schemas:generate   # rewrite dist/schemas/*.json from Zod
npm run schemas:check      # CI guard: regen + diff
```

## Lint chain (12 guards)

Run via `npm run lint`. Each guard is a self-contained `.mjs`
script under `scripts/`:

1. `guard-no-internal-barrels` — no organisational `index.ts`
   barrels that obscure imports.
2. `guard-layering` — no upward-layer imports.
3. `guard-agent-identity` — no hardcoded agent IDs outside
   `src/adapters/`.
4. `guard-project-literals` — no hardcoded project name / dir
   strings; use `PROJECT_NAME` / `PROJECT_DIR`.
5. `guard-console-usage` — no `console.*` outside the
   `Logger` boundary.
6. `guard-no-process-exit-in-utils` — utils must return Results,
   not call `process.exit()`.
7. `guard-decision-kinds` — no `as { kind?: string }` casts in
   `src/runtime/**` (CORE-008).
8. `guard-empty-catches` — every empty `catch {}` must carry an
   intent marker comment.
9. `guard-no-runtime-throws` — runtime CLI-handler files must
   return `Result`; throws banned (CORE-017).
10. `guard-template-literal-sql` — no `${var}` in
    `.prepare/.exec` SQL strings under `src/runtime/**` +
    `src/core/**` (CORE-023).
11. `guard-meta-skill-isolation` — `codi-*` + `dev-*` skills
    cannot import from `core/cli/runtime/utils/adapters`
    (CORE-024).
12. `guard-file-size` — advisory warn (does NOT block) on
    `src/{cli,core}/**/*.ts` over 700 LOC (CORE-022).

## CI gates

`npm run preversion` runs the full chain that gates a release:

```
tsc --noEmit                 # type-check
eslint .                     # lint
node scripts/guard-*.mjs     # 12 invariant guards
vitest run                   # test suite + coverage thresholds
tsup build                   # bundle
```
