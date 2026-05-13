/**
 * Read / upsert / append primitives for the project Sheet.
 *
 * Composes config + client + schema + zone discipline into a small API:
 *
 *   - readRow(entity, id, opts)        → row | null
 *   - readAllRows(entity, opts)        → rows[]
 *   - upsertRow(entity, row, opts)     → UpsertResult (idempotent)
 *   - appendAuditRow(audit, opts)      → void
 *
 * Zone discipline: outside the bootstrap caller, planning columns are read-only.
 * Idempotency: an upsert that produces no diff returns was_no_op=true with no API call.
 * Resilience: 5xx / network errors raise SheetsError(sheet_unreachable); the CLI layer
 *   maps that to a queued event in the manifest. This file does NOT touch the manifest.
 */

import type {
  EntityName,
  SheetRow,
  UpsertResult,
  ProjectConfig,
  CallerScope,
  CellValue,
} from "./types.js";
import { randomUUID } from "node:crypto";
import { SheetsError, allowedZones, zoneOf } from "./types.js";
import { validatePartialRow, validateFullRow, nextId, isValidId } from "./schema.js";
import {
  type SheetsClient,
  type BatchWriteRequest,
  type UpdateRangeRequest,
  type AppendRowRequest,
  rowRange,
  tabRange,
  appendTarget,
} from "./client.js";

/** Options every read/write call needs. */
export interface BaseOptions {
  client: SheetsClient;
  config: ProjectConfig;
  /** Override clock for deterministic tests. */
  now?: () => Date;
}

export interface UpsertOptions extends BaseOptions {
  caller: CallerScope;
  /** git config user.email — recorded in Audit row. */
  actor: string;
  /** Optional payload for the Audit row. Defaults to a minimal record. */
  auditEvent?: { event_id: string; event_type: string; payload?: unknown };
}

export interface ParsedTab {
  header: ReadonlyArray<string>;
  /** Each row is keyed by header column name. Indexed by 0-based row offset. */
  rows: ReadonlyArray<SheetRow>;
  /** rowSheetIndex[i] is the 1-based Sheet row number of rows[i] (header is row 1, data starts row 2). */
  rowSheetIndex: ReadonlyArray<number>;
}

/** Read and parse a tab. Header is row 1; data follows. */
export async function readTab(entity: EntityName, opts: BaseOptions): Promise<ParsedTab> {
  const { values } = await opts.client.readRange(opts.config.sheet_id, tabRange(entity));
  if (values.length === 0) {
    return { header: [], rows: [], rowSheetIndex: [] };
  }
  const header = (values[0] ?? []).map((c) => stringify(c));
  const rows: SheetRow[] = [];
  const sheetIndex: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const raw = values[i];
    if (!raw) continue;
    const row: Record<string, CellValue | undefined> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c];
      if (key === undefined || key.length === 0) continue;
      const cell = raw[c];
      row[key] = cell ?? "";
    }
    rows.push(row);
    sheetIndex.push(i + 1);
  }
  return { header, rows, rowSheetIndex: sheetIndex };
}

/** Read a single row by id. Returns null if not present. */
export async function readRow(
  entity: EntityName,
  id: string,
  opts: BaseOptions,
): Promise<SheetRow | null> {
  if (!isValidId(entity, id)) {
    throw new SheetsError("schema_invalid", `id '${id}' does not match ${entity} pattern`, {
      entity,
      id,
    });
  }
  const tab = await readTab(entity, opts);
  const idx = findRowIndexById(tab, id);
  if (idx === -1) return null;
  const row = tab.rows[idx];
  if (!row) return null;
  validateFullRow(entity, row);
  return row;
}

/** Read all rows of a tab (validated). */
export async function readAllRows(
  entity: EntityName,
  opts: BaseOptions,
): Promise<ReadonlyArray<SheetRow>> {
  const tab = await readTab(entity, opts);
  for (const row of tab.rows) {
    validateFullRow(entity, row);
  }
  return tab.rows;
}

/**
 * Read all rows without full-row validation. Use this in display/listing
 * paths where a malformed row should be SHOWN (so the user can fix it),
 * not hidden behind a thrown SheetsError.
 *
 * Distinct from readAllRows because workflow callers rely on the validation;
 * silently widening that contract would erase a useful guard.
 */
