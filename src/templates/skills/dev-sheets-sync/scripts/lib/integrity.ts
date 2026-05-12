/**
 * Local-only integrity checks for sync-draft inputs.
 *
 * Catches every class of defect before any Sheet API call:
 *   - shape (AJV) errors with enum-hint enrichment
 *   - duplicate IDs within a draft entity array
 *   - orphan references (satisfies / elaborated_from / parent_story)
 *   - missing required fields on insert
 *   - unknown entity keys
 *
 * Optionally accepts a snapshot of current Sheet state to cross-check
 * orphan references against rows that exist in the Sheet but not in the
 * draft. Without sheetState, only within-draft references are checked.
 *
 * Pure function. No I/O. No throwing. Returns IntegrityReport — caller
 * decides whether to abort.
 */

import type { ErrorObject } from "ajv";

import type { EntityName, SheetRow } from "./types.js";
import { SheetsError, ENTITY_NAMES } from "./types.js";
import { validatePartialRow, isValidId } from "./schema.js";

// ─── Public types ────────────────────────────────────────────────────────────

export type DraftEnvelope = Readonly<Record<string, ReadonlyArray<SheetRow>>>;

export type IntegrityIssueCode =
  | "shape_invalid"
  | "duplicate_id_within_entity"
  | "orphan_reference"
  | "missing_required_on_insert"
  | "unknown_entity"
  | "id_format_invalid";

export interface IntegrityIssue {
  entity: string;
  index: number;
  row_id?: string;
  field?: string;
  code: IntegrityIssueCode;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface IntegrityReport {
  ok: boolean;
  issues: ReadonlyArray<IntegrityIssue>;
  total_rows: number;
  by_entity: Readonly<Record<string, number>>;
}

export interface ValidateOptions {
  /** Current Sheet state — when present, orphan checks resolve across draft + Sheet. */
  sheetState?: Partial<Record<EntityName, ReadonlyArray<SheetRow>>>;
}

// ─── Reference graph ─────────────────────────────────────────────────────────

interface ReferenceEdge {
  from: EntityName;
  field: string;
  to: EntityName;
}

const REFERENCE_EDGES: ReadonlyArray<ReferenceEdge> = [
  { from: "Requirement", field: "satisfies", to: "BusinessGoal" },
  { from: "UserStory", field: "elaborated_from", to: "Requirement" },
  { from: "UserStory", field: "parent_story", to: "UserStory" },
];

const REQUIRED_ON_INSERT: Record<EntityName, ReadonlyArray<string>> = {
  BusinessGoal: ["id", "title", "status"],
  Requirement: ["id", "type", "title", "satisfies", "status"],
  UserStory: ["id", "status"],
  Release: ["id", "version", "released_at"],
  Audit: ["event_id", "event_type", "actor", "timestamp"],
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run all integrity checks. Returns a report; does not throw.
 *
 * Caller pattern:
 *   const report = validateDraft(draft, { sheetState });
 *   if (!report.ok) { print(report.issues); process.exit(1); }
 */
export function validateDraft(draft: DraftEnvelope, opts: ValidateOptions = {}): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  const byEntity: Record<string, number> = {};
  let total = 0;

  // ─── Pass 1 — top-level keys + shape + per-entity dup IDs ───────────────
  for (const [entityKey, rows] of Object.entries(draft)) {
    if (!isEntityName(entityKey)) {
      issues.push({
        entity: entityKey,
        index: -1,
        code: "unknown_entity",
        message: `unknown entity "${entityKey}" — expected one of ${formatList(ENTITY_NAMES)}`,
      });
      continue;
    }
    const entity = entityKey as EntityName;
    byEntity[entity] = rows.length;
    total += rows.length;

    const seenIds = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      // Shape (AJV partial row).
      try {
        validatePartialRow(entity, row);
      } catch (e) {
        if (e instanceof SheetsError && e.code === "schema_invalid") {
          const ajvErrors = (e.details?.["errors"] ?? []) as ReadonlyArray<ErrorObject>;
          for (const err of ajvErrors) {
            issues.push(shapeIssueFromAjv(entity, i, row, err));
          }
        } else {
          throw e;
        }
      }

      // ID format + duplicate within entity.
      const id = typeof row["id"] === "string" ? (row["id"] as string) : undefined;
      if (id !== undefined && id.length > 0) {
        if (!isValidId(entity, id)) {
          issues.push({
            entity,
            index: i,
            row_id: id,
            field: "id",
            code: "id_format_invalid",
            message: `${entity}[${i}].id: "${id}" — does not match ${entity} ID pattern`,
          });
        }
        const prior = seenIds.get(id);
        if (prior !== undefined) {
          issues.push({
            entity,
            index: i,
            row_id: id,
            field: "id",
            code: "duplicate_id_within_entity",
            message: `${entity}[${i}]: duplicate id "${id}" (also at index ${prior})`,
            details: { first_index: prior },
          });
        } else {
          seenIds.set(id, i);
        }
      }
    }
  }

