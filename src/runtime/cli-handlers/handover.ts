/**
 * Multi-developer handover handlers — voluntary handover and maintainer-
 * authority force-handover. Both record an event; neither changes the
 * active phase.
 *
 * Brain-backed: persistence goes through BrainEventLog directly.
 *
 * CORE-017: handlers return `Result<T, ProjectError[]>`.
 */

import {
  BrainEventLog,
  BrainNoActiveWorkflowError,
} from "../brain-event-log.js";
import { createEvent } from "../event-factory.js";
import type { Author } from "../types.js";
import { resolveActiveWorkflowId } from "./active-workflow.js";
import { err, ok, type Result } from "#src/types/result.js";
import { createError } from "#src/core/output/errors.js";
import type { ProjectError } from "#src/core/output/types.js";
import { fromCaughtError } from "./result-errors.js";

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

export function handover(opts: HandoverOptions): Result<HandoverResult, ProjectError[]> {
  if (!opts.toDevId || opts.toDevId.trim().length === 0) {
    return err([createError("E_HANDOVER_TO_REQUIRED")]);
  }
  if (!opts.reason || opts.reason.trim().length === 0) {
    return err([createError("E_REASON_REQUIRED", { command: "handover" })]);
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    const state = log.getReducedState(workflowId);
    if (state.status === "completed" || state.status === "abandoned") {
      return err([createError("E_WORKFLOW_CANNOT_HANDOVER", { status: state.status })]);
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
    return ok({
      workflowId,
      fromDevId: state.current_owner,
      toDevId: opts.toDevId,
    });
  } catch (e) {
    if (e instanceof BrainNoActiveWorkflowError) {
      return err([createError("E_NO_ACTIVE_WORKFLOW")]);
    }
    return err([fromCaughtError(e)]);
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

export function forceHandover(
  opts: ForceHandoverOptions,
): Result<HandoverResult, ProjectError[]> {
  if (!opts.toDevId || !opts.maintainerId || !opts.reason) {
    return err([createError("E_FORCE_HANDOVER_ARGS_REQUIRED")]);
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

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
    return ok({
      workflowId,
      fromDevId: state.current_owner,
      toDevId: opts.toDevId,
    });
  } catch (e) {
    if (e instanceof BrainNoActiveWorkflowError) {
      return err([createError("E_NO_ACTIVE_WORKFLOW")]);
    }
    return err([fromCaughtError(e)]);
  } finally {
    log.dispose();
  }
}
