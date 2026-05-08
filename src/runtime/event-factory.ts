/**
 * Typed factories for creating manifest events.
 *
 * Every event created here is validated against the schema before being
 * returned. Invalid input throws, so consumers get either a guaranteed-valid
 * event or a clear error — never a half-formed event in the log.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";
import {
  COMMITABLE_EVENT_TYPES,
  CURRENT_SCHEMA_VERSION,
  type Author,
  type EventType,
  type ManifestEvent,
} from "./types.js";

let validator: ValidateFunction | null = null;

/**
 * Find the schema relative to this file. This makes the factory portable —
 * it works whether the CLI is invoked from the plugin root, from a target
 * project, or from a temp directory during tests.
 */
function findSchemaPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "schemas", "runtime", "manifest-event.schema.json");
}

function getValidator(): ValidateFunction {
  if (validator !== null) return validator;
  const schema = JSON.parse(readFileSync(findSchemaPath(), "utf-8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false, discriminator: true });
  addFormats.default(ajv);
  validator = ajv.compile(schema);
  return validator;
}

export class InvalidEventError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly errors: unknown,
  ) {
    super(`Invalid ${eventType} event: ${JSON.stringify(errors, null, 2)}`);
    this.name = "InvalidEventError";
  }
}

export interface CreateEventOptions {
  eventType: EventType;
  payload: Record<string, unknown>;
  author: Author;
  parentEventId: string | null;
  timestamp?: string;
  eventId?: string;
}

/**
 * Build a manifest event with auto-generated ID, current timestamp, and
 * commitable status from the canonical set. Validates against the schema.
 */
export function createEvent(opts: CreateEventOptions): ManifestEvent {
  const event: ManifestEvent = {
    event_id: opts.eventId ?? randomUUID(),
    schema_version: CURRENT_SCHEMA_VERSION,
    event_type: opts.eventType,
    timestamp: opts.timestamp ?? new Date().toISOString(),
    author: opts.author,
    parent_event_id: opts.parentEventId,
    commitable: COMMITABLE_EVENT_TYPES.has(opts.eventType),
    payload: opts.payload,
  };

  const validate = getValidator();
  if (!validate(event)) {
    throw new InvalidEventError(opts.eventType, validate.errors);
  }
  return event;
}

/**
 * Validate an arbitrary object as a ManifestEvent. Used when reading events
 * from disk to reject corrupted data.
 */
export function validateEvent(value: unknown): asserts value is ManifestEvent {
  const validate = getValidator();
  if (!validate(value)) {
    throw new InvalidEventError("unknown", validate.errors);
  }
}