  // ─── Build combined ID sets (draft ∪ sheetState) for orphan check ──────
  const combinedIds = buildCombinedIdSets(draft, opts.sheetState);
  const sheetIds = buildSheetIdSets(opts.sheetState);

  // ─── Pass 2 — orphan references + required-on-insert ────────────────────
  for (const [entityKey, rows] of Object.entries(draft)) {
    if (!isEntityName(entityKey)) continue;
    const entity = entityKey as EntityName;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const id = typeof row["id"] === "string" ? (row["id"] as string) : undefined;

      // Orphan reference checks.
      for (const edge of REFERENCE_EDGES) {
        if (edge.from !== entity) continue;
        const target = row[edge.field];
        if (target === undefined || target === null || target === "") continue;
        if (typeof target !== "string") continue;
        const knownIds = combinedIds[edge.to];
        if (!knownIds.has(target)) {
          issues.push({
            entity,
            index: i,
            row_id: id,
            field: edge.field,
            code: "orphan_reference",
            message:
              `${entity}[${i}].${edge.field}: "${target}" — not present in draft or Sheet ` +
              `(expected an existing ${edge.to} id)`,
            details: { target_entity: edge.to, target_id: target },
          });
        }
      }

      // Required-on-insert: a row is an INSERT if its ID is not in the Sheet.
      // (Rows without an ID will get one auto-assigned at write time, also = INSERT.)
      const isInsert = id === undefined || !sheetIds[entity].has(id);
      if (isInsert) {
        const required = REQUIRED_ON_INSERT[entity];
        for (const field of required) {
          const v = row[field];
          if (v === undefined || v === null || v === "") {
            issues.push({
              entity,
              index: i,
              row_id: id,
              field,
              code: "missing_required_on_insert",
              message: `${entity}[${i}]: missing required field on insert: "${field}"`,
              details: { required_fields: required },
            });
          }
        }
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    total_rows: total,
    by_entity: byEntity,
  };
}

/**
 * Format an integrity report for human-readable CLI output.
 * Groups issues by entity, then by code.
 */
export function formatIntegrityReport(report: IntegrityReport): string {
  if (report.ok) {
    return `✓ integrity OK  (${report.total_rows} rows: ${formatByEntity(report.by_entity)})`;
  }
  const lines: string[] = [
    `✗ integrity FAILED  (${report.issues.length} issue${report.issues.length === 1 ? "" : "s"} ` +
      `across ${report.total_rows} rows: ${formatByEntity(report.by_entity)})`,
    "",
  ];
  const byCode = new Map<IntegrityIssueCode, IntegrityIssue[]>();
  for (const issue of report.issues) {
    const list = byCode.get(issue.code) ?? [];
    list.push(issue);
    byCode.set(issue.code, list);
  }
  // Stable ordering by severity / category.
  const order: IntegrityIssueCode[] = [
    "unknown_entity",
    "shape_invalid",
    "id_format_invalid",
    "duplicate_id_within_entity",
    "orphan_reference",
    "missing_required_on_insert",
  ];
  for (const code of order) {
    const items = byCode.get(code);
    if (!items || items.length === 0) continue;
    lines.push(`  ${code} (${items.length}):`);
    for (const issue of items) {
      lines.push(`    ${issue.message}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isEntityName(s: string): s is EntityName {
  return (ENTITY_NAMES as ReadonlyArray<string>).includes(s);
}

function buildCombinedIdSets(
  draft: DraftEnvelope,
  sheetState?: Partial<Record<EntityName, ReadonlyArray<SheetRow>>>,
): Record<EntityName, Set<string>> {
  const sets = emptyIdSets();
  for (const [k, rows] of Object.entries(draft)) {
    if (!isEntityName(k)) continue;
    for (const row of rows) {
      const id = row["id"];
      if (typeof id === "string" && id.length > 0) sets[k as EntityName].add(id);
    }
  }
  if (sheetState) {
    for (const [k, rows] of Object.entries(sheetState)) {
      if (!isEntityName(k) || !rows) continue;
      for (const row of rows) {
        const id = row["id"];
        if (typeof id === "string" && id.length > 0) sets[k as EntityName].add(id);
      }
    }
  }
  return sets;
}

function buildSheetIdSets(
  sheetState?: Partial<Record<EntityName, ReadonlyArray<SheetRow>>>,
): Record<EntityName, Set<string>> {
  const sets = emptyIdSets();
  if (!sheetState) return sets;
  for (const [k, rows] of Object.entries(sheetState)) {
    if (!isEntityName(k) || !rows) continue;
    for (const row of rows) {
      const id = row["id"];
      if (typeof id === "string" && id.length > 0) sets[k as EntityName].add(id);
    }
  }
  return sets;
}

function emptyIdSets(): Record<EntityName, Set<string>> {
  return {
    BusinessGoal: new Set(),
    Requirement: new Set(),
    UserStory: new Set(),
    Release: new Set(),
    Audit: new Set(),
  };
}

/**
 * Translate a raw AJV error into a human-friendly IntegrityIssue.
 * Enum errors get expanded with `expected one of [...]` because the bare
 * AJV message ("must be equal to one of the allowed values") is useless.
 */
function shapeIssueFromAjv(
  entity: EntityName,
  index: number,
  row: SheetRow,
  err: ErrorObject,
): IntegrityIssue {
  const id = typeof row["id"] === "string" ? (row["id"] as string) : undefined;
  const field =
    (err.instancePath || "").replace(/^\//, "") ||
    (err.params as { missingProperty?: string })?.missingProperty;
  const got = field ? row[field] : undefined;

  let message: string;
  if (err.keyword === "enum") {
    const allowed = (err.params as { allowedValues?: ReadonlyArray<string> })?.allowedValues ?? [];
    message =
      `${entity}[${index}].${field ?? "(root)"}: ` +
      `${formatGot(got)} — expected one of ${formatList(allowed)}`;
  } else if (err.keyword === "pattern") {
    const pattern = (err.params as { pattern?: string })?.pattern ?? "(unknown)";
    message =
      `${entity}[${index}].${field ?? "(root)"}: ` +
      `${formatGot(got)} — does not match pattern /${pattern}/`;
  } else if (err.keyword === "type") {
    const expected = (err.params as { type?: string })?.type ?? "(unknown)";
    message =
      `${entity}[${index}].${field ?? "(root)"}: ` +
      `${formatGot(got)} — expected type ${expected}`;
  } else if (err.keyword === "additionalProperties") {
    const extra =
      (err.params as { additionalProperty?: string })?.additionalProperty ?? "(unknown)";
    message = `${entity}[${index}]: unknown column "${extra}" — drop it from the draft`;
  } else if (err.keyword === "required") {
    const missing = (err.params as { missingProperty?: string })?.missingProperty ?? "(unknown)";
    message = `${entity}[${index}]: missing required field "${missing}"`;
  } else if (err.keyword === "minLength") {
    message =
      `${entity}[${index}].${field ?? "(root)"}: ` + `${formatGot(got)} — must not be empty`;
  } else if (err.keyword === "format") {
    const format = (err.params as { format?: string })?.format ?? "(unknown)";
    message =
      `${entity}[${index}].${field ?? "(root)"}: ` +
      `${formatGot(got)} — must match format ${format}`;
  } else {
    message = `${entity}[${index}].${field ?? "(root)"}: ` + `${err.message ?? "schema violation"}`;
  }

  const out: IntegrityIssue = {
    entity,
    index,
    code: "shape_invalid",
    message,
  };
  if (id !== undefined) out.row_id = id;
  if (field !== undefined && field.length > 0) out.field = field;
  return out;
}

function formatGot(v: unknown): string {
  if (v === undefined) return "(missing)";
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function formatList(items: ReadonlyArray<string>): string {
  return `[${items.join(", ")}]`;
}

function formatByEntity(by: Record<string, number>): string {
  const entries = Object.entries(by).map(([k, v]) => `${k}=${v}`);
  return entries.length > 0 ? entries.join(", ") : "empty";
}
