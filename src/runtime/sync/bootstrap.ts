/**
 * Sheet bootstrap — creates a new project Sheet with the 6 canonical tabs
 * populated with their headers.
 *
 * Used by project-workflow.intent when the user chooses "create new" rather
 * than attaching an existing Sheet.
 *
 * Out of scope for v0.1:
 *   - protected ranges on execution columns (manual setup; can be added later
 *     via spreadsheets.batchUpdate addProtectedRange requests)
 *   - data validation (dropdowns, regex)
 *   - Dashboard tab formulas (planned for P7)
 */

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import type { JWT, OAuth2Client, GoogleAuth } from "google-auth-library";

import { ENTITY_NAMES } from "./types.js";
import { SheetsError } from "./types.js";

/** Auth shape both modes return. */
type SheetsAuth = JWT | OAuth2Client | GoogleAuth;
/** Mode tag for branching the folder-required logic. Optional; defaults to "service_account". */
type AuthModeTag = "service_account" | "oauth_user";

/** Headers per tab — duplicates the DEFAULT_HEADERS from operations.ts on purpose,
 * because operations.ts treats them as a fallback for empty Sheets while bootstrap.ts
 * needs them as the canonical seed for new Sheets. Keep both in sync. */
// Three trailing system-managed columns appear on every entity tab (NOT on
// Dashboard / Audit). They power optimistic-concurrency control + soft-delete:
//   _rev          int, auto-bumped on every successful write
//   archived_at   ISO datetime, set when a row is archived (never blanked)
//   archived_by   actor email captured at archive time
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

export interface CreateSheetOptions {
  /** Title shown in Drive UI. Recommendation: include project name. */
  title: string;
  auth: SheetsAuth;
  /** Drive folder to drop the new Sheet into.
   *  - REQUIRED for service_account mode (SA has zero quota — file must live under a quota-bearing parent).
   *  - OPTIONAL for oauth_user mode (file lands in the user's Drive root if omitted; user has quota). */
  driveFolderId?: string;
  /** Auth mode hint. Defaults to "service_account" for back-compat. */
  authMode?: AuthModeTag;
}

export interface CreateSheetResult {
  sheet_id: string;
  url: string;
  tabs_created: ReadonlyArray<string>;
}

export async function createProjectSheet(opts: CreateSheetOptions): Promise<CreateSheetResult> {
  validateTabRegistry();

  const authMode: AuthModeTag = opts.authMode ?? "service_account";
  const folderId =
    opts.driveFolderId && opts.driveFolderId.trim().length > 0 ? opts.driveFolderId : undefined;

  // Service-account mode: file MUST live under a quota-bearing parent (SA has zero quota).
  // OAuth-user mode: file can land in user's Drive root (user has quota).
  if (authMode === "service_account" && folderId === undefined) {
    throw new SheetsError(
      "schema_invalid",
      `createProjectSheet (auth_mode=service_account) requires driveFolderId. ` +
        `Service accounts have no Drive quota. Pass (a) a folder ID owned by a user shared with the SA as Editor, ` +
        `or (b) a Workspace Shared Drive ID where the SA has Content Manager role. ` +
        `Or switch to auth_mode=oauth_user (folder optional — user has quota).`,
      { auth_mode: authMode },
    );
  }

  const drive = google.drive({ version: "v3", auth: opts.auth });
  const sheets = google.sheets({ version: "v4", auth: opts.auth });

  // Step 1 — create via Drive API. parents only set if folder/SharedDrive given.
  // supportsAllDrives works for both regular folders and Shared Drives.
  let spreadsheetId: string;
  let spreadsheetUrl: string;
  const requestBody: sheets_v4.Schema$Spreadsheet & { mimeType?: string; parents?: string[] } = {
    properties: { title: opts.title },
  };
  // Use Drive API request body type for files.create
  const driveRequest: { name: string; mimeType: string; parents?: string[] } = {
    name: opts.title,
    mimeType: "application/vnd.google-apps.spreadsheet",
  };
  if (folderId !== undefined) {
    driveRequest.parents = [folderId];
  }
  try {
    const fileResp = await drive.files.create({
      requestBody: driveRequest,
      supportsAllDrives: true,
      fields: "id, webViewLink",
    });
    spreadsheetId = fileResp.data.id ?? "";
    spreadsheetUrl =
      fileResp.data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    if (spreadsheetId.length === 0) {
      throw new Error("Drive API create returned no file id");
    }
  } catch (e) {
    const folderHint =
      folderId !== undefined ? ` in folder ${folderId}` : ` (in user's Drive root)`;
    throw new SheetsError(
      "sheet_unreachable",
      `failed to create spreadsheet${folderHint}: ${(e as Error).message}. ` +
        (authMode === "service_account"
          ? "Service-account mode: ensure SA is Editor on the folder, or use a Workspace Shared Drive."
          : "OAuth-user mode: ensure ADC is fresh ('gcloud auth application-default login') and you have access."),
      { title: opts.title, drive_folder_id: folderId, auth_mode: authMode },
    );
  }
  // suppress lint about unused intermediate
  void requestBody;

  // Step 2 — add 6 canonical tabs and delete the default "Sheet1" (sheetId 0).
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          ...ALL_TABS.map((tab) => ({ addSheet: { properties: { title: tab } } })),
          { deleteSheet: { sheetId: 0 } },
        ],
      },
    });
  } catch (e) {
    throw new SheetsError(
      "sheet_unreachable",
      `failed to set up canonical tabs on ${spreadsheetId}: ${(e as Error).message}`,
      { sheet_id: spreadsheetId },
    );
  }

  // Step 3 — write headers to each tab.
  await writeCanonicalHeaders(sheets, spreadsheetId);

  return {
    sheet_id: spreadsheetId,
    url: spreadsheetUrl,
    tabs_created: ALL_TABS.slice(),
  };
}

