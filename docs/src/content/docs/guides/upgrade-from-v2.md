---
title: Upgrade from Codi v2 to v3
description: Migrate a v2 project to v3 zero-mode with codi migrate v2-to-v3
sidebar:
  order: 8
---

A how-to for upgrading an existing Codi v2.x project (`.codi/` directory in your repo) to Codi v3 zero-mode. Plan-first, backup-first, no surprises.

## Prerequisites

- `codi-cli >= 3.0.0` installed: `pnpm add -D codi-cli@latest` (or `npm i -D codi-cli@latest`).
- Node.js 20.19+ on `PATH`.
- Your repo has a `.codi/` directory with `artifact-manifest.json` and `codi.yaml` (the standard v2 layout).
- Working tree clean. The migration creates a backup directory next to `.codi/`; nothing else is touched until you opt into `--apply`.

## Step 1 — Plan (dry-run, default)

```bash
codi migrate v2-to-v3
```

This prints a 5-step plan and exits. No filesystem writes. Sample output:

```
Codi v2 → v3 migration plan

Source:           /path/to/repo/.codi
Source artifacts: 21 rules, 49 skills, 4 agents
Backup target:    /path/to/repo/.codi.v2.backup-20260508-180000
Destination mode: zero

Steps:
  1. [backup_codi_dir]            Copy .codi/ → .codi.v2.backup-20260508-180000
  2. [bootstrap_brain_db]         Initialise brain DB (~/.codi/brain.db) — idempotent
  3. [rewrite_codi_yaml]          Update .codi/codi.yaml → mode: zero
  4. [regenerate_per_agent_output] Run codi generate to refresh .claude/, .cursor/, etc.
  5. [report_summary]             Print artifact diff (added / removed / changed)

Re-run with --apply after reviewing the plan.
```

If anything looks wrong, stop here. The planner has not modified your repo.

## Step 2 — Apply

```bash
codi migrate v2-to-v3 --apply
```

The executor walks the same 5 steps for real:

1. **Backup.** Copies `.codi/` to a sibling `.codi.v2.backup-<timestamp>/` directory. Fails fast if a backup of that name already exists.
2. **Bootstrap brain DB.** Creates or upgrades `~/.codi/brain.db` (the SQLite "brain" introduced in v3). Idempotent — safe to re-run.
3. **Rewrite codi.yaml.** Sets `mode: zero` (the new v3 install mode). Preserves every other key in your YAML.
4. **Regenerate per-agent output.** Logs a reminder; the actual regeneration is a separate command (next step).
5. **Report summary.** Prints which artifacts were added/removed/changed.

If any step fails, the executor aborts and the backup is preserved.

## Step 3 — Regenerate

```bash
codi generate --force
```

Refreshes `.claude/`, `.cursor/`, `.windsurf/`, etc. from the updated `.codi/` source. Existing per-agent output for Tier 2 targets (Cursor, Windsurf, Cline, Copilot, Gemini) is preserved as-is — see [Capabilities Matrix governance](/reference/architecture#capabilities-matrix-governance) for why.

## Step 4 — Verify

```bash
codi verify          # state matches .codi/ source
codi doctor          # checks deps, hooks, brain DB
```

`codi verify` should print `OK`. `codi doctor` reports any drift.

## What changed

| Subsystem        | Before (v2)                                  | After (v3 zero)                                                                    |
| ---------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Persistence      | None (stateless generator)                   | SQLite at `~/.codi/brain.db`                                                       |
| Capture protocol | n/a                                          | 10 typed markers in agent responses (Iron Law 9)                                   |
| Workflow state   | DevLoop event-log files (`.devloop/active/`) | `workflow_runs` + `workflow_events` tables (opt-in via `CODI_USE_BRAIN_BACKEND=1`) |
| Brain UI         | n/a                                          | `codi brain ui` opens HTMX dashboard at http://127.0.0.1:4477                      |
| LLM providers    | n/a                                          | Pluggable interface, Gemini + OpenAI built-in                                      |
| Plugin manifests | n/a                                          | `.claude-plugin/plugin.json` + `.codex-plugin/plugin.json` (Tier 1 only)           |

## Troubleshooting

### "backup path already exists"

Another migration already ran in this repo. Either delete the previous backup or pass `--backup-name` to choose a fresh one.

### "no .codi/ directory found"

Your repo is not a Codi v2 install. Run `codi init` instead to set up v3 from scratch.

### `codi verify` reports drift after migrate

Run `codi generate --force`. The migration step that regenerates per-agent output is delegated to `codi generate`; if you skipped it, drift will persist.

### Brain UI does not start

```bash
codi brain ui --foreground
```

Runs the server in the foreground so errors are visible. Common cause: port 4477 is already bound by another process. Pass `--port 5555` to use a different port.

### Roll back

```bash
rm -rf .codi
mv .codi.v2.backup-<timestamp> .codi
git checkout -- package.json   # if you bumped codi-cli
```

The backup directory contains the exact pre-migration `.codi/`. Restoring it returns the repo to its v2.x state.

## Next steps

- Read [Codi v3 architecture](/reference/architecture) to understand how the brain, capture protocol, and consolidation pipeline fit together.
- Skim the [CLI reference](/reference/cli-reference) for the new `codi brain`, `codi plugin`, and `codi migrate` commands.
- Configure an LLM provider (`CODI_LLM_PROVIDER=gemini` + `CODI_GEMINI_API_KEY=...`) if you want the consolidation pipeline to enrich proposals with rationale.
