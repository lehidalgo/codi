/**
 * Workflow lifecycle handlers — runWorkflow + getStatus.
 *
 * runWorkflow boots a brand-new workflow (writes init + first phase_started).
 * It refuses to run if docs/CONTEXT.md is missing — that's the agent's cue
 * to invoke codi:init-knowledge-base before retrying.
 *
 * Brain-backed: persistence goes through BrainEventLog directly.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { BrainEventLog } from "../brain-event-log.js";
import { createEvent } from "../event-factory.js";
import { reduce } from "../reducer.js";
import { buildWorkflowId, disambiguate } from "../workflow-id.js";
import {
  QUICK_CATEGORIES,
  type Author,
  type QuickCategory,
  type ReducedState,
  type WorkflowType,
} from "../types.js";

export class KnowledgeBaseMissingError extends Error {
  constructor(public readonly contextPath: string) {
    super(
      `Knowledge base missing: ${contextPath} does not exist.\n` +
        "\n" +
        "AGENT INSTRUCTIONS (do not relay to the user):\n" +
        "1. Immediately invoke the codi:init-knowledge-base skill yourself via the Skill tool.\n" +
        "2. Do NOT ask the user to invoke it — you are the agent.\n" +
        "3. After init-knowledge-base completes, re-run the original codi command with the same arguments.\n" +
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

  const log = BrainEventLog.open();
  try {
    // Migrate stale terminal-status pointer. If the prior active workflow is
    // in `completed` or `abandoned` status, clearing the pointer is safe:
    // the workflow_runs row stays addressable by id. Any active or paused
    // prior workflow still blocks (handled in initWorkflow).
    const priorActiveId = log.getActiveWorkflowId();
    if (priorActiveId !== null) {
      const priorEvents = log.loadEvents(priorActiveId);
      if (priorEvents.length > 0) {
        const priorState = reduce(priorEvents);
        if (priorState.status === "completed" || priorState.status === "abandoned") {
          log.clearActiveWorkflowId();
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
      cwd: opts.cwd ?? process.cwd(),
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
        author: { type: "system", id: "codi" },
        parentEventId: initEvent.event_id,
      }),
    );

    return { workflowId, initEventId: initEvent.event_id };
  } finally {
    log.dispose();
  }
}

export interface QuickRunOptions {
  task: string;
  category: QuickCategory;
  author: Author;
  cwd?: string;
}

export interface QuickRunResult {
  workflowId: string;
  initEventId: string;
  completedEventId: string;
}

/**
 * Q7 — `codi quick` mode. Boots a workflow_run with type='quick', records
 * the category in the init payload, and immediately closes the run with a
 * `workflow_completed` event. No phase machine, no chain skills, no transition
 * gates — but a manifest row exists so the audit trail is complete.
 *
 * The dev classifies the edit (typo / comment / dep-bump / format / doc-tweak).
 * Anything that doesn't fit one of those needs a real workflow.
 */
export function runQuick(opts: QuickRunOptions): QuickRunResult {
  const cwd = opts.cwd ?? process.cwd();

  if (!QUICK_CATEGORIES.includes(opts.category)) {
    throw new Error(
      `unknown quick category '${opts.category}'. Valid: ${QUICK_CATEGORIES.join(", ")}`,
    );
  }

  const ctxPath = contextMdPath(cwd);
  if (!existsSync(ctxPath)) {
    throw new KnowledgeBaseMissingError(ctxPath);
  }

  const log = BrainEventLog.open();
  try {
    const priorActiveId = log.getActiveWorkflowId();
    if (priorActiveId !== null) {
      const priorEvents = log.loadEvents(priorActiveId);
      if (priorEvents.length > 0) {
        const priorState = reduce(priorEvents);
        if (priorState.status === "completed" || priorState.status === "abandoned") {
          log.clearActiveWorkflowId();
        }
      }
    }

    const baseId = buildWorkflowId("quick", opts.task);
    const workflowId = disambiguate(baseId, (id) => log.hasWorkflow(id));

    const initEvent = createEvent({
      eventType: "init",
      payload: {
        workflow_id: workflowId,
        workflow_type: "quick",
        task: opts.task,
        plugin_version: "0.1.0",
        cwd,
        quick_category: opts.category,
      },
      author: opts.author,
      parentEventId: null,
    });

    log.initWorkflow(workflowId, initEvent);

    log.append(
      workflowId,
      createEvent({
        eventType: "phase_started",
        payload: { phase: "intent" },
        author: { type: "system", id: "codi" },
        parentEventId: initEvent.event_id,
      }),
    );

    const completedEvent = createEvent({
      eventType: "workflow_completed",
      payload: { duration_ms: 0, summary: `quick run: ${opts.category}` },
      author: { type: "system", id: "codi" },
      parentEventId: initEvent.event_id,
    });
    log.append(workflowId, completedEvent);
    log.clearActiveWorkflowId();

    return {
      workflowId,
      initEventId: initEvent.event_id,
      completedEventId: completedEvent.event_id,
    };
  } finally {
    log.dispose();
  }
}

export interface StatusOptions {
  workflowId?: string;
  cwd?: string;
}

export interface StatusResult {
  active: boolean;
  state: ReducedState | null;
}

/**
 * Slim shape for agent session-start polling (Q14). Holds only the fields
 * the agent needs to decide whether to chain skills or operate ad-hoc:
 * which workflow is live, which phase, what task.
 */
export interface SlimStatus {
  readonly active: boolean;
  readonly workflow_id: string | null;
  readonly workflow_type: WorkflowType | null;
  readonly current_phase: string | null;
  readonly status: string | null;
  readonly task: string | null;
}

export function getStatus(opts: StatusOptions = {}): StatusResult {
  const log = BrainEventLog.open();
  try {
    // Status is the user-facing surface — apply the cwd filter so a
    // workflow started in another project does not appear here.
    const cwd = opts.cwd ?? process.cwd();
    const workflowId = opts.workflowId ?? log.getActiveWorkflowIdForCwd(cwd);
    if (!workflowId) return { active: false, state: null };

    const events = log.loadEvents(workflowId);
    if (events.length === 0) return { active: false, state: null };
    return { active: true, state: reduce(events) };
  } finally {
    log.dispose();
  }
}

/**
 * Q14 — slim status, for agent session-start polling.
 *
 * Cheap to compute, cheap to serialize, cheap to read. The full ReducedState
 * is ~16 fields; the agent only needs to know "am I in a workflow and which
 * phase". When inactive, every field except `active` is null.
 */
export function getSlimStatus(opts: StatusOptions = {}): SlimStatus {
  const result = getStatus(opts);
  if (!result.active || result.state === null) {
    return {
      active: false,
      workflow_id: null,
      workflow_type: null,
      current_phase: null,
      status: null,
      task: null,
    };
  }
  const s = result.state;
  return {
    active: true,
    workflow_id: s.workflow_id,
    workflow_type: s.workflow_type,
    current_phase: s.current_phase,
    status: s.status,
    task: s.task,
  };
}
