/**
 * Thin wrapper around googleapis Sheets v4.
 *
 * Exposes a SheetsClient interface so operations.ts can be unit-tested with
 * a mock implementation. The real GoogleSheetsClient delegates to googleapis;
 * tests inject an in-memory FakeSheetsClient (see tests/sheets/).
 *
 * Errors are normalized: 5xx and network issues become SheetsError(sheet_unreachable);
 * other failures bubble up unchanged so callers can decide.
 */

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import type { JWT, OAuth2Client, GoogleAuth } from "google-auth-library";

import type { CellValue } from "./types.js";
import { SheetsError } from "./types.js";

/** Either auth flavour googleapis accepts. JWT for SA mode, GoogleAuth for OAuth ADC. */
export type SheetsAuthClient = JWT | OAuth2Client | GoogleAuth;

/** A1-notation cell reference (e.g. "UserStory!A1", "Audit!A1:F1"). */
export type A1Range = string;

export interface ReadRangeResult {
  range: A1Range;
  values: ReadonlyArray<ReadonlyArray<CellValue>>;
}

/** A single targeted update — replaces a range with the given values. */
export interface UpdateRangeRequest {
  range: A1Range;
  values: ReadonlyArray<ReadonlyArray<CellValue>>;
}

/** Append values at the end of a tab — used for Audit rows. */
export interface AppendRowRequest {
  tabA1: A1Range; // e.g. "Audit!A1"
  values: ReadonlyArray<ReadonlyArray<CellValue>>;
}

/** Atomic batch — all update + append requests commit together or fail together. */
export interface BatchWriteRequest {
  updates: ReadonlyArray<UpdateRangeRequest>;
  appends: ReadonlyArray<AppendRowRequest>;
}

export interface SheetsClient {
  readRange(spreadsheetId: string, range: A1Range): Promise<ReadRangeResult>;
  batchWrite(spreadsheetId: string, request: BatchWriteRequest): Promise<void>;
}

/** Real client backed by googleapis. Accepts either a JWT (service-account mode)
 *  or any GoogleAuthClient subtype (oauth_user mode via ADC). */
export class GoogleSheetsClient implements SheetsClient {
  private readonly sheets: sheets_v4.Sheets;

  constructor(auth: SheetsAuthClient) {
    this.sheets = google.sheets({ version: "v4", auth });
  }

  async readRange(spreadsheetId: string, range: A1Range): Promise<ReadRangeResult> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const values = (res.data.values ?? []) as ReadonlyArray<ReadonlyArray<CellValue>>;
      return { range, values };
    } catch (e) {
      throw normalizeSheetsError(e, "readRange", { spreadsheetId, range });
    }
  }

  async batchWrite(spreadsheetId: string, request: BatchWriteRequest): Promise<void> {
    try {
      // batchUpdate by values supports both targeted updates and append-to-end semantics.
      // For appends, we use spreadsheets.values.append separately because batchUpdateByDataFilter
      // does not support append. We bundle them into a single try/catch so a single failure
      // surfaces as one error, but commits are not strictly atomic across the two API calls.
      // Audit-row safety: we always perform the entity update FIRST, then the audit append.
      // If append fails, callers must reconcile via devloop sheets reconcile.
      if (request.updates.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data: request.updates.map((u) => ({
              range: u.range,
              values: u.values as CellValue[][],
            })),
          },
        });
      }
      for (const append of request.appends) {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId,
          range: append.tabA1,
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          requestBody: {
            values: append.values as CellValue[][],
          },
        });
      }
    } catch (e) {
      throw normalizeSheetsError(e, "batchWrite", { spreadsheetId });
    }
  }
}

/** Map googleapis errors to our SheetsError vocabulary. */
function normalizeSheetsError(
  e: unknown,
  op: string,
  context: Readonly<Record<string, unknown>>,
): Error {
  if (e instanceof SheetsError) return e;
  const err = e as { code?: number; status?: number; message?: string };
  const status = typeof err.code === "number" ? err.code : err.status;
  const message = err.message ?? String(e);
  if (status !== undefined && status >= 500) {
    return new SheetsError("sheet_unreachable", `Sheets ${op} failed with ${status}: ${message}`, {
      ...context,
      status,
    });
  }
  // Network-level failures often arrive without status set.
  if (status === undefined && /ENOTFOUND|ECONNRESET|ETIMEDOUT|fetch failed/i.test(message)) {
    return new SheetsError("sheet_unreachable", `Sheets ${op} network error: ${message}`, context);
  }
  // Anything else (4xx, schema errors, etc.) — bubble as a plain Error so callers don't queue.
  return e instanceof Error ? e : new Error(message);
}

/** Build the standard tab range "Tab!A:Z" for full-tab reads. */
export function tabRange(tab: string): A1Range {
  return `${tab}!A:Z`;
}

/** Build a row-update range for a row index (1-based). E.g., row 7 → "UserStory!A7:Z7". */
export function rowRange(tab: string, rowIndex: number): A1Range {
  return `${tab}!A${rowIndex}:Z${rowIndex}`;
}

/** Append target — Sheets append API treats range as "find first empty row in this column". */
export function appendTarget(tab: string): A1Range {
  return `${tab}!A1`;
}

/**
 * Pick the right SheetsClient backend based on the resolved AuthClient.
 * - service_account / oauth_user → GoogleSheetsClient (googleapis)
 * - local_xlsx                   → LocalXlsxClient (exceljs)
 *
 * Centralized so every CLI handler that previously did
 *   `new GoogleSheetsClient(authClient.client)`
 * becomes a single call regardless of backend.
 */
export async function makeSheetsClient(authClient: {
  kind: "service_account" | "oauth_user" | "local_xlsx";
  client?: SheetsAuthClient;
  filePath?: string;
}): Promise<SheetsClient> {
  if (authClient.kind === "local_xlsx") {
    if (!authClient.filePath) {
      throw new SheetsError("schema_invalid", "local_xlsx auth missing filePath", {});
    }
    const { LocalXlsxClient } = await import("./xlsx-client.js");
    return new LocalXlsxClient(authClient.filePath);
  }
  if (!authClient.client) {
    throw new SheetsError("schema_invalid", `${authClient.kind} auth missing client`, {});
  }
  return new GoogleSheetsClient(authClient.client);
}
