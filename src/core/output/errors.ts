import { z } from "zod";
import { ERROR_CATALOG, type ErrorCode } from "./error-catalog.js";
import type { ProjectError } from "./types.js";

function interpolate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = context[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

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

export function zodToProjectErrors(
  zodError: z.ZodError,
  file: string,
): ProjectError[] {
  return zodError.issues.map((issue) => {
    const path = issue.path.join(".");
    const message = `${path ? path + ": " : ""}${issue.message}`;
    return createError("E_SCHEMA_VALIDATION", { file, message, path });
  });
}
