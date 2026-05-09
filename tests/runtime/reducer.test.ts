import { describe, it, expect } from "vitest";
import { createEvent } from "#src/runtime/event-factory.js";
import { reduce, ReducerError } from "#src/runtime/reducer.js";
import type { Author } from "#src/runtime/types.js";

const author: Author = { type: "human", id: "tester" };
const sysAuthor: Author = { type: "system", id: "codi" };

function init(workflowId: string, task: string) {
  return createEvent({
    eventType: "init",
    payload: {
      workflow_id: workflowId,
      workflow_type: "feature",
      task,
      plugin_version: "0.1.0",
    },
    author,
    parentEventId: null,
  });
}

describe("reduce", () => {
  it("rejects empty event list", () => {
    expect(() => reduce([])).toThrow(ReducerError);
  });

  it("rejects log not starting with init", () => {
    const phase = createEvent({
      eventType: "phase_started",
      payload: { phase: "plan" },
      author: sysAuthor,
      parentEventId: null,
    });
    expect(() => reduce([phase])).toThrow(ReducerError);
  });

  it("returns initial state from a single init event", () => {
    const state = reduce([init("feat-1", "Build feature 1")]);
    expect(state.workflow_id).toBe("feat-1");
    expect(state.workflow_type).toBe("feature");
    expect(state.status).toBe("active");
    expect(state.current_phase).toBe("intent");
    expect(state.events_count).toBe(1);
  });

  it("tracks phase transitions", () => {
    const i = init("feat-1", "Task");
    const transition = createEvent({
      eventType: "phase_transition_approved",
      payload: { from_phase: "intent", to_phase: "plan" },
      author,
      parentEventId: i.event_id,
    });
    const state = reduce([i, transition]);
    expect(state.current_phase).toBe("plan");
  });

  it("aggregates scope expansions and incidentals", () => {
    const events = [init("feat-1", "Task")];
    events.push(
      createEvent({
        eventType: "scope_expansion_approved",
        payload: { file_path: "src/a.ts", added_to_scope: ["src/a.ts"] },
        author,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "scope_expansion_approved",
        payload: { file_path: "src/b.ts", added_to_scope: ["src/b.ts"] },
        author,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "scope_expansion_rejected",
        payload: { file_path: "src/c.ts", reason: "out of scope" },
        author,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "incidental_change_recorded",
        payload: {
          file_path: "src/utils.ts",
          lines_changed: 1,
          classifier_reason: "import only",
        },
        author: sysAuthor,
        parentEventId: null,
      }),
    );
    const state = reduce(events);
    expect(state.scope.files_in_plan).toEqual(["src/a.ts", "src/b.ts"]);
    expect(state.scope.scope_expansions_approved).toBe(2);
    expect(state.scope.scope_expansions_rejected).toBe(1);
    expect(state.scope.incidental_changes).toBe(1);
  });

  it("tracks subagent stats", () => {
    const events = [init("feat-1", "Task")];
    events.push(
      createEvent({
        eventType: "subagent_dispatched",
        payload: {
          skill_name: "gate-x",
          category: "fork-by-design",
          purpose: "test",
          parent_phase: "plan",
        },
        author: sysAuthor,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "subagent_completed",
        payload: { skill_name: "gate-x", tokens_consumed: 1500, duration_ms: 30000 },
        author: sysAuthor,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "subagent_failed",
        payload: { skill_name: "gate-y", reason: "timeout" },
        author: sysAuthor,
        parentEventId: null,
      }),
    );
    const state = reduce(events);
    expect(state.subagent_stats.total_dispatched).toBe(1);
    expect(state.subagent_stats.total_completed).toBe(1);
    expect(state.subagent_stats.total_failed).toBe(1);
    expect(state.subagent_stats.total_tokens_consumed).toBe(1500);
  });

  it("tracks child workflows and pause/resume", () => {
    const events = [init("feat-1", "Task")];
    events.push(
      createEvent({
        eventType: "child_workflow_initiated",
        payload: {
          child_workflow_id: "refactor-1",
          child_workflow_type: "refactor",
          child_branch: "codi/feat-1/refactor-1",
          reason: "decoupling",
        },
        author: sysAuthor,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "workflow_paused_for_child",
        payload: { child_workflow_id: "refactor-1", paused_in_phase: "execute" },
        author: sysAuthor,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "child_workflow_resolved",
        payload: { child_workflow_id: "refactor-1", status: "completed" },
        author: sysAuthor,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "workflow_resumed_after_child",
        payload: { child_workflow_id: "refactor-1", resumed_in_phase: "plan" },
        author,
        parentEventId: null,
      }),
    );
    const state = reduce(events);
    expect(state.child_workflows).toHaveLength(1);
    expect(state.child_workflows[0]?.status).toBe("completed");
    expect(state.paused_for_child_id).toBeNull();
    expect(state.current_phase).toBe("plan");
    expect(state.status).toBe("active");
  });

  it("tracks knowledge base updates", () => {
    const events = [init("feat-1", "Task")];
    events.push(
      createEvent({
        eventType: "context_term_added",
        payload: { term: "Theme", definition: "Visual variant" },
        author,
        parentEventId: null,
      }),
    );
    events.push(
      createEvent({
        eventType: "adr_approved",
        payload: { adr_number: 8, adr_path: "docs/adr/0008-x.md" },
        author,
        parentEventId: null,
      }),
    );
    const state = reduce(events);
    expect(state.knowledge.context_terms_added).toEqual(["Theme"]);
    expect(state.knowledge.adrs_approved).toEqual([8]);
  });

  it("transfers ownership on handover", () => {
    const events = [init("feat-1", "Task")];
    events.push(
      createEvent({
        eventType: "workflow_handover",
        payload: {
          from_dev_id: "tester",
          to_dev_id: "ana@example.com",
          reason: "vacation",
        },
        author,
        parentEventId: null,
      }),
    );
    const state = reduce(events);
    expect(state.current_owner).toBe("ana@example.com");
  });

  it("is deterministic: same events produce same state", () => {
    const events = [
      init("feat-1", "Task"),
      createEvent({
        eventType: "phase_transition_approved",
        payload: { from_phase: "intent", to_phase: "plan" },
        author,
        parentEventId: null,
      }),
      createEvent({
        eventType: "scope_expansion_approved",
        payload: { file_path: "x.ts", added_to_scope: ["x.ts"] },
        author,
        parentEventId: null,
      }),
    ];
    const stateA = reduce(events);
    const stateB = reduce(events);
    expect(JSON.stringify(stateA)).toBe(JSON.stringify(stateB));
  });

  it("marks workflow as completed", () => {
    const events = [init("feat-1", "Task")];
    events.push(
      createEvent({
        eventType: "workflow_completed",
        payload: { duration_ms: 1000 },
        author,
        parentEventId: null,
      }),
    );
    const state = reduce(events);
    expect(state.status).toBe("completed");
    expect(state.current_phase).toBe("done");
  });

  it("marks workflow as abandoned", () => {
    const events = [init("feat-1", "Task")];
    events.push(
      createEvent({
        eventType: "workflow_abandoned",
        payload: { reason: "scope unclear", abandoned_in_phase: "plan" },
        author,
        parentEventId: null,
      }),
    );
    const state = reduce(events);
    expect(state.status).toBe("abandoned");
  });
});
