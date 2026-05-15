/**
 * Pure reducer: takes an ordered list of manifest events and returns the
 * current ReducedState. Determinism is the contract — same events in, same
 * state out.
 *
 * Per CORE-001, payload guards validate every field the reducer reads. A
 * malformed payload (wrong shape, missing required field, invalid enum
 * value) throws `ReducerError` with `eventId` + `field` so the caller can
 * diagnose. Replay halts at the first bad event — never continue with
 * degraded state, because subsequent events can causally depend on the
 * corrupt one.
 *
 * The `loadEvents` source upstream (brain-event-log.ts) also tolerates
 * rows whose `payload` column is not valid JSON; those rows are silently
 * filtered. Storage-layer corruption (disk rot, partial writes) vs
 * shape-level corruption (typed bugs in a writer) thus surface at two
 * different layers.
 */

import type {
  ChildWorkflowRef,
  ManifestEvent,
  Phase,
  PhaseRecord,
  ReducedState,
  WorkflowType,
} from "./types.js";
import { PHASES, WORKFLOW_TYPES } from "./types.js";

export class ReducerError extends Error {
  constructor(
    message: string,
    public readonly eventId?: string,
    public readonly field?: string,
  ) {
    const detail = [eventId ? `event ${eventId}` : null, field ? `field ${field}` : null]
      .filter(Boolean)
      .join(", ");
    super(detail ? `${message} (${detail})` : message);
    this.name = "ReducerError";
  }
}

// ─── Payload guard helpers ───────────────────────────────────────────────────
// CORE-001: composable validators that replace the previous `event.payload as
// {…}` casts. Each helper throws `ReducerError` with `eventId` + `field` so
// callers get actionable diagnostics. Plain TS (not Zod) keeps this change
// scoped — CORE-004 will lift the contract into Zod schemas later.

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getStr(p: Record<string, unknown>, k: string, eventId: string): string {
  const v = p[k];
  if (typeof v !== "string" || v.length === 0) {
    throw new ReducerError(`payload.${k} must be a non-empty string`, eventId, k);
  }
  return v;
}

function getNum(p: Record<string, unknown>, k: string, eventId: string): number {
  const v = p[k];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ReducerError(`payload.${k} must be a finite number`, eventId, k);
  }
  return v;
}

function getBool(p: Record<string, unknown>, k: string, eventId: string): boolean {
  const v = p[k];
  if (typeof v !== "boolean") {
    throw new ReducerError(`payload.${k} must be a boolean`, eventId, k);
  }
  return v;
}

function getStrArr(p: Record<string, unknown>, k: string, eventId: string): string[] {
  const v = p[k];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    throw new ReducerError(`payload.${k} must be an array of strings`, eventId, k);
  }
  return v;
}

function getPhase(p: Record<string, unknown>, k: string, eventId: string): Phase {
  const v = p[k];
  if (typeof v !== "string" || !(PHASES as readonly string[]).includes(v)) {
    throw new ReducerError(
      `payload.${k} must be one of: ${PHASES.join(", ")}`,
      eventId,
      k,
    );
  }
  return v as Phase;
}

function getWorkflowType(p: Record<string, unknown>, k: string, eventId: string): WorkflowType {
  const v = p[k];
  if (typeof v !== "string" || !(WORKFLOW_TYPES as readonly string[]).includes(v)) {
    throw new ReducerError(
      `payload.${k} must be one of: ${WORKFLOW_TYPES.join(", ")}`,
      eventId,
      k,
    );
  }
  return v as WorkflowType;
}

function getChildStatus(
  p: Record<string, unknown>,
  k: string,
  eventId: string,
): "completed" | "abandoned" {
  const v = p[k];
  if (v !== "completed" && v !== "abandoned") {
    throw new ReducerError(
      `payload.${k} must be 'completed' or 'abandoned'`,
      eventId,
      k,
    );
  }
  return v;
}

function requireObj(payload: unknown, eventId: string): Record<string, unknown> {
  if (!isObj(payload)) {
    throw new ReducerError("payload must be an object", eventId);
  }
  return payload;
}