export async function readAllRowsLenient(
  entity: EntityName,
  opts: BaseOptions,
): Promise<ReadonlyArray<SheetRow>> {
  const tab = await readTab(entity, opts);
  return tab.rows;
}

/** System-managed columns the caller may NOT write directly. _rev appears in
 *  payloads as an OCC token but is then discarded and auto-bumped. */
const SYSTEM_COLUMNS = new Set(["_rev", "archived_at", "archived_by", "__intent"]);

/** Idempotent upsert with optional optimistic-concurrency control.
 *
 *  OCC: when `row._rev` is present, the caller is asserting the current Sheet
 *  revision they read. If the on-Sheet `_rev` differs, a SheetsError("rev_conflict")
 *  is thrown — the caller should re-pull and retry. When `row._rev` is absent,
 *  OCC is skipped and last-write-wins applies (existing back-compat).
 */
export async function upsertRow(
  entity: EntityName,
  row: SheetRow,
  opts: UpsertOptions,
): Promise<UpsertResult> {
  // 1. Schema validation (partial — only fields present in payload).
  validatePartialRow(entity, row);

  // 1b. Strip system-managed columns from caller intent. The caller's _rev
  //     is captured separately for OCC; archived_at/by/__intent are routed
  //     through archiveRow, not upsertRow.
  const callerRev = parseRev(row["_rev"]);
  const writtenCols = Object.keys(row).filter(
    (k) => row[k] !== undefined && !SYSTEM_COLUMNS.has(k),
  );

  // 2. Zone enforcement (only on caller-visible columns; system columns are auto-managed).
  const allowed = allowedZones(opts.caller);
  for (const col of writtenCols) {
    const zone = zoneOf(entity, col);
    if (!allowed.includes(zone)) {
      throw new SheetsError(
        "zone_violation",
        `caller '${opts.caller}' may not write '${col}' (zone=${zone}) on ${entity}`,
        { caller: opts.caller, column: col, zone },
      );
    }
  }

  // 3. Read tab; find existing row by id (if id provided).
  const tab = await readTab(entity, opts);
  let existingIdx = -1;
  let assignedId = typeof row["id"] === "string" ? (row["id"] as string) : undefined;

  if (assignedId !== undefined) {
    existingIdx = findRowIndexById(tab, assignedId);
  }
  if (assignedId === undefined) {
    // New row — assign id from existing IDs.
    const existingIds = tab.rows
      .map((r) => (typeof r["id"] === "string" ? (r["id"] as string) : undefined))
      .filter((v): v is string => typeof v === "string");
    assignedId = nextId(entity, existingIds);
  }

  // 3b. OCC check: only when caller provided _rev AND row exists.
  if (callerRev !== undefined && existingIdx !== -1) {
    const existing = tab.rows[existingIdx];
    const currentRev = parseRev(existing?.["_rev"]) ?? 0;
    if (currentRev !== callerRev) {
      throw new SheetsError(
        "rev_conflict",
        `OCC conflict on ${entity} ${assignedId}: payload _rev=${callerRev}, sheet _rev=${currentRev}. ` +
          `Re-pull and retry.`,
        { entity, id: assignedId, expected_rev: callerRev, actual_rev: currentRev },
      );
    }
  }

  // 4. Diff. If existing row matches all written columns, no-op.
  if (existingIdx !== -1) {
    const existing = tab.rows[existingIdx];
    if (existing && rowsEqualOn(existing, row, writtenCols)) {
      return {
        entity,
        row_id: assignedId,
        columns_written: [],
        was_no_op: true,
      };
    }
  }

  // 5. Build write request.
  const now = (opts.now ?? (() => new Date()))();
  const finalRow: Record<string, CellValue> = {};
  // Start from existing row if present (preserve unwritten columns).
  if (existingIdx !== -1) {
    const existing = tab.rows[existingIdx];
    if (existing) {
      for (const k of Object.keys(existing)) {
        const v = existing[k];
        finalRow[k] = v ?? "";
      }
    }
  }
  // Overlay the upserted columns.
  for (const k of writtenCols) {
    const v = row[k];
    finalRow[k] = v === undefined ? "" : v;
  }
  // Always set id and created_at-on-insert.
  finalRow["id"] = assignedId;
  if (existingIdx === -1 && !finalRow["created_at"]) {
    finalRow["created_at"] = now.toISOString();
  }
  // 5b. Auto-bump _rev. Insert → 1, update → existing+1. Legacy rows missing
  //     _rev are treated as 0 → first write lands them at 1.
  if (existingIdx === -1) {
    finalRow["_rev"] = 1;
  } else {
    const existing = tab.rows[existingIdx];
    const current = parseRev(existing?.["_rev"]) ?? 0;
    finalRow["_rev"] = current + 1;
  }

  // 6. Determine target row in the Sheet.
  const headers = ensureHeaders(tab, entity);
  const rowValues = headersToRow(headers, finalRow);
  const update: UpdateRangeRequest =
    existingIdx !== -1
      ? {
          range: rowRange(entity, tab.rowSheetIndex[existingIdx] ?? existingIdx + 2),
          values: [rowValues],
        }
      : {
          range: appendTarget(entity), // will be appended; range gives the tab anchor
          values: [rowValues],
        };

  // 7. Build Audit row.
  const auditEventId = opts.auditEvent?.event_id ?? `aud_${cryptoRandom()}`;
  const auditEventType = opts.auditEvent?.event_type ?? "sheet_row_upserted";
  const auditPayload = opts.auditEvent?.payload ?? { entity, columns_written: writtenCols };
  const auditAppend: AppendRowRequest = {
    tabA1: appendTarget("Audit"),
    values: [
      [
        auditEventId,
        auditEventType,
        assignedId,
        opts.actor,
        now.toISOString(),
        JSON.stringify(auditPayload),
      ],
    ],
  };

  // 8. Submit batch write. For new rows we use append rather than update.
  const batch: BatchWriteRequest =
    existingIdx !== -1
      ? { updates: [update], appends: [auditAppend] }
      : {
          updates: [],
          appends: [{ tabA1: appendTarget(entity), values: [rowValues] }, auditAppend],
        };

  await opts.client.batchWrite(opts.config.sheet_id, batch);

  return {
    entity,
    row_id: assignedId,
    columns_written: writtenCols,
    was_no_op: false,
  };
}

