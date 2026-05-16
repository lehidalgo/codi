/**
 * SheetsClient implementation backed by a local .xlsx file (exceljs).
 *
 * Plugs into the existing operations.ts / transactions.ts / integrity.ts
 * stack at the SheetsClient interface — no upstream code changes.
 *
 * A1 range semantics:
 *   - "Tab!A1:Z"     → entire tab data range (all rows)
 *   - "Tab!A2:Z2"    → row 2 only
 *   - "Tab!A1"       → cell A1 (used as anchor for appendRow)
 *
 * Writes are atomic at the file level: the whole workbook is loaded,
 * mutated in memory, written to <path>.tmp, fsynced, then renamed over
 * the original. A crash mid-write leaves either the prior file or the
 * new file — never a partial write.
 */

import {
  existsSync,
  mkdirSync,
  promises as fsp,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { dirname } from "node:path";

import ExcelJS from "exceljs";

import type {
  SheetsClient,
  ReadRangeResult,
  BatchWriteRequest,
  A1Range,
  AppendRowRequest,
  UpdateRangeRequest,
} from "./client.js";
import type { CellValue } from "./types.js";
import { SheetsError } from "./types.js";

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * SheetsClient against a local .xlsx file. Stateless; loads the workbook on
 * each call. Acceptable because: workflow phases are short, write batches are
 * small, and reload-on-each-op makes Excel-open-mid-write detection trivial.
 */
export class LocalXlsxClient implements SheetsClient {
  constructor(public readonly filePath: string) {
    // No I/O at construction — defer to readRange / batchWrite.
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw new SheetsError("schema_invalid", "LocalXlsxClient requires a file path", {});
    }
  }

  async readRange(_spreadsheetId: string, range: A1Range): Promise<ReadRangeResult> {
    if (!existsSync(this.filePath)) {
      throw new SheetsError(
        "sheet_unreachable",
        `LocalXlsxClient: file not found at ${this.filePath}`,
        { filePath: this.filePath },
      );
    }
    const wb = await loadWorkbook(this.filePath);
    const { tabName } = parseRange(range);
    const ws = wb.getWorksheet(tabName);
    if (!ws) {
      // Empty result (consumer will treat as "tab missing"; readTab maps that to empty header+rows).
      return { range, values: [] };
    }
    const values = readWorksheetValues(ws);
    return { range, values };
  }

  async batchWrite(_spreadsheetId: string, request: BatchWriteRequest): Promise<void> {
    const wb = existsSync(this.filePath)
      ? await loadWorkbook(this.filePath)
      : new ExcelJS.Workbook();

    for (const u of request.updates) applyUpdate(wb, u);
    for (const a of request.appends) applyAppend(wb, a);

    await writeWorkbookAtomic(wb, this.filePath);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ParsedRange {
  tabName: string;
  /** First row referenced (1-based, inclusive). undefined = whole tab. */
  startRow?: number;
  /** Last row referenced (1-based, inclusive). undefined = whole tab. */
  endRow?: number;
}

/**
 * Parse A1 ranges in the limited shape codi produces:
 *   "Tab"          → whole tab
 *   "Tab!A1"       → anchor cell (used by append)
 *   "Tab!A1:Z"     → whole-column open range → whole tab
 *   "Tab!A2:Z2"    → row 2 only
 *   "Tab!A2:Z5"    → rows 2..5
 */
function parseRange(range: A1Range): ParsedRange {
  const bang = range.indexOf("!");
  if (bang === -1) {
    return { tabName: range.replace(/^'|'$/g, "") };
  }
  const tabName = range.slice(0, bang).replace(/^'|'$/g, "");
  const cells = range.slice(bang + 1);
  // Match patterns like A1, A2:Z2, A1:Z, etc.
  const m = cells.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/);
  if (!m) return { tabName };
  const startRow = m[2] ? Number.parseInt(m[2], 10) : undefined;
  const endRow = m[4] ? Number.parseInt(m[4], 10) : undefined;
  const result: ParsedRange = { tabName };
  if (startRow !== undefined) result.startRow = startRow;
  if (endRow !== undefined) result.endRow = endRow;
  return result;
}

function readWorksheetValues(ws: ExcelJS.Worksheet): CellValue[][] {
  // Determine canonical row width from the header row (row 1). This avoids
  // exceljs's sparse-row.values gotcha where empty trailing cells make
  // row.values shorter than the row actually is.
  const headerRow = ws.getRow(1);
  let width = 0;
  const hv = headerRow.values;
  if (Array.isArray(hv)) {
    width = Math.max(0, hv.length - 1);
  }
  if (width === 0) {
    // Fall back to worksheet-level column count.
    width = ws.columnCount ?? 0;
  }
  if (width === 0) return [];

  const rows: CellValue[][] = [];
  const lastRow = ws.actualRowCount ?? 0;
  for (let r = 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const out: CellValue[] = [];
    for (let c = 1; c <= width; c++) {
      out.push(coerceCellValue(row.getCell(c).value));
    }
    rows.push(out);
  }
  return rows;
}

function coerceCellValue(v: unknown): CellValue {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString();
  // exceljs Hyperlink, RichText, formula objects → coerce to string
  if (typeof v === "object") {
    const obj = v as { text?: string; richText?: { text?: string }[]; result?: unknown };
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text ?? "").join("");
    if (obj.result !== undefined) return coerceCellValue(obj.result);
  }
  return String(v);
}