export interface BootstrapExistingSheetOptions {
  /** ID of an existing user-created Sheet (e.g. a blank one the user created in their personal Drive). */
  sheetId: string;
  auth: SheetsAuth;
  /**
   * Preflight policy when the Sheet already contains data rows:
   *   - "abort"  (default): throw SheetsError("schema_invalid") with row counts
   *   - "force":            proceed; the caller is responsible for taking a snapshot first
   *
   * "abort" prevents silently overwriting another project's data in a re-used Sheet
   * (the D1 defect from the T4.6 audit).
   */
  onPreExisting?: "abort" | "force";
}

/** Result of preflight scan: per-entity data-row counts on an existing Sheet. */
export interface PreflightReport {
  /** True when the Sheet has zero data rows in every entity tab. */
  is_empty: boolean;
  total_data_rows: number;
  by_entity: Readonly<Record<string, number>>;
  /** Human-readable summary suitable for inclusion in error messages. */
  summary: string;
}

/**
 * Pure helper: build a PreflightReport from raw per-tab row counts.
 * Exposed so unit tests don't need to mock the googleapis client.
 */
export function buildPreflightReport(
  rowCountsByEntity: Readonly<Record<string, number>>,
): PreflightReport {
  const byEntity: Record<string, number> = {};
  let total = 0;
  for (const [tab, n] of Object.entries(rowCountsByEntity)) {
    byEntity[tab] = n;
    total += n;
  }
  const summary =
    total === 0
      ? "Sheet is empty (or has no canonical tabs yet)"
      : `Sheet contains ${total} data row${total === 1 ? "" : "s"}: ${Object.entries(byEntity)
          .filter(([, n]) => n > 0)
          .map(([t, n]) => `${t}=${n}`)
          .join(", ")}`;
  return {
    is_empty: total === 0,
    total_data_rows: total,
    by_entity: byEntity,
    summary,
  };
}

/**
 * Read each entity tab and report row counts (header excluded). Used by
 * bootstrapExistingSheet to refuse silently overwriting another project's
 * data when the user re-uses a Sheet.
 */
export async function preflightExistingSheet(
  sheetId: string,
  auth: SheetsAuth,
): Promise<PreflightReport> {
  const sheets = google.sheets({ version: "v4", auth });

  // Discover which canonical tabs already exist (a fresh Sheet has only "Sheet1").
  let existingTabs: string[];
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: "sheets(properties(title))",
    });
    existingTabs = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => typeof t === "string");
  } catch (e) {
    throw new SheetsError(
      "sheet_unreachable",
      `preflight: cannot read spreadsheet ${sheetId}: ${(e as Error).message}`,
      { sheet_id: sheetId },
    );
  }

  // Only canonical entity tabs (skip Dashboard / Audit / Sheet1).
  const targets = ENTITY_NAMES.filter((t) => existingTabs.includes(t));
  const byEntity: Record<string, number> = {};
  let total = 0;

  if (targets.length > 0) {
    try {
      const batch = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId,
        ranges: targets.map((t) => `${t}!A1:A`),
      });
      for (let i = 0; i < targets.length; i++) {
        const tab = targets[i]!;
        const valueRange = batch.data.valueRanges?.[i];
        const values = valueRange?.values ?? [];
        // Header is row 1; data rows are everything after.
        const dataRows = values.length > 1 ? values.length - 1 : 0;
        byEntity[tab] = dataRows;
        total += dataRows;
      }
    } catch (e) {
      throw new SheetsError(
        "sheet_unreachable",
        `preflight: failed to scan ${sheetId}: ${(e as Error).message}`,
        { sheet_id: sheetId },
      );
    }
  }

  return buildPreflightReport(byEntity);
}

/**
 * Bootstrap structure into a Sheet the user already created.
 *
 * Pattern (Personal Google accounts): user creates a blank Sheet in their own
 * Drive (uses their quota), shares with the SA email as Editor, hands the
 * sheet ID to the agent. This function adds the 6 canonical tabs (only those
 * missing) + writes headers idempotently.
 *
 * SA permissions required: Editor on the Sheet.
 */