/**
 * Soft-delete a row by id. Sets `status=abandoned`, `archived_at=<now>`,
 * `archived_by=<actor>`. Idempotent: archiving an already-archived row is
 * a no-op. Throws SheetsError("row_missing") if the row does not exist.
 */
export async function archiveRow(
  entity: EntityName,
  id: string,
  opts: UpsertOptions & { reason?: string },
): Promise<UpsertResult> {
  const tab = await readTab(entity, opts);
  const idx = findRowIndexById(tab, id);
  if (idx === -1) {
    throw new SheetsError("row_missing", `cannot archive: ${entity} ${id} not found`, {
      entity,
      id,
    });
  }
  const existing = tab.rows[idx];
  if (
    existing &&
    existing["archived_at"] !== undefined &&
    existing["archived_at"] !== null &&
    existing["archived_at"] !== ""
  ) {
    return { entity, row_id: id, columns_written: [], was_no_op: true };
  }
  const now = (opts.now ?? (() => new Date()))();

  // Use upsertRow with the same caller scope; we set the archive marker columns
  // via a payload that ALREADY includes them, then patch upsertRow's filtering
  // to allow internal callers to write system columns. Cleanest way: write
  // directly here, bypassing upsertRow's system-column filter.
  const finalRow: Record<string, CellValue> = {};
  for (const k of Object.keys(existing ?? {})) {
    const v = existing?.[k];
    finalRow[k] = v ?? "";
  }
  finalRow["status"] = "abandoned";
  finalRow["archived_at"] = now.toISOString();
  finalRow["archived_by"] = opts.actor;
  const currentRev = parseRev(existing?.["_rev"]) ?? 0;
  finalRow["_rev"] = currentRev + 1;

  const headers = ensureHeaders(tab, entity);
  const rowValues = headersToRow(headers, finalRow);
  const update: UpdateRangeRequest = {
    range: rowRange(entity, tab.rowSheetIndex[idx] ?? idx + 2),
    values: [rowValues],
  };

  const auditEventId = opts.auditEvent?.event_id ?? `aud_${cryptoRandom()}`;
  const auditAppend: AppendRowRequest = {
    tabA1: appendTarget("Audit"),
    values: [
      [
        auditEventId,
        "row_archived",
        id,
        opts.actor,
        now.toISOString(),
        JSON.stringify({ entity, reason: opts.reason ?? null }),
      ],
    ],
  };

  await opts.client.batchWrite(opts.config.sheet_id, {
    updates: [update],
    appends: [auditAppend],
  });

  return {
    entity,
    row_id: id,
    columns_written: ["status", "archived_at", "archived_by", "_rev"],
    was_no_op: false,
  };
}

