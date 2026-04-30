import type { Result } from "#src/types/result.js";

export type BackupTrigger =
  | "init-first-time"
  | "init-customize"
  | "generate"
  | "update"
  | "preset-install"
  | "clean-reset"
  | "pre-revert";

export type BackupScope = "source" | "output";

export type RetentionStrategy = "auto" | "interactive" | "evict-oldest";

export interface SnapshotOptions {
  trigger: BackupTrigger;
  /** Capture generated agent files (default: true). */
  includeOutput?: boolean;
  /** Capture .codi/ source dir (default: false). */
  includeSource?: boolean;
  /** Probe ALL_ADAPTERS target paths for files NOT in state.json (default: false). */
  includePreExisting?: boolean;
  /** Retention strategy when at MAX_BACKUPS. Default: "auto". */
  retention?: RetentionStrategy;
}

export interface BackupManifestEntry {
  /** Path relative to projectRoot. Mirrored into <backupDir>/<path> on disk. */
  path: string;
  scope: BackupScope;
  /** True when the file existed at an adapter target path BEFORE codi tracked it. */
  preExisting?: boolean;
  /** True when this file was about to be deleted by orphan logic in the same operation. */
  deleted?: boolean;
}

export interface BackupManifestV2 {
  version: 2;
  /** ISO 8601 with `.toISOString().replace(/[:.]/g, "-")`: e.g. "2026-04-30T19-20-15-123Z". */
  timestamp: string;
  trigger: BackupTrigger;
  codiVersion: string;
  files: BackupManifestEntry[];
}

/** Returned from openBackup so callers can append additional files mid-operation. */
export interface BackupHandle {
  /** Absolute path to the backup directory under .codi/backups/. */
  readonly dir: string;
  /** Backup timestamp / ID. */
  readonly timestamp: string;
  /** Append additional files to this open backup. Idempotent on duplicate paths. */
  append(
    paths: readonly string[],
    scope: BackupScope,
    opts?: { deleted?: boolean; preExisting?: boolean },
  ): Promise<void>;
  /** Finalise: write manifest.json LAST as commit marker. After this the backup is sealed. */
  finalise(): Promise<void>;
  /** Abort: remove the partial backup directory. Used in finally blocks on error. */
  abort(): Promise<void>;
}

/** Result error variants returned by openBackup. */
export type OpenBackupError = "retention-cancelled" | "no-files-to-snapshot" | "io-error";

export type OpenBackupResult = Result<BackupHandle, OpenBackupError>;
