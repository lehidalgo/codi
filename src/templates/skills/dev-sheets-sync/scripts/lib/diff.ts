/**
 * Compute a row-level + column-level diff between a draft (intent) and the
 * current Sheet state (truth). Pure function. No I/O.
 *
 * Used by:
 *   - sync-draft --preview         show inserts / updates / no-ops / conflicts
 *                                  before writing
 *   - codi sheets diff <draft>  ad-hoc diff inspection
 *   - patch-model conflict surfacer  if a row's pulled value diverges from
 *                                    the Sheet's current value, mark
 *                                    "stale_pull" so the agent re-pulls
 *
 * Categorization rules:
 *   - delete_intent  draft row carries `__intent: "archive"` → soft-delete
 *   - insert         id absent from sheetState (or no id at all)
 *   - no_op          id present in sheetState; all written columns equal
 *   - update         id present in sheetState; ≥1 written column changes
 *   - stale_pull     (only when `pulledState` provided) id present in
 *                    sheetState but its value differs from `pulledState`
 *                    on a column the draft also writes — meaning someone
 *                    edited the Sheet between the agent's pull and the
 *                    impending write
 */

import type { EntityName, SheetRow, CellValue } from "./types.js";
import { ENTITY_NAMES } from "./types.js";
import type { DraftEnvelope } from "./integrity.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DiffKind = "insert" | "update" | "no_op" | "delete_intent" | "stale_pull";

export interface ColumnChange {
  column: string;
  before: CellValue | undefined;
  after: CellValue | undefined;
}

export interface RowDiff {
  entity: EntityName;
  index: number;
  id: string | undefined;
  kind: DiffKind;
  changed_columns: ReadonlyArray<ColumnChange>;
  /** When kind=stale_pull, the columns whose pulled value ≠ current Sheet value. */
  stale_columns?: ReadonlyArray<string>;
}

export interface EntityCounts {
  inserts: number;
  updates: number;
  no_ops: number;
  delete_intents: number;
  stale_pulls: number;
}

export interface DiffSummary {
  total: number;
  by_entity: Partial<Record<EntityName, EntityCounts>>;
  rows: ReadonlyArray<RowDiff>;
}

export interface ComputeDiffOptions {
  /** Current Sheet state (the truth). Per-entity rows arrays. */
  sheetState?: Partial<Record<EntityName, ReadonlyArray<SheetRow>>>;
  /**
   * Snapshot the agent pulled BEFORE editing. Used to detect "someone else
   * edited between pull and apply" — if pulledState has a value for a column
   * that differs from current sheetState on the same row, stale_pull fires
   * for that row regardless of what the draft wants.
   */
  pulledState?: Partial<Record<EntityName, ReadonlyArray<SheetRow>>>;
}

const ARCHIVE_INTENT_KEY = "__intent";
const ARCHIVE_INTENT_VALUE = "archive";

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeDiff(draft: DraftEnvelope, opts: ComputeDiffOptions = {}): DiffSummary {
  const sheetState = opts.sheetState ?? {};
  const pulledState = opts.pulledState ?? {};

  const rows: RowDiff[] = [];
  const byEntity: Partial<Record<EntityName, EntityCounts>> = {};

  for (const [entityKey, draftRows] of Object.entries(draft)) {
    if (!isEntityName(entityKey)) continue;
    const entity = entityKey as EntityName;
    const counts: EntityCounts = {
      inserts: 0,
      updates: 0,
      no_ops: 0,
      delete_intents: 0,
      stale_pulls: 0,
    };

    const sheetIndex = indexById(sheetState[entity]);
    const pulledIndex = indexById(pulledState[entity]);

    for (let i = 0; i < draftRows.length; i++) {
      const row = draftRows[i];
      if (!row) continue;
      const id = stringIdOrUndefined(row);

      // ── delete_intent: highest priority, short-circuit
      if (row[ARCHIVE_INTENT_KEY] === ARCHIVE_INTENT_VALUE) {
        rows.push({ entity, index: i, id, kind: "delete_intent", changed_columns: [] });
        counts.delete_intents++;
        continue;
      }

      // ── insert: no id, or id not in current Sheet
      if (id === undefined || !sheetIndex.has(id)) {
        const changed = listColumnChanges(undefined, row);
        rows.push({ entity, index: i, id, kind: "insert", changed_columns: changed });
        counts.inserts++;
        continue;
      }

      // ── stale_pull: pulled value diverges from current Sheet on a column
      //    the draft writes
      const current = sheetIndex.get(id);
      const pulled = pulledIndex.get(id);
      if (pulled !== undefined && current !== undefined) {
        const stale = staleColumns(pulled, current, writtenColumns(row));
        if (stale.length > 0) {
          rows.push({
            entity,
            index: i,
            id,
            kind: "stale_pull",
            changed_columns: listColumnChanges(current, row),
            stale_columns: stale,
          });
          counts.stale_pulls++;
          continue;
        }
      }

      // ── no_op vs update
      const changed = listColumnChanges(current, row);
      if (changed.length === 0) {
        rows.push({ entity, index: i, id, kind: "no_op", changed_columns: [] });
        counts.no_ops++;
      } else {
        rows.push({ entity, index: i, id, kind: "update", changed_columns: changed });
        counts.updates++;
      }
    }

    byEntity[entity] = counts;
  }

  return { total: rows.length, by_entity: byEntity, rows };
}

