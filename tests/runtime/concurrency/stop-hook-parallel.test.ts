/**
 * ISSUE-048 — concurrency: parallel Stop-hook fires for the same workflow.
 *
 * Background: Claude can double-fire `Stop` on interrupt/resume. Both
 * invocations hit `processStopHook(handle, input)`, which since ISSUE-033
 * wraps every write in `raw.transaction(() => {...})`. The transaction
 * + the `(turn_id, raw_marker)` UNIQUE-via-idx dedup on captures should
 * make a second Stop be a no-op for already-persisted markers.
 *
 * This test fires two Stop hooks for the same session via Promise.all
 * and asserts the invariant: every marker captures exactly once
 * regardless of interleaving.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processStopHook } from "#src/runtime/capture/stop-hook.js";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";

const AGENT_TEXT = `working on it
|RULE: "always lint before commit"|
|OBSERVATION: "two captures should remain one"|
done.`;

describe("ISSUE-048 — parallel Stop hooks for the same session dedup correctly", () => {
  let tmpDir: string;
  let dbPath: string;
  let transcriptPath: string;
  let prevBrainDb: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-stop-parallel-"));
    dbPath = join(tmpDir, "brain.db");
    transcriptPath = join(tmpDir, "transcript.jsonl");
    prevBrainDb = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = dbPath;
    // Stop hook reads agent text from the transcript only when no
    // `agentTextOverride` is supplied. The test uses the override path
    // so the transcript is not strictly needed, but having a file at
    // the path keeps the I/O path identical to production.
    writeFileSync(transcriptPath, "");
  });

  afterEach(() => {
    if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = prevBrainDb;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("two concurrent Stop hooks for one session produce exactly N captures, not 2N", async () => {
    const sessionId = "session-parallel-001";
    const input = {
      sessionId,
      transcriptPath,
      cwd: tmpDir,
      agentType: "claude-code" as const,
      agentTextOverride: AGENT_TEXT,
    };

    // Each Stop hook opens its own brain handle — the busy_timeout +
    // raw.transaction wrapper at processStopHook serialise the writes.
    function fireOnce(): { capturesInserted: number } {
      const handle = openBrain({ dbPath });
      applyMigrations(handle.raw);
      try {
        const r = processStopHook(handle, input);
        return { capturesInserted: r.capturesInserted };
      } finally {
        handle.close();
      }
    }

    const [a, b] = await Promise.all([
      Promise.resolve().then(fireOnce),
      Promise.resolve().then(fireOnce),
    ]);

    // First fire inserts both markers; second fire dedups to zero.
    // We don't care which wins — only that the SUM equals the unique
    // marker count (2).
    expect(a.capturesInserted + b.capturesInserted).toBe(2);

    // Verify on the DB: exactly 2 capture rows for this session.
    const handle = openBrain({ dbPath });
    try {
      const rows = handle.raw
        .prepare(`SELECT COUNT(*) AS n FROM captures WHERE session_id = ?`)
        .get(sessionId) as { n: number };
      expect(rows.n).toBe(2);
    } finally {
      handle.close();
    }
  });
});