export function reduce(events: ManifestEvent[]): ReducedState {
  if (events.length === 0) {
    throw new ReducerError("Cannot reduce empty event list.");
  }
  const init = events[0];
  if (!init || init.event_type !== "init") {
    throw new ReducerError("First event must be of type 'init'.");
  }
  const initPayload = requireObj(init.payload, init.event_id);
  const workflow_id = getStr(initPayload, "workflow_id", init.event_id);
  const workflow_type = getWorkflowType(initPayload, "workflow_type", init.event_id);
  const task = getStr(initPayload, "task", init.event_id);

  const state: ReducedState = {
    workflow_id,
    workflow_type,
    task,
    status: "active",
    current_phase: "intent",
    // phase_history is populated by phase_started events, not by init.
    // The first phase_started: intent event will record the entry timestamp.
    phase_history: [],
    scope: {
      files_in_plan: [],
      incidental_changes: 0,
      scope_expansions_approved: 0,
      scope_expansions_rejected: 0,
    },
    child_workflows: [],
    paused_for_child_id: null,
    knowledge: {
      context_terms_added: [],
      adrs_approved: [],
    },
    subagent_stats: {
      total_dispatched: 0,
      total_completed: 0,
      total_failed: 0,
      total_tokens_consumed: 0,
    },
    current_owner: init.author.id,
    started_at: init.timestamp,
    last_event_id: init.event_id,
    last_event_timestamp: init.timestamp,
    events_count: 1,
  };

  for (let i = 1; i < events.length; i += 1) {
    const event = events[i];
    if (!event) continue;
    applyEvent(state, event);
    state.last_event_id = event.event_id;
    state.last_event_timestamp = event.timestamp;
    state.events_count = i + 1;
  }

  return state;
}

/**
 * CORE-009 — version stamp written into every persisted snapshot. Bump
 * this constant whenever `applyEvent` (below) changes semantics so that
 * stored snapshots written under the old logic are auto-invalidated on
 * the next read. `BrainEventLog.readSnapshot` compares the stored value
 * to this constant and discards mismatched rows.
 *
 * Cross-version invalidation is the only mechanism — there is no SQL
 * migration for reducer logic changes. A reviewer encountering an edit
 * to any `case` below should bump this number in the same commit.
 */
export const REDUCER_VERSION = 1;

/**
 * CORE-009 — incremental replay on top of a previously-reduced snapshot.
 *
 * `reduce(events)` is O(N) in events; `reduceIncremental(prior, delta)`
 * is O(|delta|) when `prior` is non-null, which keeps reducer cost flat
 * as the event count of long-running workflows grows.
 *
 * Pure function — no I/O. Deep-clones `prior` before mutating so a
 * cached snapshot held by another reader is not corrupted: the inner
 * `applyEvent` mutates the state object in place, and arrays like
 * `phase_history`, `child_workflows`, `files_in_plan` are pushed onto.
 *
 * `prior == null`: behaves identically to `reduce(newEvents)` — used
 * by the cold-start path the first time a workflow is read after the
 * v16 migration (no snapshot row yet).
 *
 * The integer rowid tracking is the caller's responsibility — the
 * snapshot writer reads it from the `workflow_events.event_id` column
 * alongside the JSON payload. This function only knows the UUID
 * `ManifestEvent.event_id` field carried inside the payload, which is
 * unsuitable for SQL-driven `WHERE event_id > ?` seeks.
 */
export function reduceIncremental(
  prior: ReducedState | null,
  newEvents: ManifestEvent[],
): ReducedState {
  if (prior === null) {
    if (newEvents.length === 0) {
      throw new ReducerError("Cannot reduce empty event list.");
    }
    return reduce(newEvents);
  }

  // Deep clone via JSON round-trip — ReducedState is JSON-serialisable
  // by construction (it's persisted as TEXT in workflow_snapshots) so
  // this preserves every field including ordered arrays. Structured
  // clone would be cheaper but is not in the LTS Node target.
  const state = JSON.parse(JSON.stringify(prior)) as ReducedState;

  for (const event of newEvents) {
    applyEvent(state, event);
    state.last_event_id = event.event_id;
    state.last_event_timestamp = event.timestamp;
    state.events_count += 1;
  }

  return state;
}

