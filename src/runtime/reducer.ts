/**
 * Pure reducer: takes an ordered list of manifest events and returns the
 * current ReducedState. Determinism is the contract — same events in, same
 * state out.
 *
 * The reducer is intentionally tolerant: unknown event types or malformed
 * payloads cause an explicit error, not silent skip. Validation of inputs
 * happens at append time; the reducer assumes events are well-formed.
 */

import type {
  ChildWorkflowRef,
  ManifestEvent,
  Phase,
  PhaseRecord,
  ReducedState,
  WorkflowType,
} from "./types.js";

export class ReducerError extends Error {
  constructor(
    message: string,
    public readonly eventId?: string,
  ) {
    super(eventId ? `${message} (event ${eventId})` : message);
    this.name = "ReducerError";
  }
}

export function reduce(events: ManifestEvent[]): ReducedState {
  if (events.length === 0) {
    throw new ReducerError("Cannot reduce empty event list.");
  }
  const init = events[0];
  if (!init || init.event_type !== "init") {
    throw new ReducerError("First event must be of type 'init'.");
  }
  const initPayload = init.payload as {
    workflow_id: string;
    workflow_type: WorkflowType;
    task: string;
  };

  const state: ReducedState = {
    workflow_id: initPayload.workflow_id,
    workflow_type: initPayload.workflow_type,
    task: initPayload.task,
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
      const phase = (event.payload as { phase: Phase }).phase;
      const last = state.phase_history.at(-1);
      if (last && !last.completed_at) {
        last.completed_at = event.timestamp;
      }
      state.phase_history.push({ phase, started_at: event.timestamp });
      state.current_phase = phase;
      break;
    }

    case "phase_completed": {
      const payload = event.payload as {
        phase: Phase;
        duration_ms: number;
        gate_passed: boolean;
      };
      const last = state.phase_history.at(-1);
      if (last && last.phase === payload.phase) {
        last.completed_at = event.timestamp;
        last.duration_ms = payload.duration_ms;
        last.gate_passed = payload.gate_passed;
      } else {
        const record: PhaseRecord = {
          phase: payload.phase,
          started_at: event.timestamp,
          completed_at: event.timestamp,
          duration_ms: payload.duration_ms,
          gate_passed: payload.gate_passed,
        };
        state.phase_history.push(record);
      }
      break;
    }

    case "phase_transition_approved": {
      const payload = event.payload as { from_phase: Phase; to_phase: Phase };
      state.current_phase = payload.to_phase;
      break;
    }

    case "scope_expansion_approved": {
      const payload = event.payload as { added_to_scope: string[] };
      for (const file of payload.added_to_scope) {
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
      const payload = event.payload as { tokens_consumed: number };
      state.subagent_stats.total_completed += 1;
      state.subagent_stats.total_tokens_consumed += payload.tokens_consumed;
      break;
    }

    case "subagent_failed":
      state.subagent_stats.total_failed += 1;
      break;

    case "child_workflow_initiated": {
      const payload = event.payload as {
        child_workflow_id: string;
        child_workflow_type: WorkflowType;
        child_branch: string;
      };
      state.child_workflows.push({
        id: payload.child_workflow_id,
        type: payload.child_workflow_type,
        branch: payload.child_branch,
        status: "active",
        initiated_at: event.timestamp,
      });
      break;
    }

    case "child_workflow_resolved": {
      const payload = event.payload as {
        child_workflow_id: string;
        status: "completed" | "abandoned";
      };
      const child = state.child_workflows.find(
        (c: ChildWorkflowRef) => c.id === payload.child_workflow_id,
      );
      if (child) child.status = payload.status;
      break;
    }

    case "workflow_paused_for_child": {
      const payload = event.payload as { child_workflow_id: string };
      state.status = "paused";
      state.paused_for_child_id = payload.child_workflow_id;
      break;
    }

    case "workflow_resumed_after_child": {
      const payload = event.payload as { resumed_in_phase: Phase };
      state.status = "active";
      state.paused_for_child_id = null;
      state.current_phase = payload.resumed_in_phase;
      break;
    }

    case "context_term_added": {
      const payload = event.payload as { term: string };
      if (!state.knowledge.context_terms_added.includes(payload.term)) {
        state.knowledge.context_terms_added.push(payload.term);
      }
      break;
    }

    case "adr_approved": {
      const payload = event.payload as { adr_number: number };
      if (!state.knowledge.adrs_approved.includes(payload.adr_number)) {
        state.knowledge.adrs_approved.push(payload.adr_number);
      }
      break;
    }

    case "workflow_handover":
    case "workflow_force_handover": {
      const payload = event.payload as { to_dev_id: string };
      state.current_owner = payload.to_dev_id;
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
      break;

    default: {
      const exhaustive: never = event.event_type;
      throw new ReducerError(`Unknown event type: ${String(exhaustive)}`, event.event_id);
    }
  }
}