/** Append a row to the Audit tab without writing an entity row. Used by reconcile. */
export async function appendAuditRow(
  audit: { event_id: string; event_type: string; entity_id: string; payload?: unknown },
  opts: { client: SheetsClient; config: ProjectConfig; actor: string; now?: () => Date },
): Promise<void> {
  const now = (opts.now ?? (() => new Date()))();
  const append: AppendRowRequest = {
    tabA1: appendTarget("Audit"),
    values: [
      [
        audit.event_id,
        audit.event_type,
        audit.entity_id,
        opts.actor,
        now.toISOString(),
        JSON.stringify(audit.payload ?? {}),
      ],
    ],
  };
  await opts.client.batchWrite(opts.config.sheet_id, { updates: [], appends: [append] });
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

function findRowIndexById(tab: ParsedTab, id: string): number {
  for (let i = 0; i < tab.rows.length; i++) {
    const r = tab.rows[i];
    if (r && r["id"] === id) return i;
  }
  return -1;
}

function rowsEqualOn(
  existing: SheetRow,
  candidate: SheetRow,
  cols: ReadonlyArray<string>,
): boolean {
  for (const c of cols) {
    const a = existing[c];
    const b = candidate[c];
    if (normalize(a) !== normalize(b)) return false;
  }
  return true;
}

function normalize(v: CellValue | undefined): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

function stringify(v: CellValue | undefined): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

/**
 * If the tab has no header (empty Sheet), synthesize headers from the entity's
 * known columns. The canonical template ships with headers populated, so this
 * fallback only matters for hand-bootstrapped or test Sheets.
 */
function ensureHeaders(tab: ParsedTab, entity: EntityName): ReadonlyArray<string> {
  if (tab.header.length > 0) return tab.header;
  return DEFAULT_HEADERS[entity];
}

function headersToRow(
  headers: ReadonlyArray<string>,
  data: Readonly<Record<string, CellValue>>,
): ReadonlyArray<CellValue> {
  return headers.map((h) => {
    const v = data[h];
    return v === undefined ? "" : v;
  });
}

function cryptoRandom(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Parse a `_rev` cell to an integer, returning undefined when missing or
 * unparseable. Tolerates string round-trips ("3" → 3) since Sheets often
 * coerces numerics to strings on read.
 */
function parseRev(v: CellValue | undefined): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Safety columns appended to every entity tab (NOT Audit). */
const SAFETY_COLUMNS = ["_rev", "archived_at", "archived_by"] as const;

/** Default headers per entity — used only when the Sheet tab is empty. */
const DEFAULT_HEADERS: Record<EntityName, ReadonlyArray<string>> = {
  BusinessGoal: [
    "id",
    "title",
    "outcome",
    "metric",
    "priority",
    "source_link",
    "status",
    "created_at",
    ...SAFETY_COLUMNS,
  ],
  Requirement: [
    "id",
    "type",
    "title",
    "behavior_or_threshold",
    "satisfies",
    "priority",
    "status",
    "created_at",
    ...SAFETY_COLUMNS,
  ],
  UserStory: [
    "id",
    "as_a",
    "i_want",
    "so_that",
    "acceptance_criteria",
    "priority",
    "assigned_to",
    "parent_story",
    "elaborated_from",
    "workflow_type",
    "branch",
    "commit_shas",
    "design_doc_path",
    "pr_url",
    "pr_state",
    "merged_sha",
    "merged_at",
    "started_at",
    "completed_at",
    "status",
    "created_at",
    ...SAFETY_COLUMNS,
  ],
  Release: [
    "id",
    "version",
    "released_at",
    "story_ids",
    "commit_range",
    "release_notes_link",
    ...SAFETY_COLUMNS,
  ],
  Audit: ["event_id", "event_type", "entity_id", "actor", "timestamp", "payload_json"],
};
