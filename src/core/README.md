# src/core/ — Pure domain logic (no CLI / no brain)

The composable building blocks the CLI and runtime layers depend on.
Everything here is pure data flow: config parsing, artifact taxonomy,
generator pipeline, scaffolders, hook orchestration, preset resolution,
audit ledger, output shaping. No Commander, no `@clack/prompts`, no
brain (SQLite).

## Layout

- **artifact-types.ts** — single source of truth for the artifact
  taxonomy (`ArtifactType`, `CapabilityType`, `LedgerEntryType`,
  `CapturedArtifactType`) + `ARTIFACT_LAYOUT` + `artifactRelativePath`.
  Consolidated in CORE-018 with `as const satisfies` tuples + type
  guards so adding a new kind fails compile at every dispatch site.
- **config/** — `codi.yaml` parser, validator, resolver, and
  `StateManager` (the `.codi/state/state.json` reader/writer with
  atomic mutation via `proper-lockfile`, CORE-002).
- **flags/** — flag catalog + presets (`minimal`, `balanced`, `strict`).
- **generator/** — the regeneration pipeline: composer
  (`composer.ts`) drives per-adapter generation, `apply.ts` applies
  the result to disk atomically, `prune-empty-adapter-dirs.ts` removes
  empty leftover dirs. Adapter registration in `adapter-registry.ts`.
- **adapters interaction** — `core/` defines the `AdapterDefinition`
  contract (`AdapterDefinition` in `generator/`); concrete adapters
  live in `src/adapters/` and register via `registerAllAdapters()`.
- **scaffolder/** — `createRule`/`createSkill`/`createAgent`/
  `createMcpServer` — bootstraps a new artifact directory + frontmatter
  from a template.
- **hooks/** — pre-commit + agent runtime hooks. Three subsystems:
  - **Pre-commit installer** (`hook-installer.ts`,
    `hook-config-generator.ts`, `hook-detector.ts`, `auto-detection.ts`):
    composes the hooks the user selected into husky/pre-commit/lefthook/
    standalone runners. Hook payloads come from `hook-templates.ts` +
    `hook-policy-templates.ts`.
  - **Hook YAML registry** (`registry/yaml/*.yaml` + `loader.ts`): per-
    language hook discovery (CORE-010, 15 YAMLs replacing 15 inline
    `.ts` registries).
  - **Runtime hook predicates** (`registry/runtime/*`): hook-logic
    JSON predicates the agent-hooks orchestrator runs at every
    `PostToolUse` / `Stop` / `SessionStart`.
- **preset/** — preset registry, loader, applier. Presets are
  shippable artifact bundles under `src/templates/presets/`.
- **audit/** — `OperationsLedgerManager` (writes `.codi/operations.json`,
  schema v2 with actor attribution).
- **output/** — `Logger` (DI-style after CORE-003), `ProjectError`
  catalog, exit codes, `CommandResult` formatter, `Result<T,E>`.
- **migration/** — v2 → v3 migration helpers (claude.md / agents.md
  rewrites for legacy installs).
- **verify/** — drift detection: cross-reference state.json hashes
  against on-disk file hashes; surface stale + missing.
- **version/** — artifact-manifest reader/writer
  (`.codi/artifact-manifest.json`), template-hash registry, upgrade
  detector.
- **external-source/** — ZIP / GitHub / local-dir connectors for
  preset imports.
- **capabilities/** — per-target capability matrix + plugin manifest
  emission (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`).
- **security/** — content scanner (`scan-patterns.ts` + `scan-prompt.ts`)
  used by preset import + skill export.
- **skill/** — skill evolution + feedback collection + version manager.
- **docs/** — markdown converter + per-section renderers used by
  `codi docs` to generate `docs/`.
- **scanner/literal-blocks.ts** — extracts code blocks from generated
  markdown for documentation tooling.
- **scaffolder/license-generator.ts** — MIT license stamp for
  scaffolded skills.

## Conventions

- **Pure data flow**: every exported function takes plain inputs and
  returns plain outputs or a `Result<T, ProjectError[]>`. No global
  state, no `process.exit`, no Commander imports.
- **Result over throw**: errors are surfaced as `Result.err` carrying
  `ProjectError[]` (typed code + message + hint + context). Throws are
  reserved for programmer-invariant violations.
- **Logger via DI**: helpers take an optional `log?: Logger`
  parameter (CORE-003). Default is `NULL_LOGGER`; CLI composition
  passes `Logger.getInstance()`.

## Layering invariants

- `core/` MUST NOT import from `cli/`, `runtime/`, or `templates/skills/`.
  Enforced by `scripts/guard-layering.mjs`.
- `core/` MAY import from `utils/`, `adapters/`, `types/`, `constants.ts`.
- `core/output/logger.ts` is the only `Logger` shipping point; helpers
  receive it via DI.
