import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isGitRepo, getGitRoot } from "#src/utils/git.js";
import { Logger } from "#src/core/output/logger.js";
import { PROJECT_NAME } from "#src/constants.js";

const execFileAsync = promisify(execFile);

// Strip git hook env vars so test git commands are not affected by the caller's
// git context (e.g., when run from a pre-commit hook that sets GIT_DIR).
const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
delete cleanEnv["GIT_DIR"];
delete cleanEnv["GIT_WORK_TREE"];
delete cleanEnv["GIT_INDEX_FILE"];

describe("git utilities", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-git-`));
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  describe("isGitRepo", () => {
    it("returns true for a git-initialized directory", async () => {
      // Arrange
      await execFileAsync("git", ["init", tmpDir], { env: cleanEnv });

      // Act
      const result = await isGitRepo(tmpDir);

      // Assert
      expect(result).toBe(true);
    });

    it("returns false for a non-git directory", async () => {
      // Act
      const result = await isGitRepo(tmpDir);

      // Assert
      expect(result).toBe(false);
    });

    it("returns false for a nonexistent directory", async () => {
      // Act
      const result = await isGitRepo(path.join(tmpDir, "does-not-exist"));

      // Assert
      expect(result).toBe(false);
    });

    it("returns true for a subdirectory within a git repo", async () => {
      // Arrange
      await execFileAsync("git", ["init", tmpDir], { env: cleanEnv });
      const subDir = path.join(tmpDir, "nested", "deep");
      await fs.mkdir(subDir, { recursive: true });

      // Act
      const result = await isGitRepo(subDir);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("getGitRoot", () => {
    it("returns root path for a git repo", async () => {
      // Arrange
      await execFileAsync("git", ["init", tmpDir], { env: cleanEnv });

      // Act
      const root = await getGitRoot(tmpDir);

      // Assert — use realpath since tmpdir may have symlinks
      const realTmpDir = await fs.realpath(tmpDir);
      expect(root).toBe(realTmpDir);
    });

    it("returns null for a non-git directory", async () => {
      // Act
      const root = await getGitRoot(tmpDir);

      // Assert
      expect(root).toBeNull();
    });

    it("returns repo root from a subdirectory", async () => {
      // Arrange
      await execFileAsync("git", ["init", tmpDir], { env: cleanEnv });
      const subDir = path.join(tmpDir, "src", "lib");
      await fs.mkdir(subDir, { recursive: true });

      // Act
      const root = await getGitRoot(subDir);

      // Assert
      const realTmpDir = await fs.realpath(tmpDir);
      expect(root).toBe(realTmpDir);
    });

    it("returns null for a nonexistent directory", async () => {
      // Act
      const root = await getGitRoot(path.join(tmpDir, "no-such-dir"));

      // Assert
      expect(root).toBeNull();
    });
  });
});
