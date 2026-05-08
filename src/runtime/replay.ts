/**
 * Time-travel debugging: reconstruct the manifest state at any historical
 * point by replaying events up to a given event ID.
 */

import type { ManifestEvent, ReducedState } from "./types.js";
import { reduce } from "./reducer.js";

export interface ReplayResult {
  events: ManifestEvent[];
  state: ReducedState;
  stoppedAt: string | null;
  reason: string;
}

export function replay(
  events: ManifestEvent[],
  options: { untilEventId?: string } = {},
): ReplayResult {
  if (events.length === 0) {
    throw new Error("Cannot replay empty event list.");
  }

  let cutoff = events.length;
  let stoppedAt: string | null = null;
  if (options.untilEventId) {
    const idx = events.findIndex((e) => e.event_id === options.untilEventId);
    if (idx === -1) {
      throw new Error(`Event id ${options.untilEventId} not found in archive.`);
    }
    cutoff = idx + 1;
    stoppedAt = options.untilEventId;
  }

  const slice = events.slice(0, cutoff);
  const state = reduce(slice);
  return {
    events: slice,
    state,
    stoppedAt,
    reason: stoppedAt
      ? `Replay stopped at event ${stoppedAt} (index ${cutoff - 1}).`
      : `Replay over all ${cutoff} events.`,
  };
}
