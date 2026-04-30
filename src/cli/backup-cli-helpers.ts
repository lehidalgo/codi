import { openBackup } from "../core/backup/backup-manager.js";
import type { BackupHandle, SnapshotOptions } from "../core/backup/types.js";
import { Logger } from "../core/output/logger.js";
import { RETENTION_CANCELLED_ERROR } from "../constants.js";

export type WithBackupOutcome<T> =
  | { ok: true; data: T; backupTimestamp?: string }
  | { ok: false; cancelled: boolean };

/**
 * Wraps a destructive operation with the openBackup -> finalise/abort lifecycle.
 *
 * - When retention is full and the user cancels eviction, returns `cancelled: true`.
 *   Caller MUST construct its own command-specific cancel CommandResult.
 * - When openBackup returns `no-files-to-snapshot` or `io-error`, runs `fn`
 *   without a handle (best-effort) and returns its outcome.
 * - Finalises the manifest only when `fn` returns `ok: true`.
 * - Aborts the partial backup on `fn` failure or thrown exception.
 */
export async function withBackup<T>(
  projectRoot: string,
  configDir: string,
  snapshotOpts: SnapshotOptions,
  fn: (handle: BackupHandle | null) => Promise<{ ok: true; data: T } | { ok: false }>,
): Promise<WithBackupOutcome<T>> {
  const log = Logger.getInstance();
  const r = await openBackup(projectRoot, configDir, snapshotOpts);
  if (!r.ok && r.errors === "retention-cancelled") {
    log.error(RETENTION_CANCELLED_ERROR);
    return { ok: false, cancelled: true };
  }
  const handle = r.ok ? r.data : null;
  try {
    const inner = await fn(handle);
    if (inner.ok) {
      if (handle) await handle.finalise();
      return {
        ok: true,
        data: inner.data,
        ...(handle ? { backupTimestamp: handle.timestamp } : {}),
      };
    }
    if (handle) await handle.abort();
    return { ok: false, cancelled: false };
  } catch (cause) {
    if (handle) await handle.abort();
    throw cause;
  }
}
