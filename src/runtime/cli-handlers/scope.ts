/**
 * Scope-discipline handlers — propose / approve / reject scope expansion +
 * recordIncidentalChange (auto-recorded by the post-tool-use hook for edits
 * that the classifier marks as incidental).
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
import type { Author, ManifestEvent } from "../types.js";
import { resolveActiveWorkflowId } from "./active-workflow.js";
import { err, ok, type Result } from "#src/types/result.js";
import { createError } from "#src/core/output/errors.js";
import type { ProjectError } from "#src/core/output/types.js";
import { fromCaughtError } from "./result-errors.js";

export interface ProposeScopeExpansionOptions {
  filePath: string;
  reason: string;
  author: Author;
  cwd?: string;
}

export interface ProposeScopeExpansionResult {
  workflowId: string;
  filePath: string;
  proposedEventId: string;
}

export function proposeScopeExpansion(
  opts: ProposeScopeExpansionOptions,
): Result<ProposeScopeExpansionResult, ProjectError[]> {
  if (!opts.filePath || opts.filePath.trim().length === 0) {
    return err([createError("E_SCOPE_FILE_REQUIRED")]);
  }
  if (!opts.reason || opts.reason.trim().length === 0) {
    return err([createError("E_REASON_REQUIRED", { command: "propose-expansion" })]);
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    const state = log.getReducedState(workflowId);
    if (state.scope.files_in_plan.includes(opts.filePath)) {
      return err([createError("E_SCOPE_FILE_ALREADY_IN", { filePath: opts.filePath })]);
    }

    const proposed = createEvent({
      eventType: "scope_expansion_proposed",
      payload: { file_path: opts.filePath, reason: opts.reason },
      author: opts.author,
      parentEventId: state.last_event_id,
    });
    log.append(workflowId, proposed);
    return ok({ workflowId, filePath: opts.filePath, proposedEventId: proposed.event_id });
  } catch (e) {
    if (e instanceof BrainNoActiveWorkflowError) {
      return err([createError("E_NO_ACTIVE_WORKFLOW")]);
    }
    return err([fromCaughtError(e)]);
  } finally {
    log.dispose();
  }
}

export interface ApproveScopeExpansionOptions {
  filePath?: string;
  author: Author;
  cwd?: string;
}

export interface ApproveScopeExpansionResult {
  workflowId: string;
  filePath: string;
}

/**
 * Approves the most recent unresolved scope_expansion_proposed event.
 * If --file is provided, approves the most recent proposal for that file.
 */
export function approveScopeExpansion(
  opts: ApproveScopeExpansionOptions,
): Result<ApproveScopeExpansionResult, ProjectError[]> {
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    const events = log.loadEvents(workflowId);
    const proposal = findLatestUnresolvedScopeProposal(events, opts.filePath);
    if (!proposal) {
      return err([
        createError("E_PROPOSAL_NOT_PENDING", {
          kind: opts.filePath ? `scope expansion (file: ${opts.filePath})` : "scope expansion",
        }),
      ]);
    }
    const payload = proposal.payload as { file_path: string };

    log.append(
      workflowId,
      createEvent({
        eventType: "scope_expansion_approved",
        payload: { file_path: payload.file_path, added_to_scope: [payload.file_path] },
        author: opts.author,
        parentEventId: proposal.event_id,
      }),
    );
    return ok({ workflowId, filePath: payload.file_path });
  } catch (e) {
    if (e instanceof BrainNoActiveWorkflowError) {
      return err([createError("E_NO_ACTIVE_WORKFLOW")]);
    }
    return err([fromCaughtError(e)]);
  } finally {
    log.dispose();
  }
}

export interface RejectScopeExpansionOptions {
  filePath?: string;
  reason: string;
  author: Author;
  cwd?: string;
}

export interface RejectScopeExpansionResult {
  workflowId: string;
  filePath: string;
}

export function rejectScopeExpansion(
  opts: RejectScopeExpansionOptions,
): Result<RejectScopeExpansionResult, ProjectError[]> {
  if (!opts.reason || opts.reason.trim().length === 0) {
    return err([createError("E_REASON_REQUIRED", { command: "Reject" })]);
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    const events = log.loadEvents(workflowId);
    const proposal = findLatestUnresolvedScopeProposal(events, opts.filePath);
    if (!proposal) {
      return err([
        createError("E_PROPOSAL_NOT_PENDING", {
          kind: opts.filePath ? `scope expansion (file: ${opts.filePath})` : "scope expansion",
        }),
      ]);
    }
    const payload = proposal.payload as { file_path: string };

    log.append(
      workflowId,
      createEvent({
        eventType: "scope_expansion_rejected",
        payload: { file_path: payload.file_path, reason: opts.reason },
        author: opts.author,
        parentEventId: proposal.event_id,
      }),
    );
    return ok({ workflowId, filePath: payload.file_path });
  } catch (e) {
    if (e instanceof BrainNoActiveWorkflowError) {
      return err([createError("E_NO_ACTIVE_WORKFLOW")]);
    }
    return err([fromCaughtError(e)]);
  } finally {
    log.dispose();
  }
}

function findLatestUnresolvedScopeProposal(
  events: ManifestEvent[],
  filePath?: string,
): ManifestEvent | null {
  // Walk backwards. Track resolved file paths so we skip already-resolved
  // proposals when looking for the latest unresolved one.
  const resolved = new Set<string>();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (!e) continue;
    if (
      e.event_type === "scope_expansion_approved" ||
      e.event_type === "scope_expansion_rejected"
    ) {
      const p = e.payload as { file_path: string };
      resolved.add(p.file_path);
      continue;
    }
    if (e.event_type === "scope_expansion_proposed") {
      const p = e.payload as { file_path: string };
      if (filePath !== undefined && p.file_path !== filePath) continue;
      if (resolved.has(p.file_path)) continue;
      return e;
    }
  }
  return null;
}

export function recordIncidentalChange(opts: {
  filePath: string;
  linesChanged: number;
  classifierReason: string;
  author: Author;
  cwd?: string;
}): Result<{ workflowId: string }, ProjectError[]> {
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    log.append(
      workflowId,
      createEvent({
        eventType: "incidental_change_recorded",
        payload: {
          file_path: opts.filePath,
          lines_changed: opts.linesChanged,
          classifier_reason: opts.classifierReason,
        },
        author: opts.author,
        parentEventId: null,
      }),
    );
    return ok({ workflowId });
  } catch (e) {
    if (e instanceof BrainNoActiveWorkflowError) {
      return err([createError("E_NO_ACTIVE_WORKFLOW")]);
    }
    return err([fromCaughtError(e)]);
  } finally {
    log.dispose();
  }
}
