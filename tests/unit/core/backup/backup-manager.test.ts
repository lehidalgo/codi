import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import {
  createBackup,
  listBackups,
  restoreBackup,
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
  await fs.writeFile(
    path.join(configDir, STATE_FILENAME),
    JSON.stringify({ agents }),
    "utf8",
  );
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
    expect(manifest.files).toContain(".claude/rules/arch.md");
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
    await expect(
      restoreBackup(projectRoot, configDir, "nonexistent-timestamp"),
    ).rejects.toThrow();
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
    const manifestStat = await fs.stat(
      path.join(expectedPath, BACKUP_MANIFEST_FILENAME),
    );
    expect(manifestStat.isFile()).toBe(true);
  });
});
