/**
 * ISSUE-004 regression: runWorkflow + initWorkflow use BEGIN IMMEDIATE
 * so the stale-active cleanup + init are atomic against a concurrent
 * writer. Without IMMEDIATE, two processes can both observe a stale
 * terminal workflow, both clear it, both init — violating the singleton
 * invariant.
 *
 * Cross-process tests are awkward in the vitest harness. Instead we
 * exercise the underlying SQLite locking primitive: hold an IMMEDIATE
 * txn on one connection and observe that a second connection cannot
 * begin its own IMMEDIATE within busy_timeout. Combined with the
 * singleton-error invariant check at the API level, these regression
 * tests prove the fix mechanism and the user-visible contract.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { runWorkflow } from "#src/runtime/cli-handlers.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { createEvent } from "#src/runtime/event-factory.js";
import { reduce } from "#src/runtime/reducer.js";
import type { Author } from "#src/runtime/types.js";

const HUMAN: Author = { type: "human", id: "tester" };

function bootstrap(dir: string): void {
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# context\n");
}

describe("ISSUE-004 — runWorkflow singleton race", () => {
  let tmpDir: string;
  let dbPath: string;
  let prevBrainDb: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-race-"));
    bootstrap(tmpDir);
    dbPath = join(tmpDir, "brain.db");
    prevBrainDb = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = dbPath;
  });

  afterEach(() => {
    if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = prevBrainDb;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("a second runWorkflow throws BrainWorkflowAlreadyActiveError instead of corrupting state", () => {
    runWorkflow({
      workflowType: "feature",
      task: "first race winner",
      author: HUMAN,
      cwd: tmpDir,
    });

    expect(() =>
      runWorkflow({
        workflowType: "feature",
        task: "loser",
        author: HUMAN,
        cwd: tmpDir,
      }),
    ).toThrow(/already active|already initialized/i);

    const handle = openBrain({ dbPath });
    try {
      applyMigrations(handle.raw);
      const inits = handle.raw
        .prepare(`SELECT workflow_id FROM workflow_events WHERE event_type = 'init'`)
        .all() as { workflow_id: string }[];
      expect(inits).toHaveLength(1);
    } finally {
      handle.close();
    }
  });

  it("stale terminal workflow is migrated atomically (no double-active)", () => {
    {
      const handle = openBrain({ dbPath });
      applyMigrations(handle.raw);
      const log = BrainEventLog.open({ dbPath });
      try {
        const init = createEvent({
          eventType: "init",
          payload: {
            workflow_id: "wf-prior",
            workflow_type: "feature",
            task: "prior",
            plugin_version: "0.1.0",
          },
          author: HUMAN,
          parentEventId: null,
        });
        log.initWorkflow("wf-prior", init);
        log.append(
          "wf-prior",
          createEvent({
            eventType: "workflow_completed",
            payload: { duration_ms: 0, summary: "prior terminal" },
            author: { type: "system", id: "codi" },
            parentEventId: init.event_id,
          }),
        );
      } finally {
        log.dispose();
        handle.close();
      }
    }

    const result = runWorkflow({
      workflowType: "feature",
      task: "after stale",
      author: HUMAN,
      cwd: tmpDir,
    });
    expect(result.workflowId).not.toBe("wf-prior");

    const handle = openBrain({ dbPath });
    try {
      // v11+: workflow_runs holds only real workflow rows — the active-id
      // pointer was lifted to the runtime_state KV table (ISSUE-037).
      const activeRows = handle.raw
        .prepare(`SELECT workflow_id FROM workflow_runs WHERE status = 'active'`)
        .all() as { workflow_id: string }[];
      expect(activeRows).toHaveLength(1);
      expect(activeRows[0]!.workflow_id).toBe(result.workflowId);
    } finally {
      handle.close();
    }
  });

  it("BEGIN IMMEDIATE held on connection A makes connection B fail to acquire within busy_timeout", () => {
    {
      const handle = openBrain({ dbPath });
      applyMigrations(handle.raw);
      handle.close();
    }

    const connA = new Database(dbPath);
    connA.pragma("journal_mode = WAL");
    connA.exec("BEGIN IMMEDIATE");

    try {
      const connB = new Database(dbPath);
      connB.pragma("journal_mode = WAL");
      connB.pragma("busy_timeout = 100");
      try {
        expect(() => connB.exec("BEGIN IMMEDIATE")).toThrow(/database is locked|SQLITE_BUSY/i);
      } finally {
        connB.close();
      }
    } finally {
      connA.exec("ROLLBACK");
      connA.close();
    }
  });

  it("reduce() of a freshly-created workflow remains queryable through the fix", () => {
    runWorkflow({
      workflowType: "feature",
      task: "happy path",
      author: HUMAN,
      cwd: tmpDir,
    });
    const log = BrainEventLog.open({ dbPath });
    try {
      const id = log.getActiveWorkflowId()!;
      const events = log.loadEvents(id);
      const state = reduce(events);
      expect(state.status).toBe("active");
      expect(state.current_phase).toBe("intent");
    } finally {
      log.dispose();
    }
  });
});