export async function bootstrapExistingSheet(
  opts: BootstrapExistingSheetOptions,
): Promise<CreateSheetResult> {
  validateTabRegistry();
  const sheets = google.sheets({ version: "v4", auth: opts.auth });
  const policy = opts.onPreExisting ?? "abort";

  // Step 0 — preflight: refuse to bind a Sheet that already carries another
  // project's data unless the caller explicitly opted in with --force.
  const preflight = await preflightExistingSheet(opts.sheetId, opts.auth);
  if (!preflight.is_empty && policy === "abort") {
    throw new SheetsError(
      "schema_invalid",
      `Refusing to bootstrap into ${opts.sheetId}: ${preflight.summary}. ` +
        `If this Sheet belongs to a different project, choose a different Sheet ` +
        `or pass --force to overwrite.`,
      { sheet_id: opts.sheetId, preflight },
    );
  }

  // Step 1 — read meta + existing tabs (verifies access).
  let url: string;
  let existingTabs: string[];
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: opts.sheetId,
      fields: "spreadsheetUrl,properties(title),sheets(properties(title))",
    });
    url = meta.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${opts.sheetId}/edit`;
    existingTabs = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => typeof t === "string");
  } catch (e) {
    throw new SheetsError(
      "sheet_unreachable",
      `cannot read spreadsheet ${opts.sheetId}: ${(e as Error).message}. ` +
        `Make sure the SA has Editor access — share the Sheet with the service-account email.`,
      { sheet_id: opts.sheetId },
    );
  }

  // Step 2 — add only the missing canonical tabs (idempotent).
  const missingTabs = ALL_TABS.filter((t) => !existingTabs.includes(t));
  if (missingTabs.length > 0) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: opts.sheetId,
        requestBody: {
          requests: missingTabs.map((tab) => ({
            addSheet: { properties: { title: tab } },
          })),
        },
      });
    } catch (e) {
      throw new SheetsError(
        "sheet_unreachable",
        `failed to add tabs to ${opts.sheetId}: ${(e as Error).message}`,
        { sheet_id: opts.sheetId },
      );
    }
  }

  // Step 3 — write headers (overwrites row 1; idempotent).
  await writeCanonicalHeaders(sheets, opts.sheetId);

  return {
    sheet_id: opts.sheetId,
    url,
    tabs_created: ALL_TABS.slice(),
  };
}

async function writeCanonicalHeaders(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<void> {
  const headerWrites = ALL_TABS.map((tab) => ({
    range: `${tab}!A1`,
    values: [TAB_HEADERS[tab]?.slice() ?? []],
  })) satisfies sheets_v4.Schema$ValueRange[];
  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: headerWrites,
      },
    });
  } catch (e) {
    throw new SheetsError(
      "sheet_unreachable",
      `failed to write headers to ${spreadsheetId}: ${(e as Error).message}`,
      { sheet_id: spreadsheetId },
    );
  }
}

export interface MoveOptions {
  auth: JWT;
  fileId: string;
  folderId: string;
}

/**
 * Move a Drive file into a target folder. Currently unused at the call site
 * (Sprint 2.2 ExternalSyncer refactor will wire this into the bootstrap flow
 * for OAuth-mode users who want a specific Drive folder). Exported to keep
 * the implementation alive across the refactor without flagging unused-var.
 */
export async function moveToDriveFolder(opts: MoveOptions): Promise<void> {
  const drive = google.drive({ version: "v3", auth: opts.auth });
  try {
    // Discover current parents so we can subtract them while adding the new folder.
    const meta = await drive.files.get({
      fileId: opts.fileId,
      fields: "parents",
    });
    const previousParents = (meta.data.parents ?? []).join(",");
    await drive.files.update({
      fileId: opts.fileId,
      addParents: opts.folderId,
      removeParents: previousParents.length > 0 ? previousParents : undefined,
      fields: "id, parents",
    });
  } catch (e) {
    throw new SheetsError(
      "sheet_unreachable",
      `failed to move spreadsheet ${opts.fileId} into Drive folder ${opts.folderId}: ${(e as Error).message}`,
      { sheet_id: opts.fileId, drive_folder_id: opts.folderId },
    );
  }
}

/** Sanity check at module load — every entity (except synthetic Audit) is in TAB_HEADERS. */
function validateTabRegistry(): void {
  for (const e of ENTITY_NAMES) {
    if (!TAB_HEADERS[e]) {
      throw new Error(`bootstrap.ts: missing TAB_HEADERS entry for entity ${e}`);
    }
  }
  for (const tab of ALL_TABS) {
    if (!TAB_HEADERS[tab]) {
      throw new Error(`bootstrap.ts: missing TAB_HEADERS entry for tab ${tab}`);
    }
  }
}
