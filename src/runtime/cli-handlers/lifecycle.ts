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
import type { Author, Phase } from "../types.js";
import { resolveActiveWorkflowId } from "./active-workflow.js";

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
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) throw new BrainNoActiveWorkflowError();

    const state = log.getReducedState(workflowId);
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
      if (log.hasWorkflow(currentActive)) {
        const state = log.getReducedState(currentActive);
        if (state.status === "active" || state.status === "paused") {
          return {
            recovered: false,
            workflowId: currentActive,
            reason: "Active workflow ID is already set and valid.",
          };
        }
      }
    }

    // Scan workflow_runs for the most recent non-terminal row. As of v11
    // the active-id pointer lives in runtime_state, so workflow_runs holds
    // only real workflow rows.
    const candidates = log.privateRaw
      .prepare(
        `SELECT workflow_id
         FROM workflow_runs
         WHERE status IN ('active', 'paused')
         ORDER BY started_at DESC`,
      )
      .all() as { workflow_id: string }[];

    for (const c of candidates) {
      if (!log.hasWorkflow(c.workflow_id)) continue;
      const state = log.getReducedState(c.workflow_id);
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

// ─── O5 — codi workflow convert (cross-workflow conversion) ──────────────────

import type { WorkflowType } from "../types.js";
import { runWorkflow, type RunOptions } from "./workflow.js";

export interface ConvertOptions {
  /** Target workflow type to start. */
  toType: WorkflowType;
  /** Reason recorded with the abandon event for the source workflow. */
  reason?: string;
  /**
   * Forwarding options — adapter-specific intake fields. The caller is
   * responsible for passing the right `<x>Adaptation` field (the runWorkflow
   * handler picks the matching one for the target type).
   */
  forward: Omit<RunOptions, "workflowType" | "carryoverFrom" | "task" | "author" | "cwd">;
  /** Task line for the new workflow run. */
  task: string;
  author: Author;
  cwd?: string;
}

export interface ConvertResult {
  abandonedWorkflowId: string;
  newWorkflowId: string;
  carryoverFrom: string;
}

/**
 * One-command cross-workflow conversion. Abandons the active workflow with
 * the given reason, then starts a new workflow of `toType` whose init
 * payload preserves a compact carryover_context summary of the source run
 * (task, scope_files, decisions_count, knowledge_terms).
 *
 * Errors:
 *  - no active workflow → BrainNoActiveWorkflowError (re-thrown from abandon)
 *  - knowledge base missing for target → KnowledgeBaseMissingError (from runWorkflow)
 */
export function convertWorkflow(opts: ConvertOptions): ConvertResult {
  const log = BrainEventLog.open();
  let priorId: string;
  try {
    priorId = resolveActiveWorkflowId(log, opts) ?? "";
    if (!priorId) throw new BrainNoActiveWorkflowError();
  } finally {
    log.dispose();
  }

  abandonWorkflow({
    reason: opts.reason ?? `converted to ${opts.toType}`,
    author: opts.author,
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
  });

  const result = runWorkflow({
    workflowType: opts.toType,
    task: opts.task,
    author: opts.author,
    carryoverFrom: priorId,
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    ...opts.forward,
  });

  return {
    abandonedWorkflowId: priorId,
    newWorkflowId: result.workflowId,
    carryoverFrom: priorId,
  };
}
