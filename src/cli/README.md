# src/cli/ — Commander entry points + interactive wizards

The `codi` CLI surface. Every top-level command (`init`, `generate`,
`update`, `verify`, `workflow`, `preset`, `hub`, `skill`, …) is wired
here as a Commander subcommand whose `.action()` callback delegates to
a sibling `*-handlers.ts` file (and, for interactive flows, a
`*-wizard.ts` file).

## Layout

- **Top-level command files** (`init.ts`, `generate.ts`, `update.ts`,
  `verify.ts`, `clean.ts`, `doctor.ts`, `backup.ts`, `migrate.ts`,
  `revert.ts`, `validate.ts`, `status.ts`, …) — Commander registration
  + option parsing. Each delegates to a `*-handlers.ts` sibling for
  the actual logic.
- **`*-handlers.ts`** — testable handler functions returning
  `CommandResult<T>`. The Result is shaped into stdout/stderr by
  `handleOutput()` in `shared.ts`.
- **`*-wizard.ts`** — `@clack/prompts` interactive flows (init wizard,
  preset wizard, add wizard). Usually skipped via `--json` / `--quiet`
  / explicit flags for non-interactive runs.
- **`init.ts` + `init-helpers.ts`** — `codi init` orchestrator (12-phase
  flow after CORE-020) + the phase helper library. The orchestrator
  lives in `init.ts`; each phase is an exported function in
  `init-helpers.ts` operating on `InitContext` / `InitState`.
- **`workflow.ts`** — `codi workflow {run, transition, scope, elevate,
  handover, abandon, recover, advance, convert, stats, phase-ref}`.
  Delegates to `src/runtime/cli-handlers/*`. The `WORKFLOW_BUILDERS`
  dispatch map (CORE-019) handles per-workflow-type adaptive flags.
- **`agent-hooks.ts`** — hook orchestrator for the runtime layer's
  `pre-tool-use` / `post-tool-use` / `stop` JSON hooks. Wraps stdin
  + a brain handle; runs the registered hook predicates in
  `src/core/hooks/registry/runtime/*`.
- **`hub.ts` + `hub-handlers.ts`** — the interactive entry hub
  (`codi hub`) that walks new users through init / generate / verify
  with help text per option.
- **`brain.ts`** — `codi brain {ui, doctor, stats}` — spawns
  `runtime/brain-ui` via child_process for the read-only HTTP
  inspector.
- **`shared.ts`** — `initFromOptions(opts)` (Logger + output mode
  bootstrap) + `handleOutput(result, opts)` (CommandResult → JSON /
  human stdout). Imported by every command.

## Conventions

- **Result discipline**: handler functions return
  `CommandResult<T>`. The `.action()` callback never throws —
  uncaught throws are wrapped by `tryRun()` (see `workflow.ts`).
- **Exit codes**: read from `result.exitCode`, set via
  `process.exit(result.exitCode)` at the end of every `.action()`.
  Codes live in `core/output/exit-codes.ts`.
- **Interactive vs JSON**: handlers must respect `globalOpts.json` —
  no `p.note()` / `p.intro()` when the user requested machine output.
  Helpers like `isInteractive(opts)` codify the predicate.
- **No business logic here**: heavy logic lives in `core/` (pure data
  flow) or `runtime/` (brain-backed workflows). `cli/` is allowed to
  call them but should not embed domain knowledge directly.

## Test-debt exclusions

`vitest.config.ts:coverage.exclude` lifts a handful of top-level
files (`add.ts`, `preset.ts`, `hub.ts`, `skill.ts`, `prefs.ts`,
`workflow.ts`, `brain.ts`, `agent-hooks.ts`, `watch.ts`,
`contribute.ts`, `contribute-git.ts`, `preset-github.ts`,
`update-check.ts`, `preset-handlers.ts`, `preset-wizard.ts`,
`hub-handlers.ts`, `wizard-prompts.ts`, `wizard-summary.ts`) out of
coverage. The logic for each lives in a tested sibling
(`*-handlers.ts` / `*-wizard.ts`); the excluded file is pure
Commander wiring + interactive prompt loops that need a TTY harness
we don't yet have.

## Adding a new command

1. Create `src/cli/<name>.ts` exporting `registerXCommand(program)`.
2. Wire option parsing + delegate to a handler in
   `<name>-handlers.ts` (testable, returns `CommandResult<T>`).
3. Register the command in `src/cli.ts`.
4. Add unit tests for the handler under `tests/unit/cli/`.
