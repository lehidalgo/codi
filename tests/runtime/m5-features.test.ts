import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runWorkflow, abandonWorkflow, recordIncidentalChange } from "#src/runtime/cli-handlers.js";
import { EventLog } from "#src/runtime/event-log.js";
import { reduce } from "#src/runtime/reducer.js";
import { buildPrSummary, extractHashFromBlock } from "#src/runtime/pr-summary.js";
import { compactAllArchives } from "#src/runtime/compactor.js";
import { replay } from "#src/runtime/replay.js";
import { devloopPaths } from "#src/runtime/paths.js";
import type { Author } from "#src/runtime/types.js";

const human: Author = { type: "human", id: "tester" };

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), "devloop-m5-"));
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
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty for no events", () => {
    const result = buildPrSummary([]);
    expect(result.block).toBe("");
    expect(result.hash).toBe("");
  });

  it("emits a workflow summary block with hash", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Test PR summary",
      author: human,
      cwd: dir,
    });
    const log = EventLog.fromCwd(dir);
    const wId = log.getActiveWorkflowId();
    if (!wId) throw new Error("expected workflow");
    const events = log.loadArchivedEvents(wId);
    const result = buildPrSummary(events);
    expect(result.block).toContain("## Workflow Summary");
    expect(result.block).toContain("**Type:** feature");
    expect(result.block).toContain("**Workflow ID:** " + wId);
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.block).toContain(`<!-- devloop-summary-hash: sha256:${result.hash} -->`);
  });

  it("hash is deterministic — same events produce same hash", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Determinism test",
      author: human,
      cwd: dir,
    });
    const log = EventLog.fromCwd(dir);
    const wId = log.getActiveWorkflowId();
    if (!wId) throw new Error("expected workflow");
    const events = log.loadArchivedEvents(wId);
    const r1 = buildPrSummary(events);
    const r2 = buildPrSummary(events);
    expect(r1.hash).toBe(r2.hash);
  });

  it("hash ignores non-commitable events (incidentals)", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Test",
      author: human,
      cwd: dir,
    });
    const log = EventLog.fromCwd(dir);
    const wId = log.getActiveWorkflowId();
    if (!wId) throw new Error("expected workflow");
    const eventsBefore = log.loadEvents(wId);
    const r1 = buildPrSummary(eventsBefore);

    recordIncidentalChange({
      filePath: "src/x.ts",
      linesChanged: 1,
      classifierReason: "imports",
      author: { type: "system", id: "h" },
      cwd: dir,
    });
    const eventsAfter = log.loadEvents(wId);
    const r2 = buildPrSummary(eventsAfter);
    // Incidentals are non-commitable; hash should not change.
    expect(r1.hash).toBe(r2.hash);
  });

  it("extractHashFromBlock returns the hash", () => {
    const block = `## Workflow Summary\nfoo\n<!-- devloop-summary-hash: sha256:${"a".repeat(64)} -->`;
    expect(extractHashFromBlock(block)).toBe("a".repeat(64));
  });

  it("extractHashFromBlock returns null when missing", () => {
    expect(extractHashFromBlock("foo bar")).toBeNull();
  });
});

describe("compactor", () => {
  let dir: string;

  beforeEach(() => {
    dir = setup();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not compact recent archives", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Recent",
      author: human,
      cwd: dir,
    });
    abandonWorkflow({ reason: "test", author: human, cwd: dir });

    const paths = devloopPaths(dir);
    const results = compactAllArchives({ archivesDir: paths.archivesDir, thresholdDays: 30 });
    expect(results.length).toBe(1);
    expect(results[0]?.summarized).toBe(false);
  });

  it("compacts archives older than threshold", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Old",
      author: human,
      cwd: dir,
    });
    abandonWorkflow({ reason: "test", author: human, cwd: dir });
    const paths = devloopPaths(dir);

    // Compact with threshold 0 → everything is past
    const results = compactAllArchives({
      archivesDir: paths.archivesDir,
      thresholdDays: 0,
      now: new Date(Date.now() + 86400000),
    });
    expect(results.length).toBe(1);
    expect(results[0]?.summarized).toBe(true);
    expect(results[0]?.preservedCount).toBeGreaterThan(0);
  });

  it("compaction is idempotent (already compacted archives are skipped)", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Old",
      author: human,
      cwd: dir,
    });
    abandonWorkflow({ reason: "test", author: human, cwd: dir });
    const paths = devloopPaths(dir);

    compactAllArchives({
      archivesDir: paths.archivesDir,
      thresholdDays: 0,
      now: new Date(Date.now() + 86400000),
    });
    const second = compactAllArchives({
      archivesDir: paths.archivesDir,
      thresholdDays: 0,
      now: new Date(Date.now() + 86400000),
    });
    expect(second[0]?.summarized).toBe(false);
    expect(second[0]?.reason).toContain("Already compacted");
  });

  it("preserves critical events in summary", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Critical",
      author: human,
      cwd: dir,
    });
    abandonWorkflow({ reason: "test", author: human, cwd: dir });
    const paths = devloopPaths(dir);
    compactAllArchives({
      archivesDir: paths.archivesDir,
      thresholdDays: 0,
      now: new Date(Date.now() + 86400000),
    });

    // Find the only archive directory
    const archivesDir = paths.archivesDir;
    const entries = readdirSync(archivesDir);
    const summaryFile = join(archivesDir, entries[0]!, "summary.json");
    expect(existsSync(summaryFile)).toBe(true);
    const summary = JSON.parse(readFileSync(summaryFile, "utf-8"));
    const types = (summary.preserved_events as Array<{ event_type: string }>).map(
      (e) => e.event_type,
    );
    expect(types).toContain("init");
    expect(types).toContain("workflow_abandoned");
  });
});

describe("replay", () => {
  let dir: string;

  beforeEach(() => {
    dir = setup();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("replays the entire log when no until is given", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Replay test",
      author: human,
      cwd: dir,
    });
    const log = EventLog.fromCwd(dir);
    const wId = log.getActiveWorkflowId();
    if (!wId) throw new Error("expected workflow");
    const events = log.loadArchivedEvents(wId);
    const result = replay(events);
    expect(result.events.length).toBe(events.length);
    expect(result.stoppedAt).toBeNull();
  });

  it("replays up to a specific event id", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Replay test",
      author: human,
      cwd: dir,
    });
    const log = EventLog.fromCwd(dir);
    const wId = log.getActiveWorkflowId();
    if (!wId) throw new Error("expected workflow");
    const events = log.loadEvents(wId);
    const firstEventId = events[0]?.event_id;
    if (!firstEventId) throw new Error("expected init event");
    const result = replay(events, { untilEventId: firstEventId });
    expect(result.events.length).toBe(1);
    expect(result.stoppedAt).toBe(firstEventId);
  });

  it("throws when until points to non-existent event", () => {
    runWorkflow({
      workflowType: "feature",
      task: "x",
      author: human,
      cwd: dir,
    });
    const log = EventLog.fromCwd(dir);
    const wId = log.getActiveWorkflowId();
    if (!wId) throw new Error("expected workflow");
    const events = log.loadEvents(wId);
    expect(() => replay(events, { untilEventId: "00000000-0000-4000-8000-000000000000" })).toThrow(
      "not found",
    );
  });

  it("throws on empty event list", () => {
    expect(() => replay([])).toThrow("Cannot replay empty");
  });
});
