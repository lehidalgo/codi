/**
 * Workflow lifecycle handlers — runWorkflow + getStatus.
 *
 * runWorkflow boots a brand-new workflow (writes init + first phase_started).
 * It refuses to run if docs/CONTEXT.md is missing — that's the agent's cue
 * to invoke devloop:init-knowledge-base before retrying.
 */

import { existsSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { selectEventLog, isLegacyEventLog } from "../event-log-factory.js";
import { createEvent } from "../event-factory.js";
import { reduce } from "../reducer.js";
import { buildWorkflowId, disambiguate } from "../workflow-id.js";
import type { Author, ReducedState, WorkflowType } from "../types.js";

export class KnowledgeBaseMissingError extends Error {
  constructor(public readonly contextPath: string) {
    super(
      `Knowledge base missing: ${contextPath} does not exist.\n` +
        "\n" +
        "AGENT INSTRUCTIONS (do not relay to the user):\n" +
        "1. Immediately invoke the devloop:init-knowledge-base skill yourself via the Skill tool.\n" +
        "2. Do NOT ask the user to invoke it — you are the agent.\n" +
        "3. After init-knowledge-base completes, re-run the original devloop command with the same arguments.\n" +
        "\n" +
        "The init-knowledge-base skill scans the codebase, proposes domain terms, " +
        "asks the user to confirm those terms (one decision point), then writes docs/CONTEXT.md.",
    );
    this.name = "KnowledgeBaseMissingError";
  }
}

function contextMdPath(cwd: string): string {
  return resolve(cwd, "docs", "CONTEXT.md");
}

export interface RunOptions {
  workflowType: WorkflowType;
  task: string;
  author: Author;
  cwd?: string;
  /** Optional UserStory id this workflow run is delivering (--from-story US-NNN). */
  fromStoryId?: string;
}

export interface RunResult {
  workflowId: string;
  initEventId: string;
}

export function runWorkflow(opts: RunOptions): RunResult {
  const cwd = opts.cwd ?? process.cwd();

  const ctxPath = contextMdPath(cwd);
  if (!existsSync(ctxPath)) {
    throw new KnowledgeBaseMissingError(ctxPath);
  }

  if (opts.fromStoryId !== undefined && !/^US-\d{3,}$/.test(opts.fromStoryId)) {
    throw new Error(`--from-story must match pattern US-NNN (got '${opts.fromStoryId}')`);
  }

  const log = selectEventLog(cwd);

  // Migrate stale terminal-status pointer. If the prior active workflow is
  // in `completed` or `abandoned` status, clearing the pointer + staging is
  // safe: the archive remains addressable via `--workflow <id>` / `replay`.
  // Any active or paused prior workflow still blocks (handled in initWorkflow).
  const priorActiveId = log.getActiveWorkflowId();
  if (priorActiveId !== null) {
    const priorEvents = log.loadEvents(priorActiveId);
    if (priorEvents.length > 0) {
      const priorState = reduce(priorEvents);
      if (priorState.status === "completed" || priorState.status === "abandoned") {
        log.clearActiveWorkflowId();
        // Staging cleanup is a legacy filesystem concept — brain backend
        // has no staging directory (every event lives in workflow_events
        // with a commitable flag). Skip for brain.
        if (isLegacyEventLog(log) && existsSync(log.paths.stagingDir)) {
          for (const file of readdirSync(log.paths.stagingDir)) {
            rmSync(join(log.paths.stagingDir, file));
          }
        }
      }
    }
  }

  const baseId = buildWorkflowId(opts.workflowType, opts.task);
  const workflowId = disambiguate(baseId, (id) => log.hasWorkflow(id));

  const initPayload: Record<string, unknown> = {
    workflow_id: workflowId,
    workflow_type: opts.workflowType,
    task: opts.task,
    plugin_version: "0.1.0",
  };
  if (opts.fromStoryId !== undefined) {
    initPayload["from_story_id"] = opts.fromStoryId;
  }

  const initEvent = createEvent({
    eventType: "init",
    payload: initPayload,
    author: opts.author,
    parentEventId: null,
  });

  log.initWorkflow(workflowId, initEvent);

  log.append(
    workflowId,
    createEvent({
      eventType: "phase_started",
      payload: { phase: "intent" },
      author: { type: "system", id: "devloop" },
      parentEventId: initEvent.event_id,
    }),
  );

  return { workflowId, initEventId: initEvent.event_id };
}

export interface StatusOptions {
  workflowId?: string;
  cwd?: string;
}

export interface StatusResult {
  active: boolean;
  state: ReducedState | null;
}

export function getStatus(opts: StatusOptions = {}): StatusResult {
  const log = selectEventLog(opts.cwd ?? process.cwd());
  const workflowId = opts.workflowId ?? log.getActiveWorkflowId();
  if (!workflowId) return { active: false, state: null };

  const events = log.loadEvents(workflowId);
  if (events.length === 0) return { active: false, state: null };
  return { active: true, state: reduce(events) };
}
