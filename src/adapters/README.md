# src/adapters/ — Per-agent generator adapters

One file per supported agent. Each adapter declares **how** to render
a normalized codi config (`NormalizedConfig`) into the agent's
on-disk artefacts: instruction files (`CLAUDE.md`, `AGENTS.md`),
agent definitions (`.cursor/rules/`, `.claude/agents/`, …), MCP
configs (`.cursor/mcp.json`, `.claude/settings.local.json`), and any
agent-specific extras (hooks for `claude-code`, settings JSON for
`cursor`).

## Layout

- **`index.ts`** — `registerAllAdapters()` registers every concrete
  adapter against `adapter-registry.ts` (in `core/generator/`).
- **One-file-per-agent**: `claude-code.ts`, `codex.ts`, `cursor.ts`,
  `cline.ts`, `copilot.ts`, `windsurf.ts`. Each exports an
  `AdapterDefinition` consumed by the generator.
- **`base.ts`** — `BaseAdapter` + `defineAdapter` declarative
  factory introduced by CORE-006. Each concrete adapter is now ~80
  LOC of data; the imperative reads/writes live in shared helpers.
- **Shared helpers** (the rest of the directory):
  - **`fs-helpers.ts`** — `exists`/`existsAny`/`readJsonIfExists`
    (the de-duplicated leaf-adapter primitives, CORE-006/CORE-025).
  - **`heartbeat-emission.ts`** + **`heartbeat-state.ts`** — emits the
    `.codi/state/heartbeat.json` ping each adapter writes during
    `apply` so external watchers see liveness (CORE-006).
  - **`claude-settings.ts`** — Claude Code's `settings.local.json`
    builder.
  - **`cursor-hooks.ts`** — Cursor's hooks JSON builder
    (`.cursor/hooks/*.json`).
  - **`section-builder.ts`** — composes the artifact sections that
    end up inside `CLAUDE.md`/`AGENTS.md` for ALL adapters (rules,
    skills, agents, MCPs).
  - **`permission-builder.ts`** — emits the Claude permission JSON
    that gates which tools each rule/skill can use.
  - **`skill-generator.ts`** — Markdown emitter for skill bundles
    (used by every adapter; bundle layout is uniform).
  - **`brand-filter.ts`** — strips codi-specific branding from
    artifact frontmatter on export (used by `preset publish`).
  - **`flag-instructions.ts`** — renders flag-driven sections into
    instruction files (e.g. when `require_test_coverage` is enabled
    a "TDD strict" block is inserted).
  - **`generated-header.ts`** — `<!-- GENERATED -->` marker every
    adapter emits at the top of every generated file.

## Conventions

- **Declarative adapter definition** (CORE-006): each adapter is a
  `defineAdapter({ id, outputs, …})` call. Imperative
  glue lives in `BaseAdapter` + the shared helpers above.
- **No CLI imports**: adapters return pure `GeneratedFile[]`
  shapes; `core/generator/apply.ts` writes them to disk atomically.
- **Logger via DI**: optional `log?: Logger` param if the adapter
  needs to surface a warning. Default `NULL_LOGGER`.
- **Brand isolation**: adapters never embed codi branding directly —
  emit `PROJECT_NAME` from `constants.ts` so the brand can be
  overridden at export time.

## Adding a new agent

1. Create `src/adapters/<agent-id>.ts` exporting a
   `defineAdapter({...})` call.
2. Add the adapter to `registerAllAdapters()` in `index.ts`.
3. Extend the `AgentId` union in `types/agents.ts` if needed.
4. Add per-adapter snapshot tests under
   `tests/unit/adapters/<agent>.test.ts` (every adapter ships byte-
   equal fixtures the regeneration pipeline cross-checks against).
