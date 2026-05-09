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
 */

import { NoActiveWorkflowError } from "../event-log.js";
import { selectEventLog } from "../event-log-factory.js";
import { createEvent } from "../event-factory.js";
import { reduce } from "../reducer.js";
import type { Author, Phase, ReducedState } from "../types.js";
import { openBrain } from "../brain/index.js";
import { assertLegalTransition, UnknownWorkflowTypeError } from "../workflow-graph.js";

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
  const log = selectEventLog(opts.cwd ?? process.cwd());
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
  const brain = openBrain();
  try {
    assertLegalTransition(brain.raw, state.workflow_type, fromPhase, opts.toPhase);
  } catch (e) {
    if (e instanceof UnknownWorkflowTypeError) {
      // Definition not seeded — skip enforcement.
    } else if (e instanceof Error && /no such table: workflow_definitions/.test(e.message)) {
      // Brain DB present but pre-v2 (table missing) — skip enforcement.
    } else {
      throw e;
    }
  } finally {
    brain.close();
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
  const log = selectEventLog(opts.cwd ?? process.cwd());
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
  log.append(
    workflowId,
    createEvent({
      eventType: "phase_completed",
      payload: {
        phase: proposalPayload.from_phase,
        duration_ms: computePhaseDuration(state, proposalPayload.from_phase),
        gate_passed: true,
      },
      author: { type: "system", id: "devloop" },
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
      author: { type: "system", id: "devloop" },
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
        author: { type: "system", id: "devloop" },
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
        author: { type: "system", id: "devloop" },
        parentEventId: lastProposed.event_id,
      }),
    );
    // Note: do NOT clear the active ID here. The workflow is `completed` but
    // remains queryable via `devloop status` and `devloop pr generate-summary`
    // (both rely on getActiveWorkflowId). When the user starts a new workflow
    // via `devloop run`, runWorkflow auto-migrates the stale terminal pointer
    // (clears active/workflow-id.txt + staging) before initializing the new
    // archive — so no manual `rm -rf` is needed.
  }

  return {
    workflowId,
    fromPhase: proposalPayload.from_phase,
    toPhase: proposalPayload.to_phase,
  };
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
  const log = selectEventLog(opts.cwd ?? process.cwd());
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
}

function computePhaseDuration(state: ReducedState, phase: Phase): number {
  const record = [...state.phase_history].reverse().find((p) => p.phase === phase);
  if (!record) return 0;
  if (record.duration_ms !== undefined) return record.duration_ms;
  const startedAt = new Date(record.started_at).getTime();
  const now = Date.now();
  return Math.max(0, now - startedAt);
}