function applyEvent(state: ReducedState, event: ManifestEvent): void {
  switch (event.event_type) {
    case "init":
      throw new ReducerError("Multiple init events in log.", event.event_id);

    case "workflow_completed":
      state.status = "completed";
      state.current_phase = "done";
      break;

    case "workflow_abandoned":
      state.status = "abandoned";
      break;

    case "phase_started": {
      const payload = requireObj(event.payload, event.event_id);
      const phase = getPhase(payload, "phase", event.event_id);
      const last = state.phase_history.at(-1);
      if (last && !last.completed_at) {
        last.completed_at = event.timestamp;
      }
      state.phase_history.push({ phase, started_at: event.timestamp });
      state.current_phase = phase;
      break;
    }

    case "phase_completed": {
      const payload = requireObj(event.payload, event.event_id);
      const phase = getPhase(payload, "phase", event.event_id);
      const duration_ms = getNum(payload, "duration_ms", event.event_id);
      const gate_passed = getBool(payload, "gate_passed", event.event_id);
      const last = state.phase_history.at(-1);
      if (last && last.phase === phase) {
        last.completed_at = event.timestamp;
        last.duration_ms = duration_ms;
        last.gate_passed = gate_passed;
      } else {
        const record: PhaseRecord = {
          phase,
          started_at: event.timestamp,
          completed_at: event.timestamp,
          duration_ms,
          gate_passed,
        };
        state.phase_history.push(record);
      }
      break;
    }

    case "phase_transition_approved": {
      const payload = requireObj(event.payload, event.event_id);
      const to_phase = getPhase(payload, "to_phase", event.event_id);
      state.current_phase = to_phase;
      break;
    }

    case "scope_expansion_approved": {
      const payload = requireObj(event.payload, event.event_id);
      const added_to_scope = getStrArr(payload, "added_to_scope", event.event_id);
      for (const file of added_to_scope) {
        if (!state.scope.files_in_plan.includes(file)) {
          state.scope.files_in_plan.push(file);
        }
      }
      state.scope.scope_expansions_approved += 1;
      break;
    }

    case "scope_expansion_rejected":
      state.scope.scope_expansions_rejected += 1;
      break;

    case "incidental_change_recorded":
      state.scope.incidental_changes += 1;
      break;

    case "subagent_dispatched":
      state.subagent_stats.total_dispatched += 1;
      break;

    case "subagent_completed": {
      const payload = requireObj(event.payload, event.event_id);
      const tokens_consumed = getNum(payload, "tokens_consumed", event.event_id);
      state.subagent_stats.total_completed += 1;
      state.subagent_stats.total_tokens_consumed += tokens_consumed;
      break;
    }

    case "subagent_failed":
      state.subagent_stats.total_failed += 1;
      break;

    case "child_workflow_initiated": {
      const payload = requireObj(event.payload, event.event_id);
      const child_workflow_id = getStr(payload, "child_workflow_id", event.event_id);
      const child_workflow_type = getWorkflowType(payload, "child_workflow_type", event.event_id);
      const child_branch = getStr(payload, "child_branch", event.event_id);
      state.child_workflows.push({
        id: child_workflow_id,
        type: child_workflow_type,
        branch: child_branch,
        status: "active",
        initiated_at: event.timestamp,
      });
      break;
    }

    case "child_workflow_resolved": {
      const payload = requireObj(event.payload, event.event_id);
      const child_workflow_id = getStr(payload, "child_workflow_id", event.event_id);
      const childStatus = getChildStatus(payload, "status", event.event_id);
      const child = state.child_workflows.find(
        (c: ChildWorkflowRef) => c.id === child_workflow_id,
      );
      if (child) child.status = childStatus;
      break;
    }

    case "workflow_paused_for_child": {
      const payload = requireObj(event.payload, event.event_id);
      const child_workflow_id = getStr(payload, "child_workflow_id", event.event_id);
      state.status = "paused";
      state.paused_for_child_id = child_workflow_id;
      break;
    }

    case "workflow_resumed_after_child": {
      const payload = requireObj(event.payload, event.event_id);
      const resumed_in_phase = getPhase(payload, "resumed_in_phase", event.event_id);
      state.status = "active";
      state.paused_for_child_id = null;
      state.current_phase = resumed_in_phase;
      break;
    }

    case "context_term_added": {
      const payload = requireObj(event.payload, event.event_id);
      const term = getStr(payload, "term", event.event_id);
      if (!state.knowledge.context_terms_added.includes(term)) {
        state.knowledge.context_terms_added.push(term);
      }
      break;
    }

    case "adr_approved": {
      const payload = requireObj(event.payload, event.event_id);
      const adr_number = getNum(payload, "adr_number", event.event_id);
      if (!state.knowledge.adrs_approved.includes(adr_number)) {
        state.knowledge.adrs_approved.push(adr_number);
      }
      break;
    }

    case "workflow_handover":
    case "workflow_force_handover": {
      const payload = requireObj(event.payload, event.event_id);
      const to_dev_id = getStr(payload, "to_dev_id", event.event_id);
      state.current_owner = to_dev_id;
      break;
    }

    // Pass-through events: recorded but no state change derived
    case "phase_transition_proposed":
    case "phase_transition_rejected":
    case "scope_change_classified":
    case "scope_expansion_proposed":
    case "gate_check_started":
    case "gate_check_passed":
    case "gate_check_failed":
    case "validation_run":
    case "parallel_fork_dispatched":
    case "elevation_proposed":
    case "elevation_approved":
    case "elevation_rejected":
    case "context_term_updated":
    case "adr_proposed":
    case "adr_superseded":
    case "artifact_linked":
    case "design_doc_authored":
    case "decision_recorded":
    // CORE-004: sheet sync events flow through the event log but the
    // reducer derives no state from them — they're consumed by the
    // dev-sheets-sync skill, not by the workflow state machine.
    case "sheet_row_upserted":
    case "sheet_row_appended":
    case "sheet_sync_queued":
    case "sheet_sync_failed":
    case "sheet_reconciled":
      break;

    default: {
      const exhaustive: never = event.event_type;
      throw new ReducerError(`Unknown event type: ${String(exhaustive)}`, event.event_id);
    }
  }
}
