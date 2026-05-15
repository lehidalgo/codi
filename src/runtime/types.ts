/**
 * Core type definitions for the manifest event log.
 *
 * Types here mirror the JSON Schema in schemas/manifest-event.schema.json.
 * Runtime validation against the schema is the source of truth — these types
 * give compile-time hints. When adding a new event type, update both this
 * file and the schema, with an ADR per the migration policy.
 */

export const EVENT_TYPES = [
  // Lifecycle
  "init",
  "workflow_completed",
  "workflow_abandoned",
  // Phase
  "phase_started",
  "phase_completed",
  "phase_transition_proposed",
  "phase_transition_approved",
  "phase_transition_rejected",
  // Scope
  "scope_change_classified",
  "scope_expansion_proposed",
  "scope_expansion_approved",
  "scope_expansion_rejected",
  "incidental_change_recorded",
  // Gate
  "gate_check_started",
  "gate_check_passed",
  "gate_check_failed",
  "validation_run",
  // Subagent
  "subagent_dispatched",
  "subagent_completed",
  "subagent_failed",
  "parallel_fork_dispatched",
  // Composition
  "child_workflow_initiated",
  "child_workflow_resolved",
  "workflow_paused_for_child",
  "workflow_resumed_after_child",
  "elevation_proposed",
  "elevation_approved",
  "elevation_rejected",
  // Knowledge
  "context_term_added",
  "context_term_updated",
  "adr_proposed",
  "adr_approved",
  "adr_superseded",
  "artifact_linked",
  "design_doc_authored",
  // Decision
  "decision_recorded",
  // Multi-dev
  "workflow_handover",
  "workflow_force_handover",
  // Sheet sync (cross-tool integration events). Already present in
  // manifest-event.schema.json + sample-events.json — CORE-004 closed
  // the drift by adding the matching TS entries.
  "sheet_row_upserted",
  "sheet_row_appended",
  "sheet_sync_queued",
  "sheet_sync_failed",
  "sheet_reconciled",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const COMMITABLE_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  "init",
  "workflow_completed",
  "workflow_abandoned",
  "phase_completed",
  "phase_transition_approved",
  "scope_expansion_approved",
  "child_workflow_initiated",
  "child_workflow_resolved",
  "workflow_paused_for_child",
  "workflow_resumed_after_child",
  "elevation_approved",
  "adr_approved",
  "adr_superseded",
  "decision_recorded",
  "workflow_handover",
  "workflow_force_handover",
]);

export const PHASES = [
  "intent",
  "reproduce",
  "baseline",
  "plan",
  "discover",
  "decompose",
  "execute",
  "verify",
  "data-validation",
  "sync",
  "done",
] as const;

export type Phase = (typeof PHASES)[number];

export const WORKFLOW_TYPES = [
  "feature",
  "bug-fix",
  "refactor",
  "migration",
  "project",
  "quick",
  "team-consolidation",
] as const;

export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

/**
 * Q7 — closed category list for `codi quick` runs. The dev MUST classify
 * every quick run as one of these. Anything that doesn't fit needs a full
 * workflow (`codi workflow run`).
 */
export const QUICK_CATEGORIES = ["typo", "comment", "dep-bump", "format", "doc-tweak"] as const;

export type QuickCategory = (typeof QUICK_CATEGORIES)[number];

export type AuthorType = "agent" | "human" | "system";

export interface Author {
  type: AuthorType;
  id: string;
}

export interface ManifestEvent {
  event_id: string;
  schema_version: string;
  event_type: EventType;
  timestamp: string;
  author: Author;
  parent_event_id: string | null;
  commitable: boolean;
  payload: Record<string, unknown>;
}

export type WorkflowStatus = "active" | "paused" | "completed" | "abandoned";

export interface PhaseRecord {
  phase: Phase;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  gate_passed?: boolean;
}

export interface ChildWorkflowRef {
  id: string;
  type: WorkflowType;
  status: "active" | "completed" | "abandoned";
  branch: string;
  initiated_at: string;
}

export interface ReducedState {
  workflow_id: string;
  workflow_type: WorkflowType;
  task: string;
  status: WorkflowStatus;
  current_phase: Phase;
  phase_history: PhaseRecord[];
  scope: {
    files_in_plan: string[];
    incidental_changes: number;
    scope_expansions_approved: number;
    scope_expansions_rejected: number;
  };
  child_workflows: ChildWorkflowRef[];
  paused_for_child_id: string | null;
  knowledge: {
    context_terms_added: string[];
    adrs_approved: number[];
  };
  subagent_stats: {
    total_dispatched: number;
    total_completed: number;
    total_failed: number;
    total_tokens_consumed: number;
  };
  current_owner: string;
  started_at: string;
  last_event_id: string;
  last_event_timestamp: string;
  events_count: number;
}

export const CURRENT_SCHEMA_VERSION = "1.0.0";