/**
 * Render a DiffSummary for human reading. Compact by default; pass
 * `showColumns: true` to list every changed column on every row.
 */
export function formatDiffSummary(diff: DiffSummary, opts: { showColumns?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push(`diff preview — ${diff.total} row${diff.total === 1 ? "" : "s"}`);
  lines.push("");
  for (const entity of ENTITY_NAMES) {
    const c = diff.by_entity[entity];
    if (!c) continue;
    lines.push(
      `  ${entity.padEnd(13)} ` +
        `${c.inserts} insert` +
        (c.inserts === 1 ? ", " : "s, ") +
        `${c.updates} update` +
        (c.updates === 1 ? ", " : "s, ") +
        `${c.no_ops} no-op` +
        (c.no_ops === 1 ? ", " : "s, ") +
        `${c.delete_intents} archive` +
        (c.delete_intents === 1 ? ", " : "s, ") +
        `${c.stale_pulls} stale-pull` +
        (c.stale_pulls === 1 ? "" : "s"),
    );
  }

  const stale = diff.rows.filter((r) => r.kind === "stale_pull");
  if (stale.length > 0) {
    lines.push("");
    lines.push(`  ⚠  stale-pull rows (Sheet changed since you pulled — re-pull recommended):`);
    for (const r of stale) {
      lines.push(`    ${r.entity} ${r.id ?? "(?)"}  cols: ${(r.stale_columns ?? []).join(", ")}`);
    }
  }

  if (opts.showColumns) {
    lines.push("");
    lines.push(`  Changed columns:`);
    for (const r of diff.rows) {
      if (r.kind === "no_op") continue;
      if (r.changed_columns.length === 0) continue;
      lines.push(`    ${r.entity} ${r.id ?? "(no id)"}  [${r.kind}]`);
      for (const c of r.changed_columns) {
        lines.push(`      ${c.column}: ${formatCell(c.before)} → ${formatCell(c.after)}`);
      }
    }
  }

  return lines.join("\n");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isEntityName(s: string): s is EntityName {
  return (ENTITY_NAMES as ReadonlyArray<string>).includes(s);
}

function stringIdOrUndefined(row: SheetRow): string | undefined {
  const id = row["id"];
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function indexById(rows?: ReadonlyArray<SheetRow>): Map<string, SheetRow> {
  const map = new Map<string, SheetRow>();
  if (!rows) return map;
  for (const r of rows) {
    const id = r["id"];
    if (typeof id === "string" && id.length > 0) map.set(id, r);
  }
  return map;
}

function writtenColumns(row: SheetRow): ReadonlyArray<string> {
  return Object.keys(row).filter((k) => row[k] !== undefined && k !== ARCHIVE_INTENT_KEY);
}

function listColumnChanges(before: SheetRow | undefined, after: SheetRow): ColumnChange[] {
  const changes: ColumnChange[] = [];
  for (const col of writtenColumns(after)) {
    if (col === "id") continue;
    const a = after[col];
    const b = before?.[col];
    if (cellsEqual(a, b)) continue;
    changes.push({ column: col, before: b, after: a });
  }
  return changes;
}

function staleColumns(
  pulled: SheetRow,
  current: SheetRow,
  cols: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const stale: string[] = [];
  for (const col of cols) {
    if (col === "id") continue;
    if (!cellsEqual(pulled[col], current[col])) stale.push(col);
  }
  return stale;
}

/**
 * Cell equality treats `undefined`, `null`, and `""` as equivalent (the
 * Sheet round-trips empty cells inconsistently across reads/writes).
 */
function cellsEqual(a: CellValue | undefined, b: CellValue | undefined): boolean {
  if (a === undefined && b === undefined) return true;
  if (isEmpty(a) && isEmpty(b)) return true;
  return a === b;
}

function isEmpty(v: CellValue | undefined): boolean {
  return v === undefined || v === null || v === "";
}

function formatCell(v: CellValue | undefined): string {
  if (v === undefined) return "(unset)";
  if (v === null) return "null";
  if (typeof v === "string") return v.length > 60 ? `"${v.slice(0, 57)}…"` : `"${v}"`;
  return String(v);
}
