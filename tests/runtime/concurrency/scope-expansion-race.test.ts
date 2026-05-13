/**
 * ISSUE-048 — concurrency: two parallel scope-expansion approvals.
 *
 * If two callers approve scope expansions for different files at the
 * same time, both writes should commit. If both target the SAME file
 * (rare but possible in multi-agent setups), exactly-once semantics
 * still hold — a duplicate approval event for the same file is
 * structurally allowed (the reducer dedups), but the underlying SQLite
 * locking must serialise the writes.
 *
 * This test runs two `approveScopeExpansion` calls via `Promise.all`
 * for two different files and asserts both reach approved status.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runWorkflow,
  proposeScopeExpansion,
  approveScopeExpansion,
} from "#src/runtime/cli-handlers.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import type { Author } from "#src/runtime/types.js";

const HUMAN: Author = { type: "human", id: "tester" };

function bootstrap(dir: string): void {
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# context\n");
}

describe("ISSUE-048 — concurrent scope expansion approvals", () => {
  let tmpDir: string;
  let dbPath: string;
  let prevBrainDb: string | undefined;
  let workflowId: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-scope-race-"));
    bootstrap(tmpDir);
    dbPath = join(tmpDir, "brain.db");
    prevBrainDb = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = dbPath;
    const r = runWorkflow({
      workflowType: "feature",
      task: "scope race",
      author: HUMAN,
      cwd: tmpDir,
    });
    workflowId = r.workflowId;
    // Propose two distinct file expansions, then approve in parallel.
    proposeScopeExpansion({
      filePath: "src/a.ts",
      reason: "first file",
      author: HUMAN,
      cwd: tmpDir,
    });
    proposeScopeExpansion({
      filePath: "src/b.ts",
      reason: "second file",
      author: HUMAN,
      cwd: tmpDir,
    });
  });

  afterEach(() => {
    if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = prevBrainDb;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("two parallel approvals for distinct files both commit cleanly", async () => {
    await Promise.all([
      Promise.resolve().then(() =>
        approveScopeExpansion({ filePath: "src/a.ts", author: HUMAN, cwd: tmpDir }),
      ),
      Promise.resolve().then(() =>
        approveScopeExpansion({ filePath: "src/b.ts", author: HUMAN, cwd: tmpDir }),
      ),
    ]);

    const log = BrainEventLog.open();
    try {
      const events = log.loadEvents(workflowId);
      const approved = events.filter((e) => e.event_type === "scope_expansion_approved");
      const approvedFiles = approved
        .map((e) => (e.payload as { file_path?: string }).file_path)
        .sort();
      expect(approvedFiles).toEqual(["src/a.ts", "src/b.ts"]);
    } finally {
      log.dispose();
    }
  });
});
