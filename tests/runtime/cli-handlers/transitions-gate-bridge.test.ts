import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { approveTransition, proposeTransition } from "#src/runtime/cli-handlers/transitions.js";
import { runWorkflow } from "#src/runtime/cli-handlers/workflow.js";
import type { Author } from "#src/runtime/types.js";

const AGENT_AUTHOR: Author = { type: "agent", id: "test" };

describe("approveTransition runs phase gates as advisory", () => {
  let scratch: string;
  let dbPath: string;
  let prevCwd: string;

  beforeEach(() => {
    prevCwd = process.cwd();
    scratch = mkdtempSync(join(tmpdir(), "codi-tg-"));
    mkdirSync(join(scratch, "docs"), { recursive: true });
    writeFileSync(join(scratch, "docs", "CONTEXT.md"), "# context\n");
    dbPath = join(mkdtempSync(join(tmpdir(), "codi-tg-db-")), "brain.db");
    process.env["CODI_BRAIN_DB"] = dbPath;
  });

  afterEach(() => {
    delete process.env["CODI_BRAIN_DB"];
    process.chdir(prevCwd);
    rmSync(scratch, { recursive: true, force: true });
  });

  it("plan→decompose with empty scope persists gate_check_failed but still approves", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Test gate firing",
      author: AGENT_AUTHOR,
      cwd: scratch,
    });
    proposeTransition({ toPhase: "plan", author: AGENT_AUTHOR, cwd: scratch });
    approveTransition({ author: AGENT_AUTHOR });
    proposeTransition({ toPhase: "decompose", author: AGENT_AUTHOR, cwd: scratch });
    const result = approveTransition({ author: AGENT_AUTHOR });
    expect(result.fromPhase).toBe("plan");
    expect(result.toPhase).toBe("decompose");
    const log = BrainEventLog.open();
    const events = log.loadEvents(result.workflowId);
    const failed = events.filter((e) => e.event_type === "gate_check_failed");
    expect(failed.length).toBeGreaterThan(0);
    const phaseCompleted = events.find(
      (e) =>
        e.event_type === "phase_completed" && (e.payload as { phase?: string }).phase === "plan",
    );
    expect(phaseCompleted).toBeDefined();
    expect((phaseCompleted!.payload as { gate_passed?: boolean }).gate_passed).toBe(false);
  });

  it("intent→plan with task set passes task_described and emits gate_check_passed", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Real task",
      author: AGENT_AUTHOR,
      cwd: scratch,
    });
    proposeTransition({ toPhase: "plan", author: AGENT_AUTHOR, cwd: scratch });
    const result = approveTransition({ author: AGENT_AUTHOR });
    const log = BrainEventLog.open();
    const events = log.loadEvents(result.workflowId);
    const passed = events.filter(
      (e) =>
        e.event_type === "gate_check_passed" &&
        (e.payload as { check_id?: string }).check_id === "task_described",
    );
    expect(passed.length).toBe(1);
  });
});
