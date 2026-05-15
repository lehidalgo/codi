/**
 * Multi-developer handover handlers — voluntary handover and maintainer-
 * authority force-handover. Both record an event; neither changes the
 * active phase.
 *
 * Brain-backed: persistence goes through BrainEventLog directly.
 */

import {
  BrainEventLog,
  BrainNoActiveWorkflowError as NoActiveWorkflowError,
} from "../brain-event-log.js";
import { createEvent } from "../event-factory.js";
import type { Author } from "../types.js";
import { resolveActiveWorkflowId } from "./active-workflow.js";

export interface HandoverOptions {
  toDevId: string;
  reason: string;
  author: Author;
  cwd?: string;
}

export interface HandoverResult {
  workflowId: string;
  fromDevId: string;
  toDevId: string;
}

export function handover(opts: HandoverOptions): HandoverResult {
  if (!opts.toDevId || opts.toDevId.trim().length === 0) {
    throw new Error("handover requires --to <dev-id>");
  }
  if (!opts.reason || opts.reason.trim().length === 0) {
    throw new Error("handover requires --reason '<text>'");
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) throw new NoActiveWorkflowError();

    const state = log.getReducedState(workflowId);
    if (state.status === "completed" || state.status === "abandoned") {
      throw new Error(`Cannot hand over a ${state.status} workflow.`);
    }

    log.append(
      workflowId,
      createEvent({
        eventType: "workflow_handover",
        payload: {
          from_dev_id: state.current_owner,
          to_dev_id: opts.toDevId,
          reason: opts.reason,
        },
        author: opts.author,
        parentEventId: state.last_event_id,
      }),
    );
    return {
      workflowId,
      fromDevId: state.current_owner,
      toDevId: opts.toDevId,
    };
  } finally {
    log.dispose();
  }
}

export interface ForceHandoverOptions {
  toDevId: string;
  maintainerId: string;
  reason: string;
  author: Author;
  cwd?: string;
}

export function forceHandover(opts: ForceHandoverOptions): HandoverResult {
  if (!opts.toDevId || !opts.maintainerId || !opts.reason) {
    throw new Error("force-handover requires --to <dev-id> --maintainer <id> --reason '<text>'");
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) throw new NoActiveWorkflowError();

    const state = log.getReducedState(workflowId);
    log.append(
      workflowId,
      createEvent({
        eventType: "workflow_force_handover",
        payload: {
          from_dev_id: state.current_owner,
          to_dev_id: opts.toDevId,
          maintainer_id: opts.maintainerId,
          reason: opts.reason,
        },
        author: opts.author,
        parentEventId: state.last_event_id,
      }),
    );
    return {
      workflowId,
      fromDevId: state.current_owner,
      toDevId: opts.toDevId,
    };
  } finally {
    log.dispose();
  }
}
