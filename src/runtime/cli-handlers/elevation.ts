/**
 * Child-workflow elevation handlers — propose / approve / reject elevation +
 * resolveChild (records that a child workflow has finished and forces the
 * parent back to phase plan per the constitutional rule).
 *
 * Brain-backed: persistence goes through BrainEventLog directly.
 */

import {
  BrainEventLog,
  BrainNoActiveWorkflowError as NoActiveWorkflowError,
} from "../brain-event-log.js";
import { createEvent } from "../event-factory.js";
import type { Author, ManifestEvent, Phase, WorkflowType } from "../types.js";
import { resolveActiveWorkflowId } from "./active-workflow.js";

const SYSTEM_AUTHOR: Author = { type: "system", id: "codi" };

export interface ProposeElevationOptions {
  childWorkflowType: WorkflowType;
  trigger: string;
  reason: string;
  author: Author;
  cwd?: string;
}

export interface ProposeElevationResult {
  workflowId: string;
  proposedEventId: string;
}

export function proposeElevation(opts: ProposeElevationOptions): ProposeElevationResult {
  if (!opts.reason || opts.reason.trim().length === 0) {
    throw new Error("propose-elevation requires --reason '<text>'");
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) throw new NoActiveWorkflowError();

    const state = log.getReducedState(workflowId);
    if (state.status !== "active") {
      throw new Error(`Cannot elevate from a ${state.status} workflow.`);
    }

    const proposed = createEvent({
      eventType: "elevation_proposed",
      payload: {
        suggested_workflow_type: opts.childWorkflowType,
        trigger: opts.trigger,
        reason: opts.reason,
      },
      author: opts.author,
      parentEventId: state.last_event_id,
    });
    log.append(workflowId, proposed);
    return { workflowId, proposedEventId: proposed.event_id };
  } finally {
    log.dispose();
  }
}

export interface ApproveElevationOptions {
  author: Author;
  cwd?: string;
}

export interface ApproveElevationResult {
  parentWorkflowId: string;
  childWorkflowId: string;
  childBranch: string;
}

export function approveElevation(opts: ApproveElevationOptions): ApproveElevationResult {
  const log = BrainEventLog.open();
  try {
    const parentId = resolveActiveWorkflowId(log, opts);
    if (!parentId) throw new NoActiveWorkflowError();

    const events = log.loadEvents(parentId);
    const lastProposal = findLatestUnresolvedElevation(events);
    if (!lastProposal) throw new Error("No pending elevation proposal.");
    const payload = lastProposal.payload as {
      suggested_workflow_type: WorkflowType;
      reason: string;
    };

    const childId = `${parentId}-child-${payload.suggested_workflow_type}-${Date.now()}`;
    const childBranch = `codi/${parentId}/${payload.suggested_workflow_type}`;
    const state = log.getReducedState(parentId);

    log.append(
      parentId,
      createEvent({
        eventType: "elevation_approved",
        payload: { child_workflow_type: payload.suggested_workflow_type },
        author: opts.author,
        parentEventId: lastProposal.event_id,
      }),
    );

    log.append(
      parentId,
      createEvent({
        eventType: "child_workflow_initiated",
        payload: {
          child_workflow_id: childId,
          child_workflow_type: payload.suggested_workflow_type,
          child_branch: childBranch,
          reason: payload.reason,
        },
        author: SYSTEM_AUTHOR,
        parentEventId: lastProposal.event_id,
      }),
    );

    log.append(
      parentId,
      createEvent({
        eventType: "workflow_paused_for_child",
        payload: { child_workflow_id: childId, paused_in_phase: state.current_phase },
        author: SYSTEM_AUTHOR,
        parentEventId: lastProposal.event_id,
      }),
    );

    return { parentWorkflowId: parentId, childWorkflowId: childId, childBranch };
  } finally {
    log.dispose();
  }
}

export interface RejectElevationOptions {
  reason: string;
  author: Author;
  cwd?: string;
}

export function rejectElevation(opts: RejectElevationOptions): { workflowId: string } {
  if (!opts.reason || opts.reason.trim().length === 0) {
    throw new Error("Reject elevation requires --reason '<text>'");
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) throw new NoActiveWorkflowError();

    const events = log.loadEvents(workflowId);
    const lastProposal = findLatestUnresolvedElevation(events);
    if (!lastProposal) throw new Error("No pending elevation proposal.");

    log.append(
      workflowId,
      createEvent({
        eventType: "elevation_rejected",
        payload: { reason: opts.reason },
        author: opts.author,
        parentEventId: lastProposal.event_id,
      }),
    );
    return { workflowId };
  } finally {
    log.dispose();
  }
}

export interface ResolveChildOptions {
  childWorkflowId: string;
  status: "completed" | "abandoned";
  summary?: string;
  author: Author;
  cwd?: string;
}

/**
 * Records that a child workflow has resolved. Forces parent back to phase
 * plan because the codebase state has changed and the plan needs review.
 */
export function resolveChild(opts: ResolveChildOptions): {
  parentWorkflowId: string;
  resumedInPhase: Phase;
} {
  const log = BrainEventLog.open();
  try {
    const parentId = resolveActiveWorkflowId(log, opts);
    if (!parentId) throw new NoActiveWorkflowError();

    const summaryPayload = opts.summary !== undefined ? { summary: opts.summary } : {};
    log.append(
      parentId,
      createEvent({
        eventType: "child_workflow_resolved",
        payload: {
          child_workflow_id: opts.childWorkflowId,
          status: opts.status,
          ...summaryPayload,
        },
        author: SYSTEM_AUTHOR,
        parentEventId: null,
      }),
    );

    // Force parent back to phase plan per the constitutional rule.
    log.append(
      parentId,
      createEvent({
        eventType: "workflow_resumed_after_child",
        payload: { child_workflow_id: opts.childWorkflowId, resumed_in_phase: "plan" },
        author: opts.author,
        parentEventId: null,
      }),
    );
    return { parentWorkflowId: parentId, resumedInPhase: "plan" };
  } finally {
    log.dispose();
  }
}

function findLatestUnresolvedElevation(events: ManifestEvent[]): ManifestEvent | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (!e) continue;
    if (e.event_type === "elevation_approved" || e.event_type === "elevation_rejected") {
      return null; // most recent elevation activity is already resolved
    }
    if (e.event_type === "elevation_proposed") return e;
  }
  return null;
}