function applyUpdate(wb: ExcelJS.Workbook, u: UpdateRangeRequest): void {
  const { tabName, startRow } = parseRange(u.range);

  if (startRow === undefined) {
    // Whole-tab overwrite (used by restoreFromSnapshot).
    // exceljs's spliceRows + worksheet recreation both leave phantom rows
    // in some cases. The reliable fix: clear every row's cells by walking
    // the existing worksheet and explicitly null-ing each cell, then
    // splice down the row count, then write the new content.
    const ws = wb.getWorksheet(tabName) ?? wb.addWorksheet(tabName);
    const oldRowCount = ws.actualRowCount;
    // Wipe every cell of every existing row (in case xlsx serializer
    // persists otherwise-orphaned cells past the spliced boundary).
    for (let r = 1; r <= oldRowCount; r++) {
      const row = ws.getRow(r);
      const cellCount = row.cellCount ?? 0;
      for (let c = 1; c <= Math.max(cellCount, 30); c++) {
        row.getCell(c).value = null;
      }
      row.commit();
    }
    // Now collapse to nothing and rebuild from the payload.
    if (oldRowCount > 0) ws.spliceRows(1, oldRowCount);
    for (let i = 0; i < u.values.length; i++) {
      writeRow(ws, i + 1, u.values[i] ?? []);
    }
    return;
  }

  // Targeted single-row update.
  const ws = wb.getWorksheet(tabName) ?? wb.addWorksheet(tabName);
  for (let i = 0; i < u.values.length; i++) {
    writeRow(ws, startRow + i, u.values[i] ?? []);
  }
}

function applyAppend(wb: ExcelJS.Workbook, a: AppendRowRequest): void {
  const { tabName } = parseRange(a.tabA1);
  const ws = wb.getWorksheet(tabName) ?? wb.addWorksheet(tabName);
  const start = ws.actualRowCount === 0 ? 1 : ws.actualRowCount + 1;
  for (let i = 0; i < a.values.length; i++) {
    writeRow(ws, start + i, a.values[i] ?? []);
  }
}

function writeRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  values: ReadonlyArray<CellValue>,
): void {
  const row = ws.getRow(rowNumber);
  // Use explicit getCell() rather than row.values = [undefined, ...] —
  // exceljs's row.values setter has a subtle off-by-one when the array's
  // length doesn't match the worksheet's columnCount, which corrupted writes.
  for (let i = 0; i < values.length; i++) {
    row.getCell(i + 1).value = values[i] as ExcelJS.CellValue;
  }
  row.commit();
}

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(filePath);
  } catch (e) {
    throw new SheetsError(
      "sheet_unreachable",
      `LocalXlsxClient: failed to read ${filePath}: ${(e as Error).message}`,
      { filePath },
    );
  }
  return wb;
}

/**
 * Atomic write: write to <path>.tmp, fsync, rename over the original.
 * A mid-write crash leaves either the old file or the new file, never a
 * partial. Mirrors the Sheet-side atomicity guarantee.
 */
async function writeWorkbookAtomic(wb: ExcelJS.Workbook, filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  await wb.xlsx.writeFile(tmpPath);

  // fsync the tmp file before rename so the on-disk content is durable.
  const fd = openSync(tmpPath, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  renameSync(tmpPath, filePath);

  // Best-effort fsync the directory so the rename is durable too. Optional
  // on Linux, no-op on macOS/Windows in many cases; ignore errors.
  try {
    const dfd = openSync(dir, "r");
    try {
      fsyncSync(dfd);
    } finally {
      closeSync(dfd);
    }
  } catch {
    /* ignore */
  }

  // Suppress unused-import warning if fsp is later unused
  void fsp;
}
