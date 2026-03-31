import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { revertHandler } from "../../../src/cli/revert.js";
import { Logger } from "../../../src/core/output/logger.js";
import {
  BACKUPS_DIR,
  BACKUP_MANIFEST_FILENAME,
  PROJECT_NAME,
  PROJECT_DIR,
} from "../../../src/constants.js";

vi.mock("../../../src/cli/shared.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../src/cli/shared.js")>();
  return {
    ...actual,
    regenerateConfigs: vi.fn().mockResolvedValue(true),
  };
});

describe("revert command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-revert-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  async function createBackupEntry(
    timestamp: string,
    files: Record<string, string>,
  ): Promise<void> {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    const backupDir = path.join(configDir, BACKUPS_DIR, timestamp);
    await fs.mkdir(backupDir, { recursive: true });

    const fileNames: string[] = [];
    for (const [relPath, content] of Object.entries(files)) {
      const filePath = path.join(backupDir, relPath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
      fileNames.push(relPath);
    }

    const manifest = { timestamp, files: fileNames };
    await fs.writeFile(
      path.join(backupDir, BACKUP_MANIFEST_FILENAME),
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );
  }

  it("returns error when no option specified", async () => {
    // Arrange
    const options = {};

    // Act
    const result = await revertHandler(tmpDir, options);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]!.message).toContain(
      "Specify --list, --last, or --backup",
    );
  });

  it("--list returns available backups", async () => {
    // Arrange
    await createBackupEntry("2026-01-01T00-00-00-000Z", {
      "CLAUDE.md": "# backup content",
    });
    await createBackupEntry("2026-01-02T00-00-00-000Z", {
      "CLAUDE.md": "# newer backup",
      ".cursorrules": "# cursor rules",
    });

    // Act
    const result = await revertHandler(tmpDir, { list: true });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe("list");
    expect(result.data.backups).toHaveLength(2);
    expect(result.data.backups![0]!.timestamp).toBe("2026-01-02T00-00-00-000Z");
    expect(result.data.backups![0]!.fileCount).toBe(2);
    expect(result.data.backups![1]!.fileCount).toBe(1);
  });

  it("--list handles no backups gracefully", async () => {
    // Arrange — no backups directory at all

    // Act
    const result = await revertHandler(tmpDir, { list: true });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe("list");
    expect(result.data.backups).toEqual([]);
  });

  it("--last returns error when no backups exist", async () => {
    // Arrange — empty project

    // Act
    const result = await revertHandler(tmpDir, { last: true });

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]!.message).toContain("No backups available");
  });

  it("--last restores most recent backup", async () => {
    // Arrange
    await createBackupEntry("2026-01-01T00-00-00-000Z", {
      "CLAUDE.md": "# old backup",
    });
    await createBackupEntry("2026-01-02T00-00-00-000Z", {
      "CLAUDE.md": "# latest backup",
    });

    // Act
    const result = await revertHandler(tmpDir, { last: true });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe("restore");
    expect(result.data.timestamp).toBe("2026-01-02T00-00-00-000Z");
    expect(result.data.restoredFiles).toContain("CLAUDE.md");

    const restored = await fs.readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(restored).toBe("# latest backup");
  });

  it("--backup <timestamp> restores specific backup", async () => {
    // Arrange
    const targetTimestamp = "2026-01-01T12-00-00-000Z";
    await createBackupEntry(targetTimestamp, {
      ".cursorrules": "# specific backup rules",
      "CLAUDE.md": "# specific backup claude",
    });

    // Act
    const result = await revertHandler(tmpDir, { backup: targetTimestamp });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe("restore");
    expect(result.data.timestamp).toBe(targetTimestamp);
    expect(result.data.restoredFiles).toHaveLength(2);

    const rulesContent = await fs.readFile(
      path.join(tmpDir, ".cursorrules"),
      "utf-8",
    );
    expect(rulesContent).toBe("# specific backup rules");
  });
});
