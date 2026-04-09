import { z } from "zod";
import { ERROR_CATALOG, type ErrorCode } from "./error-catalog.js";
import type { ProjectError } from "./types.js";

function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = context[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

/**
 * Build a structured {@link ProjectError} from the error catalog.
 *
 * The hint template for `code` is interpolated with `context` values using
 * `{key}` placeholders. Unmatched placeholders are left as-is.
 *
 * @param code - Error code from the {@link ERROR_CATALOG}.
 * @param context - Key-value pairs interpolated into the hint template.
 * @param cause - Optional originating error for stack trace preservation.
 * @returns A fully formed `ProjectError` object ready to include in a `Result.err`.
 */
export function createError(
  code: ErrorCode,
  context: Record<string, unknown> = {},
  cause?: Error,
): ProjectError {
  const entry = ERROR_CATALOG[code];
  return {
    code,
    message: `[${code}] ${interpolate(entry.hintTemplate, context)}`,
    hint: interpolate(entry.hintTemplate, context),
    severity: entry.severity,
    context,
    ...(cause ? { cause } : {}),
  };
}

/**
 * Convert a Zod validation error into an array of {@link ProjectError} objects.
 *
 * Each Zod issue becomes one `E_SCHEMA_VALIDATION` error with the dotted
 * property path and the Zod message included in the hint.
 *
 * @param zodError - The `ZodError` thrown by a failed `schema.parse()` call.
 * @param file - Path or label of the file being validated (for context).
 * @returns Array of `ProjectError` objects, one per Zod issue.
 */
export function zodToProjectErrors(zodError: z.ZodError, file: string): ProjectError[] {
  return zodError.issues.map((issue) => {
    const path = issue.path.join(".");
    const message = `${path ? path + ": " : ""}${issue.message}`;
    return createError("E_SCHEMA_VALIDATION", { file, message, path });
  });
}
