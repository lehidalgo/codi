import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { BACKUP_MANIFEST_FILENAME } from "#src/constants.js";

vi.mock("@clack/prompts", () => ({
  multiselect: vi.fn(),
  confirm: vi.fn(),
  isCancel: (v: unknown) => v === Symbol.for("clack:cancel"),
}));

async function mkBackup(root: string, ts: string, sealed: boolean): Promise<void> {
  const dir = path.join(root, ts);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "CLAUDE.md"), "test\n");
  if (sealed) {
    await fs.writeFile(
      path.join(dir, BACKUP_MANIFEST_FILENAME),
      JSON.stringify({
        version: 2,
        timestamp: ts,
        trigger: "generate",
        codiVersion: "x",
        files: [],
      }),
    );
  }
}

describe("backup-retention", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-br-"));
  });
  afterEach(() => cleanupTmpDir(tmp));

  it("listSealedBackups returns only directories with manifest.json, sorted oldest-first", async () => {
    const { listSealedBackups } = await import("#src/core/backup/backup-retention.js");
    await mkBackup(tmp, "2026-04-30T10-00-00-000Z", true);
    await mkBackup(tmp, "2026-04-30T11-00-00-000Z", false);
    await mkBackup(tmp, "2026-04-30T09-00-00-000Z", true);
    const backups = await listSealedBackups(tmp);
    expect(backups.map((b) => b.timestamp)).toEqual([
      "2026-04-30T09-00-00-000Z",
      "2026-04-30T10-00-00-000Z",
    ]);
  });

  it("pruneIncompleteBackups removes unsealed backup directories", async () => {
    const { pruneIncompleteBackups } = await import("#src/core/backup/backup-retention.js");
    await mkBackup(tmp, "2026-04-30T10-00-00-000Z", true);
    await mkBackup(tmp, "2026-04-30T11-00-00-000Z", false);
    await pruneIncompleteBackups(tmp);
    const remaining = await fs.readdir(tmp);
    expect(remaining).toEqual(["2026-04-30T10-00-00-000Z"]);
  });

  it("evictOldest removes the oldest sealed backup and returns its timestamp", async () => {
    const { evictOldest } = await import("#src/core/backup/backup-retention.js");
    await mkBackup(tmp, "2026-04-30T10-00-00-000Z", true);
    await mkBackup(tmp, "2026-04-30T11-00-00-000Z", true);
    await mkBackup(tmp, "2026-04-30T09-00-00-000Z", true);
    const evicted = await evictOldest(tmp);
    expect(evicted).toBe("2026-04-30T09-00-00-000Z");
    const remaining = await fs.readdir(tmp);
    expect(remaining.sort()).toEqual(["2026-04-30T10-00-00-000Z", "2026-04-30T11-00-00-000Z"]);
  });

  it("evictOldest returns null when there are no sealed backups", async () => {
    const { evictOldest } = await import("#src/core/backup/backup-retention.js");
    expect(await evictOldest(tmp)).toBeNull();
  });
});

describe("interactiveEvict", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-iv-"));
  });
  afterEach(() => cleanupTmpDir(tmp));

  it("returns false when user cancels at the multiselect", async () => {
    const { interactiveEvict } = await import("#src/core/backup/backup-retention.js");
    const prompts = await import("@clack/prompts");
    (prompts.multiselect as ReturnType<typeof vi.fn>).mockResolvedValue(Symbol.for("clack:cancel"));
    await mkBackup(tmp, "2026-04-30T10-00-00-000Z", true);
    expect(await interactiveEvict(tmp)).toBe(false);
  });

  it("returns false when user picks 0 backups", async () => {
    const { interactiveEvict } = await import("#src/core/backup/backup-retention.js");
    const prompts = await import("@clack/prompts");
    (prompts.multiselect as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await mkBackup(tmp, "2026-04-30T10-00-00-000Z", true);
    expect(await interactiveEvict(tmp)).toBe(false);
  });
});
