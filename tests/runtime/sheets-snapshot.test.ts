import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  statSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  SNAPSHOT_VERSION,
  SNAPSHOT_DIR_RELATIVE,
  DEFAULT_SNAPSHOT_RETENTION,
  captureSnapshot,
  readSnapshot,
  listSnapshots,
  pruneSnapshots,
  snapshotFilename,
  type ProjectConfig,
  type SheetsClient,
} from "#src/runtime/sync/index.js";

// ─── Fake SheetsClient ───────────────────────────────────────────────────────

function makeFakeClient(
  tabRows: Record<string, ReadonlyArray<ReadonlyArray<string>>>,
): SheetsClient {
  return {
    async readRange(_sheetId: string, range: string) {
      const tabName = range.split("!")[0]?.replace(/'/g, "") ?? "";
      const rows = tabRows[tabName] ?? [];
      return { range, values: rows.map((r) => [...r]) };
    },
    async batchWrite() {
      // void
    },
  };
}

const config: ProjectConfig = {
  project_name: "snap-test",
  sheet_id: "SHEET_ABC",
  sheet_template_version: 1,
  created_at: "2026-05-02T00:00:00.000Z",
  created_by: "tester@local",
};

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "codi-snapshot-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("snapshot / captureSnapshot", () => {
  it("writes a JSON file at .codi/snapshots/<ts>[_label].json with all 5 tabs", async () => {
    const client = makeFakeClient({
      BusinessGoal: [
        ["id", "title", "status"],
        ["BG-001", "lift", "proposed"],
      ],
      Requirement: [
        ["id", "type", "title", "satisfies", "status"],
        ["REQ-001", "functional", "x", "BG-001", "proposed"],
      ],
      UserStory: [
        ["id", "status"],
        ["US-001", "backlog"],
      ],
      Release: [["id", "version", "released_at"]],
      Audit: [["event_id", "event_type", "actor", "timestamp"]],
    });
    const result = await captureSnapshot({
      cwd,
      client,
      config,
      taken_by: "alice@local",
      label: "pre-sync-discover",
      now: () => new Date("2026-05-02T19:00:00.000Z"),
    });

    expect(result.path).toContain(SNAPSHOT_DIR_RELATIVE);
    expect(result.path).toMatch(/20260502_190000_pre-sync-discover\.json$/);

    const snap = JSON.parse(readFileSync(result.path, "utf8"));
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.taken_by).toBe("alice@local");
    expect(snap.sheet_id).toBe("SHEET_ABC");
    expect(snap.label).toBe("pre-sync-discover");
    expect(snap.tabs.BusinessGoal.row_count).toBe(1);
    expect(snap.tabs.Requirement.row_count).toBe(1);
    expect(snap.tabs.UserStory.row_count).toBe(1);
  });

  it("captures an empty Sheet (all tabs present with row_count=0)", async () => {
    const client = makeFakeClient({
      BusinessGoal: [["id", "title", "status"]],
      Requirement: [["id", "type", "title", "satisfies", "status"]],
      UserStory: [["id", "status"]],
      Release: [["id", "version", "released_at"]],
      Audit: [["event_id", "event_type", "actor", "timestamp"]],
    });
    const result = await captureSnapshot({
      cwd,
      client,
      config,
      taken_by: "alice@local",
      now: () => new Date("2026-05-02T20:00:00.000Z"),
    });
    expect(result.snapshot.tabs.BusinessGoal?.row_count).toBe(0);
    expect(result.snapshot.tabs.UserStory?.row_count).toBe(0);
  });

  it("respects the entities option (only captures BG, skips others)", async () => {
    const client = makeFakeClient({
      BusinessGoal: [
        ["id", "title", "status"],
        ["BG-001", "x", "proposed"],
      ],
      Requirement: [
        ["id", "type", "title", "satisfies", "status"],
        ["REQ-001", "functional", "x", "BG-001", "proposed"],
      ],
    });
    const result = await captureSnapshot({
      cwd,
      client,
      config,
      taken_by: "alice@local",
      entities: ["BusinessGoal"],
    });
    expect(result.snapshot.tabs.BusinessGoal).toBeDefined();
    expect(result.snapshot.tabs.Requirement).toBeUndefined();
  });
});

