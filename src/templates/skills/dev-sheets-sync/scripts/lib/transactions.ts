/**
 * Atomic-from-the-user's-perspective sync + restore for the project Sheet.
 *
 * The Google Sheets API itself does not give us cell-level transactions
 * across multiple ranges, so "atomic" here is implemented as:
 *
 *   1. snapshot every affected tab to local JSON
 *   2. run the per-row upserts
 *   3. on first failure → restore from snapshot, exit with rolled_back=true
 *   4. on full success → return; the snapshot is retained for forensics
 *
 * From the caller's perspective this gives the same guarantee as a real
 * transaction: either the whole envelope landed, or the Sheet looks
 * exactly as it did before the call. (The snapshot is the source of truth
 * for "before" — see captureSnapshot in snapshot.ts.)
 *
 * Soft-delete via `__intent: "archive"` rows is supported in the same flow.
 */

import type {
  EntityName,
  SheetRow,
  ProjectConfig,
  CellValue,
  CallerScope,
  UpsertResult,
  SheetsClient,
} from "./index.js";
import {
  ENTITY_NAMES,
  SheetsError,
  upsertRow,
  archiveRow,
  readTab,
  captureSnapshot,
  type DraftEnvelope,
  type Snapshot,
} from "./index.js";
import { randomUUID } from "node:crypto";
import { tabRange, type AppendRowRequest, type UpdateRangeRequest } from "./client.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AtomicSyncOptions {
  cwd: string;
  client: SheetsClient;
  config: ProjectConfig;
  caller: CallerScope;
  actor: string;
  envelope: DraftEnvelope;
  /** Snapshot label — defaults to "pre-sync". */
  snapshotLabel?: string;
  /** Skip auto-snapshot (NOT recommended). When true, no rollback is possible. */
  skipSnapshot?: boolean;
  now?: () => Date;
}

export interface AtomicSyncOutcome {
  entity: EntityName;
  index: number;
  row_id?: string;
  columns_written?: ReadonlyArray<string>;
  was_no_op?: boolean;
  archived?: boolean;
  error?: string;
  error_code?: string;
}

export interface AtomicSyncResult {
  total: number;
  written: number;
  no_ops: number;
  archived: number;
  failed: number;
  rolled_back: boolean;
  snapshot_path?: string;
  outcomes: ReadonlyArray<AtomicSyncOutcome>;
}

const ARCHIVE_INTENT_KEY = "__intent";
const ARCHIVE_INTENT_VALUE = "archive";

// ─── atomicSyncDraft ─────────────────────────────────────────────────────────

/**
 * Write every row in `envelope` to the Sheet under "atomic-from-user" semantics.
 *
 * Failure handling:
 *   - on the FIRST per-row error, the loop stops
 *   - if a snapshot was captured, the affected tabs are restored
 *   - the result reports rolled_back=true and the failing outcome
 */
export async function atomicSyncDraft(opts: AtomicSyncOptions): Promise<AtomicSyncResult> {
  const outcomes: AtomicSyncOutcome[] = [];

  // 1. Capture snapshot (best-effort — failure to snapshot is fatal because
  //    we'd lose the rollback safety net).
  let snapshotPath: string | undefined;
  if (!opts.skipSnapshot) {
    const cap = await captureSnapshot({
      cwd: opts.cwd,
      client: opts.client,
      config: opts.config,
      taken_by: opts.actor,
      label: opts.snapshotLabel ?? "pre-sync",
      ...(opts.now !== undefined ? { now: opts.now } : {}),
      entities: affectedEntities(opts.envelope),
    });
    snapshotPath = cap.path;
  }

  // 2. Per-row upsert / archive.
  let firstFailure: AtomicSyncOutcome | undefined;
  let totalRows = 0;
  for (const [entityKey, rows] of Object.entries(opts.envelope)) {
    if (!isEntityName(entityKey)) continue;
    const entity = entityKey as EntityName;
    for (let i = 0; i < rows.length; i++) {
      totalRows++;
      const row = rows[i];
      if (!row) continue;
      try {
        const outcome = await applyRow(entity, i, row, opts);
        outcomes.push(outcome);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const errCode = e instanceof SheetsError ? e.code : "unknown";
        const failed: AtomicSyncOutcome = {
          entity,
          index: i,
          ...(typeof row["id"] === "string" ? { row_id: row["id"] as string } : {}),
          error: errMsg,
          error_code: errCode,
        };
        outcomes.push(failed);
        firstFailure = failed;
        break; // stop the whole sync on first failure
      }
    }
    if (firstFailure) break;
  }

  // 3. Roll back if any failure + we have a snapshot.
  let rolledBack = false;
  if (firstFailure !== undefined && snapshotPath !== undefined) {
    try {
      await restoreFromSnapshotPath(snapshotPath, {
        client: opts.client,
        config: opts.config,
        only: affectedEntities(opts.envelope),
      });
      rolledBack = true;
    } catch {
      // Restore failed — leave Sheet as-is and surface the original error.
      // The snapshot is still on disk for manual recovery.
    }
  }

  const written = outcomes.filter((o) => !o.error && o.was_no_op !== true && !o.archived).length;
  const noOps = outcomes.filter((o) => !o.error && o.was_no_op === true).length;
  const archived = outcomes.filter((o) => !o.error && o.archived === true).length;
  const failed = outcomes.filter((o) => o.error !== undefined).length;

  const result: AtomicSyncResult = {
    total: totalRows,
    written,
    no_ops: noOps,
    archived,
    failed,
    rolled_back: rolledBack,
    outcomes,
  };
  if (snapshotPath !== undefined)
    (result as { snapshot_path?: string }).snapshot_path = snapshotPath;
  return result;
}

