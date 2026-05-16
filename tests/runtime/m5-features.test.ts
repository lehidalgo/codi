import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runWorkflow, recordIncidentalChange, abandonWorkflow } from "#src/runtime/cli-handlers.js";
import { unwrap } from "./_brain-helper.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { buildPrSummary, extractHashFromBlock } from "#src/runtime/pr-summary.js";
import { replay } from "#src/runtime/replay.js";
import type { Author } from "#src/runtime/types.js";

const human: Author = { type: "human", id: "tester" };

let prevBrainDb: string | undefined;
function isolateBrain(dir: string): void {
  prevBrainDb = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
}
function restoreBrain(): void {
  if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
  else process.env["CODI_BRAIN_DB"] = prevBrainDb;
}

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), "codi-m5-"));
  isolateBrain(dir);
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Context\n", "utf-8");
  return dir;
}

describe("PR summary generation", () => {
  let dir: string;

  beforeEach(() => {
    dir = setup();
  });

  afterEach(() => {
    restoreBrain();
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty for no events", () => {
    const result = buildPrSummary([]);
    expect(result.block).toBe("");
    expect(result.hash).toBe("");
  });

  it("emits a workflow summary block with hash", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Test PR summary",
        author: human,
        cwd: dir,
      }),
    );
    const log = BrainEventLog.open();
    try {
      const wId = log.getActiveWorkflowId();
      if (!wId) throw new Error("expected workflow");
      const events = log.loadArchivedEvents(wId);
      const result = buildPrSummary(events);
      expect(result.block).toContain("## Workflow Summary");
      expect(result.block).toContain("**Type:** feature");
      expect(result.block).toContain("**Workflow ID:** " + wId);
      expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.block).toContain(`<!-- codi-summary-hash: sha256:${result.hash} -->`);
    } finally {
      log.dispose();
    }
  });

  it("hash is deterministic — same events produce same hash", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Determinism test",
        author: human,
        cwd: dir,
      }),
    );
    const log = BrainEventLog.open();
    try {
      const wId = log.getActiveWorkflowId();
      if (!wId) throw new Error("expected workflow");
      const events = log.loadArchivedEvents(wId);
      const r1 = buildPrSummary(events);
      const r2 = buildPrSummary(events);
      expect(r1.hash).toBe(r2.hash);
    } finally {
      log.dispose();
    }
  });

  it("hash ignores non-commitable events (incidentals)", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Test",
        author: human,
        cwd: dir,
      }),
    );
    const log = BrainEventLog.open();
    try {
      const wId = log.getActiveWorkflowId();
      if (!wId) throw new Error("expected workflow");
      const eventsBefore = log.loadEvents(wId);
      const r1 = buildPrSummary(eventsBefore);

      unwrap(
        recordIncidentalChange({
          filePath: "src/x.ts",
          linesChanged: 1,
          classifierReason: "imports",
          author: { type: "system", id: "h" },
          cwd: dir,
        }),
      );
      const eventsAfter = log.loadEvents(wId);
      const r2 = buildPrSummary(eventsAfter);
      // Incidentals are non-commitable; hash should not change.
      expect(r1.hash).toBe(r2.hash);
    } finally {
      log.dispose();
    }
  });

  it("extractHashFromBlock returns the hash", () => {
    const block = `## Workflow Summary\nfoo\n<!-- codi-summary-hash: sha256:${"a".repeat(64)} -->`;
    expect(extractHashFromBlock(block)).toBe("a".repeat(64));
  });

  it("extractHashFromBlock returns null when missing", () => {
    expect(extractHashFromBlock("foo bar")).toBeNull();
  });
});

