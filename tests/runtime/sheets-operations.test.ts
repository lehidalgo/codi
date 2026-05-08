/**
 * Operations tests with an in-memory FakeSheetsClient.
 */

import { describe, it, expect } from "vitest";

import {
  SheetsError,
  upsertRow,
  readRow,
  readAllRows,
  type SheetsClient,
  type ReadRangeResult,
  type BatchWriteRequest,
  type ProjectConfig,
  type CellValue,
} from "#src/runtime/sync/index.js";

interface FakeTab {
  header: string[];
  rows: CellValue[][];
}

class FakeSheetsClient implements SheetsClient {
  private tabs: Map<string, FakeTab> = new Map();
  public readonly batchCalls: BatchWriteRequest[] = [];
  public failNextWrite: Error | null = null;

  setTab(name: string, tab: FakeTab): void {
    this.tabs.set(name, tab);
  }

  getTab(name: string): FakeTab | undefined {
    return this.tabs.get(name);
  }

  async readRange(_spreadsheetId: string, range: string): Promise<ReadRangeResult> {
    const tabName = range.split("!")[0] ?? "";
    const tab = this.tabs.get(tabName);
    if (!tab) return { range, values: [] };
    const out: CellValue[][] = [];
    out.push(tab.header);
    for (const row of tab.rows) out.push(row);
    return { range, values: out };
  }

  async batchWrite(_spreadsheetId: string, request: BatchWriteRequest): Promise<void> {
    if (this.failNextWrite) {
      const err = this.failNextWrite;
      this.failNextWrite = null;
      throw err;
    }
    this.batchCalls.push(request);
    for (const u of request.updates) {
      const tabName = u.range.split("!")[0] ?? "";
      const tab = this.tabs.get(tabName);
      if (!tab) continue;
      const match = u.range.match(/!A(\d+):/);
      const rowIdx = match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
      if (!Number.isFinite(rowIdx) || rowIdx < 2) continue;
      const dataIdx = rowIdx - 2;
      while (tab.rows.length <= dataIdx) tab.rows.push([]);
      tab.rows[dataIdx] = (u.values[0] ?? []).slice() as CellValue[];
    }
    for (const a of request.appends) {
      const tabName = a.tabA1.split("!")[0] ?? "";
      let tab = this.tabs.get(tabName);
      if (!tab) {
        tab = { header: [], rows: [] };
        this.tabs.set(tabName, tab);
      }
      for (const row of a.values) {
        tab.rows.push(row.slice() as CellValue[]);
      }
    }
  }
}

const fixedConfig: ProjectConfig = {
  project_name: "test-project",
  sheet_id: "TEST_SHEET_ID",
  sheet_template_version: 1,
  created_at: "2026-05-02T00:00:00.000Z",
  created_by: "tester@local",
};

const fixedNow = () => new Date("2026-05-02T12:00:00.000Z");

