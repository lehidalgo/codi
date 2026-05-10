import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { createEvent } from "#src/runtime/event-factory.js";
import type { Author } from "#src/runtime/types.js";

const AUTHOR: Author = { type: "system", id: "codi" };

describe("getActiveWorkflowId cwd filter", () => {
  let projectA: string;
  let projectB: string;
  let dbDir: string;
  let prevCwd: string;

  beforeEach(() => {
    prevCwd = process.cwd();
    projectA = mkdtempSync(join(tmpdir(), "codi-cwdA-"));
    projectB = mkdtempSync(join(tmpdir(), "codi-cwdB-"));
    dbDir = mkdtempSync(join(tmpdir(), "codi-cwd-db-"));
  });

  afterEach(() => {
    process.chdir(prevCwd);
    rmSync(projectA, { recursive: true, force: true });
    rmSync(projectB, { recursive: true, force: true });
    rmSync(dbDir, { recursive: true, force: true });
  });

  function newLog(): BrainEventLog {
    return BrainEventLog.open({ dbPath: join(dbDir, `${Date.now()}-${Math.random()}.db`) });
  }

  it("returns id when cwd matches workflow init payload", () => {
    process.chdir(projectA);
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: {
        workflow_id: "wA",
        workflow_type: "feature",
        task: "x",
        plugin_version: "0.1.0",
        cwd: projectA,
      },
      author: AUTHOR,
      parentEventId: null,
    });
    log.initWorkflow("wA", init);
    expect(log.getActiveWorkflowIdForCwd(process.cwd())).toBe("wA");
  });

  it("returns null when cwd is a different project from active workflow", () => {
    process.chdir(projectA);
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: {
        workflow_id: "wA",
        workflow_type: "feature",
        task: "x",
        plugin_version: "0.1.0",
        cwd: projectA,
      },
      author: AUTHOR,
      parentEventId: null,
    });
    log.initWorkflow("wA", init);
    process.chdir(projectB);
    expect(log.getActiveWorkflowIdForCwd(process.cwd())).toBe(null);
  });

  it("back-compat: returns id when init payload has no cwd field", () => {
    process.chdir(projectA);
    const log = newLog();
    const init = createEvent({
      eventType: "init",
      payload: {
        workflow_id: "wOld",
        workflow_type: "feature",
        task: "x",
        plugin_version: "0.1.0",
      },
      author: AUTHOR,
      parentEventId: null,
    });
    log.initWorkflow("wOld", init);
    expect(log.getActiveWorkflowIdForCwd(process.cwd())).toBe("wOld");
  });
});
