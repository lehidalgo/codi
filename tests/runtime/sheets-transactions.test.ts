import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  atomicSyncDraft,
  restoreFromSnapshot,
  upsertRow,
  archiveRow,
  readTab,
  SheetsError,
  type ProjectConfig,
  type SheetsClient,
  type CellValue,
  type DraftEnvelope,
  type Snapshot,
} from "#src/runtime/sync/index.js";

// ─── In-memory Sheets client ─────────────────────────────────────────────────

interface InMemoryTab {
  header: string[];
  rows: CellValue[][];
}

function makeMemClient(initial: Record<string, InMemoryTab>): SheetsClient & {
  tabs: Record<string, InMemoryTab>;
  failOnTabAt?: { tab: string; rowMatch: RegExp };
} {
  const tabs: Record<string, InMemoryTab> = JSON.parse(JSON.stringify(initial));
  return {
    tabs,
    async readRange(_id, range) {
      const tabName = range.split("!")[0]?.replace(/'/g, "") ?? "";
      const tab = tabs[tabName];
      if (!tab) return { range, values: [] };
      return { range, values: [tab.header, ...tab.rows] };
    },
    async batchWrite(_id, request) {
      // Per-update: replace cells in target row index. Per-append: push to end.
      for (const u of request.updates) {
        const tabName = u.range.split("!")[0]?.replace(/'/g, "") ?? "";
        const tab = tabs[tabName];
        if (!tab) throw new SheetsError("sheet_unreachable", `unknown tab ${tabName}`);
        // Parse "A2:Z2" → row index 2 → tab.rows[0]
        const rowMatch = u.range.match(/!([A-Z]+)(\d+):/);
        const rowNum = rowMatch ? Number.parseInt(rowMatch[2]!, 10) : 0;
        if (rowNum >= 2) {
          const idx = rowNum - 2;
          for (let i = 0; i < (u.values[0]?.length ?? 0); i++) {
            const v = u.values[0]?.[i];
            if (v !== undefined) {
              tab.rows[idx] = tab.rows[idx] ?? [];
              tab.rows[idx]![i] = v;
            }
          }
        } else {
          // Whole-range write (header + rows): replace.
          tab.header = (u.values[0] ?? []).map((c) => String(c ?? ""));
          tab.rows = u.values.slice(1).map((r) => r.map((c) => c ?? ""));
        }
      }
      for (const a of request.appends) {
        const tabName = a.tabA1.split("!")[0]?.replace(/'/g, "") ?? "";
        const tab = tabs[tabName];
        if (!tab) {
          tabs[tabName] = { header: [], rows: [] };
        }
        for (const r of a.values) {
          tabs[tabName]!.rows.push(r.map((c) => c ?? ""));
        }
      }
    },
  };
}

const config: ProjectConfig = {
  project_name: "tx-test",
  sheet_id: "SHEET_TX",
  sheet_template_version: 1,
  created_at: "2026-05-02T00:00:00.000Z",
  created_by: "tester@local",
};

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "codi-tx-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

const BG_HEADER = [
  "id",
  "title",
  "outcome",
  "metric",
  "priority",
  "source_link",
  "status",
  "created_at",
  "_rev",
  "archived_at",
  "archived_by",
];
const REQ_HEADER = [
  "id",
  "type",
  "title",
  "behavior_or_threshold",
  "satisfies",
  "priority",
  "status",
  "created_at",
  "_rev",
  "archived_at",
  "archived_by",
];
const AUDIT_HEADER = ["event_id", "event_type", "entity_id", "actor", "timestamp", "payload_json"];

function freshSheet(): Record<string, InMemoryTab> {
  return {
    BusinessGoal: { header: [...BG_HEADER], rows: [] },
    Requirement: { header: [...REQ_HEADER], rows: [] },
    UserStory: { header: ["id", "status", "_rev", "archived_at", "archived_by"], rows: [] },
    Release: {
      header: ["id", "version", "released_at", "_rev", "archived_at", "archived_by"],
      rows: [],
    },
    Audit: { header: [...AUDIT_HEADER], rows: [] },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("transactions / atomicSyncDraft — happy path", () => {
  it("writes all rows + captures a snapshot, with auto-bumped _rev", async () => {
    const client = makeMemClient(freshSheet());
    const envelope: DraftEnvelope = {
      BusinessGoal: [
        { id: "BG-001", title: "lift", status: "proposed" },
        { id: "BG-002", title: "fast", status: "proposed" },
      ],
    };
    const result = await atomicSyncDraft({
      cwd,
      client,
      config,
      caller: "bootstrap",
      actor: "alice@local",
      envelope,
    });
    expect(result.failed).toBe(0);
    expect(result.rolled_back).toBe(false);
    expect(result.written).toBe(2);
    expect(result.snapshot_path).toBeDefined();
    // Both rows should have _rev=1 in the in-memory Sheet.
    expect(client.tabs.BusinessGoal!.rows[0]?.[8]).toBe(1);
    expect(client.tabs.BusinessGoal!.rows[1]?.[8]).toBe(1);
  });

  it("counts NO_OP correctly when re-syncing an unchanged row", async () => {
    const sheet = freshSheet();
    sheet.BusinessGoal!.rows.push([
      "BG-001",
      "lift",
      "",
      "",
      "",
      "",
      "proposed",
      "2026-05-02T00:00:00.000Z",
      3,
      "",
      "",
    ]);
    const client = makeMemClient(sheet);
    const envelope: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", title: "lift", status: "proposed" }],
    };
    const result = await atomicSyncDraft({
      cwd,
      client,
      config,
      caller: "bootstrap",
      actor: "alice@local",
      envelope,
    });
    expect(result.no_ops).toBe(1);
    expect(result.written).toBe(0);
  });
});

describe("transactions / archive intent flow", () => {
  it("flips status=abandoned + archived_at + archived_by when __intent: archive", async () => {
    const sheet = freshSheet();
    sheet.BusinessGoal!.rows.push([
      "BG-001",
      "old",
      "",
      "",
      "",
      "",
      "proposed",
      "2026-05-02T00:00:00.000Z",
      1,
      "",
      "",
    ]);
    const client = makeMemClient(sheet);
    const envelope: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-001", __intent: "archive", reason: "deferred" }],
    };
    const result = await atomicSyncDraft({
      cwd,
      client,
      config,
      caller: "bootstrap",
      actor: "alice@local",
      envelope,
    });
    expect(result.archived).toBe(1);
    expect(result.failed).toBe(0);
    const row = client.tabs.BusinessGoal!.rows[0];
    expect(row?.[6]).toBe("abandoned"); // status
    expect(row?.[9]).not.toBe(""); // archived_at populated
    expect(row?.[10]).toBe("alice@local"); // archived_by
  });

  it("treats archive on already-archived row as no-op", async () => {
    const sheet = freshSheet();
    sheet.BusinessGoal!.rows.push([
      "BG-001",
      "x",
      "",
      "",
      "",
      "",
      "abandoned",
      "2026-05-02T00:00:00.000Z",
      5,
      "2026-05-02T01:00:00.000Z",
      "alice@local",
    ]);
    const client = makeMemClient(sheet);
    const result = await atomicSyncDraft({
      cwd,
      client,
      config,
      caller: "bootstrap",
      actor: "bob@local",
      envelope: { BusinessGoal: [{ id: "BG-001", __intent: "archive" }] },
    });
    expect(result.archived).toBe(0);
    expect(result.no_ops).toBe(1);
  });
});

describe("transactions / OCC", () => {
  it("rejects update with stale _rev (rev_conflict)", async () => {
    const sheet = freshSheet();
    sheet.BusinessGoal!.rows.push([
      "BG-001",
      "current",
      "",
      "",
      "",
      "",
      "proposed",
      "2026-05-02T00:00:00.000Z",
      7,
      "",
      "",
    ]);
    const client = makeMemClient(sheet);
    await expect(
      upsertRow(
        "BusinessGoal",
        { id: "BG-001", _rev: 5, title: "stale" },
        {
          caller: "bootstrap",
          client,
          config,
          actor: "alice@local",
        },
      ),
    ).rejects.toMatchObject({ code: "rev_conflict" });
  });

  it("accepts update with matching _rev", async () => {
    const sheet = freshSheet();
    sheet.BusinessGoal!.rows.push([
      "BG-001",
      "current",
      "",
      "",
      "",
      "",
      "proposed",
      "2026-05-02T00:00:00.000Z",
      7,
      "",
      "",
    ]);
    const client = makeMemClient(sheet);
    const result = await upsertRow(
      "BusinessGoal",
      { id: "BG-001", _rev: 7, title: "fresh" },
      {
        caller: "bootstrap",
        client,
        config,
        actor: "alice@local",
      },
    );
    expect(result.was_no_op).toBe(false);
    // _rev should bump to 8.
    expect(client.tabs.BusinessGoal!.rows[0]?.[8]).toBe(8);
  });

  it("skips OCC entirely when _rev not in payload (back-compat)", async () => {
    const sheet = freshSheet();
    sheet.BusinessGoal!.rows.push([
      "BG-001",
      "x",
      "",
      "",
      "",
      "",
      "proposed",
      "2026-05-02T00:00:00.000Z",
      9,
      "",
      "",
    ]);
    const client = makeMemClient(sheet);
    const result = await upsertRow(
      "BusinessGoal",
      { id: "BG-001", title: "y" },
      {
        caller: "bootstrap",
        client,
        config,
        actor: "alice@local",
      },
    );
    expect(result.was_no_op).toBe(false);
    expect(client.tabs.BusinessGoal!.rows[0]?.[8]).toBe(10);
  });

  it("treats legacy row with no _rev cell as _rev=0; first write lands _rev=1", async () => {
    const sheet = freshSheet();
    // Pre-migration row: _rev cell absent (header has the column but row is shorter).
    sheet.BusinessGoal!.rows.push([
      "BG-099",
      "old",
      "",
      "",
      "",
      "",
      "proposed",
      "2026-05-02T00:00:00.000Z",
    ]);
    const client = makeMemClient(sheet);
    const result = await upsertRow(
      "BusinessGoal",
      { id: "BG-099", title: "now" },
      {
        caller: "bootstrap",
        client,
        config,
        actor: "alice@local",
      },
    );
    expect(result.was_no_op).toBe(false);
    expect(client.tabs.BusinessGoal!.rows[0]?.[8]).toBe(1);
  });
});

describe("transactions / archiveRow direct", () => {
  it("throws row_missing when archiving a nonexistent row", async () => {
    const client = makeMemClient(freshSheet());
    await expect(
      archiveRow("BusinessGoal", "BG-404", {
        caller: "bootstrap",
        client,
        config,
        actor: "alice@local",
      }),
    ).rejects.toMatchObject({ code: "row_missing" });
  });
});

describe("transactions / restoreFromSnapshot", () => {
  it("round-trips a snapshot back onto the Sheet", async () => {
    const client = makeMemClient(freshSheet());
    // Capture an empty Sheet snapshot.
    const snapshot: Snapshot = {
      version: 1,
      taken_at: "2026-05-02T00:00:00.000Z",
      taken_by: "tester@local",
      sheet_id: "SHEET_TX",
      project_name: "tx-test",
      tabs: {
        BusinessGoal: {
          rows: [{ id: "BG-RESTORED", title: "from snap", status: "proposed", _rev: 5 }],
          row_count: 1,
          taken_at: "2026-05-02T00:00:00.000Z",
        },
      },
    };
    const result = await restoreFromSnapshot(snapshot, { client, config });
    expect(result.restored_tabs).toContain("BusinessGoal");
    expect(result.total_rows).toBe(1);
    const tab = await readTab("BusinessGoal", { client, config });
    expect(tab.rows[0]?.["id"]).toBe("BG-RESTORED");
    expect(tab.rows[0]?.["title"]).toBe("from snap");
  });
});
