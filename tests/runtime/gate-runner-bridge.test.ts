import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPhaseGates, formatGateAdvisory } from "#src/runtime/gate-runner-bridge.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { reduce } from "#src/runtime/reducer.js";
import { createEvent } from "#src/runtime/event-factory.js";
import type { Author, ManifestEvent } from "#src/runtime/types.js";

const SYSTEM_AUTHOR: Author = { type: "system", id: "codi" };

describe("gate-runner-bridge", () => {
  let cwd: string;
  let dbDir: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "codi-gb-"));
    dbDir = mkdtempSync(join(tmpdir(), "codi-gb-db-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(dbDir, { recursive: true, force: true });
  });

  function newLog(): BrainEventLog {
    return BrainEventLog.open({ dbPath: join(dbDir, `${Date.now()}-${Math.random()}.db`) });
  }

  it("runs the right gates for fromPhase=intent (task_described)", () => {
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: {
        workflow_id: "w1",
        workflow_type: "feature",
        task: "Test feature",
        plugin_version: "0.1.0",
      },
      author: SYSTEM_AUTHOR,
      parentEventId: null,
    });
    log.initWorkflow("w1", init);
    log.append(
      "w1",
      createEvent({
        eventType: "phase_started",
        payload: { phase: "intent" },
        author: SYSTEM_AUTHOR,
        parentEventId: init.event_id,
      }),
    );
    const events = log.loadEvents("w1");
    const state = reduce(events);
    const result = runPhaseGates("intent", {
      cwd,
      workflowType: "feature",
      workflowId: "w1",
      state,
      events,
      log,
    });
    expect(result.passed).toBe(true);
    expect(result.outcomes.map((o) => o.check.id)).toEqual(["task_described"]);
  });

  it("returns failing result when scope_files_listed has zero files", () => {
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: { workflow_id: "w2", workflow_type: "feature", task: "x", plugin_version: "0.1.0" },
      author: SYSTEM_AUTHOR,
      parentEventId: null,
    });
    log.initWorkflow("w2", init);
    log.append(
      "w2",
      createEvent({
        eventType: "phase_started",
        payload: { phase: "plan" },
        author: SYSTEM_AUTHOR,
        parentEventId: init.event_id,
      }),
    );
    const events = log.loadEvents("w2");
    const state = reduce(events);
    const result = runPhaseGates("plan", {
      cwd,
      workflowType: "feature",
      workflowId: "w2",
      state,
      events,
      log,
    });
    expect(result.passed).toBe(false);
    const ids = result.outcomes.map((o) => o.check.id);
    expect(ids).toContain("scope_files_listed");
    expect(ids).toContain("plan_artifact_exists");
  });

  it("never throws on internal errors — fail-open with summary", () => {
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: { workflow_id: "w3", workflow_type: "feature", task: "x", plugin_version: "0.1.0" },
      author: SYSTEM_AUTHOR,
      parentEventId: null,
    });
    log.initWorkflow("w3", init);
    const events: ManifestEvent[] = [];
    const state = reduce(log.loadEvents("w3"));
    const result = runPhaseGates("plan", {
      cwd: "/nonexistent/path/that/does/not/exist",
      workflowType: "feature",
      workflowId: "w3",
      state,
      events,
      log,
    });
    expect(result).toBeDefined();
    expect(typeof result.passed).toBe("boolean");
  });

  it("persists gate_check_started + gate_check_failed events for failures", () => {
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: { workflow_id: "w4", workflow_type: "feature", task: "x", plugin_version: "0.1.0" },
      author: SYSTEM_AUTHOR,
      parentEventId: null,
    });
    log.initWorkflow("w4", init);
    log.append(
      "w4",
      createEvent({
        eventType: "phase_started",
        payload: { phase: "plan" },
        author: SYSTEM_AUTHOR,
        parentEventId: init.event_id,
      }),
    );
    const events = log.loadEvents("w4");
    const state = reduce(events);
    runPhaseGates("plan", {
      cwd,
      workflowType: "feature",
      workflowId: "w4",
      state,
      events,
      log,
    });
    const after = log.loadEvents("w4");
    const startedCount = after.filter((e) => e.event_type === "gate_check_started").length;
    const failedCount = after.filter((e) => e.event_type === "gate_check_failed").length;
    expect(startedCount).toBeGreaterThan(0);
    expect(failedCount).toBeGreaterThan(0);
  });

  it("formatGateAdvisory produces multi-line stderr text with suggested actions", () => {
    const text = formatGateAdvisory({
      gate_name: "plan",
      passed: false,
      outcomes: [
        {
          check: { id: "scope_files_listed", type: "deterministic" },
          result: {
            check_id: "scope_files_listed",
            verdict: "fail",
            summary: "scope.files_in_plan is empty.",
            suggested_action: "Use codi workflow scope propose-expansion --file <path>.",
          },
          retries_used: 0,
        },
      ],
      failed_checks: [],
      retries_remaining: 0,
      next_step: "Investigate the failed check.",
    });
    expect(text).toContain("scope_files_listed");
    expect(text).toContain("scope.files_in_plan is empty.");
    expect(text).toContain("propose-expansion");
  });
});
