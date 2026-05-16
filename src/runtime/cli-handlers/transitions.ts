/**
 * Phase-transition handlers — propose / approve / reject.
 *
 * The flow is:
 *   1. agent (or user) calls proposeTransition({ to })
 *   2. system writes phase_transition_proposed event
 *   3. user calls approveTransition() or rejectTransition({ reason })
 *   4. on approve, system writes phase_completed (for the from_phase) +
 *      phase_transition_approved + phase_started (for the to_phase).
 *      Reaching phase `done` additionally emits a terminal phase_completed
 *      and workflow_completed.
 *   5. on reject, system writes phase_transition_rejected; current phase
 *      stays the same.
 *
 * Brain-backed: persistence goes through BrainEventLog directly.
 *
 * CORE-017: handlers return `Result<T, ProjectError[]>`. The inner
 * `assertLegalTransition` STILL throws — its typed errors
 * (`UnknownWorkflowTypeError`) are caught locally and degrade gracefully
 * to skip enforcement. ReducerError from `getReducedState` is intentionally
 * propagated up via the outer catch as `E_GENERAL` (corrupt event log =
 * loud failure, per CORE-001).
 */

import {
  BrainEventLog,
  BrainNoActiveWorkflowError,
} from "../brain-event-log.js";
import { createEvent } from "../event-factory.js";
import { reduce } from "../reducer.js";
import type { Author, Phase, ReducedState } from "../types.js";
import { assertLegalTransition, UnknownWorkflowTypeError } from "../workflow-graph.js";
import { runPhaseGates, formatGateAdvisory } from "../gate-runner-bridge.js";
import { resolveActiveWorkflowId } from "./active-workflow.js";
import { err, ok, type Result } from "#src/types/result.js";
import { createError } from "#src/core/output/errors.js";
import type { ProjectError } from "#src/core/output/types.js";
import { fromCaughtError } from "./result-errors.js";

const SYSTEM_AUTHOR: Author = { type: "system", id: "codi" };

export interface ProposeTransitionOptions {
  toPhase: Phase;
  author: Author;
  cwd?: string;
}

export interface ProposeTransitionResult {
  workflowId: string;
  fromPhase: Phase;
  toPhase: Phase;
  proposedEventId: string;
}

