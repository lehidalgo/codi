import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import {
  createBackup,
  listBackups,
  restoreBackup,
  openBackup,
} from "#src/core/backup/backup-manager.js";
import {
  STATE_FILENAME,
  BACKUPS_DIR,
  BACKUP_MANIFEST_FILENAME,
  PROJECT_NAME,
  PROJECT_DIR,
} from "#src/constants.js";

let tmpDir: string;
let projectRoot: string;
let configDir: string;

async function setup(): Promise<void> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-backup-`));
  projectRoot = tmpDir;
  configDir = path.join(tmpDir, PROJECT_DIR);
  await fs.mkdir(configDir, { recursive: true });
}

afterEach(async () => {
  if (tmpDir) {
    await cleanupTmpDir(tmpDir);
  }
});

/**
 * Writes a minimal state.json that references the given relative file paths.
 */
async function writeState(filePaths: string[]): Promise<void> {
  const agents: Record<string, Array<{ path: string }>> = {
    "claude-code": filePaths.map((p) => ({ path: p })),
  };
  await fs.writeFile(path.join(configDir, STATE_FILENAME), JSON.stringify({ agents }), "utf8");
}

/**
 * Creates a file at the given relative path inside projectRoot.
 */
async function createFile(relPath: string, content: string): Promise<void> {
  const absPath = path.join(projectRoot, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf8");
}

describe("createBackup", () => {
  it("creates a timestamped backup directory with files", async () => {
    // Arrange
    await setup();
    await createFile(".claude/rules/arch.md", "# Architecture");
    await writeState([".claude/rules/arch.md"]);

    // Act
    const timestamp = await createBackup(projectRoot, configDir);

    // Assert
    expect(timestamp).not.toBeNull();
    const backupDir = path.join(configDir, BACKUPS_DIR, timestamp!);
    const stat = await fs.stat(backupDir);
    expect(stat.isDirectory()).toBe(true);

    const manifestPath = path.join(backupDir, BACKUP_MANIFEST_FILENAME);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    expect(manifest.timestamp).toBe(timestamp);
    expect(manifest.files.some((f: { path: string }) => f.path === ".claude/rules/arch.md")).toBe(
      true,
    );
  });

  it("copies file contents correctly", async () => {
    // Arrange
    await setup();
    const content = "rule content here\nline two";
    await createFile("AGENTS.md", content);
    await writeState(["AGENTS.md"]);

    // Act
    const timestamp = await createBackup(projectRoot, configDir);

    // Assert
    expect(timestamp).not.toBeNull();
    const backedUp = await fs.readFile(
      path.join(configDir, BACKUPS_DIR, timestamp!, "AGENTS.md"),
      "utf8",
    );
    expect(backedUp).toBe(content);
  });

  it("returns null when state file does not exist", async () => {
    // Arrange
    await setup();
    // No state.json written

    // Act
    const result = await createBackup(projectRoot, configDir);

    // Assert
    expect(result).toBeNull();
  });

  it("returns null when no files are found on disk", async () => {
    // Arrange
    await setup();
    // State references a file that does not exist on disk
    await writeState([".claude/rules/missing.md"]);

    // Act
    const result = await createBackup(projectRoot, configDir);

    // Assert
    expect(result).toBeNull();
  });
});

describe("listBackups", () => {
  it("returns backups sorted by timestamp newest first", async () => {
    // Arrange
    await setup();
    const backupsRoot = path.join(configDir, BACKUPS_DIR);

    const timestamps = [
      "2026-01-01T00-00-00-000Z",
      "2026-01-03T00-00-00-000Z",
      "2026-01-02T00-00-00-000Z",
    ];

    for (const ts of timestamps) {
      const dir = path.join(backupsRoot, ts);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, BACKUP_MANIFEST_FILENAME),
        JSON.stringify({ timestamp: ts, files: ["file.md"] }),
        "utf8",
      );
    }

    // Act
    const result = await listBackups(configDir);

    // Assert
    expect(result).toHaveLength(3);
    expect(result[0].timestamp).toBe("2026-01-03T00-00-00-000Z");
    expect(result[1].timestamp).toBe("2026-01-02T00-00-00-000Z");
    expect(result[2].timestamp).toBe("2026-01-01T00-00-00-000Z");
  });

  it("returns empty array when no backups exist", async () => {
    // Arrange
    await setup();
    // No backups directory created

    // Act
    const result = await listBackups(configDir);

    // Assert
    expect(result).toEqual([]);
  });

  it("returns correct fileCount from manifest", async () => {
    // Arrange
    await setup();
    const backupsRoot = path.join(configDir, BACKUPS_DIR);
    const ts = "2026-02-01T00-00-00-000Z";
    const dir = path.join(backupsRoot, ts);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, BACKUP_MANIFEST_FILENAME),
      JSON.stringify({ timestamp: ts, files: ["a.md", "b.md", "c.md"] }),
      "utf8",
    );

    // Act
    const result = await listBackups(configDir);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].fileCount).toBe(3);
  });
});

describe("restoreBackup", () => {
  it("restores files to original locations", async () => {
    // Arrange
    await setup();
    const content = "# Restored content";
    await createFile(".claude/rules/arch.md", content);
    await writeState([".claude/rules/arch.md"]);

    const timestamp = await createBackup(projectRoot, configDir);
    expect(timestamp).not.toBeNull();

    // Delete the original file
    await fs.rm(path.join(projectRoot, ".claude/rules/arch.md"));

    // Act
    const restored = await restoreBackup(projectRoot, configDir, timestamp!);

    // Assert
    expect(restored).toContain(".claude/rules/arch.md");
    const restoredContent = await fs.readFile(
      path.join(projectRoot, ".claude/rules/arch.md"),
      "utf8",
    );
    expect(restoredContent).toBe(content);
  });

  it("throws when backup does not exist", async () => {
    // Arrange
    await setup();

    // Act & Assert
    await expect(restoreBackup(projectRoot, configDir, "nonexistent-timestamp")).rejects.toThrow();
  });
});

describe("backup directory structure", () => {
  it(`stores backups under ${PROJECT_DIR}/backups/<timestamp>/`, async () => {
    // Arrange
    await setup();
    await createFile("README.md", "# Hello");
    await writeState(["README.md"]);

    // Act
    const timestamp = await createBackup(projectRoot, configDir);

    // Assert
    expect(timestamp).not.toBeNull();
    const expectedPath = path.join(configDir, BACKUPS_DIR, timestamp!);
    const stat = await fs.stat(expectedPath);
    expect(stat.isDirectory()).toBe(true);

    // Manifest is inside the backup directory
    const manifestStat = await fs.stat(path.join(expectedPath, BACKUP_MANIFEST_FILENAME));
    expect(manifestStat.isFile()).toBe(true);
  });
});

describe("openBackup / BackupHandle lifecycle", () => {
  it("openBackup with includeSource captures .codi/ files", async () => {
    await setup();
    await fs.writeFile(path.join(configDir, "codi.yaml"), "name: t\nversion: '1'\nagents: []\n");
    const r = await openBackup(projectRoot, configDir, {
      trigger: "init-customize",
      includeSource: true,
      includeOutput: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const handle = r.data;
    const sourceCopy = await fs.stat(path.join(handle.dir, ".codi", "codi.yaml")).catch(() => null);
    expect(sourceCopy).not.toBeNull();
    await handle.finalise();
    const manifest = JSON.parse(
      await fs.readFile(path.join(handle.dir, BACKUP_MANIFEST_FILENAME), "utf8"),
    );
    expect(manifest.version).toBe(2);
    expect(manifest.trigger).toBe("init-customize");
    expect(
      manifest.files.some(
        (f: { path: string; scope: string }) =>
          f.path === ".codi/codi.yaml" && f.scope === "source",
      ),
    ).toBe(true);
  });

  it("handle.append adds files mid-operation", async () => {
    await setup();
    await fs.writeFile(path.join(configDir, "codi.yaml"), "name: t\n");
    await createFile("CLAUDE.md", "stale\n");
    const r = await openBackup(projectRoot, configDir, {
      trigger: "init-customize",
      includeSource: true,
      includeOutput: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const handle = r.data;
    await handle.append(["CLAUDE.md"], "output", { deleted: true });
    await handle.finalise();
    const manifest = JSON.parse(
      await fs.readFile(path.join(handle.dir, BACKUP_MANIFEST_FILENAME), "utf8"),
    );
    const claudeEntry = manifest.files.find((f: { path: string }) => f.path === "CLAUDE.md");
    expect(claudeEntry).toEqual({
      path: "CLAUDE.md",
      scope: "output",
      deleted: true,
    });
    const claudeCopy = await fs.stat(path.join(handle.dir, "CLAUDE.md")).catch(() => null);
    expect(claudeCopy).not.toBeNull();
  });

  it("handle.abort removes the partial backup", async () => {
    await setup();
    await fs.writeFile(path.join(configDir, "codi.yaml"), "name: t\n");
    const r = await openBackup(projectRoot, configDir, {
      trigger: "init-customize",
      includeSource: true,
      includeOutput: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const handle = r.data;
    const dir = handle.dir;
    await handle.abort();
    const exists = await fs.stat(dir).catch(() => null);
    expect(exists).toBeNull();
  });

  it("manifest is NOT present until finalise is called", async () => {
    await setup();
    await fs.writeFile(path.join(configDir, "codi.yaml"), "name: t\n");
    const r = await openBackup(projectRoot, configDir, {
      trigger: "init-customize",
      includeSource: true,
      includeOutput: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const handle = r.data;
    const before = await fs.stat(path.join(handle.dir, BACKUP_MANIFEST_FILENAME)).catch(() => null);
    expect(before).toBeNull();
    await handle.finalise();
    const after = await fs.stat(path.join(handle.dir, BACKUP_MANIFEST_FILENAME)).catch(() => null);
    expect(after).not.toBeNull();
  });

  it("retention: evict-oldest deletes oldest when at MAX_BACKUPS", async () => {
    await setup();
    await fs.writeFile(path.join(configDir, "codi.yaml"), "name: t\n");
    const backupsRoot = path.join(configDir, BACKUPS_DIR);
    await fs.mkdir(backupsRoot, { recursive: true });
    const { MAX_BACKUPS } = await import("#src/constants.js");
    for (let i = 0; i < MAX_BACKUPS; i++) {
      const ts = `2026-04-${String(i + 1).padStart(2, "0")}T00-00-00-000Z`;
      await fs.mkdir(path.join(backupsRoot, ts));
      await fs.writeFile(
        path.join(backupsRoot, ts, BACKUP_MANIFEST_FILENAME),
        JSON.stringify({
          version: 2,
          timestamp: ts,
          trigger: "generate",
          codiVersion: "x",
          files: [],
        }),
      );
    }
    const r = await openBackup(projectRoot, configDir, {
      trigger: "generate",
      includeSource: true,
      includeOutput: false,
      retention: "evict-oldest",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await r.data.finalise();
    const remaining = await fs.readdir(backupsRoot);
    expect(remaining.length).toBe(MAX_BACKUPS);
    expect(remaining).not.toContain("2026-04-01T00-00-00-000Z");
  });
});
