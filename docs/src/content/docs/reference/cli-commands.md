---
title: CLI commands reference
description: Every codi subcommand, flags, and exit codes
sidebar:
  order: 4
---

Authoritative reference for every command shipped in v3.0.0. The [getting-started guide](/guides/getting-started) covers a happy-path tutorial; this page is the lookup table.

## Global flags

Every command accepts:

| Flag               | Effect                                                 |
| ------------------ | ------------------------------------------------------ |
| `--verbose` / `-v` | Verbose logger output.                                 |
| `--quiet` / `-q`   | Errors only.                                           |
| `--json`           | Machine-readable JSON on stdout instead of human text. |

Exit codes: `0` success, `1` general error, `2` invalid invocation, `3` config error.

## Project lifecycle

### `codi init`

Bootstrap a new `.codi/` directory in the current repo.

```
codi init [--preset <name>] [--customize]
```

- `--preset <name>` — start from a built-in preset (`minimal`, `default`, `extended`).
- `--customize` — interactive picker.

### `codi add`

Install one artifact (rule, skill, agent, preset, MCP server) into `.codi/`.

```
codi add <artifact-type> <name> [--template <name>]
```

### `codi generate`

Emit per-agent output (`.claude/`, `.cursor/`, …) from the `.codi/` source.

```
codi generate [--force] [--target <id...>]
```

- `--force` — overwrite drift detection. Use after `codi migrate`.
- `--target` — restrict to a subset of targets.

### `codi update`

Pull updates for managed artifacts from the upstream catalog.

```
codi update [--rules] [--skills] [--agents] [--force]
```

### `codi clean`

Remove generated output. By default keeps `.codi/`; `--all` removes everything.

```
codi clean [--all] [--target <id...>]
```

## Brain (v3.0.0+)

### `codi brain ui`

Spawn or attach to the brain-ui server (read-only HTMX dashboard).

```
codi brain ui [--port 4477] [--brain-path <path>] [--foreground]
```

- Default port: `4477`.
- Pidfile at `~/.codi/brain-ui.pid` lets multiple agent sessions share one server.
- `--foreground` stays attached to the terminal (skip pidfile).

### `codi brain export`

Write the consolidation package (accepted proposals) as JSON.

```
codi brain export [--out <path>]
```

Default output: `codi-consolidation-package.json` in the cwd.

## Migration (v3.0.0+)

### `codi migrate v2-to-v3`

Migrate an existing v2 install to v3 zero-mode.

```
codi migrate v2-to-v3 [--mode zero|lite|standard|full] [--apply]
```

- Without `--apply` → dry-run preview only.
- With `--apply` → executes the 5-step plan: backup, bootstrap brain, rewrite YAML, regenerate, summary.
- Default mode: `zero`. v3.0.0 only ships zero — `lite`/`standard`/`full` are accepted but parked until v3.1+.

See the [upgrade guide](/guides/upgrade-from-v2) for the full walkthrough.

## Plugin (v3.0.0+)

### `codi plugin publish`

Emit per-target plugin manifests under `.claude-plugin/`, `.codex-plugin/`.

```
codi plugin publish [--track local|marketplace] [--target <id...>]
```

- `--track local` (default) writes manifests to disk.
- `--track marketplace` computes manifests, returns paths only — release tooling assembles the tarball.
- `--target` restricts to a subset of Tier 1 targets. Tier 2 targets are skipped with a warning.

## Configuration & validation

### `codi validate`

Validates `.codi/` content against the JSON schemas in `src/schemas/`.

```
codi validate [--strict]
```

### `codi verify`

Verifies that generated output matches the `.codi/` source.

```
codi verify
```

### `codi doctor`

Health check: deps, hooks, brain DB, version drift.

```
codi doctor
```

### `codi status`

One-screen status of the project: drift detection, hook installation, last `generate`.

```
codi status [--diff]
```

## Backups & recovery

### `codi backup`

Manage backups created automatically by destructive operations.

```
codi backup [--list] [--delete <ts...>] [--prune]
```

### `codi revert`

Restore the project from a backup.

```
codi revert [--last] [--backup <ts>] [--dry-run]
```

`--last` restores the most recent. Without args, opens an interactive picker.

## Authoring

### `codi preset <subcommand>`

Manage presets (export, import, install).

### `codi skill evolve`

Promote an installed skill to the latest upstream version, with conflict resolution.

### `codi contribute`

Open a contribution PR upstream from a locally-improved artifact.

```
codi contribute <artifact-type> <name>
```

## Documentation maintenance

### `codi docs`, `codi docs:check`, `codi docs:stamp`

Internal commands that maintain this very docs site. See [docs internals](/guides/internals) if you are extending the site.

## Environment variables

| Var                          | Effect                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `CODI_USE_BRAIN_BACKEND`     | When `1`, workflows use BrainEventLog instead of legacy file-based EventLog. |
| `CODI_LLM_PROVIDER`          | `gemini` (default) or `openai`.                                              |
| `CODI_GEMINI_API_KEY`        | Required when provider = `gemini`.                                           |
| `CODI_OPENAI_API_KEY`        | Required when provider = `openai`.                                           |
| `CODI_LLM_MAX_CALLS_PER_RUN` | Hard cap on LLM calls per consolidation run. Default `20`. `0` disables.     |

## Exit codes

| Code | Meaning                                                             |
| ---- | ------------------------------------------------------------------- |
| `0`  | Success.                                                            |
| `1`  | General error (validation failure, command failed, drift detected). |
| `2`  | Invalid invocation (missing arg, bad flag combination).             |
| `3`  | Config error (bad `.codi/codi.yaml`, schema violation).             |
