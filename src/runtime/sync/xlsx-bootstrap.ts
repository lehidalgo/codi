/**
 * Bootstrap a fresh local .xlsx workbook with the canonical 6 tabs +
 * headers + safety columns. The local_xlsx counterpart of
 * `bootstrap.ts::createProjectSheet` / `bootstrapExistingSheet`.
 *
 * Same headers / column zones / safety columns as the Google path so the two
 * backends stay swappable. Pushing to Google later (B9) is just a per-row
 * upsert — no schema migration required.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import ExcelJS from "exceljs";

import { SheetsError } from "./types.js";

// Canonical headers — keep in sync with lib/sheets/bootstrap.ts::TAB_HEADERS
// and lib/sheets/operations.ts::DEFAULT_HEADERS. A unit test verifies parity.
const SAFETY_COLUMNS = ["_rev", "archived_at", "archived_by"] as const;

const TAB_HEADERS: Record<string, ReadonlyArray<string>> = {
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
  Dashboard: ["metric", "value", "as_of"],
  Audit: ["event_id", "event_type", "entity_id", "actor", "timestamp", "payload_json"],
};

const ALL_TABS = [
  "BusinessGoal",
  "Requirement",
  "UserStory",
  "Release",
  "Dashboard",
  "Audit",
] as const;

export interface CreateLocalXlsxOptions {
  /** Absolute file path for the workbook. */
  filePath: string;
  /** Refuse to overwrite an existing file unless force=true. */
  force?: boolean;
}

export interface CreateLocalXlsxResult {
  file_path: string;
  tabs_created: ReadonlyArray<string>;
}

/**
 * Create a fresh local .xlsx workbook with all six canonical tabs + headers.
 *
 * Behavior:
 *   - file already exists, force=false → throw schema_invalid
 *   - file already exists, force=true  → overwrite (caller is expected to
 *     have snapshotted via createSnapshot first)
 *   - file does not exist              → create + parent directories
 */
export async function createLocalXlsxProject(
  opts: CreateLocalXlsxOptions,
): Promise<CreateLocalXlsxResult> {
  if (existsSync(opts.filePath) && opts.force !== true) {
    throw new SheetsError(
      "schema_invalid",
      `Refusing to bootstrap into ${opts.filePath}: file already exists. ` +
        `Use a different --local-path or pass --force.`,
      { file_path: opts.filePath },
    );
  }

  const dir = dirname(opts.filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const wb = new ExcelJS.Workbook();
  wb.creator = "codi";
  wb.created = new Date();

  for (const tab of ALL_TABS) {
    const ws = wb.addWorksheet(tab);
    const headers = TAB_HEADERS[tab];
    if (!headers || headers.length === 0) {
      throw new SheetsError("schema_invalid", `xlsx-bootstrap: missing headers for tab ${tab}`, {
        tab,
      });
    }
    ws.addRow([...headers]);
    // Bold header row + freeze for usability.
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  await wb.xlsx.writeFile(opts.filePath);
  return { file_path: opts.filePath, tabs_created: [...ALL_TABS] };
}

/**
 * Read-only accessor for the canonical header set. Exported so the bridge
 * code (push-to-google, B9) and tests can verify schema parity without
 * duplicating the lists.
 */
export function localXlsxTabHeaders(tab: string): ReadonlyArray<string> | undefined {
  return TAB_HEADERS[tab];
}

export const LOCAL_XLSX_TABS = ALL_TABS;
