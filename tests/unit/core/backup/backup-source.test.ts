import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { connectBackup } from "#src/core/backup/backup-source.js";
import { BACKUPS_DIR } from "#src/constants.js";

describe("connectBackup", () => {
  let tmp: string;
  let configDir: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-bs-"));
    configDir = path.join(tmp, ".codi");
    await fs.mkdir(configDir, { recursive: true });
  });
  afterEach(() => cleanupTmpDir(tmp));

  it("returns ExternalSource pointing at backup .codi/", async () => {
    const ts = "2026-04-30T19-20-15-123Z";
    const backupCodi = path.join(configDir, BACKUPS_DIR, ts, ".codi");
    await fs.mkdir(path.join(backupCodi, "rules"), { recursive: true });
    const src = await connectBackup(configDir, ts);
    expect(src.id).toBe(`backup:${ts}`);
    expect(src.rootPath).toBe(backupCodi);
    await src.cleanup();
  });

  it("throws when backup has no .codi/ subdirectory", async () => {
    const ts = "2026-04-30T19-20-15-123Z";
    await fs.mkdir(path.join(configDir, BACKUPS_DIR, ts), { recursive: true });
    await expect(connectBackup(configDir, ts)).rejects.toThrow(/no \.codi\/ source/);
  });

  it("throws when backup .codi/ has no artifact dirs", async () => {
    const ts = "2026-04-30T19-20-15-123Z";
    const backupCodi = path.join(configDir, BACKUPS_DIR, ts, ".codi");
    await fs.mkdir(path.join(backupCodi, "hooks"), { recursive: true });
    await expect(connectBackup(configDir, ts)).rejects.toThrow(/no artifact dirs/);
  });
});