function freshClient(): FakeSheetsClient {
  const c = new FakeSheetsClient();
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

describe("sheets/operations — upsertRow", () => {
  it("inserts a new row with assigned id when id absent", async () => {
    const client = freshClient();
    const result = await upsertRow(
      "UserStory",
      { status: "in-progress", branch: "feat/x", workflow_type: "feature" },
      {
        caller: "execution-only",
        client,
        config: fixedConfig,
        actor: "tester@local",
        now: fixedNow,
      },
    );
    expect(result.row_id).toBe("US-001");
    expect(result.was_no_op).toBe(false);
    expect(client.batchCalls.length).toBe(1);
    expect(client.batchCalls[0]?.appends.length).toBe(2);
  });

  it("updates an existing row by id", async () => {
    const client = freshClient();
    await upsertRow(
      "UserStory",
      { id: "US-014", status: "in-progress", branch: "feat/x", workflow_type: "feature" },
      {
        caller: "execution-only",
        client,
        config: fixedConfig,
        actor: "tester@local",
        now: fixedNow,
      },
    );
    const result = await upsertRow(
      "UserStory",
      { id: "US-014", status: "in-review" },
      {
        caller: "execution-only",
        client,
        config: fixedConfig,
        actor: "tester@local",
        now: fixedNow,
      },
    );
    expect(result.row_id).toBe("US-014");
    expect(result.columns_written).toContain("status");
    expect(result.was_no_op).toBe(false);
  });

  it("is idempotent — repeat upsert with same data is a no-op", async () => {
    const client = freshClient();
    await upsertRow(
      "UserStory",
      { id: "US-007", status: "in-progress", workflow_type: "feature" },
      {
        caller: "execution-only",
        client,
        config: fixedConfig,
        actor: "tester@local",
        now: fixedNow,
      },
    );
    const before = client.batchCalls.length;
    const result = await upsertRow(
      "UserStory",
      { id: "US-007", status: "in-progress", workflow_type: "feature" },
      {
        caller: "execution-only",
        client,
        config: fixedConfig,
        actor: "tester@local",
        now: fixedNow,
      },
    );
    expect(result.was_no_op).toBe(true);
    expect(client.batchCalls.length).toBe(before);
  });

  it("rejects planning-column write from execution-only caller (zone_violation)", async () => {
    const client = freshClient();
    try {
      await upsertRow(
        "UserStory",
        { id: "US-001", acceptance_criteria: "evil overwrite" },
        {
          caller: "execution-only",
          client,
          config: fixedConfig,
          actor: "tester@local",
          now: fixedNow,
        },
      );
      expect.fail("expected zone_violation");
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsError);
      expect((e as SheetsError).code).toBe("zone_violation");
    }
    expect(client.batchCalls.length).toBe(0);
  });

  it("allows planning-column write from bootstrap caller", async () => {
    const client = freshClient();
    const result = await upsertRow(
      "UserStory",
      {
        id: "US-001",
        as_a: "user",
        i_want: "x",
        so_that: "y",
        acceptance_criteria: "z",
        priority: "P1",
      },
      { caller: "bootstrap", client, config: fixedConfig, actor: "tester@local", now: fixedNow },
    );
    expect(result.was_no_op).toBe(false);
    expect(client.batchCalls.length).toBe(1);
  });

  it("appends an Audit row on every write", async () => {
    const client = freshClient();
    await upsertRow(
      "UserStory",
      { id: "US-001", status: "in-progress", workflow_type: "feature" },
      {
        caller: "execution-only",
        client,
        config: fixedConfig,
        actor: "tester@local",
        now: fixedNow,
      },
    );
    const auditTab = client.getTab("Audit");
    expect(auditTab).toBeDefined();
    expect(auditTab?.rows.length).toBeGreaterThanOrEqual(1);
    expect(auditTab?.rows[0]?.[3]).toBe("tester@local");
  });

  it("propagates sheet_unreachable on transient client error", async () => {
    const client = freshClient();
    client.failNextWrite = new SheetsError("sheet_unreachable", "503 Service Unavailable", {});
    try {
      await upsertRow(
        "UserStory",
        { id: "US-009", status: "in-progress", workflow_type: "feature" },
        {
          caller: "execution-only",
          client,
          config: fixedConfig,
          actor: "tester@local",
          now: fixedNow,
        },
      );
      expect.fail("expected sheet_unreachable");
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsError);
      expect((e as SheetsError).code).toBe("sheet_unreachable");
    }
  });
});

describe("sheets/operations — readRow / readAllRows", () => {
  it("readRow returns null when not found", async () => {
    const client = new FakeSheetsClient();
    client.setTab("UserStory", { header: ["id", "status"], rows: [] });
    const r = await readRow("UserStory", "US-999", { client, config: fixedConfig });
    expect(r).toBeNull();
  });

  it("readRow throws on invalid id pattern", async () => {
    const client = freshClient();
    await expect(
      readRow("UserStory", "US-XXX", { client, config: fixedConfig }),
    ).rejects.toThrowError(SheetsError);
  });

  it("readAllRows returns empty for empty tab", async () => {
    const client = new FakeSheetsClient();
    client.setTab("UserStory", { header: ["id", "status"], rows: [] });
    const rows = await readAllRows("UserStory", { client, config: fixedConfig });
    expect(rows).toEqual([]);
  });

  it("readAllRows returns parsed rows", async () => {
    const client = new FakeSheetsClient();
    client.setTab("UserStory", {
      header: ["id", "status"],
      rows: [
        ["US-001", "delivered"],
        ["US-002", "in-progress"],
      ],
    });
    const rows = await readAllRows("UserStory", { client, config: fixedConfig });
    expect(rows.length).toBe(2);
    expect(rows[0]?.["id"]).toBe("US-001");
    expect(rows[1]?.["status"]).toBe("in-progress");
  });
});
