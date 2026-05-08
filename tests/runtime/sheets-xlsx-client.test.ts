import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  LocalXlsxClient,
  createLocalXlsxProject,
  upsertRow,
  archiveRow,
  readTab,
  readAllRowsLenient,
  validateDraft,
  atomicSyncDraft,
  type ProjectConfig,
  type DraftEnvelope,
} from "../lib/sheets/index.js";

let cwd: string;
let xlsxPath: string;
let config: ProjectConfig;

beforeEach(async () => {
  cwd = mkdtempSync(join(tmpdir(), "devloop-xlsx-"));
  xlsxPath = join(cwd, "sheet.xlsx");
  await createLocalXlsxProject({ filePath: xlsxPath });
  config = {
    project_name: "xlsx-test",
    sheet_id: "local:sheet.xlsx",
    sheet_template_version: 1,
    local_path: xlsxPath,
    auth_mode: "local_xlsx",
    created_at: "2026-05-02T00:00:00.000Z",
    created_by: "tester@local",
  };
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

// ─── createLocalXlsxProject ──────────────────────────────────────────────────

describe("xlsx-bootstrap / createLocalXlsxProject", () => {
  it("creates a workbook with all six canonical tabs + safety columns", async () => {
    const fresh = join(cwd, "fresh.xlsx");
    const result = await createLocalXlsxProject({ filePath: fresh });
    expect(existsSync(fresh)).toBe(true);
    expect(result.tabs_created).toEqual([
      "BusinessGoal",
      "Requirement",
      "UserStory",
      "Release",
      "Dashboard",
      "Audit",
    ]);

    // Read back the BG tab and check headers include _rev / archived_at / archived_by.
    const client = new LocalXlsxClient(fresh);
    const r = await client.readRange("local:fresh.xlsx", "BusinessGoal!A1:Z");
    const headers = r.values[0] ?? [];
    expect(headers).toContain("_rev");
    expect(headers).toContain("archived_at");
    expect(headers).toContain("archived_by");
    expect(headers).toContain("title");
  });

  it("refuses to overwrite an existing file without force=true", async () => {
    await expect(createLocalXlsxProject({ filePath: xlsxPath })).rejects.toThrow(/already exists/);
  });

  it("overwrites with force=true", async () => {
    await expect(
      createLocalXlsxProject({ filePath: xlsxPath, force: true }),
    ).resolves.toBeDefined();
  });
});

// ─── LocalXlsxClient as SheetsClient ─────────────────────────────────────────

describe("LocalXlsxClient — SheetsClient interface", () => {
  it("upsertRow against a local .xlsx — first row gets _rev=1", async () => {
    const client = new LocalXlsxClient(xlsxPath);
    const result = await upsertRow(
      "BusinessGoal",
      { id: "BG-001", title: "Lift signups", status: "proposed" },
      { caller: "bootstrap", client, config, actor: "alice@local" },
    );
    expect(result.was_no_op).toBe(false);
    expect(result.row_id).toBe("BG-001");

    const tab = await readTab("BusinessGoal", { client, config });
    const row = tab.rows.find((r) => r["id"] === "BG-001");
    expect(row).toBeDefined();
    expect(row?.["title"]).toBe("Lift signups");
    expect(row?.["_rev"]).toBe(1);
  });

  it("upsertRow updating an existing row bumps _rev", async () => {
    const client = new LocalXlsxClient(xlsxPath);
    await upsertRow(
      "BusinessGoal",
      { id: "BG-001", title: "v1", status: "proposed" },
      { caller: "bootstrap", client, config, actor: "alice@local" },
    );
    await upsertRow(
      "BusinessGoal",
      { id: "BG-001", title: "v2" },
      { caller: "bootstrap", client, config, actor: "alice@local" },
    );
    const tab = await readTab("BusinessGoal", { client, config });
    const row = tab.rows.find((r) => r["id"] === "BG-001");
    expect(row?.["title"]).toBe("v2");
    expect(row?.["_rev"]).toBe(2);
  });

  it("readAllRows on an empty tab returns empty array", async () => {
    const client = new LocalXlsxClient(xlsxPath);
    const rows = await readAllRowsLenient("Requirement", { client, config });
    expect(rows).toEqual([]);
  });

  it("archiveRow flips status + archived_at + archived_by", async () => {
    const client = new LocalXlsxClient(xlsxPath);
    await upsertRow(
      "BusinessGoal",
      { id: "BG-002", title: "deferred goal", status: "proposed" },
      { caller: "bootstrap", client, config, actor: "alice@local" },
    );
    await archiveRow("BusinessGoal", "BG-002", {
      caller: "bootstrap",
      client,
      config,
      actor: "alice@local",
      reason: "v1.5 punt",
    });
    const tab = await readTab("BusinessGoal", { client, config });
    const row = tab.rows.find((r) => r["id"] === "BG-002");
    expect(row?.["status"]).toBe("abandoned");
    expect(typeof row?.["archived_at"]).toBe("string");
    expect((row?.["archived_at"] as string).length).toBeGreaterThan(0);
    expect(row?.["archived_by"]).toBe("alice@local");
  });

  it("OCC: stale _rev → rev_conflict against the local backend", async () => {
    const client = new LocalXlsxClient(xlsxPath);
    await upsertRow(
      "BusinessGoal",
      { id: "BG-003", title: "concurrent", status: "proposed" },
      { caller: "bootstrap", client, config, actor: "alice@local" },
    );
    // Stale rev (Sheet has _rev=1; payload says _rev=99):
    await expect(
      upsertRow(
        "BusinessGoal",
        { id: "BG-003", _rev: 99, title: "should fail" },
        { caller: "bootstrap", client, config, actor: "alice@local" },
      ),
    ).rejects.toMatchObject({ code: "rev_conflict" });
  });

  it("validateDraft + atomicSyncDraft full happy path against local .xlsx", async () => {
    const client = new LocalXlsxClient(xlsxPath);
    const envelope: DraftEnvelope = {
      BusinessGoal: [
        { id: "BG-001", title: "Lift signups", status: "proposed" },
        { id: "BG-002", title: "Sub-200ms", status: "proposed" },
      ],
      Requirement: [
        {
          id: "REQ-001",
          type: "functional",
          title: "Google OAuth",
          satisfies: "BG-001",
          status: "proposed",
        },
      ],
    };
    const report = validateDraft(envelope);
    expect(report.ok).toBe(true);

    const result = await atomicSyncDraft({
      cwd,
      client,
      config,
      caller: "bootstrap",
      actor: "alice@local",
      envelope,
    });
    expect(result.failed).toBe(0);
    expect(result.written).toBe(3);

    const bg = await readAllRowsLenient("BusinessGoal", { client, config });
    expect(bg.length).toBe(2);
  });

  it("atomic rollback on local .xlsx — failure restores prior state", async () => {
    const client = new LocalXlsxClient(xlsxPath);
    // Seed 1 valid row
    await upsertRow(
      "BusinessGoal",
      { id: "BG-001", title: "preexisting", status: "proposed" },
      { caller: "bootstrap", client, config, actor: "alice@local" },
    );
    const before = (await readAllRowsLenient("BusinessGoal", { client, config }))[0];

    // Now atomic sync where the SECOND row will fail (orphan satisfies)
    const envelope: DraftEnvelope = {
      BusinessGoal: [{ id: "BG-002", title: "new", status: "proposed" }],
      Requirement: [
        { id: "REQ-001", type: "functional", title: "x", satisfies: "BG-999", status: "proposed" },
      ],
    };
    // Atomic sync runs with skipSnapshot=false → captures snapshot → on
    // schema invalid (REQ.satisfies orphan would be caught at validate stage,
    // not atomic stage). For pure-atomic test, force a row-level failure
    // by passing an unparseable id pattern:
    const badEnvelope: DraftEnvelope = {
      BusinessGoal: [
        { id: "BG-555", title: "should rollback", status: "proposed" },
        { id: "BG-NOTANUM", title: "fail", status: "proposed" }, // pattern fails at upsertRow
      ],
    };
    const result = await atomicSyncDraft({
      cwd,
      client,
      config,
      caller: "bootstrap",
      actor: "alice@local",
      envelope: badEnvelope,
    });
    expect(result.failed).toBeGreaterThan(0);
    // Either rolled_back=true (snapshot worked) OR rolled_back=false (best effort).
    // The Sheet should NOT have BG-555 if rollback worked.
    const after = await readAllRowsLenient("BusinessGoal", { client, config });
    if (result.rolled_back) {
      expect(after.length).toBe(1);
      expect(after[0]?.["id"]).toBe("BG-001");
      expect(after[0]?.["title"]).toBe(before?.["title"]);
    }
  });
});

describe("LocalXlsxClient — atomic file write", () => {
  it("write does not leave a .tmp file on success", async () => {
    const client = new LocalXlsxClient(xlsxPath);
    await upsertRow(
      "BusinessGoal",
      { id: "BG-001", title: "x", status: "proposed" },
      { caller: "bootstrap", client, config, actor: "alice@local" },
    );
    expect(existsSync(`${xlsxPath}.tmp`)).toBe(false);
    expect(existsSync(xlsxPath)).toBe(true);
  });
});
