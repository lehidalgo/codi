import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { openBackup, listBackups } from "#src/core/backup/backup-manager.js";
import { readManifest } from "#src/core/backup/backup-manifest.js";
import { pruneIncompleteBackups } from "#src/core/backup/backup-retention.js";
import {
  PROJECT_NAME,
  PROJECT_DIR,
  BACKUPS_DIR,
  BACKUP_MANIFEST_FILENAME,
} from "#src/constants.js";

describe("backup overhaul - integration", () => {
  let tmp: string;
  let configDir: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-bo-`));
    configDir = path.join(tmp, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, "codi.yaml"), "name: t\n");
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });
    await fs.writeFile(path.join(configDir, "rules", "a.md"), "# a\n");
  });

  afterEach(() => cleanupTmpDir(tmp));

  it("openBackup -> append -> finalise writes a v2 manifest with all scopes", async () => {
    await fs.writeFile(path.join(tmp, "CLAUDE.md"), "user-edited\n");
    // An orphan file we'll mark deleted via append. Path is outside every
    // adapter target dir so it isn't auto-captured by the preExisting probe.
    await fs.writeFile(path.join(tmp, "doomed.md"), "stale\n");
    const r = await openBackup(tmp, configDir, {
      trigger: "init-customize",
      includeSource: true,
      includeOutput: false,
      includePreExisting: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await r.data.append(["doomed.md"], "output", { deleted: true });
    await r.data.finalise();

    const m = await readManifest(r.data.dir);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.data.version).toBe(2);
    expect(m.data.trigger).toBe("init-customize");

    const sourceFiles = m.data.files.filter((f) => f.scope === "source");
    const outputFiles = m.data.files.filter((f) => f.scope === "output");
    const preExisting = m.data.files.filter((f) => f.preExisting);
    const deleted = m.data.files.filter((f) => f.deleted);

    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(preExisting.some((f) => f.path === "CLAUDE.md")).toBe(true);
    expect(deleted.some((f) => f.path === "doomed.md")).toBe(true);
    // Output entries come from append() and the preExisting scan, all stored
    // with scope "output".
    expect(outputFiles.length).toBeGreaterThan(0);
  });

  it("backup excludes .codi/backups/ recursively (no infinite recursion)", async () => {
    const r = await openBackup(tmp, configDir, {
      trigger: "generate",
      includeSource: true,
      includeOutput: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await r.data.finalise();

    const r2 = await openBackup(tmp, configDir, {
      trigger: "generate",
      includeSource: true,
      includeOutput: false,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    await r2.data.finalise();

    // The second backup should NOT contain .codi/backups/ from the first.
    const m = await readManifest(r2.data.dir);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    const hasBackupsDir = m.data.files.some((f) => f.path.startsWith(".codi/backups/"));
    expect(hasBackupsDir).toBe(false);
  });

  it("aborted backup leaves no manifest, gets swept by pruneIncompleteBackups", async () => {
    const r = await openBackup(tmp, configDir, {
      trigger: "generate",
      includeSource: true,
      includeOutput: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const dir = r.data.dir;
    // Simulate a crash mid-backup: do NOT call finalise.
    const manifestPath = path.join(dir, BACKUP_MANIFEST_FILENAME);
    expect(
      await fs
        .stat(manifestPath)
        .then(() => true)
        .catch(() => false),
    ).toBe(false);

    // pruneIncompleteBackups removes the dir.
    const backupsRoot = path.join(configDir, BACKUPS_DIR);
    await pruneIncompleteBackups(backupsRoot);
    expect(
      await fs
        .stat(dir)
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
  });

  it("listBackups only returns sealed (manifest-present) entries", async () => {
    const r1 = await openBackup(tmp, configDir, {
      trigger: "generate",
      includeSource: true,
      includeOutput: false,
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    await r1.data.finalise();

    const r2 = await openBackup(tmp, configDir, {
      trigger: "generate",
      includeSource: true,
      includeOutput: false,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    // Don't finalise r2 — leave it incomplete.

    const backups = await listBackups(configDir);
    expect(backups.some((b) => b.timestamp === r1.data.timestamp)).toBe(true);
    expect(backups.some((b) => b.timestamp === r2.data.timestamp)).toBe(false);
  });
});
