import fs from "node:fs/promises";
import path from "node:path";
import { isPathSafe } from "#src/utils/path-guard.js";
import { fileExists, safeRm } from "#src/utils/fs.js";
import { STATE_FILENAME, BACKUPS_DIR, MAX_BACKUPS } from "#src/constants.js";
import { VERSION } from "#src/index.js";
import { readManifest, writeManifest } from "#src/core/backup/backup-manifest.js";
import {
  listSealedBackups,
  pruneIncompleteBackups,
  evictOldest,
  interactiveEvict,
} from "#src/core/backup/backup-retention.js";
import { collectSourceFiles, collectPreExistingFiles } from "#src/core/backup/backup-collectors.js";
import type { Result } from "#src/types/result.js";
import { ok, err } from "#src/types/result.js";
import type {
  SnapshotOptions,
  BackupHandle,
  BackupManifestEntry,
  BackupManifestV2,
  RetentionStrategy,
  OpenBackupResult,
  OpenBackupError,
} from "#src/core/backup/types.js";

export type { BackupHandle } from "#src/core/backup/types.js";

export async function openBackup(
  projectRoot: string,
  configDir: string,
  opts: SnapshotOptions,
): Promise<OpenBackupResult> {
  const includeOutput = opts.includeOutput ?? true;
  const includeSource = opts.includeSource ?? false;
  const includePreExisting = opts.includePreExisting ?? false;
  const retention = opts.retention ?? "auto";

  const backupsRoot = path.join(configDir, BACKUPS_DIR);
  await fs.mkdir(backupsRoot, { recursive: true });

  await pruneIncompleteBackups(backupsRoot);

  const evicted = await applyRetention(backupsRoot, retention);
  if (evicted === "cancelled") return err<OpenBackupError>("retention-cancelled");

  const initialFiles = await computeInitialFiles(projectRoot, configDir, {
    includeOutput,
    includeSource,
    includePreExisting,
  });

  if (initialFiles.length === 0) {
    return err<OpenBackupError>("no-files-to-snapshot");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(backupsRoot, timestamp);
  await fs.mkdir(dir, { recursive: true });

  const entries: BackupManifestEntry[] = [];
  try {
    for (const f of initialFiles) {
      await copyOne(projectRoot, dir, f.path);
      entries.push(f);
    }
  } catch {
    await safeRm(dir);
    return err<OpenBackupError>("io-error");
  }

  const seenPaths = new Set(entries.map((e) => e.path));
  const handle: BackupHandle = {
    dir,
    timestamp,
    async append(paths, scope, flags) {
      for (const p of paths) {
        if (seenPaths.has(p)) continue;
        if (!isPathSafe(projectRoot, p)) continue;
        const exists = await fileExists(path.resolve(projectRoot, p));
        if (!exists) continue;
        await copyOne(projectRoot, dir, p);
        const entry: BackupManifestEntry = { path: p, scope };
        if (flags?.deleted) entry.deleted = true;
        if (flags?.preExisting) entry.preExisting = true;
        entries.push(entry);
        seenPaths.add(p);
      }
    },
    async finalise() {
      const manifest: BackupManifestV2 = {
        version: 2,
        timestamp,
        trigger: opts.trigger,
        codiVersion: VERSION,
        files: entries,
      };
      await writeManifest(dir, manifest);
    },
    async abort() {
      await safeRm(dir);
    },
  };
  return ok(handle) as Result<BackupHandle, OpenBackupError>;
}

/**
 * Legacy single-shot API. Wraps openBackup → finalise. Kept for backwards
 * compat with existing callers (e.g. generate.ts).
 */
export async function createBackup(projectRoot: string, configDir: string): Promise<string | null> {
  const r = await openBackup(projectRoot, configDir, {
    trigger: "generate",
    includeOutput: true,
  });
  if (!r.ok) return null;
  await r.data.finalise();
  return r.data.timestamp;
}

export interface BackupInfo {
  timestamp: string;
  fileCount: number;
}

export async function listBackups(configDir: string): Promise<BackupInfo[]> {
  const backupsRoot = path.join(configDir, BACKUPS_DIR);
  const sealed = await listSealedBackups(backupsRoot);
  return sealed
    .map((b) => ({
      timestamp: b.timestamp,
      fileCount: b.manifest.files.length,
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function restoreBackup(
  projectRoot: string,
  configDir: string,
  timestamp: string,
): Promise<string[]> {
  const backupDir = path.join(configDir, BACKUPS_DIR, timestamp);
  const m = await readManifest(backupDir);
  if (!m.ok) {
    throw new Error(`Backup not found or unreadable: ${timestamp}`);
  }
  const restored: string[] = [];
  for (const entry of m.data.files) {
    if (!isPathSafe(projectRoot, entry.path)) continue;
    const sourcePath = path.join(backupDir, entry.path);
    const destPath = path.resolve(projectRoot, entry.path);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    try {
      await fs.copyFile(sourcePath, destPath);
      restored.push(entry.path);
    } catch {
      // skip files not present in the backup (e.g. orphan-deleted scope)
    }
  }
  return restored;
}

interface InitialFilesOpts {
  includeOutput: boolean;
  includeSource: boolean;
  includePreExisting: boolean;
}

async function computeInitialFiles(
  projectRoot: string,
  configDir: string,
  opts: InitialFilesOpts,
): Promise<BackupManifestEntry[]> {
  const out: BackupManifestEntry[] = [];

  let stateData: { agents: Record<string, Array<{ path: string }>> } = {
    agents: {},
  };
  const statePath = path.join(configDir, STATE_FILENAME);
  if (await fileExists(statePath)) {
    try {
      const raw = await fs.readFile(statePath, "utf8");
      stateData = JSON.parse(raw) as typeof stateData;
    } catch {
      stateData = { agents: {} };
    }
  }
  if (opts.includeOutput) {
    const seen = new Set<string>();
    for (const files of Object.values(stateData.agents)) {
      for (const file of files) {
        if (seen.has(file.path)) continue;
        seen.add(file.path);
        if (!isPathSafe(projectRoot, file.path)) continue;
        if (await fileExists(path.resolve(projectRoot, file.path))) {
          out.push({ path: file.path, scope: "output" });
        }
      }
    }
  }

  if (opts.includeSource) {
    const sourceFiles = await collectSourceFiles(projectRoot);
    for (const p of sourceFiles) {
      out.push({ path: p, scope: "source" });
    }
  }

  if (opts.includePreExisting) {
    const pre = await collectPreExistingFiles(projectRoot, stateData.agents);
    for (const p of pre) {
      if (out.some((e) => e.path === p && e.scope === "output")) continue;
      out.push({ path: p, scope: "output", preExisting: true });
    }
  }

  return out;
}

async function copyOne(projectRoot: string, backupDir: string, relPath: string): Promise<void> {
  const src = path.resolve(projectRoot, relPath);
  const dest = path.join(backupDir, relPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function applyRetention(
  backupsRoot: string,
  strategy: RetentionStrategy,
): Promise<"ok" | "cancelled"> {
  const sealed = await listSealedBackups(backupsRoot);
  if (sealed.length < MAX_BACKUPS) return "ok";

  const resolved =
    strategy === "auto" ? (process.stdout.isTTY ? "interactive" : "evict-oldest") : strategy;

  if (resolved === "evict-oldest") {
    await evictOldest(backupsRoot);
    return "ok";
  }
  const success = await interactiveEvict(backupsRoot);
  return success ? "ok" : "cancelled";
}
