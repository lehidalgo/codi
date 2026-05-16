/**
 * ISSUE-002 regression: gate sources are unified on the brain DB.
 *
 * Locks the invariant that `applyMigrations` seeds `workflow_definitions`
 * and that `gate-runner-bridge.runPhaseGates` reads gate lists from the
 * same DB-backed `workflow-graph.gatesForPhase` (no longer from disk
 * YAML). A regression here would re-open the W-C1 divergence between
 * the two `gatesForPhase` implementations.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { gatesForPhase } from "#src/runtime/workflow-graph.js";
import { runPhaseGates } from "#src/runtime/gate-runner-bridge.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { reduce } from "#src/runtime/reducer.js";
import { createEvent } from "#src/runtime/event-factory.js";

const SYSTEM_AUTHOR = { type: "system" as const, id: "codi" };

function tmpDir(prefix: string) {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("ISSUE-002 — gate source unification", () => {
  it("applyMigrations seeds workflow_definitions with the 7 builtins", () => {
    const dir = tmpDir("codi-issue002-");
    const handle = openBrain({ dbPath: join(dir, "brain.db") });
    try {
      applyMigrations(handle.raw);
      const count = (
        handle.raw.prepare("SELECT COUNT(*) as c FROM workflow_definitions").get() as {
          c: number;
        }
      ).c;
      expect(count).toBeGreaterThanOrEqual(7);
    } finally {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("bridge runPhaseGates reads the same gate list as DB-backed gatesForPhase", () => {
    const dbDir = tmpDir("codi-issue002-db-");
    const log = BrainEventLog.open({ dbPath: join(dbDir, "brain.db") });
    try {
      const init = createEvent({
        eventType: "init",
        payload: {
          workflow_id: "w1",
          workflow_type: "feature",
          task: "single-source check",
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
          parentEventId: null,
        }),
      );
      const events = log.loadEvents("w1");

      const fromDb = [...gatesForPhase(log.privateRaw, "feature", "intent")];
      const result = runPhaseGates("intent", {
        cwd: process.cwd(),
        workflowType: "feature",
        workflowId: "w1",
        state: reduce(events),
        events,
        log,
      });
      const fromBridge = result.outcomes.map((o) => o.check.id);

      // Both paths must agree on the gate list — single source of truth.
      expect(fromBridge).toEqual(fromDb);
      expect(fromBridge.length).toBeGreaterThan(0);
    } finally {
      log.dispose();
      rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it("unknown workflow type returns empty gate list from DB-backed query", () => {
    const dir = tmpDir("codi-issue002-unknown-");
    const handle = openBrain({ dbPath: join(dir, "brain.db") });
    try {
      applyMigrations(handle.raw);
      // Bridge wrapper catches UnknownWorkflowTypeError and returns [].
      // We verify the underlying contract: workflow-graph.gatesForPhase
      // throws on unknown type, which the bridge wrapper translates to [].
      expect(() => gatesForPhase(handle.raw, "this-type-does-not-exist", "intent")).toThrow();
    } finally {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
