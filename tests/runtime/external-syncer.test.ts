/**
 * ExternalSyncer interface contract + registry (Sprint 2 proper).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import { SyncerRegistry } from "#src/runtime/sync/external-syncer.js";
import { SheetsSyncer } from "#src/runtime/sync/sheets-syncer.js";
import { XlsxSyncer } from "#src/runtime/sync/xlsx-syncer.js";

function tmpBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-syncer-"));
  const handle = openBrain({ dbPath: join(dir, "brain.db") });
  applyMigrations(handle.raw);
  return {
    handle,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("SyncerRegistry", () => {
  it("registers and looks up adapters by kind", () => {
    const reg = new SyncerRegistry();
    reg.register(new SheetsSyncer());
    reg.register(new XlsxSyncer());
    expect(reg.kinds().sort()).toEqual(["sheets", "xlsx"]);
    expect(reg.has("sheets")).toBe(true);
    expect(reg.get("xlsx").kind).toBe("xlsx");
  });

  it("rejects duplicate registration of the same kind", () => {
    const reg = new SyncerRegistry();
    reg.register(new SheetsSyncer());
    expect(() => reg.register(new SheetsSyncer())).toThrow(/already registered/);
  });

  it("throws when looking up an unregistered kind", () => {
    const reg = new SyncerRegistry();
    expect(() => reg.get("nonexistent")).toThrow(/No ExternalSyncer registered/);
  });
});

describe("ExternalSyncer contract — scaffold returns are well-formed", () => {
  it("SheetsSyncer.push returns a PushResult with the destination echoed back", async () => {
    const t = tmpBrain();
    try {
      const adapter = new SheetsSyncer();
      const result = await adapter.push(t.handle.raw, {
        external: { id: "spreadsheet-abc", kind: "sheets" },
      });
      expect(result.destination.id).toBe("spreadsheet-abc");
      expect(result.rowsPushed).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    } finally {
      t.cleanup();
    }
  });

  it("XlsxSyncer.pull surfaces a clear unsupported-direction error", async () => {
    const t = tmpBrain();
    try {
      const adapter = new XlsxSyncer();
      const result = await adapter.pull(t.handle.raw, {
        external: { id: "/tmp/snapshot.xlsx", kind: "xlsx" },
      });
      expect(result.rowsPulled).toBe(0);
      expect(result.errors.some((e) => e.includes("push-only"))).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it("diff() returns empty sets against a fresh brain", async () => {
    const t = tmpBrain();
    try {
      const adapter = new SheetsSyncer();
      const diff = await adapter.diff(t.handle.raw, { id: "x", kind: "sheets" });
      expect(diff.localOnly).toEqual([]);
      expect(diff.externalOnly).toEqual([]);
      expect(diff.conflicting).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});
