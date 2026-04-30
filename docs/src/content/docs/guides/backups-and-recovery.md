---
title: Backups & Recovery
description: How Codi protects your work before destructive operations - automatic snapshots, the codi backup command, and codi revert
sidebar:
  order: 5
---

Codi takes a snapshot before any operation that overwrites or deletes files in your project. Snapshots are stored under `.codi/backups/<ISO-timestamp>/` and capped at 50 entries. You can list, prune, or restore them at any time.

## What gets snapshotted

A snapshot can capture three scopes of files in a single atomic operation:

- **source** — every file under `.codi/` (your installed rules, skills, agents, configs)
- **output** — every file Codi has generated and tracked in `state.json` (e.g. `CLAUDE.md`, `.claude/settings.json`, `.cursor/rules/*.md`, MCP configs)
- **pre-existing** — files Codi sees at adapter target paths (e.g. a hand-written `CLAUDE.md`) that were never tracked. Captured on first install so you can recover the exact file Codi may have replaced.

Each captured file is recorded in a `backup-manifest.json` v2 file written LAST as a commit marker. If Codi crashes mid-snapshot, the partial directory is swept by the next operation.

## When Codi takes a backup

| Command                         | Trigger label     | Source | Output | Pre-existing |
| ------------------------------- | ----------------- | ------ | ------ | ------------ |
| `codi init` (first run)         | `init-first-time` | no     | yes    | yes          |
| `codi init --customize`         | `init-customize`  | yes    | yes    | no           |
| `codi update`                   | `update`          | yes    | yes    | no           |
| `codi clean` (without `--all`)  | `clean-reset`     | yes    | yes    | no           |
| `codi preset install`           | `preset-install`  | yes    | yes    | no           |
| Add from external source wizard | `init-customize`  | yes    | yes    | no           |
| `codi revert` (any restore)     | `pre-revert`      | yes    | yes    | yes          |

Two cases skip the snapshot:

- `codi clean --all` — wipes `.codi/` entirely, including `.codi/backups/`. The user has explicitly opted into total loss; no backup can survive.
- `codi generate` — uses the legacy single-shot `createBackup` (output-only) for backwards compatibility.

## Retention

Codi keeps up to 50 sealed backups per project (`MAX_BACKUPS`). When the cap is hit, the next operation either:

- evicts the oldest sealed backup automatically (non-interactive runs)
- prompts you with a multi-select TUI showing each backup's timestamp, trigger, and approximate size; deletion requires double-confirm

If you cancel the eviction prompt, the destructive operation is aborted with `E_BACKUP_CANCELLED`. Run `codi backup --prune` later to free space, then retry.

## Listing and managing backups

```bash
codi backup --list           # show all sealed backups, newest first
codi backup --delete <ts...> # remove specific backups by timestamp
codi backup --prune          # interactive TUI to select backups to delete
```

`codi backup --list` is also available as `codi revert --list`.

## Restoring

```bash
codi revert                 # interactive picker (TUI)
codi revert --last          # restore the most recent backup
codi revert <timestamp>     # restore a specific backup
codi revert --dry-run [<ts>] # show what would happen without writing
```

Before any restore, Codi takes a `pre-revert` snapshot of the current state. Reverting is itself reversible.

When the chosen backup contains a `.codi/` source subtree, the restore routes through the artifact-selection wizard (the same flow used by "Add from external source"). You see every artifact in the backup and choose which to bring back, with collision resolution per file. After the wizard finishes, Codi auto-regenerates the agent output via `codi generate`.

When the chosen backup is output-only (e.g. an older `generate`-time backup), Codi falls back to direct file restore: every entry in the manifest is copied back to its original path.

If the backup also captured pre-existing files (e.g. your original `CLAUDE.md` from before Codi was installed), Codi prompts at the end of the restore: "Restore these N pre-existing files too?" Answer no to keep the current Codi-generated versions; answer yes to bring back the originals.

## Recovery scenarios

**You unselected an agent and want it back.**
Run `codi revert`, pick the backup taken just before the customize. The artifact-selection wizard offers every rule/skill/agent in the backup; re-select what you want.

**You ran `codi update` and don't like the changes.**
Run `codi revert --last`. The latest backup is the pre-update snapshot, which captured `.codi/` source + the previous agent output.

**`codi init` overwrote your hand-written `CLAUDE.md`.**
On first init, Codi captured your `CLAUDE.md` as a pre-existing file. Run `codi revert --last`, accept the artifact-selection picks, and answer YES to the "restore pre-existing files" prompt.

**You see lots of backups eating disk space.**
Run `codi backup --list` to inspect, then `codi backup --prune` for the interactive picker or `codi backup --delete <ts>` for specific entries.

**A backup looks corrupted.**
A backup with no `manifest.json` is partial (interrupted by a crash or kill). It is harmless: the next destructive operation calls `pruneIncompleteBackups` first, which sweeps every dir without a manifest. You can also remove it manually.

## Disk-space planning

Each backup contains the union of the captured scopes for that operation. A typical project after a `codi init --customize` snapshot is 200 KB - 2 MB depending on preset size. With 50 backups, plan for ~10 - 100 MB worst-case. Use `codi backup --list` to see the per-backup file count.