export function proposeTransition(
  opts: ProposeTransitionOptions,
): Result<ProposeTransitionResult, ProjectError[]> {
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    const state = log.getReducedState(workflowId);
    const fromPhase = state.current_phase;

    if (fromPhase === opts.toPhase) {
      return err([createError("E_WORKFLOW_ALREADY_IN_PHASE", { phase: opts.toPhase })]);
    }
    if (state.status !== "active") {
      return err([createError("E_WORKFLOW_NOT_ACTIVE", { status: state.status })]);
    }

    // F4 — phase graph enforcement. Read workflow_definitions[type].phases[from].next
    // from brain.db and reject illegal transitions. Missing definitions or a
    // brain.db without the v2 schema yet degrade gracefully (no enforcement)
    // so callers without a seeded brain — fresh installs pre-`codi init`,
    // tests with tmp brains — still work; F11 tightens this once all install
    // paths guarantee seeding.
    try {
      assertLegalTransition(log.privateRaw, state.workflow_type, fromPhase, opts.toPhase);
    } catch (e) {
      if (e instanceof UnknownWorkflowTypeError) {
        // Definition not seeded — skip enforcement.
      } else if (e instanceof Error && /no such table: workflow_definitions/.test(e.message)) {
        // Brain DB present but pre-v2 (table missing) — skip enforcement.
      } else {
        // IllegalPhaseTransitionError or other — map to ProjectError and bail.
        return err([fromCaughtError(e)]);
      }
    }

    const proposed = createEvent({
      eventType: "phase_transition_proposed",
      payload: { from_phase: fromPhase, to_phase: opts.toPhase },
      author: opts.author,
      parentEventId: state.last_event_id,
    });
    log.append(workflowId, proposed);

    return ok({
      workflowId,
      fromPhase,
      toPhase: opts.toPhase,
      proposedEventId: proposed.event_id,
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

export interface ApproveTransitionOptions {
  author: Author;
  cwd?: string;
}

export interface ApproveTransitionResult {
  workflowId: string;
  fromPhase: Phase;
  toPhase: Phase;
}

export function approveTransition(
  opts: ApproveTransitionOptions,
): Result<ApproveTransitionResult, ProjectError[]> {
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    const events = log.loadEvents(workflowId);
    const lastProposed = events
      .slice()
      .reverse()
      .find((e) => e.event_type === "phase_transition_proposed");
    if (!lastProposed) {
      return err([createError("E_PROPOSAL_NOT_PENDING", { kind: "transition" })]);
    }
    const proposalPayload = lastProposed.payload as { from_phase: Phase; to_phase: Phase };
    // Reject any newer event of the same proposal type that came after a
    // resolution — handled by walking backwards and seeing if the proposal
    // is still the most recent transition event.
    const lastTransitionEvent = events
      .slice()
      .reverse()
      .find(
        (e) =>
          e.event_type === "phase_transition_proposed" ||
          e.event_type === "phase_transition_approved" ||
          e.event_type === "phase_transition_rejected",
      );
    if (!lastTransitionEvent || lastTransitionEvent.event_id !== lastProposed.event_id) {
      return err([createError("E_PROPOSAL_NOT_PENDING", { kind: "transition" })]);
    }

    const state = log.getReducedState(workflowId);
    const fromPhase = proposalPayload.from_phase;

    // Advisory gate run — fires the deterministic checkers configured for
    // this workflow's `fromPhase`, persists gate_check_* events, and
    // surfaces failures to stderr. Never blocks: the transition still
    // completes regardless of the gate verdict.
    const gateResult = runPhaseGates(fromPhase, {
      cwd: process.cwd(),
      workflowType: state.workflow_type,
      workflowId,
      state,
      events,
      log,
    });
    if (!gateResult.passed) {
      process.stderr.write(`[codi gate-advisory]\n${formatGateAdvisory(gateResult)}\n`);
    }

    // Atomic: wrap the 3 (or 5, in terminal done branch) approval writes in
    // a single SQLite transaction so a crash mid-flow cannot leave the
    // workflow_runs.status / current_phase columns half-advanced. Each
    // inner log.append already wraps its own raw.transaction; under an
    // outer txn better-sqlite3 demotes those to SAVEPOINTs and only
    // commits the whole tree at the outer scope. The gate run (lines
    // above) deliberately stays OUTSIDE — gate events are advisory and
    // best-effort by design (see runPhaseGates docstring).
    log.privateRaw.transaction(() => {
      log.append(
        workflowId,
        createEvent({
          eventType: "phase_completed",
          payload: {
            phase: fromPhase,
            duration_ms: computePhaseDuration(state, fromPhase),
            gate_passed: gateResult.passed,
          },
          author: SYSTEM_AUTHOR,
          parentEventId: lastProposed.event_id,
        }),
      );

      log.append(
        workflowId,
        createEvent({
          eventType: "phase_transition_approved",
          payload: proposalPayload,
          author: opts.author,
          parentEventId: lastProposed.event_id,
        }),
      );

      log.append(
        workflowId,
        createEvent({
          eventType: "phase_started",
          payload: { phase: proposalPayload.to_phase },
          author: SYSTEM_AUTHOR,
          parentEventId: lastProposed.event_id,
        }),
      );

      // Reaching phase `done` marks the workflow as complete. Emit the
      // workflow_completed event automatically and a phase_completed for the
      // terminal phase so reduce() reports status: "completed".
      if (proposalPayload.to_phase === "done") {
        const stateNow = log.getReducedState(workflowId);
        const doneRecord = stateNow.phase_history.at(-1);
        const doneStartedAtMs = doneRecord ? new Date(doneRecord.started_at).getTime() : Date.now();
        const doneDurationMs = Math.max(0, Date.now() - doneStartedAtMs);

        log.append(
          workflowId,
          createEvent({
            eventType: "phase_completed",
            payload: {
              phase: "done",
              duration_ms: doneDurationMs,
              gate_passed: true,
            },
            author: SYSTEM_AUTHOR,
            parentEventId: lastProposed.event_id,
          }),
        );

        const totalDurationMs = Math.max(0, Date.now() - new Date(stateNow.started_at).getTime());
        log.append(
          workflowId,
          createEvent({
            eventType: "workflow_completed",
            payload: {
              duration_ms: totalDurationMs,
              summary: `Reached phase done after ${stateNow.phase_history.length} phases.`,
            },
            author: SYSTEM_AUTHOR,
            parentEventId: lastProposed.event_id,
          }),
        );
        // Note: do NOT clear the active ID here. The workflow is `completed` but
        // remains queryable via `codi workflow status` and `codi pr generate-summary`.
        // When the user starts a new workflow via `codi workflow run`,
        // runWorkflow auto-migrates the stale terminal pointer before
        // initializing the new run.
      }
    })();

    return ok({
      workflowId,
      fromPhase: proposalPayload.from_phase,
      toPhase: proposalPayload.to_phase,
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

export interface RejectTransitionOptions {
  reason: string;
  author: Author;
  cwd?: string;
}

export interface RejectTransitionResult {
  workflowId: string;
  fromPhase: Phase;
  rejectedToPhase: Phase;
}

export function rejectTransition(
  opts: RejectTransitionOptions,
): Result<RejectTransitionResult, ProjectError[]> {
  if (!opts.reason || opts.reason.trim().length === 0) {
    return err([createError("E_REASON_REQUIRED", { command: "Reject" })]);
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = resolveActiveWorkflowId(log, opts);
    if (!workflowId) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    const events = log.loadEvents(workflowId);
    const lastProposed = events
      .slice()
      .reverse()
      .find((e) => e.event_type === "phase_transition_proposed");
    if (!lastProposed) {
      return err([createError("E_PROPOSAL_NOT_PENDING", { kind: "transition" })]);
    }
    const lastTransitionEvent = events
      .slice()
      .reverse()
      .find(
        (e) =>
          e.event_type === "phase_transition_proposed" ||
          e.event_type === "phase_transition_approved" ||
          e.event_type === "phase_transition_rejected",
      );
    if (!lastTransitionEvent || lastTransitionEvent.event_id !== lastProposed.event_id) {
      return err([createError("E_PROPOSAL_NOT_PENDING", { kind: "transition" })]);
    }
    const proposalPayload = lastProposed.payload as { from_phase: Phase; to_phase: Phase };

    log.append(
      workflowId,
      createEvent({
        eventType: "phase_transition_rejected",
        payload: { ...proposalPayload, reason: opts.reason },
        author: opts.author,
        parentEventId: lastProposed.event_id,
      }),
    );

    return ok({
      workflowId,
      fromPhase: proposalPayload.from_phase,
      rejectedToPhase: proposalPayload.to_phase,
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

function computePhaseDuration(state: ReducedState, phase: Phase): number {
  const record = [...state.phase_history].reverse().find((p) => p.phase === phase);
  if (!record) return 0;
  if (record.duration_ms !== undefined) return record.duration_ms;
  const startedAt = new Date(record.started_at).getTime();
  const now = Date.now();
  return Math.max(0, now - startedAt);
}

// ─── O1 — codi workflow advance (single-command transition) ──────────────────

import { getAdapter } from "../workflows/registry.js";
import { snakeAdapterToCamel } from "../workflows/adapter-keys.js";
import { computeNextPhase } from "../workflows/phase-walker.js";
import type { WorkflowAdapter } from "../workflows/types.js";

export interface AdvanceOptions {
  /** Override target phase. Default: derived from adapter + adaptation. */
  toPhase?: Phase;
  /**
   * Skip the human approval step and auto-approve. Safe when the caller is
   * the agent (Iron Law 4 still records the proposal + approval as separate
   * events).
   */
  autoApprove?: boolean;
  author: Author;
  cwd?: string;
}

export interface AdvanceResult {
  workflowId: string;
  fromPhase: Phase;
  toPhase: Phase;
  proposedEventId: string;
  approvedEventId: string | null;
  derivedFromAdaptation: boolean;
  skippedPhases: readonly string[];
}

/**
 * Single-command transition. Reads the active workflow's adaptation from
 * the init payload, computes the next non-skipped phase via the adapter,
 * proposes the transition, and (when `autoApprove` is true) immediately
 * approves it.
 */
export function advanceWorkflow(opts: AdvanceOptions): Result<AdvanceResult, ProjectError[]> {
  const log = BrainEventLog.open();
  let derivedFromAdaptation = false;
  let skippedPhases: readonly string[] = [];
  let target: Phase | undefined = opts.toPhase;
  let fromPhase: Phase;

  try {
    const resolved = resolveActiveWorkflowId(log, opts);
    if (!resolved) return err([createError("E_NO_ACTIVE_WORKFLOW")]);

    const events = log.loadEvents(resolved);
    const state = reduce(events);
    fromPhase = state.current_phase;

    if (target === undefined) {
      const adapter = getAdapter(state.workflow_type);
      const initEvent = events.find((e) => e.event_type === "init");
      const adaptationFromInit = readAdaptationFromInit(initEvent, state.workflow_type);
      if (adapter !== undefined && adaptationFromInit !== null) {
        skippedPhases = adapter.computeSkipPhases(adaptationFromInit);
        const next = computeNextPhase(adapter.phaseOrder, skippedPhases, fromPhase);
        if (next !== null) {
          target = next as Phase;
          derivedFromAdaptation = true;
        }
      }
      // Fall back to the next entry in the adapter's phase order even when
      // no adaptation was supplied, so `advance` works for plain runs.
      if (target === undefined && adapter !== undefined) {
        const next = computeNextPhase(adapter.phaseOrder, [], fromPhase);
        if (next !== null) target = next as Phase;
      }
    }

    if (target === undefined) {
      return err([createError("E_PHASE_ADVANCE_DERIVATION_FAILED", { fromPhase })]);
    }
  } catch (e) {
    if (e instanceof BrainNoActiveWorkflowError) {
      return err([createError("E_NO_ACTIVE_WORKFLOW")]);
    }
    return err([fromCaughtError(e)]);
  } finally {
    log.dispose();
  }

  const proposed = proposeTransition({
    toPhase: target,
    author: opts.author,
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
  });
  if (!proposed.ok) return proposed;

  let approvedEventId: string | null = null;
  if (opts.autoApprove === true) {
    const approved = approveTransition({
      author: opts.author,
      ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    });
    if (!approved.ok) return approved;
    // approveTransition does not return the event id directly; surface the
    // proposal id paired with a synthetic marker so callers can detect that
    // approval ran. The brain log carries the real approved event regardless.
    approvedEventId = `${approved.data.workflowId}:${approved.data.toPhase}`;
  }

  return ok({
    workflowId: proposed.data.workflowId,
    fromPhase: proposed.data.fromPhase,
    toPhase: proposed.data.toPhase,
    proposedEventId: proposed.data.proposedEventId,
    approvedEventId,
    derivedFromAdaptation,
    skippedPhases,
  });
}

const ADAPTATION_KEY: Partial<Record<string, string>> = {
  "bug-fix": "bug_fix_adaptation",
  feature: "feature_adaptation",
  refactor: "refactor_adaptation",
  migration: "migration_adaptation",
  project: "project_adaptation",
};

function readAdaptationFromInit(
  initEvent: ReturnType<typeof reduce> extends infer _ ? unknown : never,
  workflowType: string,
): unknown {
  if (initEvent === undefined || initEvent === null) return null;
  const payload = (initEvent as { payload?: Record<string, unknown> }).payload;
  if (!payload) return null;
  const key = ADAPTATION_KEY[workflowType];
  if (!key) return null;
  const raw = payload[key];
  if (raw === undefined) return null;
  return adapterCanonical(workflowType, raw);
}

/**
 * Convert the snake_case JSON payload back to the camelCase shape the
 * adapter resolves operate on. The transformation is the inverse of each
 * adapter's `serialize`. Unknown workflow types return the raw payload.
 */
function adapterCanonical(workflowType: string, raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  // The adapter resolver type-checks via casting; `workflowType` is a
  // runtime-only hint that lets a future debugger see which workflow this
  // came from. The actual mapping lives in `adapter-keys.ts` so both this
  // handler and `workflow.ts` share one source of truth.
  void workflowType;
  return snakeAdapterToCamel(raw as Record<string, unknown>);
}

// Re-affirm WorkflowAdapter import as referenced (silences unused-import
// when bundler tree-shakes via barrel).
type _WorkflowAdapterRef = WorkflowAdapter<unknown>;
void (null as unknown as _WorkflowAdapterRef);
