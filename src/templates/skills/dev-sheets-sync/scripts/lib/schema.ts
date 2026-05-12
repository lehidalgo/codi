/**
 * AJV-based row schema validation per entity.
 *
 * Schemas are intentionally narrow on REQUIRED fields — the caller often
 * upserts a partial row (e.g., setting status only). The validator allows
 * partial writes by treating every field as optional and validating only
 * the fields actually present in the upsert payload.
 *
 * For full-row reads, use validateFullRow which enforces required fields.
 */

import AjvModule from "ajv";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import type { EntityName, SheetRow } from "./types.js";
import { SheetsError } from "./types.js";

// ESM-CJS interop: ajv@8 ships CJS where the constructor lives under
// .default after NodeNext shims it. Cast through unknown keeps `new` callable
// without leaking `any` to consumers (each compile() call still returns a
// typed ValidateFunction).
const AjvCtor = (AjvModule as unknown as { default?: typeof AjvModule }).default ?? AjvModule;
const ajv = new (AjvCtor as unknown as new (opts: unknown) => {
  compile<T = unknown>(schema: unknown): ValidateFunction<T>;
  addKeyword(...args: unknown[]): unknown;
  addFormat(...args: unknown[]): unknown;
})({ allErrors: true, strict: false, removeAdditional: false });
addFormats.default(ajv as unknown as Parameters<typeof addFormats.default>[0]);

const ID_PATTERNS: Record<EntityName, RegExp> = {
  BusinessGoal: /^BG-\d{3,}$/,
  Requirement: /^REQ-\d{3,}$/,
  UserStory: /^US-\d{3,}$/,
  Release: /^REL-\d{3,}$/,
  Audit: /^[a-zA-Z0-9_-]{1,64}$/,
};

const PRIORITY_VALUES = ["P0", "P1", "P2"] as const;
const PR_STATE_VALUES = ["open", "merged", "closed"] as const;
const WORKFLOW_TYPE_VALUES = ["feature", "bug-fix", "refactor", "migration", "chore"] as const;
const STATUS_VALUES = [
  "backlog",
  "ready",
  "blocked",
  "in-progress",
  "in-review",
  "delivered",
  "abandoned",
  "proposed",
  "accepted",
  "dropped",
] as const;
const REQUIREMENT_TYPE_VALUES = ["functional", "non_functional", "constraint"] as const;

/** Safety columns shared by BG / REQ / US / REL — system-managed but
 *  callers may include _rev in payloads to opt into OCC. */
const SAFETY_COLUMN_SCHEMAS = {
  _rev: { type: ["integer", "string"] }, // tolerated as string round-trip from Sheets
  archived_at: { type: ["string", "null"], format: "date-time" },
  archived_by: { type: ["string", "null"] },
  __intent: { type: "string", enum: ["archive"] },
} as const;

/**
 * Per-entity property schemas — every property is OPTIONAL here so partial
 * upserts validate. Required-field enforcement happens in validateFullRow.
 */
const PROPERTY_SCHEMAS: Record<EntityName, Record<string, object>> = {
  BusinessGoal: {
    id: { type: "string", pattern: ID_PATTERNS.BusinessGoal.source },
    title: { type: "string", minLength: 1 },
    outcome: { type: "string" },
    metric: { type: "string" },
    priority: { type: "string", enum: PRIORITY_VALUES },
    source_link: { type: "string" },
    status: { type: "string", enum: STATUS_VALUES },
    created_at: { type: "string", format: "date-time" },
    ...SAFETY_COLUMN_SCHEMAS,
  },
  Requirement: {
    id: { type: "string", pattern: ID_PATTERNS.Requirement.source },
    type: { type: "string", enum: REQUIREMENT_TYPE_VALUES },
    title: { type: "string", minLength: 1 },
    behavior_or_threshold: { type: "string" },
    satisfies: { type: "string", pattern: ID_PATTERNS.BusinessGoal.source },
    priority: { type: "string", enum: PRIORITY_VALUES },
    status: { type: "string", enum: STATUS_VALUES },
    created_at: { type: "string", format: "date-time" },
    ...SAFETY_COLUMN_SCHEMAS,
  },
  UserStory: {
    id: { type: "string", pattern: ID_PATTERNS.UserStory.source },
    as_a: { type: ["string", "null"] },
    i_want: { type: ["string", "null"] },
    so_that: { type: ["string", "null"] },
    acceptance_criteria: { type: ["string", "null"] },
    priority: { type: "string", enum: PRIORITY_VALUES },
    assigned_to: { type: "string" },
    parent_story: { type: ["string", "null"], pattern: ID_PATTERNS.UserStory.source },
    elaborated_from: { type: ["string", "null"], pattern: ID_PATTERNS.Requirement.source },
    workflow_type: { type: "string", enum: WORKFLOW_TYPE_VALUES },
    branch: { type: "string" },
    commit_shas: { type: "string" },
    design_doc_path: { type: "string" },
    pr_url: { type: "string" },
    pr_state: { type: "string", enum: PR_STATE_VALUES },
    merged_sha: { type: "string" },
    merged_at: { type: "string", format: "date-time" },
    started_at: { type: "string", format: "date-time" },
    completed_at: { type: "string", format: "date-time" },
    status: { type: "string", enum: STATUS_VALUES },
    created_at: { type: "string", format: "date-time" },
    ...SAFETY_COLUMN_SCHEMAS,
  },
  Release: {
    id: { type: "string", pattern: ID_PATTERNS.Release.source },
    version: { type: "string", minLength: 1 },
    released_at: { type: "string", format: "date-time" },
    story_ids: { type: "string" },
    commit_range: { type: "string" },
    release_notes_link: { type: "string" },
    ...SAFETY_COLUMN_SCHEMAS,
  },
  Audit: {
    event_id: { type: "string", minLength: 1 },
    event_type: { type: "string", minLength: 1 },
    entity_id: { type: "string" },
    actor: { type: "string", minLength: 1 },
    timestamp: { type: "string", format: "date-time" },
    payload_json: { type: "string" },
  },
};

