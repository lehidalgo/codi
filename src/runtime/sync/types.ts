/**
 * Type definitions for the Google Sheets persistence layer.
 *
 * Maps the conceptual model (BusinessGoal / Requirement / UserStory / Release / Audit)
 * to row-shaped data, declares the column zone discipline, and defines the structured
 * error vocabulary callers handle.
 *
 * Runtime validation lives in schema.ts (AJV-based). These types give compile-time
 * hints; the schema is the source of truth.
 */

export const ENTITY_NAMES = [
  "BusinessGoal",
  "Requirement",
  "UserStory",
  "Release",
  "Audit",
] as const;

export type EntityName = (typeof ENTITY_NAMES)[number];

export const ID_PREFIX_BY_ENTITY = {
  BusinessGoal: "BG",
  Requirement: "REQ",
  UserStory: "US",
  Release: "REL",
  Audit: "AUD",
} as const satisfies Record<EntityName, string>;

/** Column zone — who is allowed to write what. */
export type Zone = "planning" | "execution";

/** Caller scope passed to upsertRow — controls which zones are writable. */
export type CallerScope = "bootstrap" | "execution-only";

/** Cell value type — Sheets stores strings, numbers, booleans, or empty. */
export type CellValue = string | number | boolean | null;

/** A row is a flat string-keyed map of cells. */
export interface SheetRow {
  readonly [column: string]: CellValue | undefined;
}

/** Project-level config persisted at .devloop/project.json. */
export interface ProjectConfig {
  project_name: string;
  /**
   * Identifier for the persistence backend.
   *   - service_account / oauth_user: Google Sheet ID
   *   - local_xlsx: a sentinel placeholder ("local:<filename>"); see local_path
   */
  sheet_id: string;
  sheet_template_version: number;
  drive_folder_id?: string;
  /**
   * Local file path for the .xlsx backend (only set when auth_mode=local_xlsx).
   * Default convention: .devloop/sheet.xlsx.
   */
  local_path?: string;
  created_at: string;
  created_by: string;
  /**
   * Persistence mode for this project. Three first-class options:
   *   - "service_account" : agent acts as an SA against a Google Sheet.
   *   - "oauth_user"      : agent acts as the user via OAuth ADC against a Google Sheet.
   *   - "local_xlsx"      : agent persists to a local .xlsx file (no Google access).
   * Missing field → defaults to "service_account" for back-compat.
   */
  auth_mode?: "service_account" | "oauth_user" | "local_xlsx";
}

/** Result of a successful upsert. */
export interface UpsertResult {
  entity: EntityName;
  row_id: string;
  columns_written: ReadonlyArray<string>;
  was_no_op: boolean;
}

/** Per-entity column-to-zone mapping. Single source of truth for zone enforcement. */
export const COLUMN_ZONES: Record<EntityName, Readonly<Record<string, Zone>>> = {
  BusinessGoal: {
    id: "execution",
    title: "planning",
    outcome: "planning",
    metric: "planning",
    priority: "planning",
    source_link: "planning",
    status: "planning",
    created_at: "execution",
    _rev: "execution",
    archived_at: "execution",
    archived_by: "execution",
  },
  Requirement: {
    id: "execution",
    type: "planning",
    title: "planning",
    behavior_or_threshold: "planning",
    satisfies: "planning",
    priority: "planning",
    status: "planning",
    created_at: "execution",
    _rev: "execution",
    archived_at: "execution",
    archived_by: "execution",
  },
  UserStory: {
    id: "execution",
    as_a: "planning",
    i_want: "planning",
    so_that: "planning",
    acceptance_criteria: "planning",
    priority: "planning",
    assigned_to: "planning",
    parent_story: "planning",
    elaborated_from: "planning",
    workflow_type: "execution",
    branch: "execution",
    commit_shas: "execution",
    design_doc_path: "execution",
    pr_url: "execution",
    pr_state: "execution",
    merged_sha: "execution",
    merged_at: "execution",
    started_at: "execution",
    completed_at: "execution",
    status: "execution",
    created_at: "execution",
    _rev: "execution",
    archived_at: "execution",
    archived_by: "execution",
  },
  Release: {
    id: "execution",
    version: "execution",
    released_at: "execution",
    story_ids: "execution",
    commit_range: "execution",
    release_notes_link: "execution",
    _rev: "execution",
    archived_at: "execution",
    archived_by: "execution",
  },
  Audit: {
    event_id: "execution",
    event_type: "execution",
    entity_id: "execution",
    actor: "execution",
    timestamp: "execution",
    payload_json: "execution",
  },
};

/** Structured errors — callers branch on .code, not on instanceof + message. */
export type SheetsErrorCode =
  | "config_missing"
  | "credentials_missing"
  | "zone_violation"
  | "schema_invalid"
  | "sheet_unreachable"
  | "row_missing"
  | "id_conflict"
  | "rev_conflict";

export class SheetsError extends Error {
  readonly code: SheetsErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: SheetsErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "SheetsError";
    this.code = code;
    this.details = details;
  }
}

/** Helper — narrow zones by caller scope. */
export function allowedZones(caller: CallerScope): ReadonlyArray<Zone> {
  return caller === "bootstrap" ? ["planning", "execution"] : ["execution"];
}

/** Look up a column's zone for a given entity. Throws on unknown column. */
export function zoneOf(entity: EntityName, column: string): Zone {
  const map = COLUMN_ZONES[entity];
  const zone = map[column];
  if (zone === undefined) {
    throw new SheetsError("schema_invalid", `unknown column ${column} on entity ${entity}`, {
      entity,
      column,
    });
  }
  return zone;
}
