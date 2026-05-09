/**
 * Workflow lifecycle handlers — abandonWorkflow + recoverWorkflow.
 *
 * abandonWorkflow records workflow_abandoned and clears the active pointer.
 * recoverWorkflow rebuilds the active pointer from the most recent
 * non-terminal workflow_runs row when the active id is missing or stale.
 *
 * Brain-backed: both handlers go through BrainEventLog directly. The legacy
 * file-based EventLog is gone (F5 of v3 zero closure).
 */

import { BrainEventLog, BrainNoActiveWorkflowError } from "../brain-event-log.js";
import { createEvent } from "../event-factory.js";
import { reduce } from "../reducer.js";
import type { Author, Phase } from "../types.js";

export interface AbandonOptions {
  reason: string;
  author: Author;
  cwd?: string;
}

export interface AbandonResult {
  workflowId: string;
  abandonedInPhase: Phase;
}

export function abandonWorkflow(opts: AbandonOptions): AbandonResult {
  if (!opts.reason || opts.reason.trim().length === 0) {
    throw new Error("Abandon requires --reason '<text>'.");
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) throw new BrainNoActiveWorkflowError();

    const state = reduce(log.loadEvents(workflowId));
    if (state.status !== "active" && state.status !== "paused") {
      throw new Error(`Cannot abandon workflow in status ${state.status}.`);
    }

    log.append(
      workflowId,
      createEvent({
        eventType: "workflow_abandoned",
        payload: { reason: opts.reason, abandoned_in_phase: state.current_phase },
        author: opts.author,
        parentEventId: state.last_event_id,
      }),
    );
    log.clearActiveWorkflowId();

    return { workflowId, abandonedInPhase: state.current_phase };
  } finally {
    log.dispose();
  }
}

export interface RecoverOptions {
  cwd?: string;
}

export interface RecoverResult {
  recovered: boolean;
  workflowId: string | null;
  reason: string;
}

/**
 * Recovers the active workflow ID from the most recent non-terminal row in
 * `workflow_runs`. SQL-driven now (was filesystem walk under legacy backend).
 */
export function recoverWorkflow(_opts: RecoverOptions = {}): RecoverResult {
  const log = BrainEventLog.open();
  try {
    // Already pointing at something? Verify it's still non-terminal.
    const currentActive = log.getActiveWorkflowId();
    if (currentActive !== null) {
      const events = log.loadEvents(currentActive);
      if (events.length > 0) {
        const state = reduce(events);
        if (state.status === "active" || state.status === "paused") {
          return {
            recovered: false,
            workflowId: currentActive,
            reason: "Active workflow ID is already set and valid.",
          };
        }
      }
    }

    // Scan workflow_runs for the most recent non-terminal row. Project
    // singletons (the __codi_session__ row used for active-id tracking) are
    // skipped via the `type != 'session'` predicate.
    const candidates = log.privateRaw
      .prepare(
        `SELECT workflow_id
         FROM workflow_runs
         WHERE status IN ('active', 'paused')
           AND type != 'session'
         ORDER BY started_at DESC`,
      )
      .all() as { workflow_id: string }[];

    for (const c of candidates) {
      const events = log.loadEvents(c.workflow_id);
      if (events.length === 0) continue;
      const state = reduce(events);
      if (state.status === "active" || state.status === "paused") {
        log.setActiveWorkflowId(c.workflow_id);
        return {
          recovered: true,
          workflowId: c.workflow_id,
          reason: `Recovered active workflow from brain (status: ${state.status}).`,
        };
      }
    }

    return {
      recovered: false,
      workflowId: null,
      reason: "No non-terminal workflow found to recover.",
    };
  } finally {
    log.dispose();
  }
}