const REQUIRED_FOR_FULL_ROW: Record<EntityName, ReadonlyArray<string>> = {
  BusinessGoal: ["id", "title", "status"],
  Requirement: ["id", "type", "title", "satisfies", "status"],
  UserStory: ["id", "status"],
  Release: ["id", "version", "released_at"],
  Audit: ["event_id", "event_type", "actor", "timestamp"],
};

const partialValidators: Map<EntityName, ValidateFunction> = new Map();
const fullValidators: Map<EntityName, ValidateFunction> = new Map();

function buildValidator(entity: EntityName, requireFields: boolean): ValidateFunction {
  const props = PROPERTY_SCHEMAS[entity];
  const schema = {
    type: "object",
    properties: props,
    required: requireFields ? REQUIRED_FOR_FULL_ROW[entity] : [],
    additionalProperties: false,
  };
  return ajv.compile(schema);
}

function partialValidator(entity: EntityName): ValidateFunction {
  let v = partialValidators.get(entity);
  if (!v) {
    v = buildValidator(entity, false);
    partialValidators.set(entity, v);
  }
  return v;
}

function fullValidator(entity: EntityName): ValidateFunction {
  let v = fullValidators.get(entity);
  if (!v) {
    v = buildValidator(entity, true);
    fullValidators.set(entity, v);
  }
  return v;
}

/** Validate a partial upsert payload. Throws SheetsError(schema_invalid) on failure. */
export function validatePartialRow(entity: EntityName, row: SheetRow): void {
  const validate = partialValidator(entity);
  if (!validate(row)) {
    throw new SheetsError("schema_invalid", `partial-row validation failed for ${entity}`, {
      errors: validate.errors ?? [],
    });
  }
}

/** Validate a full row read from the Sheet. */
export function validateFullRow(entity: EntityName, row: SheetRow): void {
  const validate = fullValidator(entity);
  if (!validate(row)) {
    throw new SheetsError("schema_invalid", `full-row validation failed for ${entity}`, {
      errors: validate.errors ?? [],
    });
  }
}

/** Check whether a string matches the ID pattern for an entity. */
export function isValidId(entity: EntityName, id: string): boolean {
  return ID_PATTERNS[entity].test(id);
}

/** Compute the next monotonic ID for an entity given the existing IDs in the Sheet. */
export function nextId(entity: EntityName, existingIds: ReadonlyArray<string>): string {
  const pattern = ID_PATTERNS[entity];
  let max = 0;
  let padWidth = 3;
  for (const id of existingIds) {
    if (!pattern.test(id)) continue;
    const dashIdx = id.indexOf("-");
    const numericPart = id.slice(dashIdx + 1);
    const n = Number.parseInt(numericPart, 10);
    if (!Number.isFinite(n)) continue;
    if (n > max) max = n;
    if (numericPart.length > padWidth) padWidth = numericPart.length;
  }
  const next = max + 1;
  const prefix = id_prefix(entity);
  return `${prefix}-${String(next).padStart(padWidth, "0")}`;
}

function id_prefix(entity: EntityName): string {
  switch (entity) {
    case "BusinessGoal":
      return "BG";
    case "Requirement":
      return "REQ";
    case "UserStory":
      return "US";
    case "Release":
      return "REL";
    case "Audit":
      return "AUD";
  }
}
