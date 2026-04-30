import fs from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import { BACKUP_MANIFEST_FILENAME } from "#src/constants.js";
import { safeRm } from "#src/utils/fs.js";
import { readManifest } from "#src/core/backup/backup-manifest.js";
import type { BackupManifestV2 } from "#src/core/backup/types.js";

export interface SealedBackup {
  timestamp: string;
  dir: string;
  manifest: BackupManifestV2;
}

/**
 * Lists backup directories that have a finalised manifest.json.
 * Sorted oldest-first by timestamp. Skips unsealed dirs silently.
 */
export async function listSealedBackups(backupsRoot: string): Promise<SealedBackup[]> {
  let entries;
  try {
    entries = await fs.readdir(backupsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: SealedBackup[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(backupsRoot, entry.name);
    const m = await readManifest(dir);
    if (!m.ok) continue;
    out.push({ timestamp: entry.name, dir, manifest: m.data });
  }
  out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return out;
}

/**
 * Removes any backup directory that lacks a finalised manifest.json.
 * Idempotent. Safe to call at the start of every openBackup.
 */
export async function pruneIncompleteBackups(backupsRoot: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(backupsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(backupsRoot, entry.name);
    const manifestExists = await fs
      .stat(path.join(dir, BACKUP_MANIFEST_FILENAME))
      .then(() => true)
      .catch(() => false);
    if (!manifestExists) {
      await safeRm(dir);
      removed.push(entry.name);
    }
  }
  return removed;
}

/** Removes the oldest sealed backup. Returns its timestamp, or null if none. */
export async function evictOldest(backupsRoot: string): Promise<string | null> {
  const sealed = await listSealedBackups(backupsRoot);
  if (sealed.length === 0) return null;
  const oldest = sealed[0];
  if (!oldest) return null;
  await safeRm(oldest.dir);
  return oldest.timestamp;
}

/**
 * Returns true if the user deleted >=1 backup. False on cancel / 0-selected.
 * When false, callers MUST abort the destructive operation.
 */
export async function interactiveEvict(backupsRoot: string): Promise<boolean> {
  const sealed = await listSealedBackups(backupsRoot);
  if (sealed.length === 0) return true;

  const options = sealed
    .slice()
    .reverse()
    .map((b) => {
      const sizeKB = backupSizeApprox(b.manifest.files.length);
      const label = `${b.timestamp}  -  ${b.manifest.trigger}  -  ~${sizeKB} KB`;
      return { value: b.timestamp, label };
    });

  const selected = await p.multiselect({
    message: `You have ${sealed.length} backups (the maximum). ` + `Select which to delete:`,
    options,
    required: false,
  });

  if (p.isCancel(selected) || !Array.isArray(selected) || selected.length === 0) {
    return false;
  }

  const confirmFirst = await p.confirm({
    message: `Delete ${selected.length} backup(s)?`,
    initialValue: false,
  });
  if (p.isCancel(confirmFirst) || !confirmFirst) return false;

  const confirmFinal = await p.confirm({
    message: `This permanently removes the selected backups. Continue?`,
    initialValue: false,
  });
  if (p.isCancel(confirmFinal) || !confirmFinal) return false;

  for (const ts of selected as string[]) {
    await safeRm(path.join(backupsRoot, ts));
  }
  return true;
}

function backupSizeApprox(fileCount: number): number {
  return Math.max(1, Math.round(fileCount * 4));
}
