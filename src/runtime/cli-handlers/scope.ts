/**
 * Scope-discipline handlers — propose / approve / reject scope expansion +
 * recordIncidentalChange (auto-recorded by the post-tool-use hook for edits
 * that the classifier marks as incidental).
 *
 * Brain-backed: persistence goes through BrainEventLog directly.
 */

import {
  BrainEventLog,
  BrainNoActiveWorkflowError as NoActiveWorkflowError,
} from "../brain-event-log.js";
import { createEvent } from "../event-factory.js";
import { reduce } from "../reducer.js";
import type { Author, ManifestEvent } from "../types.js";

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
): ProposeScopeExpansionResult {
  if (!opts.filePath || opts.filePath.trim().length === 0) {
    throw new Error("propose-expansion requires --file <path>");
  }
  if (!opts.reason || opts.reason.trim().length === 0) {
    throw new Error("propose-expansion requires --reason '<text>'");
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) throw new NoActiveWorkflowError();

    const state = reduce(log.loadEvents(workflowId));
    if (state.scope.files_in_plan.includes(opts.filePath)) {
      throw new Error(`File '${opts.filePath}' is already in scope.`);
    }

    const proposed = createEvent({
      eventType: "scope_expansion_proposed",
      payload: { file_path: opts.filePath, reason: opts.reason },
      author: opts.author,
      parentEventId: state.last_event_id,
    });
    log.append(workflowId, proposed);
    return { workflowId, filePath: opts.filePath, proposedEventId: proposed.event_id };
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
): ApproveScopeExpansionResult {
  const log = BrainEventLog.open();
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) throw new NoActiveWorkflowError();

    const events = log.loadEvents(workflowId);
    const proposal = findLatestUnresolvedScopeProposal(events, opts.filePath);
    if (!proposal) {
      throw new Error(
        opts.filePath
          ? `No pending scope expansion proposal for ${opts.filePath}.`
          : "No pending scope expansion proposal.",
      );
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
    return { workflowId, filePath: payload.file_path };
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
): RejectScopeExpansionResult {
  if (!opts.reason || opts.reason.trim().length === 0) {
    throw new Error("Reject requires --reason '<text>'.");
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) throw new NoActiveWorkflowError();

    const events = log.loadEvents(workflowId);
    const proposal = findLatestUnresolvedScopeProposal(events, opts.filePath);
    if (!proposal) {
      throw new Error(
        opts.filePath
          ? `No pending scope expansion proposal for ${opts.filePath}.`
          : "No pending scope expansion proposal.",
      );
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
    return { workflowId, filePath: payload.file_path };
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
}): { workflowId: string } {
  const log = BrainEventLog.open();
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) throw new NoActiveWorkflowError();

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
    return { workflowId };
  } finally {
    log.dispose();
  }
}
