import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { createEvent } from "#src/runtime/event-factory.js";
import { buildGateAdvisoryBlock } from "#src/runtime/hook-logic.js";
import type { Author } from "#src/runtime/types.js";

const SYSTEM: Author = { type: "system", id: "codi" };

describe("buildGateAdvisoryBlock", () => {
  let dbDir: string;

  beforeEach(() => {
    dbDir = mkdtempSync(join(tmpdir(), "codi-gab-"));
  });

  afterEach(() => rmSync(dbDir, { recursive: true, force: true }));

  function newLog(): BrainEventLog {
    return BrainEventLog.open({ dbPath: join(dbDir, `${Date.now()}-${Math.random()}.db`) });
  }

  it("returns empty when no active workflow", () => {
    const log = newLog();
    expect(buildGateAdvisoryBlock(log)).toBe("");
  });

  it("returns empty when no gate_check_failed events", () => {
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: { workflow_id: "w1", workflow_type: "feature", task: "x", plugin_version: "0.1.0" },
      author: SYSTEM,
      parentEventId: null,
    });
    log.initWorkflow("w1", init);
    expect(buildGateAdvisoryBlock(log)).toBe("");
  });

  it("emits block with gate failures from the most recent transition burst", () => {
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: { workflow_id: "w2", workflow_type: "feature", task: "x", plugin_version: "0.1.0" },
      author: SYSTEM,
      parentEventId: null,
    });
    log.initWorkflow("w2", init);
    log.append(
      "w2",
      createEvent({
        eventType: "gate_check_failed",
        payload: {
          gate_name: "plan",
          check_id: "scope_files_listed",
          reason: "scope.files_in_plan is empty.",
          retry_count: 0,
          retries_remaining: 0,
          suggested_action: "Use codi workflow scope propose-expansion --file <path>.",
        },
        author: SYSTEM,
        parentEventId: null,
      }),
    );
    log.append(
      "w2",
      createEvent({
        eventType: "phase_completed",
        payload: { phase: "plan", duration_ms: 0, gate_passed: false },
        author: SYSTEM,
        parentEventId: null,
      }),
    );
    log.append(
      "w2",
      createEvent({
        eventType: "phase_transition_approved",
        payload: { from_phase: "plan", to_phase: "decompose" },
        author: SYSTEM,
        parentEventId: null,
      }),
    );
    const out = buildGateAdvisoryBlock(log);
    expect(out).toContain("<gate-advisory>");
    expect(out).toContain("scope_files_listed");
    expect(out).toContain("scope.files_in_plan is empty.");
    expect(out).toContain("propose-expansion");
    expect(out).toContain("</gate-advisory>");
  });

  it("suppresses block when the most recent approval had only passing gates", () => {
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: { workflow_id: "w3", workflow_type: "feature", task: "x", plugin_version: "0.1.0" },
      author: SYSTEM,
      parentEventId: null,
    });
    log.initWorkflow("w3", init);
    // Earlier failure that was already superseded by the prior approval
    log.append(
      "w3",
      createEvent({
        eventType: "gate_check_failed",
        payload: {
          gate_name: "intent",
          check_id: "task_described",
          reason: "Task is empty.",
          retry_count: 0,
          retries_remaining: 0,
          suggested_action: "Set the task at workflow init.",
        },
        author: SYSTEM,
        parentEventId: null,
      }),
    );
    log.append(
      "w3",
      createEvent({
        eventType: "phase_transition_approved",
        payload: { from_phase: "intent", to_phase: "plan" },
        author: SYSTEM,
        parentEventId: null,
      }),
    );
    log.append(
      "w3",
      createEvent({
        eventType: "phase_started",
        payload: { phase: "plan" },
        author: SYSTEM,
        parentEventId: null,
      }),
    );
    // Latest approval with only passing gates — burst-walk-back stops at phase_started
    log.append(
      "w3",
      createEvent({
        eventType: "gate_check_passed",
        payload: { gate_name: "plan", check_id: "scope_files_listed", duration_ms: 1 },
        author: SYSTEM,
        parentEventId: null,
      }),
    );
    log.append(
      "w3",
      createEvent({
        eventType: "phase_transition_approved",
        payload: { from_phase: "plan", to_phase: "decompose" },
        author: SYSTEM,
        parentEventId: null,
      }),
    );
    expect(buildGateAdvisoryBlock(log)).toBe("");
  });
});
