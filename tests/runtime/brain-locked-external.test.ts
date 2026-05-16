/**
 * CORE-038 — brain DB locked by an external process scenario.
 *
 * Real-world trigger: the user opens the brain DB in a SQLite GUI
 * (DB Browser for SQLite, TablePlus, datagrip) and starts a write
 * transaction. Meanwhile codi tries to `codi workflow transition` or
 * a hook fires. Without `busy_timeout`, codi would error immediately
 * with `SQLITE_BUSY`; with the 5s default (see brain/db.ts:219) the
 * write defers and eventually succeeds once the external process
 * releases its lock.
 *
 * These tests use a second `better-sqlite3` handle in the same
 * Node process to simulate the external lock. The SQLite locking
 * primitive is identical regardless of whether the contention
 * comes from another Node process or a separate binary — both
 * acquire the same OS-level WAL/reserved lock.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { runWorkflow, proposeTransition } from "#src/runtime/cli-handlers.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import type { Author } from "#src/runtime/types.js";
import { unwrap } from "./_brain-helper.js";

const HUMAN: Author = { type: "human", id: "tester" };

function bootstrap(dir: string): void {
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# context\n");
}

describe("CORE-038 — brain DB locked by external process", () => {
  let tmpDir: string;
  let dbPath: string;
  let prevBrainDb: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-locked-ext-"));
    bootstrap(tmpDir);
    dbPath = join(tmpDir, "brain.db");
    prevBrainDb = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = dbPath;
    // Materialise the brain so the "external process" handle below
    // can attach without racing the migration step.
    const handle = openBrain({ dbPath });
    try {
      applyMigrations(handle.raw);
    } finally {
      handle.close();
    }
  });

  afterEach(() => {
    if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = prevBrainDb;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // NOTE — the obvious "external lock released mid-write → codi waits + succeeds"
  // scenario is not single-process-testable: `better-sqlite3` is fully synchronous
  // and blocks the event loop, so a `setTimeout(release, 150)` scheduled in the
  // same process can never fire while codi is inside `busy_timeout`. Validating
  // that path requires a real second OS process (subprocess fixture) holding the
  // lock; tracked as future test-debt. The remaining 3 tests cover the
  // synchronously-observable contract: locked → SQLITE_BUSY after timeout,
  // WAL readers don't block, post-release writes succeed cleanly.

  it("does NOT fail immediately when the lock is held by a second connection", () => {
    // Open a second handle that holds an IMMEDIATE write lock. Codi
    // must NOT see an instantaneous SQLITE_BUSY — the busy_timeout
    // pragma forces it to retry until the timeout window expires.
    const externalConn = new Database(dbPath);
    externalConn.pragma("journal_mode = WAL");
    externalConn.exec("BEGIN IMMEDIATE");

    // Force a SHORT busy_timeout on the codi-side handle so the test
    // doesn't hang for 5s — we want to prove the timeout PATH exists,
    // not that we wait the full default.
    const codiHandle = openBrain({ dbPath });
    codiHandle.raw.pragma("busy_timeout = 200");
    try {
      const start = Date.now();
      let threw: unknown = null;
      try {
        codiHandle.raw.exec("BEGIN IMMEDIATE");
      } catch (e) {
        threw = e;
      }
      const elapsed = Date.now() - start;
      // The error must surface SQLITE_BUSY / "database is locked".
      expect(threw).toBeTruthy();
      expect(String((threw as Error)?.message ?? threw)).toMatch(
        /database is locked|SQLITE_BUSY/i,
      );
      // And it must have waited at least the busy_timeout window
      // before giving up — proves retry actually happened.
      expect(elapsed).toBeGreaterThanOrEqual(150);
    } finally {
      try {
        codiHandle.raw.exec("ROLLBACK");
      } catch {
        // not in a txn — fine
      }
      codiHandle.close();
      externalConn.exec("ROLLBACK");
      externalConn.close();
    }
  });

  it("brain-ui-style read concurrent with external write proceeds (WAL readers don't block on writers)", () => {
    // In WAL mode a reader can proceed against the last committed
    // snapshot even while a writer holds an IMMEDIATE lock. This is
    // the contract that lets `codi brain ui` keep serving HTTP
    // requests while `codi workflow transition` writes.
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "wal reader vs external writer",
        author: HUMAN,
        cwd: tmpDir,
      }),
    );

    // External writer holds an IMMEDIATE lock — does NOT block readers.
    const externalConn = new Database(dbPath);
    externalConn.pragma("journal_mode = WAL");
    externalConn.exec("BEGIN IMMEDIATE");

    try {
      // The reader (a brain-event-log open + active-workflow read)
      // must complete without blocking — WAL mode contract.
      const log = BrainEventLog.open();
      try {
        const id = log.getActiveWorkflowId();
        expect(id).toBeTruthy();
      } finally {
        log.dispose();
      }
    } finally {
      externalConn.exec("ROLLBACK");
      externalConn.close();
    }
  });

  it("post-release writes succeed without manual intervention (lock auto-clears)", () => {
    // External process locks, then releases, then exits. Codi must
    // pick up cleanly on the next write — no stale lock-file rescue
    // needed.
    const externalConn = new Database(dbPath);
    externalConn.pragma("journal_mode = WAL");
    externalConn.exec("BEGIN IMMEDIATE");
    externalConn.exec("ROLLBACK");
    externalConn.close();

    // Now codi writes. Must succeed normally.
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "post-release write",
        author: HUMAN,
        cwd: tmpDir,
      }),
    );

    // A second write (transition) on the same lifecycle also works
    // — proves the connection isn't poisoned by the prior contention.
    const r = proposeTransition({ toPhase: "plan", author: HUMAN, cwd: tmpDir });
    expect(r.ok).toBe(true);
  });
});
