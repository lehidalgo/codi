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
 */

import {
  BrainEventLog,
  BrainNoActiveWorkflowError as NoActiveWorkflowError,
} from "../brain-event-log.js";
import { createEvent } from "../event-factory.js";
import { reduce } from "../reducer.js";
import type { Author, Phase, ReducedState } from "../types.js";
import { assertLegalTransition, UnknownWorkflowTypeError } from "../workflow-graph.js";
import { runPhaseGates, formatGateAdvisory } from "../gate-runner-bridge.js";

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

export function proposeTransition(opts: ProposeTransitionOptions): ProposeTransitionResult {
  const log = BrainEventLog.open();
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) throw new NoActiveWorkflowError();

    const events = log.loadEvents(workflowId);
    const state = reduce(events);
    const fromPhase = state.current_phase;

    if (fromPhase === opts.toPhase) {
      throw new Error(`Already in phase ${opts.toPhase}.`);
    }
    if (state.status !== "active") {
      throw new Error(`Workflow is not active (status: ${state.status}).`);
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
        throw e;
      }
    }

    const proposed = createEvent({
      eventType: "phase_transition_proposed",
      payload: { from_phase: fromPhase, to_phase: opts.toPhase },
      author: opts.author,
      parentEventId: state.last_event_id,
    });
    log.append(workflowId, proposed);

    return {
      workflowId,
      fromPhase,
      toPhase: opts.toPhase,
      proposedEventId: proposed.event_id,
    };
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

export function approveTransition(opts: ApproveTransitionOptions): ApproveTransitionResult {
  const log = BrainEventLog.open();
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) throw new NoActiveWorkflowError();

    const events = log.loadEvents(workflowId);
    const lastProposed = events
      .slice()
      .reverse()
      .find((e) => e.event_type === "phase_transition_proposed");
    if (!lastProposed) {
      throw new Error("No pending transition proposal.");
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
      throw new Error("No pending transition proposal.");
    }

    const state = reduce(events);
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
        const stateNow = reduce(log.loadEvents(workflowId));
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

    return {
      workflowId,
      fromPhase: proposalPayload.from_phase,
      toPhase: proposalPayload.to_phase,
    };
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

export function rejectTransition(opts: RejectTransitionOptions): RejectTransitionResult {
  if (!opts.reason || opts.reason.trim().length === 0) {
    throw new Error("Reject requires --reason '<text>'.");
  }
  const log = BrainEventLog.open();
  try {
    const workflowId = log.getActiveWorkflowId();
    if (!workflowId) throw new NoActiveWorkflowError();

    const events = log.loadEvents(workflowId);
    const lastProposed = events
      .slice()
      .reverse()
      .find((e) => e.event_type === "phase_transition_proposed");
    if (!lastProposed) {
      throw new Error("No pending transition proposal.");
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
      throw new Error("No pending transition proposal.");
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

    return {
      workflowId,
      fromPhase: proposalPayload.from_phase,
      rejectedToPhase: proposalPayload.to_phase,
    };
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
 *
 * Errors:
 *  - no active workflow → NoActiveWorkflowError (re-thrown)
 *  - terminal phase     → Error("workflow already at terminal phase")
 *  - explicit toPhase ∧ adaptation skip says otherwise → still honoured
 *    (the dev's override wins; the adapter is advisory only here)
 */
export function advanceWorkflow(opts: AdvanceOptions): AdvanceResult {
  const log = BrainEventLog.open();
  let derivedFromAdaptation = false;
  let skippedPhases: readonly string[] = [];
  let target: Phase | undefined = opts.toPhase;
  let workflowId: string;
  let fromPhase: Phase;

  try {
    workflowId = log.getActiveWorkflowId() ?? "";
    if (!workflowId) throw new NoActiveWorkflowError();

    const events = log.loadEvents(workflowId);
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
      throw new Error(
        `Cannot derive next phase from '${fromPhase}'. Pass --to <phase> explicitly or use 'workflow transition'.`,
      );
    }
  } finally {
    log.dispose();
  }

  const proposed = proposeTransition({
    toPhase: target,
    author: opts.author,
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
  });

  let approvedEventId: string | null = null;
  if (opts.autoApprove === true) {
    const approved = approveTransition({
      author: opts.author,
      ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    });
    // approveTransition does not return the event id directly; surface the
    // proposal id paired with a synthetic marker so callers can detect that
    // approval ran. The brain log carries the real approved event regardless.
    approvedEventId = `${approved.workflowId}:${approved.toPhase}`;
  }

  return {
    workflowId: proposed.workflowId,
    fromPhase: proposed.fromPhase,
    toPhase: proposed.toPhase,
    proposedEventId: proposed.proposedEventId,
    approvedEventId,
    derivedFromAdaptation,
    skippedPhases,
  };
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
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  // Map snake → camel for every known field; pass through everything else.
  const mapping: Record<string, string> = {
    profile: "profile",
    severity: "severity",
    reproducer_exists: "reproducerExists",
    root_cause_known: "rootCauseKnown",
    scope: "scope",
    execute_mode: "executeMode",
    grill: "grill",
    interactive: "interactive",
    complexity: "complexity",
    design_exists: "designExists",
    tdd_strict: "tddStrict",
    kind: "kind",
    risk_level: "riskLevel",
    rollback_tested: "rollbackTested",
    mode: "mode",
    no_sheet: "noSheet",
  };
  for (const [snake, value] of Object.entries(r)) {
    const camel = mapping[snake] ?? snake;
    out[camel] = value;
  }
  // The adapter resolver type-checks via casting; `_w` is a runtime-only
  // hint that lets a future debugger see which workflow this came from.
  void workflowType;
  return out;
}

// Re-affirm WorkflowAdapter import as referenced (silences unused-import
// when bundler tree-shakes via barrel).
type _WorkflowAdapterRef = WorkflowAdapter<unknown>;
void (null as unknown as _WorkflowAdapterRef);
