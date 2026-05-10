/**
 * Workflow lifecycle handlers — runWorkflow + runQuick + getStatus.
 *
 * Adaptive intake (per-workflow profiles, skip rules, CLI flag parsing) lives
 * in `src/runtime/workflows/<id>/`. This module is a thin orchestration layer
 * that consults the adapter registry for the active workflow type.
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
import { adaptationPayloadKey, getAdapter } from "../workflows/registry.js";
import type { BugFixAdaptation } from "../workflows/bug-fix/index.js";
import type { FeatureAdaptation } from "../workflows/feature/index.js";
import type { RefactorAdaptation } from "../workflows/refactor/index.js";
import type { MigrationAdaptation } from "../workflows/migration/index.js";
import type { ProjectAdaptation } from "../workflows/project/index.js";

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
        "and writes docs/CONTEXT.md.",
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
  fromStoryId?: string;
  /** Per-workflow adaptive intake — only the matching field is read by runWorkflow. */
  bugFixAdaptation?: BugFixAdaptation;
  featureAdaptation?: FeatureAdaptation;
  refactorAdaptation?: RefactorAdaptation;
  migrationAdaptation?: MigrationAdaptation;
  projectAdaptation?: ProjectAdaptation;
  /** Cross-workflow conversion — preserves the prior run's metadata + decisions. */
  carryoverFrom?: string;
}

export interface RunResult {
  workflowId: string;
  initEventId: string;
}

const ADAPTATION_FIELD: Record<WorkflowType, keyof RunOptions | undefined> = {
  "bug-fix": "bugFixAdaptation",
  feature: "featureAdaptation",
  refactor: "refactorAdaptation",
  migration: "migrationAdaptation",
  project: "projectAdaptation",
  quick: undefined,
  "team-consolidation": undefined,
};

/**
 * Look up the adapter for the workflow type and serialize its adaptation
 * into the init payload under the conventional key (e.g. `bug_fix_adaptation`).
 * No-op when the adapter is missing or the dev didn't supply an adaptation.
 */
function applyAdaptation(initPayload: Record<string, unknown>, opts: RunOptions): void {
  const adapter = getAdapter(opts.workflowType);
  if (!adapter) return;
  const fieldName = ADAPTATION_FIELD[opts.workflowType];
  if (!fieldName) return;
  const adaptation = opts[fieldName];
  if (adaptation === undefined) return;
  initPayload[adaptationPayloadKey(opts.workflowType)] = adapter.serialize(adaptation);
}

interface CarryoverContext {
  readonly task: string | null;
  readonly type: string | null;
  readonly current_phase: string | null;
  readonly status: string | null;
  readonly scope_files: readonly string[];
  readonly decisions_count: number;
  readonly knowledge_terms: readonly string[];
}

function collectCarryoverContext(log: BrainEventLog, priorId: string): CarryoverContext | null {
  if (!log.hasWorkflow(priorId)) return null;
  const events = log.loadEvents(priorId);
  if (events.length === 0) return null;
  const reduced = reduce(events);
  return {
    task: reduced.task ?? null,
    type: reduced.workflow_type ?? null,
    current_phase: reduced.current_phase ?? null,
    status: reduced.status ?? null,
    scope_files: reduced.scope.files_in_plan,
    decisions_count: events.filter((e) => e.event_type === "decision_recorded").length,
    knowledge_terms: reduced.knowledge.context_terms_added,
  };
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
    // Migrate stale terminal-status pointer so completed/abandoned prior runs
    // do not block a fresh start. Active or paused prior workflows still block
    // in `initWorkflow` itself.
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
    applyAdaptation(initPayload, opts);
    if (opts.carryoverFrom !== undefined) {
      initPayload["carryover_from"] = opts.carryoverFrom;
      const carriedContext = collectCarryoverContext(log, opts.carryoverFrom);
      if (carriedContext !== null) {
        initPayload["carryover_context"] = carriedContext;
      }
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
