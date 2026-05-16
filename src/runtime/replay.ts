/**
 * Time-travel debugging: reconstruct the manifest state at any historical
 * point by replaying events up to a given event ID.
 *
 * CORE-017: returns `Result<ReplayResult, ProjectError[]>`.
 */

import type { ManifestEvent, ReducedState } from "./types.js";
import { reduce } from "./reducer.js";
import { err, ok, type Result } from "#src/types/result.js";
import { createError } from "#src/core/output/errors.js";
import type { ProjectError } from "#src/core/output/types.js";

export interface ReplayResult {
  events: ManifestEvent[];
  state: ReducedState;
  stoppedAt: string | null;
  reason: string;
}

export function replay(
  events: ManifestEvent[],
  options: { untilEventId?: string } = {},
): Result<ReplayResult, ProjectError[]> {
  if (events.length === 0) {
    return err([createError("E_EVENT_REPLAY_EMPTY")]);
  }

  let cutoff = events.length;
  let stoppedAt: string | null = null;
  if (options.untilEventId) {
    const idx = events.findIndex((e) => e.event_id === options.untilEventId);
    if (idx === -1) {
      return err([createError("E_EVENT_NOT_FOUND", { eventId: options.untilEventId })]);
    }
    cutoff = idx + 1;
    stoppedAt = options.untilEventId;
  }

  const slice = events.slice(0, cutoff);
  const state = reduce(slice);
  return ok({
    events: slice,
    state,
    stoppedAt,
    reason: stoppedAt
      ? `Replay stopped at event ${stoppedAt} (index ${cutoff - 1}).`
      : `Replay over all ${cutoff} events.`,
  });
}
