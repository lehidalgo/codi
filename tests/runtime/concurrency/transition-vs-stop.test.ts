/**
 * ISSUE-048 — concurrency: phase transition racing a Stop-hook fire.
 *
 * Real-world scenario: the user runs `codi workflow approve` in the
 * foreground while a Stop hook fires in the background (Claude triggered
 * mid-session). Both write to brain.db. The invariant is exactly-once
 * for each event: no duplicate `phase_transition_approved`, no orphan
 * `phase_started`, capture markers persist exactly once.
 *
 * The test interleaves a `processStopHook` call with an
 * `approveTransition` via `Promise.all`. SQLite's BEGIN IMMEDIATE +
 * busy_timeout serialise the writes; we assert the final state, never
 * timing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflow, proposeTransition, approveTransition } from "#src/runtime/cli-handlers.js";
import { processStopHook } from "#src/runtime/capture/stop-hook.js";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import type { Author } from "#src/runtime/types.js";

const HUMAN: Author = { type: "human", id: "tester" };

function bootstrap(dir: string): void {
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# context\n");
}

describe("ISSUE-048 — Stop hook concurrent with approveTransition", () => {
  let tmpDir: string;
  let dbPath: string;
  let prevBrainDb: string | undefined;
  let workflowId: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-trans-stop-"));
    bootstrap(tmpDir);
    dbPath = join(tmpDir, "brain.db");
    prevBrainDb = process.env["CODI_BRAIN_DB"];
    process.env["CODI_BRAIN_DB"] = dbPath;
    const r = runWorkflow({
      workflowType: "feature",
      task: "race scenario",
      author: HUMAN,
      cwd: tmpDir,
    });
    workflowId = r.workflowId;
    proposeTransition({ toPhase: "plan", author: HUMAN, cwd: tmpDir });
  });

  afterEach(() => {
    if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = prevBrainDb;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("approveTransition + Stop hook in parallel each leave a clean event chain", async () => {
    const stopInput = {
      sessionId: "race-session-001",
      transcriptPath: join(tmpDir, "transcript.jsonl"),
      cwd: tmpDir,
      agentType: "claude-code" as const,
      agentTextOverride: `|INSIGHT: "race scenario"|`,
    };
    writeFileSync(stopInput.transcriptPath, "");

    function runStop(): void {
      const handle = openBrain({ dbPath });
      applyMigrations(handle.raw);
      try {
        processStopHook(handle, stopInput);
      } finally {
        handle.close();
      }
    }

    await Promise.all([
      Promise.resolve().then(() => approveTransition({ author: HUMAN, cwd: tmpDir })),
      Promise.resolve().then(runStop),
    ]);

    // Verify the transition completed exactly once.
    const log = BrainEventLog.open();
    try {
      const events = log.loadEvents(workflowId);
      const approved = events.filter((e) => e.event_type === "phase_transition_approved");
      const completed = events.filter((e) => e.event_type === "phase_completed");
      const started = events.filter(
        (e) =>
          e.event_type === "phase_started" && (e.payload as { phase?: string }).phase === "plan",
      );
      expect(approved).toHaveLength(1);
      expect(completed).toHaveLength(1);
      expect(started).toHaveLength(1);
    } finally {
      log.dispose();
    }

    // Verify the Stop hook capture persisted exactly once.
    const handle = openBrain({ dbPath });
    try {
      const rows = handle.raw
        .prepare(`SELECT COUNT(*) AS n FROM captures WHERE session_id = ?`)
        .get(stopInput.sessionId) as { n: number };
      expect(rows.n).toBe(1);
    } finally {
      handle.close();
    }
  });
});