describe("snapshot / readSnapshot", () => {
  it("round-trips a captured snapshot", async () => {
    const client = makeFakeClient({
      BusinessGoal: [
        ["id", "title", "status"],
        ["BG-001", "lift", "proposed"],
      ],
    });
    const { path } = await captureSnapshot({
      cwd,
      client,
      config,
      taken_by: "alice@local",
      entities: ["BusinessGoal"],
    });
    const snap = readSnapshot(path);
    expect(snap.tabs.BusinessGoal?.rows[0]?.id).toBe("BG-001");
  });

  it("rejects a JSON file with wrong version", () => {
    const dir = join(cwd, SNAPSHOT_DIR_RELATIVE);
    mkdirSync(dir, { recursive: true });
    const p = join(dir, "20260502_000000_bad.json");
    writeFileSync(
      p,
      JSON.stringify({ version: 999, taken_at: "x", taken_by: "y", sheet_id: "z", tabs: {} }),
    );
    expect(() => readSnapshot(p)).toThrow(/version mismatch/);
  });

  it("rejects malformed JSON", () => {
    const dir = join(cwd, SNAPSHOT_DIR_RELATIVE);
    mkdirSync(dir, { recursive: true });
    const p = join(dir, "20260502_000000_bad.json");
    writeFileSync(p, "{ not valid");
    expect(() => readSnapshot(p)).toThrow(/not valid JSON/);
  });
});

describe("snapshot / listSnapshots", () => {
  it("returns empty array when dir does not exist", async () => {
    const entries = await listSnapshots(cwd);
    expect(entries).toEqual([]);
  });

  it("lists snapshots newest-first", async () => {
    const dir = join(cwd, SNAPSHOT_DIR_RELATIVE);
    mkdirSync(dir, { recursive: true });
    const files = ["a.json", "b.json", "c.json"];
    for (const f of files) writeFileSync(join(dir, f), "{}");
    // make A older, C newest
    const now = Date.now() / 1000;
    utimesSync(join(dir, "a.json"), now - 30, now - 30);
    utimesSync(join(dir, "b.json"), now - 15, now - 15);
    utimesSync(join(dir, "c.json"), now, now);

    const entries = await listSnapshots(cwd);
    expect(entries.map((e) => e.filename)).toEqual(["c.json", "b.json", "a.json"]);
  });
});

describe("snapshot / pruneSnapshots", () => {
  it("keeps the N most-recent and removes older", async () => {
    const dir = join(cwd, SNAPSHOT_DIR_RELATIVE);
    mkdirSync(dir, { recursive: true });
    const now = Date.now() / 1000;
    for (let i = 0; i < 5; i++) {
      const p = join(dir, `f${i}.json`);
      writeFileSync(p, "{}");
      utimesSync(p, now - (5 - i) * 10, now - (5 - i) * 10);
    }
    const removed = await pruneSnapshots(cwd, 2);
    expect(removed.length).toBe(3);
    const remaining = await listSnapshots(cwd);
    expect(remaining.map((e) => e.filename)).toEqual(["f4.json", "f3.json"]);
  });

  it("is a no-op when count <= keep", async () => {
    const dir = join(cwd, SNAPSHOT_DIR_RELATIVE);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "f.json"), "{}");
    const removed = await pruneSnapshots(cwd, DEFAULT_SNAPSHOT_RETENTION);
    expect(removed).toEqual([]);
  });
});

describe("snapshot / snapshotFilename", () => {
  it("formats with UTC timestamp + sanitized label", () => {
    const f = snapshotFilename(new Date("2026-05-02T19:30:45.000Z"), "Pre-Sync DISCOVER!!");
    expect(f).toBe("20260502_193045_pre-sync-discover.json");
  });

  it("omits label when empty", () => {
    const f = snapshotFilename(new Date("2026-05-02T19:30:45.000Z"));
    expect(f).toBe("20260502_193045.json");
  });
});
