import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  EventLog,
  WorkflowAlreadyActiveError,
  LockHeldError,
  NoActiveWorkflowError,
} from "../lib/event-log.js";
import { createEvent } from "../lib/event-factory.js";

describe("EventLog", () => {
  let tmpDir: string;
  let log: EventLog;
  const workflowId = "feat-test-20260501";

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "devloop-test-"));
    log = EventLog.fromCwd(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeInit() {
    return createEvent({
      eventType: "init",
      payload: {
        workflow_id: workflowId,
        workflow_type: "feature",
        task: "Test task",
        plugin_version: "0.1.0",
      },
      author: { type: "human", id: "tester" },
      parentEventId: null,
    });
  }

  it("initializes a workflow with an init event at sequence 0", () => {
    const init = makeInit();
    log.initWorkflow(workflowId, init);

    expect(log.getActiveWorkflowId()).toBe(workflowId);
    const events = log.loadEvents(workflowId);
    expect(events).toHaveLength(1);
    expect(events[0]?.event_type).toBe("init");

    const archiveFiles = readdirSync(join(tmpDir, ".workflow", "archives", workflowId));
    expect(archiveFiles).toContain("000_init.json");
  });

  it("rejects init when another workflow is active", () => {
    log.initWorkflow(workflowId, makeInit());
    const otherInit = createEvent({
      eventType: "init",
      payload: {
        workflow_id: "other-id",
        workflow_type: "feature",
        task: "Other",
        plugin_version: "0.1.0",
      },
      author: { type: "human", id: "tester" },
      parentEventId: null,
    });
    expect(() => log.initWorkflow("other-id", otherInit)).toThrow(WorkflowAlreadyActiveError);
  });

  it("appends commitable events to archive", () => {
    log.initWorkflow(workflowId, makeInit());
    const phaseStarted = createEvent({
      eventType: "phase_completed",
      payload: { phase: "intent", duration_ms: 1000, gate_passed: true },
      author: { type: "system", id: "devloop" },
      parentEventId: null,
    });
    const result = log.append(workflowId, phaseStarted);
    expect(result.commitable).toBe(true);
    expect(result.sequence).toBe(1);
    expect(result.path).toContain(join(".workflow", "archives", workflowId));
  });

  it("appends non-commitable events to staging", () => {
    log.initWorkflow(workflowId, makeInit());
    const phaseStarted = createEvent({
      eventType: "phase_started",
      payload: { phase: "plan" },
      author: { type: "system", id: "devloop" },
      parentEventId: null,
    });
    const result = log.append(workflowId, phaseStarted);
    expect(result.commitable).toBe(false);
    expect(result.path).toContain(join(".workflow", "active", "staging"));
  });

  it("appends 10 events and loads them in sequence order", () => {
    log.initWorkflow(workflowId, makeInit());
    for (let i = 0; i < 10; i += 1) {
      log.append(
        workflowId,
        createEvent({
          eventType: "validation_run",
          payload: { command: `cmd-${i}`, exit_code: 0, duration_ms: i },
          author: { type: "system", id: "devloop" },
          parentEventId: null,
        }),
      );
    }
    const events = log.loadEvents(workflowId);
    expect(events).toHaveLength(11);
    expect(events[0]?.event_type).toBe("init");
    for (let i = 1; i <= 10; i += 1) {
      expect(events[i]?.event_type).toBe("validation_run");
      expect((events[i]?.payload as { command: string }).command).toBe(`cmd-${i - 1}`);
    }
  });

  it("does not overwrite existing event files", () => {
    log.initWorkflow(workflowId, makeInit());
    expect(() => log.initWorkflow(workflowId, makeInit())).toThrow();
  });

  it("acquires and releases lock", () => {
    log.acquireLock();
    expect(() => log.acquireLock()).toThrow(LockHeldError);
    log.releaseLock();
    expect(() => log.acquireLock()).not.toThrow();
    log.releaseLock();
  });

  it("loadArchivedEvents skips staging events", () => {
    log.initWorkflow(workflowId, makeInit());
    log.append(
      workflowId,
      createEvent({
        eventType: "phase_started",
        payload: { phase: "plan" },
        author: { type: "system", id: "devloop" },
        parentEventId: null,
      }),
    );
    log.append(
      workflowId,
      createEvent({
        eventType: "phase_completed",
        payload: { phase: "plan", duration_ms: 1000, gate_passed: true },
        author: { type: "system", id: "devloop" },
        parentEventId: null,
      }),
    );
    const all = log.loadEvents(workflowId);
    const archived = log.loadArchivedEvents(workflowId);
    expect(all).toHaveLength(3);
    expect(archived).toHaveLength(2);
    expect(archived.map((e) => e.event_type)).toEqual(["init", "phase_completed"]);
  });
});