describe("compactor (F11 — brain-backed)", () => {
  let cdir: string;
  let savedBrain: string | undefined;

  beforeEach(() => {
    cdir = setup();
    savedBrain = process.env["CODI_BRAIN_DB"];
  });

  afterEach(() => {
    if (savedBrain === undefined) delete process.env["CODI_BRAIN_DB"];
    else process.env["CODI_BRAIN_DB"] = savedBrain;
    rmSync(cdir, { recursive: true, force: true });
  });

  it("does not compact recent terminal workflows", async () => {
    const { compactWorkflows } = await import("#src/runtime/compactor.js");
    const { openBrain } = await import("#src/runtime/brain/db.js");
    const { applyMigrations } = await import("#src/runtime/brain/migrate.js");
    unwrap(runWorkflow({ workflowType: "feature", task: "Recent", author: human, cwd: cdir }));
    unwrap(abandonWorkflow({ reason: "test", author: human, cwd: cdir }));

    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      const results = compactWorkflows(handle, { thresholdDays: 30 });
      const recent = results.find((r) => r.workflowId.startsWith("feat-recent-"));
      expect(recent?.summarized).toBe(false);
      expect(recent?.reason).toContain("threshold");
    } finally {
      handle.close();
    }
  });

  it("compacts terminal workflows older than the threshold", async () => {
    const { compactWorkflows, readCompactedSummary } = await import("#src/runtime/compactor.js");
    const { openBrain } = await import("#src/runtime/brain/db.js");
    const { applyMigrations } = await import("#src/runtime/brain/migrate.js");
    runWorkflow({ workflowType: "feature", task: "Old", author: human, cwd: cdir });
    abandonWorkflow({ reason: "test", author: human, cwd: cdir });

    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      const results = compactWorkflows(handle, {
        thresholdDays: 0,
        now: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const compacted = results.find((r) => r.summarized);
      expect(compacted).toBeDefined();
      expect(compacted?.preservedCount).toBeGreaterThan(0);

      const summary = readCompactedSummary(handle.raw, compacted!.workflowId);
      expect(summary).not.toBeNull();
      const types = (summary?.preserved_events ?? []).map((e) => e.event_type);
      expect(types).toContain("init");
      expect(types).toContain("workflow_abandoned");

      // Underlying events should be deleted.
      const remaining = handle.raw
        .prepare(`SELECT COUNT(*) as c FROM workflow_events WHERE workflow_id = ?`)
        .get(compacted!.workflowId) as { c: number };
      expect(remaining.c).toBe(0);
    } finally {
      handle.close();
    }
  });

  it("is idempotent — already-compacted workflows are skipped", async () => {
    const { compactWorkflows } = await import("#src/runtime/compactor.js");
    const { openBrain } = await import("#src/runtime/brain/db.js");
    const { applyMigrations } = await import("#src/runtime/brain/migrate.js");
    runWorkflow({ workflowType: "feature", task: "Old", author: human, cwd: cdir });
    abandonWorkflow({ reason: "test", author: human, cwd: cdir });

    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      compactWorkflows(handle, { thresholdDays: 0, now: future });
      const second = compactWorkflows(handle, { thresholdDays: 0, now: future });
      const skipped = second.find((r) => r.reason === "Already compacted.");
      expect(skipped).toBeDefined();
    } finally {
      handle.close();
    }
  });

  it("dryRun summarizes but does not delete events", async () => {
    const { compactWorkflows } = await import("#src/runtime/compactor.js");
    const { openBrain } = await import("#src/runtime/brain/db.js");
    const { applyMigrations } = await import("#src/runtime/brain/migrate.js");
    unwrap(runWorkflow({ workflowType: "feature", task: "DryOld", author: human, cwd: cdir }));
    unwrap(abandonWorkflow({ reason: "test", author: human, cwd: cdir }));

    const handle = openBrain();
    try {
      applyMigrations(handle.raw);
      const id = handle.raw
        .prepare(
          `SELECT workflow_id FROM workflow_runs WHERE workflow_id LIKE 'feat-dryold-%' LIMIT 1`,
        )
        .get() as { workflow_id: string };

      const before = handle.raw
        .prepare(`SELECT COUNT(*) as c FROM workflow_events WHERE workflow_id = ?`)
        .get(id.workflow_id) as { c: number };

      const results = compactWorkflows(handle, {
        thresholdDays: 0,
        now: new Date(Date.now() + 24 * 60 * 60 * 1000),
        dryRun: true,
      });
      expect(results.find((r) => r.summarized)).toBeDefined();

      const after = handle.raw
        .prepare(`SELECT COUNT(*) as c FROM workflow_events WHERE workflow_id = ?`)
        .get(id.workflow_id) as { c: number };
      expect(after.c).toBe(before.c);
    } finally {
      handle.close();
    }
  });
});

describe("replay", () => {
  let dir: string;

  beforeEach(() => {
    dir = setup();
  });

  afterEach(() => {
    restoreBrain();
    rmSync(dir, { recursive: true, force: true });
  });

  it("replays the entire log when no until is given", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Replay test",
        author: human,
        cwd: dir,
      }),
    );
    const log = BrainEventLog.open();
    try {
      const wId = log.getActiveWorkflowId();
      if (!wId) throw new Error("expected workflow");
      const events = log.loadArchivedEvents(wId);
      const result = unwrap(replay(events));
      expect(result.events.length).toBe(events.length);
      expect(result.stoppedAt).toBeNull();
    } finally {
      log.dispose();
    }
  });

  it("replays up to a specific event id", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "Replay test",
        author: human,
        cwd: dir,
      }),
    );
    const log = BrainEventLog.open();
    try {
      const wId = log.getActiveWorkflowId();
      if (!wId) throw new Error("expected workflow");
      const events = log.loadEvents(wId);
      const firstEventId = events[0]?.event_id;
      if (!firstEventId) throw new Error("expected init event");
      const result = unwrap(replay(events, { untilEventId: firstEventId }));
      expect(result.events.length).toBe(1);
      expect(result.stoppedAt).toBe(firstEventId);
    } finally {
      log.dispose();
    }
  });

  it("errors when until points to non-existent event", () => {
    unwrap(
      runWorkflow({
        workflowType: "feature",
        task: "x",
        author: human,
        cwd: dir,
      }),
    );
    const log = BrainEventLog.open();
    try {
      const wId = log.getActiveWorkflowId();
      if (!wId) throw new Error("expected workflow");
      const events = log.loadEvents(wId);
      const r = replay(events, { untilEventId: "00000000-0000-4000-8000-000000000000" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("E_EVENT_NOT_FOUND");
    } finally {
      log.dispose();
    }
  });

  it("errors on empty event list", () => {
    const r = replay([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("E_EVENT_REPLAY_EMPTY");
  });
});
