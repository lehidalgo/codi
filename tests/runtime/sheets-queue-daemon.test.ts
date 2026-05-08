/**
 * Tests for queue + daemon + reconcile (P5).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  enqueue,
  readPending,
  removeById,
  incrementAttempt,
  buildQueueId,
  drainOnce,
  reconcile,
  SheetsError,
  type QueuedSync,
  type SheetsClient,
  type ReadRangeResult,
  type BatchWriteRequest,
  type ProjectConfig,
  type CellValue,
} from "../lib/sheets/index.js";

class FakeClient implements SheetsClient {
  public readonly batchCalls: BatchWriteRequest[] = [];
  public failNextWrite: Error | null = null;
  private tabs = new Map<string, { header: string[]; rows: CellValue[][] }>();

  setTab(name: string, tab: { header: string[]; rows: CellValue[][] }): void {
    this.tabs.set(name, tab);
  }

  async readRange(_id: string, range: string): Promise<ReadRangeResult> {
    const tabName = range.split("!")[0] ?? "";
    const tab = this.tabs.get(tabName);
    if (!tab) return { range, values: [] };
    const out: CellValue[][] = [tab.header];
    for (const r of tab.rows) out.push(r);
    return { range, values: out };
  }

  async batchWrite(_id: string, request: BatchWriteRequest): Promise<void> {
    if (this.failNextWrite) {
      const err = this.failNextWrite;
      this.failNextWrite = null;
      throw err;
    }
    this.batchCalls.push(request);
    for (const a of request.appends) {
      const tabName = a.tabA1.split("!")[0] ?? "";
      let tab = this.tabs.get(tabName);
      if (!tab) {
        tab = { header: [], rows: [] };
        this.tabs.set(tabName, tab);
      }
      for (const row of a.values) tab.rows.push(row.slice() as CellValue[]);
    }
  }
}

const fixedConfig: ProjectConfig = {
  project_name: "test",
  sheet_id: "S",
  sheet_template_version: 1,
  created_at: "2026-05-02T00:00:00.000Z",
  created_by: "tester@local",
};

function freshClient(): FakeClient {
  const c = new FakeClient();
  c.setTab("UserStory", {
    header: [
      "id",
      "as_a",
      "i_want",
      "so_that",
      "acceptance_criteria",
      "priority",
      "assigned_to",
      "parent_story",
      "elaborated_from",
      "workflow_type",
      "branch",
      "commit_shas",
      "design_doc_path",
      "pr_url",
      "pr_state",
      "merged_sha",
      "merged_at",
      "started_at",
      "completed_at",
      "status",
      "created_at",
    ],
    rows: [],
  });
  c.setTab("Audit", {
    header: ["event_id", "event_type", "entity_id", "actor", "timestamp", "payload_json"],
    rows: [],
  });
  return c;
}

// ─── queue ───────────────────────────────────────────────────────────────────

describe("sheets/queue", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-queue-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  function makeRecord(id: string, rowId?: string): QueuedSync {
    return {
      queue_id: id,
      enqueued_at: "2026-05-02T00:00:00.000Z",
      attempts: 0,
      entity: "UserStory",
      row:
        rowId !== undefined
          ? { id: rowId, status: "in-progress", workflow_type: "feature" }
          : { status: "in-progress", workflow_type: "feature" },
      caller: "execution-only",
      actor: "tester@local",
    };
  }

  it("enqueue + readPending roundtrip", () => {
    enqueue(cwd, makeRecord("q1", "US-001"));
    enqueue(cwd, makeRecord("q2", "US-002"));
    const pending = readPending(cwd);
    expect(pending.length).toBe(2);
    expect(pending[0]?.queue_id).toBe("q1");
    expect(pending[1]?.queue_id).toBe("q2");
  });

  it("readPending returns empty when file missing", () => {
    expect(readPending(cwd)).toEqual([]);
  });

  it("removeById removes the matching record", () => {
    enqueue(cwd, makeRecord("q1", "US-001"));
    enqueue(cwd, makeRecord("q2", "US-002"));
    removeById(cwd, "q1");
    const pending = readPending(cwd);
    expect(pending.length).toBe(1);
    expect(pending[0]?.queue_id).toBe("q2");
  });

  it("incrementAttempt bumps the counter", () => {
    enqueue(cwd, makeRecord("q1", "US-001"));
    incrementAttempt(cwd, "q1");
    incrementAttempt(cwd, "q1");
    const pending = readPending(cwd);
    expect(pending[0]?.attempts).toBe(2);
  });

  it("buildQueueId is deterministic-ish per row id", () => {
    const id1 = buildQueueId("UserStory", { id: "US-001" });
    const id2 = buildQueueId("UserStory", { id: "US-001" });
    expect(id1.startsWith("q_UserStory_US-001_")).toBe(true);
    expect(id2.startsWith("q_UserStory_US-001_")).toBe(true);
    // suffix differs (random) — that's by design
    expect(id1).not.toEqual(id2);
  });

  it("malformed lines are skipped", () => {
    const path = join(cwd, ".devloop/sheets-queue.jsonl");
    mkdirSync(join(cwd, ".devloop"));
    writeFileSync(
      path,
      JSON.stringify(makeRecord("q1", "US-001")) +
        "\n{not json\n" +
        JSON.stringify(makeRecord("q2", "US-002")) +
        "\n",
    );
    const pending = readPending(cwd);
    expect(pending.length).toBe(2);
  });
});

// ─── daemon.drainOnce ────────────────────────────────────────────────────────

describe("sheets/daemon — drainOnce", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-daemon-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("flushes a pending record on success", async () => {
    enqueue(cwd, {
      queue_id: "q1",
      enqueued_at: "2026-05-02T00:00:00.000Z",
      attempts: 0,
      entity: "UserStory",
      row: { id: "US-001", status: "in-progress", workflow_type: "feature" },
      caller: "execution-only",
      actor: "tester@local",
    });
    const client = freshClient();
    const result = await drainOnce({
      cwd,
      client,
      config: fixedConfig,
      log: () => undefined,
    });
    expect(result.flushed).toBe(1);
    expect(result.attempted).toBe(1);
    expect(readPending(cwd).length).toBe(0);
  });

  it("retries on sheet_unreachable until budget exhausted", async () => {
    enqueue(cwd, {
      queue_id: "q1",
      enqueued_at: "2026-05-02T00:00:00.000Z",
      attempts: 0,
      entity: "UserStory",
      row: { id: "US-002", status: "in-progress", workflow_type: "feature" },
      caller: "execution-only",
      actor: "tester@local",
    });
    const client = freshClient();
    client.failNextWrite = new SheetsError("sheet_unreachable", "503", {});
    // Pass 1: one retry, attempt count → 1, still queued
    const r1 = await drainOnce({
      cwd,
      client,
      config: fixedConfig,
      maxAttempts: 2,
      log: () => undefined,
    });
    expect(r1.retried).toBe(1);
    expect(readPending(cwd)[0]?.attempts).toBe(1);

    client.failNextWrite = new SheetsError("sheet_unreachable", "503", {});
    // Pass 2: attempts+1=2 reaches budget=2 → permanently failed
    const r2 = await drainOnce({
      cwd,
      client,
      config: fixedConfig,
      maxAttempts: 2,
      log: () => undefined,
    });
    expect(r2.permanently_failed).toBe(1);
    expect(readPending(cwd).length).toBe(0);
  });

  it("drops record on non-transient error (zone_violation)", async () => {
    // Caller=execution-only writing a planning column → zone_violation.
    enqueue(cwd, {
      queue_id: "q1",
      enqueued_at: "2026-05-02T00:00:00.000Z",
      attempts: 0,
      entity: "UserStory",
      row: { id: "US-003", acceptance_criteria: "evil overwrite" },
      caller: "execution-only",
      actor: "tester@local",
    });
    const client = freshClient();
    const result = await drainOnce({
      cwd,
      client,
      config: fixedConfig,
      log: () => undefined,
    });
    expect(result.permanently_failed).toBe(1);
    expect(readPending(cwd).length).toBe(0);
  });

  it("returns zeros when queue is empty", async () => {
    const client = freshClient();
    const result = await drainOnce({ cwd, client, config: fixedConfig, log: () => undefined });
    expect(result.attempted).toBe(0);
    expect(result.flushed).toBe(0);
  });
});

// ─── reconcile ───────────────────────────────────────────────────────────────

describe("sheets/reconcile", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sheets-reconcile-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  function writeWorkflow(
    workflowId: string,
    events: ReadonlyArray<{
      event_type: string;
      payload: Record<string, unknown>;
      timestamp?: string;
    }>,
  ) {
    const dir = join(cwd, ".workflow", "archives", workflowId);
    mkdirSync(dir, { recursive: true });
    events.forEach((ev, idx) => {
      const filename = `${String(idx).padStart(3, "0")}_${ev.event_type}.json`;
      writeFileSync(
        join(dir, filename),
        JSON.stringify({
          timestamp: ev.timestamp ?? "2026-05-02T12:00:00.000Z",
          ...ev,
        }),
      );
    });
  }

  it("derives delivered status from workflow_completed and upserts to Sheet", async () => {
    writeWorkflow("feat-x-20260502", [
      {
        event_type: "init",
        payload: {
          workflow_id: "feat-x",
          workflow_type: "feature",
          task: "x",
          plugin_version: "0.1.0",
          from_story_id: "US-014",
        },
        timestamp: "2026-05-02T10:00:00.000Z",
      },
      {
        event_type: "phase_started",
        payload: { phase: "intent" },
        timestamp: "2026-05-02T10:00:01.000Z",
      },
      {
        event_type: "design_doc_authored",
        payload: { design_doc_path: "docs/[PLAN]_x.md", story_id: "US-014" },
      },
      {
        event_type: "workflow_completed",
        payload: { duration_ms: 1000 },
        timestamp: "2026-05-02T15:00:00.000Z",
      },
    ]);
    const client = freshClient();
    const result = await reconcile({ cwd, client, config: fixedConfig, actor: "tester@local" });
    expect(result.rows_reconciled).toBe(1);
    expect(client.batchCalls.length).toBe(1);
  });

  it("ignores workflows with no from_story_id", async () => {
    writeWorkflow("feat-y-20260502", [
      {
        event_type: "init",
        payload: {
          workflow_id: "feat-y",
          workflow_type: "feature",
          task: "y",
          plugin_version: "0.1.0",
        },
      },
      { event_type: "workflow_completed", payload: { duration_ms: 100 } },
    ]);
    const client = freshClient();
    const result = await reconcile({ cwd, client, config: fixedConfig, actor: "tester@local" });
    expect(result.rows_reconciled).toBe(0);
  });

  it("is idempotent — second run is a no-op when state hasn't changed", async () => {
    writeWorkflow("feat-z-20260502", [
      {
        event_type: "init",
        payload: {
          workflow_id: "feat-z",
          workflow_type: "feature",
          task: "z",
          plugin_version: "0.1.0",
          from_story_id: "US-021",
        },
        timestamp: "2026-05-02T10:00:00.000Z",
      },
      {
        event_type: "workflow_completed",
        payload: { duration_ms: 1 },
        timestamp: "2026-05-02T11:00:00.000Z",
      },
    ]);
    const client = freshClient();
    const r1 = await reconcile({ cwd, client, config: fixedConfig, actor: "tester@local" });
    expect(r1.rows_reconciled).toBe(1);
    const r2 = await reconcile({ cwd, client, config: fixedConfig, actor: "tester@local" });
    expect(r2.rows_no_op).toBe(1);
    expect(r2.rows_reconciled).toBe(0);
  });

  it("returns zero when archives dir is missing", async () => {
    const client = freshClient();
    const result = await reconcile({ cwd, client, config: fixedConfig, actor: "tester@local" });
    expect(result.rows_reconciled).toBe(0);
    // sanity: existsSync confirms we did not implicitly create the dir
    expect(existsSync(join(cwd, ".workflow", "archives"))).toBe(false);
    // suppress unused readFileSync warning
    void readFileSync;
  });
});
