/**
 * CORE-017 — translate caught throws into `ProjectError`.
 *
 * Used at the boundary of every runtime CLI handler that now returns
 * `Result<T, ProjectError[]>` but still calls APIs (BrainEventLog, reducer,
 * better-sqlite3) that throw. Maps the typed runtime errors we intentionally
 * KEEP (see CORE-017 closure notes) to user-actionable error codes.
 */

import { BrainNoActiveWorkflowError } from "../brain-event-log.js";
import { createError } from "#src/core/output/errors.js";
import type { ProjectError } from "#src/core/output/types.js";

/**
 * Map an unknown caught value to a single `ProjectError`. Typed runtime
 * errors get their own catalog code; everything else degrades to
 * `E_GENERAL` carrying the original message.
 */
export function fromCaughtError(e: unknown): ProjectError {
  if (e instanceof BrainNoActiveWorkflowError) {
    return createError("E_NO_ACTIVE_WORKFLOW");
  }
  const message = e instanceof Error ? e.message : String(e);
  return createError("E_GENERAL", { message }, e instanceof Error ? e : undefined);
}
