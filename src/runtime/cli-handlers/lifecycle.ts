/**
 * Workflow lifecycle handlers — abandonWorkflow + recoverWorkflow.
 *
 * abandonWorkflow records workflow_abandoned and clears the active pointer.
 * recoverWorkflow rebuilds the active pointer from the most recent
 * non-terminal archive when active/workflow-id.txt is missing or stale.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { EventLog, NoActiveWorkflowError } from "../event-log.js";
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
  const log = EventLog.fromCwd(opts.cwd ?? process.cwd());
  const workflowId = log.getActiveWorkflowId();
  if (!workflowId) throw new NoActiveWorkflowError();

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
 * Recovers the active workflow ID from the most recent non-terminal archive
 * if active/workflow-id.txt is missing or stale. Useful after corruption,
 * fresh clone, or machine switch.
 */
export function recoverWorkflow(opts: RecoverOptions = {}): RecoverResult {
  const log = EventLog.fromCwd(opts.cwd ?? process.cwd());

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

  if (!existsSync(log.paths.archivesDir)) {
    return { recovered: false, workflowId: null, reason: "No archives directory found." };
  }
  const candidates = readdirSync(log.paths.archivesDir)
    .map((name) => ({
      name,
      path: join(log.paths.archivesDir, name),
      mtimeMs: statSync(join(log.paths.archivesDir, name)).mtimeMs,
    }))
    .filter((entry) => statSync(entry.path).isDirectory())
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of candidates) {
    const events = log.loadArchivedEvents(candidate.name);
    if (events.length === 0) continue;
    const state = reduce(events);
    if (state.status === "active" || state.status === "paused") {
      log.setActiveWorkflowId(candidate.name);
      return {
        recovered: true,
        workflowId: candidate.name,
        reason: `Recovered active workflow from archive (status: ${state.status}).`,
      };
    }
  }

  return {
    recovered: false,
    workflowId: null,
    reason: "No non-terminal archived workflow found to recover.",
  };
}
