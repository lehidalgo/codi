/**
 * Workflow lifecycle handlers — runWorkflow + runQuick + getStatus.
 *
 * Adaptive intake (per-workflow profiles, skip rules, CLI flag parsing) lives
 * in `src/runtime/workflows/<id>/`. This module is a thin orchestration layer
 * that consults the adapter registry for the active workflow type.
 */

import { existsSync, readFileSync } from "node:fs";
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
import { snakeAdapterToCamel } from "../workflows/adapter-keys.js";
import type { BugFixAdaptation } from "../workflows/bug-fix/index.js";
import type { FeatureAdaptation } from "../workflows/feature/index.js";
import type { RefactorAdaptation } from "../workflows/refactor/index.js";
import type { MigrationAdaptation } from "../workflows/migration/index.js";
import type { ProjectAdaptation } from "../workflows/project/index.js";
import { PROJECT_DIR } from "#src/constants.js";

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
    // BEGIN IMMEDIATE: serialize stale-active cleanup + init across
    // concurrent `codi workflow run` processes. Without this, two procs
    // can both observe priorActiveId as terminal, both clear it, and both
    // init — producing two active workflows and breaking the singleton
    // invariant. The IMMEDIATE lock makes the cleanup+init atomic per the
    // SQLite write-lock acquired at txn start; the second proc sees
    // SQLITE_BUSY or BrainWorkflowAlreadyActiveError.
    const txn = log.privateRaw.transaction(() => {
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
    });
    return txn.immediate();
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
    // Same singleton-race protection as runWorkflow — see comment there.
    const txn = log.privateRaw.transaction(() => {
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
    });
    return txn.immediate();
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

export interface SlimAdaptationSummary {
  readonly profile: string | null;
  readonly key_answers: Record<string, unknown>;
}

export interface SlimProgress {
  readonly current: number;
  readonly total: number;
  readonly percent: number;
}

export interface SlimStatus {
  readonly active: boolean;
  readonly workflow_id: string | null;
  readonly workflow_type: WorkflowType | null;
  readonly current_phase: string | null;
  readonly status: string | null;
  readonly task: string | null;
  readonly adaptation: SlimAdaptationSummary | null;
  readonly skipped_phases: readonly string[];
  readonly next_phase: string | null;
  readonly progress: SlimProgress | null;
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

const SLIM_ADAPTATION_KEY: Partial<Record<WorkflowType, string>> = {
  "bug-fix": "bug_fix_adaptation",
  feature: "feature_adaptation",
  refactor: "refactor_adaptation",
  migration: "migration_adaptation",
  project: "project_adaptation",
};

const SLIM_KEY_ANSWERS: Partial<Record<WorkflowType, readonly string[]>> = {
  "bug-fix": ["severity", "scope", "execute_mode"],
  feature: ["complexity", "scope", "execute_mode"],
  refactor: ["kind", "scope", "execute_mode"],
  migration: ["risk_level", "rollback_tested"],
  project: ["mode", "no_sheet"],
};

function loadInitPayload(workflowId: string): Record<string, unknown> | null {
  const log = BrainEventLog.open();
  try {
    const events = log.loadEvents(workflowId);
    const init = events.find((e) => e.event_type === "init");
    if (!init) return null;
    return (init.payload as Record<string, unknown>) ?? null;
  } finally {
    log.dispose();
  }
}

function buildAdaptationSummary(
  workflowType: WorkflowType,
  initPayload: Record<string, unknown> | null,
): SlimAdaptationSummary | null {
  if (!initPayload) return null;
  const key = SLIM_ADAPTATION_KEY[workflowType];
  if (!key) return null;
  const raw = initPayload[key];
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const profile = typeof r["profile"] === "string" ? (r["profile"] as string) : null;
  const keyAnswers: Record<string, unknown> = {};
  for (const field of SLIM_KEY_ANSWERS[workflowType] ?? []) {
    if (r[field] !== undefined) keyAnswers[field] = r[field];
  }
  return { profile, key_answers: keyAnswers };
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
      adaptation: null,
      skipped_phases: [],
      next_phase: null,
      progress: null,
    };
  }
  const s = result.state;
  const adapter = getAdapter(s.workflow_type);
  const initPayload = loadInitPayload(s.workflow_id);
  const adaptationSummary = buildAdaptationSummary(s.workflow_type, initPayload);

  let skippedPhases: readonly string[] = [];
  let nextPhase: string | null = null;
  let progress: SlimProgress | null = null;
  if (adapter !== undefined) {
    const adaptationCanonical = readAdaptationCanonical(s.workflow_type, initPayload);
    if (adaptationCanonical !== null) {
      skippedPhases = adapter.computeSkipPhases(adaptationCanonical);
    }
    const idx = adapter.phaseOrder.indexOf(s.current_phase);
    if (idx >= 0 && idx < adapter.phaseOrder.length - 1) {
      const skipSet = new Set(skippedPhases);
      for (let i = idx + 1; i < adapter.phaseOrder.length; i += 1) {
        const candidate = adapter.phaseOrder[i];
        if (candidate === undefined) continue;
        if (!skipSet.has(candidate)) {
          nextPhase = candidate;
          break;
        }
      }
    }
    const total = adapter.phaseOrder.length;
    const current = idx === -1 ? 0 : idx + 1;
    progress = {
      current,
      total,
      percent: total === 0 ? 0 : Math.round((current / total) * 100),
    };
  }

  return {
    active: true,
    workflow_id: s.workflow_id,
    workflow_type: s.workflow_type,
    current_phase: s.current_phase,
    status: s.status,
    task: s.task,
    adaptation: adaptationSummary,
    skipped_phases: skippedPhases,
    next_phase: nextPhase,
    progress,
  };
}

