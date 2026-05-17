import fs from "node:fs/promises";
import fsSync from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { isPathSafe } from "#src/utils/path-guard.js";
import { fileExists, safeRm } from "#src/utils/fs.js";
import {
  STATE_FILENAME,
  BACKUPS_DIR,
  MAX_BACKUPS,
  EXTERNAL_ARCHIVE_DIR,
  PROJECT_DIR,
} from "#src/constants.js";
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

  const backupsRoot = opts.external
    ? externalArchiveRoot(projectRoot)
    : path.join(configDir, BACKUPS_DIR);
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
  return restoreFromBackupDir(projectRoot, backupDir);
}

/**
 * Restore from any backup directory (local or external archive). The
 * directory must contain a v2 manifest; files listed in the manifest are
 * copied back to their original `projectRoot`-relative paths. Files
 * present at the destination but not in the backup are LEFT UNTOUCHED —
 * this is a non-destructive overlay restore.
 */
export async function restoreFromBackupDir(
  projectRoot: string,
  backupDir: string,
): Promise<string[]> {
  const m = await readManifest(backupDir);
  if (!m.ok) {
    throw new Error(`Backup not found or unreadable at ${backupDir}`);
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

/**
 * Resolve the out-of-tree archive root for `projectRoot`. The directory layout
 * groups backups by a stable hash of the absolute project path so re-installs
 * in the same directory share archive history, and so two projects with the
 * same basename do not collide.
 *
 * Layout: `~/.codi/archive/<sha256[0..16]>-<basename>/<timestamp>/`
 */
export function externalArchiveRoot(projectRoot: string): string {
  const abs = path.resolve(projectRoot);
  const hash = createHash("sha256").update(abs).digest("hex").slice(0, 16);
  const slug = path.basename(abs).replace(/[^A-Za-z0-9._-]/g, "_") || "project";
  return path.join(homedir(), PROJECT_DIR, EXTERNAL_ARCHIVE_DIR, `${hash}-${slug}`);
}

/**
 * Default top-level archive root: `~/.codi/archive/`. Callers that need
 * project-specific paths should use `externalArchiveRoot(projectRoot)` instead.
 * Exposed so brain-ui and tests can inject an alternate root for hermetic
 * fixtures or test isolation (e.g. point at a tmp dir during tests).
 */
export function defaultArchiveRoot(): string {
  return path.join(homedir(), PROJECT_DIR, EXTERNAL_ARCHIVE_DIR);
}

export interface ArchiveListEntry {
  readonly hash: string;
  readonly timestamp: string;
  readonly path: string;
  readonly size: number;
  readonly trigger: string;
}

export interface ListProjectArchivesOptions {
  /** Override default `~/.codi/archive/` — primarily for tests. */
  readonly archiveRoot?: string;
  /** Max entries per page (1..MAX_ARCHIVE_PAGE_SIZE). Default = DEFAULT_ARCHIVE_PAGE_SIZE. */
  readonly limit?: number;
  /** Page offset (entries to skip). Default 0. */
  readonly offset?: number;
}

export interface ListProjectArchivesResult {
  readonly entries: readonly ArchiveListEntry[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

/** Default page size when listing archives (UI pagination). */
export const DEFAULT_ARCHIVE_PAGE_SIZE = 50;
/** Hard cap on archive page size to prevent unbounded responses. */
export const MAX_ARCHIVE_PAGE_SIZE = 500;
/**
 * Hard cap on the size of `backup-manifest.json` we will read into memory
 * and JSON.parse. A maliciously-large manifest could OOM the process; entries
 * past this size are kept as best-effort placeholders.
 */
export const MAX_MANIFEST_BYTES = 10 * 1024 * 1024;

/**
 * Enumerate all project archives under `archiveRoot` (default `~/.codi/archive/`).
 *
 * Safety guarantees:
 *   - `lstat` is used everywhere — symlinks under the archive root are NOT
 *     followed. A symlinked directory looks like a regular file to the walker
 *     and is skipped.
 *   - Each `backup-manifest.json` is size-checked before reading; oversized
 *     manifests are kept as best-effort entries (size=0, trigger="oversized").
 *   - Results are paginated. Callers MUST provide explicit `limit`/`offset` or
 *     accept the conservative defaults.
 *
 * Sync I/O on purpose: archives are read in a request handler that is itself
 * synchronous; switching to async fs would add `await` overhead without
 * reducing event-loop blocking for this directory size in practice. If/when
 * archive counts grow past a few thousand, revisit by streaming the listing.
 */
export function listProjectArchives(
  opts: ListProjectArchivesOptions = {},
): ListProjectArchivesResult {
  const root = opts.archiveRoot ?? defaultArchiveRoot();
  const limit = clampPageSize(opts.limit);
  const offset = Math.max(0, opts.offset ?? 0);

  if (!fsSync.existsSync(root)) {
    return { entries: [], total: 0, offset, limit };
  }

  const all: ArchiveListEntry[] = [];
  let rootEntries: string[] = [];
  try {
    rootEntries = fsSync.readdirSync(root);
  } catch {
    return { entries: [], total: 0, offset, limit };
  }

  for (const hashDir of rootEntries) {
    const hashPath = path.join(root, hashDir);
    if (!isDirectoryNoSymlink(hashPath)) continue;

    let tsDirs: string[] = [];
    try {
      tsDirs = fsSync.readdirSync(hashPath);
    } catch {
      continue;
    }

    for (const tsDir of tsDirs) {
      const dir = path.join(hashPath, tsDir);
      if (!isDirectoryNoSymlink(dir)) continue;

      const manifestPath = path.join(dir, "backup-manifest.json");
      let trigger = "unknown";
      let size = 0;

      try {
        const manifestStat = fsSync.lstatSync(manifestPath);
        if (!manifestStat.isFile()) {
          // dangling symlink or non-file — keep entry as best-effort
        } else if (manifestStat.size > MAX_MANIFEST_BYTES) {
          trigger = "oversized";
        } else {
          const raw = fsSync.readFileSync(manifestPath, "utf8");
          const manifest = JSON.parse(raw) as {
            trigger?: string;
            files?: Array<{ path: string }>;
          };
          trigger = manifest.trigger ?? "unknown";
          for (const f of manifest.files ?? []) {
            try {
              size += fsSync.lstatSync(path.join(dir, f.path)).size;
            } catch {
              /* tolerate missing files inside snapshot */
            }
          }
        }
      } catch {
        /* manifest unreadable — keep entry as best-effort placeholder */
      }
      all.push({ hash: hashDir, timestamp: tsDir, path: dir, size, trigger });
    }
  }

  all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return {
    entries: all.slice(offset, offset + limit),
    total: all.length,
    offset,
    limit,
  };
}

function clampPageSize(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_ARCHIVE_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_ARCHIVE_PAGE_SIZE, Math.floor(raw)));
}

function isDirectoryNoSymlink(p: string): boolean {
  try {
    return fsSync.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
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