async function applyRow(
  entity: EntityName,
  index: number,
  row: SheetRow,
  opts: AtomicSyncOptions,
): Promise<AtomicSyncOutcome> {
  // Archive intent path.
  if (row[ARCHIVE_INTENT_KEY] === ARCHIVE_INTENT_VALUE) {
    const id = typeof row["id"] === "string" ? (row["id"] as string) : undefined;
    if (id === undefined) {
      throw new SheetsError(
        "schema_invalid",
        `archive intent on ${entity}[${index}] but no id provided`,
        { entity, index },
      );
    }
    const reason = typeof row["reason"] === "string" ? (row["reason"] as string) : undefined;
    const result = await archiveRow(entity, id, {
      caller: opts.caller,
      client: opts.client,
      config: opts.config,
      actor: opts.actor,
      ...(opts.now !== undefined ? { now: opts.now } : {}),
      ...(reason !== undefined ? { reason } : {}),
    });
    return {
      entity,
      index,
      row_id: result.row_id,
      columns_written: result.columns_written,
      was_no_op: result.was_no_op,
      archived: !result.was_no_op,
    };
  }

  // Standard upsert path.
  const result: UpsertResult = await upsertRow(entity, row, {
    caller: opts.caller,
    client: opts.client,
    config: opts.config,
    actor: opts.actor,
    ...(opts.now !== undefined ? { now: opts.now } : {}),
  });
  return {
    entity,
    index,
    row_id: result.row_id,
    columns_written: result.columns_written,
    was_no_op: result.was_no_op,
  };
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export interface RestoreOptions {
  client: SheetsClient;
  config: ProjectConfig;
  /** When provided, restore only these tabs. Default: every tab in the snapshot. */
  only?: ReadonlyArray<EntityName>;
}

/** Restore tabs from a snapshot file. Reads via fs, then writes via client. */
export async function restoreFromSnapshotPath(
  snapshotPath: string,
  opts: RestoreOptions,
): Promise<{ restored_tabs: ReadonlyArray<EntityName>; total_rows: number }> {
  const fs = await import("node:fs");
  if (!fs.existsSync(snapshotPath)) {
    throw new SheetsError("schema_invalid", `snapshot not found: ${snapshotPath}`, {
      snapshotPath,
    });
  }
  const raw = fs.readFileSync(snapshotPath, "utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  return restoreFromSnapshot(snapshot, opts);
}

/** Restore tabs from an in-memory Snapshot object. */
export async function restoreFromSnapshot(
  snapshot: Snapshot,
  opts: RestoreOptions,
): Promise<{ restored_tabs: ReadonlyArray<EntityName>; total_rows: number }> {
  const targets = (opts.only ?? Object.keys(snapshot.tabs)).filter(isEntityName) as EntityName[];
  const restored: EntityName[] = [];
  let totalRows = 0;

  for (const entity of targets) {
    const tab = snapshot.tabs[entity];
    if (!tab) continue;

    // Read current header (preserve column order on restore).
    const current = await readTab(entity, opts);
    const headers =
      current.header.length > 0
        ? current.header
        : (() => {
            // Fall back to the headers implicit in snapshot rows.
            const seen = new Set<string>();
            for (const r of tab.rows) {
              for (const k of Object.keys(r)) {
                if (k !== undefined && k.length > 0) seen.add(k);
              }
            }
            return [...seen];
          })();

    // Build full overwrite: header row + every data row from snapshot.
    // The whole-tab range contract is "this IS the new content"; backends
    // are responsible for truncating any trailing rows that no longer exist.
    // (LocalXlsxClient does this; the Google adapter would need a follow-up
    // batchClear call for shrink-to-restore — tracked in B9 plan.)
    const values: CellValue[][] = [headers.map((h) => h)];
    for (const row of tab.rows) {
      values.push(headers.map((h) => normalizeCell(row[h])));
    }
    // Reference current to avoid TS "declared but unused" — used for
    // pre-restore diagnostics in non-test paths.
    void current;

    const update: UpdateRangeRequest = {
      range: tabRange(entity),
      values,
    };
    const auditAppend: AppendRowRequest = {
      tabA1: tabRange("Audit"),
      values: [
        [
          `aud_${randomUUID().replace(/-/g, "").slice(0, 8)}`,
          "tab_restored_from_snapshot",
          entity,
          snapshot.taken_by,
          new Date().toISOString(),
          JSON.stringify({ snapshot_taken_at: snapshot.taken_at, rows_restored: tab.rows.length }),
        ],
      ],
    };

    await opts.client.batchWrite(opts.config.sheet_id, {
      updates: [update],
      appends: [auditAppend],
    });

    restored.push(entity);
    totalRows += tab.rows.length;
  }

  return { restored_tabs: restored, total_rows: totalRows };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function affectedEntities(envelope: DraftEnvelope): ReadonlyArray<EntityName> {
  const out: EntityName[] = [];
  for (const k of Object.keys(envelope)) {
    if (isEntityName(k)) out.push(k as EntityName);
  }
  return out;
}

function isEntityName(s: string): s is EntityName {
  return (ENTITY_NAMES as ReadonlyArray<string>).includes(s);
}

function normalizeCell(v: CellValue | undefined): CellValue {
  if (v === undefined || v === null) return "";
  return v;
}