// ─── O4 — phase-ref reader with active-adaptation block ──────────────────────

const ADAPTATION_HEADER_BEGIN = "<!-- BEGIN active-adaptation -->";
const ADAPTATION_HEADER_END = "<!-- END active-adaptation -->";

const SKILL_DIR_BY_TYPE: Partial<Record<WorkflowType, string>> = {
  feature: "feature-workflow",
  "bug-fix": "bug-fix-workflow",
  refactor: "refactor-workflow",
  migration: "migration-workflow",
  project: "project-workflow",
};

export interface PhaseRefOptions {
  /** Defaults to the active workflow's current phase. */
  phase?: string;
  /**
   * Search root for installed phase-refs. Defaults to `process.cwd()`.
   * Paths probed (first match wins): `<cwd>/.codi/skills/codi-<workflow>-workflow/references/phase-X.md`,
   * `<cwd>/.codi/skills/<workflow>-workflow/references/phase-X.md`,
   * `<cwd>/src/templates/skills/<workflow>-workflow/references/phase-X.md`.
   */
  cwd?: string;
  /**
   * Cwd used to identify the active workflow. Defaults to `cwd`. Tests pass
   * a different value when the workflow lives in a tmp dir but the
   * phase-ref content lives in the codi repo.
   */
  workflowCwd?: string;
}

export interface PhaseRefResult {
  readonly workflowId: string;
  readonly workflowType: WorkflowType;
  readonly phase: string;
  readonly path: string;
  readonly markdown: string;
}

/**
 * Read the phase-ref markdown for the active workflow's current phase (or
 * an override) and prepend a transient "active adaptation" block summarizing
 * profile + skipped_phases + next_phase. The agent reads this instead of
 * the raw file when it wants context about the active run.
 *
 * Throws when no workflow is active or the phase-ref does not exist.
 */
export function getPhaseRef(opts: PhaseRefOptions = {}): PhaseRefResult {
  const statusCwd = opts.workflowCwd ?? opts.cwd ?? process.cwd();
  const slim = getSlimStatus({ cwd: statusCwd });
  if (!slim.active || slim.workflow_id === null || slim.workflow_type === null) {
    throw new Error("No active workflow — start one with `codi workflow run` first.");
  }
  const phase = opts.phase ?? slim.current_phase ?? "intent";
  const skillDir = SKILL_DIR_BY_TYPE[slim.workflow_type];
  if (!skillDir) {
    throw new Error(`No phase-ref directory mapping for workflow type '${slim.workflow_type}'.`);
  }
  const cwd = opts.cwd ?? process.cwd();
  const candidates = [
    resolve(cwd, PROJECT_DIR, "skills", `codi-${skillDir}`, "references", `phase-${phase}.md`),
    resolve(cwd, PROJECT_DIR, "skills", skillDir, "references", `phase-${phase}.md`),
    resolve(cwd, "src", "templates", "skills", skillDir, "references", `phase-${phase}.md`),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) {
    throw new Error(
      `phase-ref for '${slim.workflow_type}.${phase}' not found. Searched:\n  ${candidates.join("\n  ")}`,
    );
  }
  const raw = readFileSync(path, "utf8");
  const header = renderActiveAdaptationBlock(slim);
  return {
    workflowId: slim.workflow_id,
    workflowType: slim.workflow_type,
    phase,
    path,
    markdown: `${header}\n\n${raw}`,
  };
}

function renderActiveAdaptationBlock(slim: SlimStatus): string {
  const lines: string[] = [ADAPTATION_HEADER_BEGIN, ""];
  if (slim.adaptation !== null) {
    const profile = slim.adaptation.profile ?? "(none)";
    lines.push(`## Active adaptation`);
    lines.push("");
    lines.push(`- **Profile:** \`${profile}\``);
    const answers = Object.entries(slim.adaptation.key_answers);
    if (answers.length > 0) {
      lines.push(
        `- **Key answers:** ${answers.map(([k, v]) => `${k}=\`${String(v)}\``).join(", ")}`,
      );
    }
  } else {
    lines.push(`## Active adaptation`);
    lines.push("");
    lines.push(`- _No adaptive intake recorded for this run._`);
  }
  if (slim.skipped_phases.length > 0) {
    lines.push(`- **Skipped phases:** ${slim.skipped_phases.join(", ")}`);
  }
  if (slim.next_phase !== null) {
    lines.push(`- **Next phase:** \`${slim.next_phase}\``);
  }
  if (slim.progress !== null) {
    lines.push(
      `- **Progress:** ${slim.progress.current} of ${slim.progress.total} phases (${slim.progress.percent}%)`,
    );
  }
  lines.push("");
  lines.push(ADAPTATION_HEADER_END);
  return lines.join("\n");
}

function readAdaptationCanonical(
  workflowType: WorkflowType,
  initPayload: Record<string, unknown> | null,
): unknown {
  if (!initPayload) return null;
  const key = SLIM_ADAPTATION_KEY[workflowType];
  if (!key) return null;
  const raw = initPayload[key];
  if (typeof raw !== "object" || raw === null) return null;
  // Convert snake_case payload back to camelCase for the adapter resolvers.
  // The mapping is owned by `runtime/workflows/adapter-keys.ts` so this
  // handler and `cli-handlers/transitions.ts` share a single source.
  return snakeAdapterToCamel(raw as Record<string, unknown>);
}
