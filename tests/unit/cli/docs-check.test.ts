import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { docsCheckHandler } from "#src/cli/docs-check.js";
import { docsStampHandler } from "#src/cli/docs-stamp.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { DOC_PROJECT_DIR, DOC_STAMP_FILENAME } from "#src/constants.js";

describe("docs-check command handler", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-docs-check-"));
    Logger.init({ level: "error", mode: "human", noColor: true });

    spawnSync("git", ["init", "-q"], { cwd: tmp });
    spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: tmp });
    spawnSync("git", ["config", "user.name", "Test"], { cwd: tmp });
    spawnSync("git", ["config", "commit.gpgsign", "false"], { cwd: tmp });
    await fs.writeFile(path.join(tmp, "README.md"), "# Test\n");
    spawnSync("git", ["add", "."], { cwd: tmp });
    spawnSync("git", ["commit", "-q", "-m", "init"], { cwd: tmp });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmp);
  });

  it("reports stale=true when no stamp file exists", async () => {
    const result = await docsCheckHandler(tmp);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.data.stale).toBe(true);
    expect(result.data.reason).toBe("no_stamp");
  });

  it("reports stale=false right after stamping", async () => {
    await docsStampHandler(tmp, "human");
    const result = await docsCheckHandler(tmp);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.stale).toBe(false);
    expect(result.data.stamp_commit).toMatch(/^[a-f0-9]{40}$/);
  });

  it("reports stale=true with invalid_hash when the stamp commit is rewritten away", async () => {
    // Write a stamp with a fake commit hash that's not in this repo's history.
    const stampDir = path.join(tmp, DOC_PROJECT_DIR);
    await fs.mkdir(stampDir, { recursive: true });
    const fakeStamp = {
      commit: "0000000000000000000000000000000000000000",
      verified_at: new Date().toISOString(),
      verified_by: "human" as const,
    };
    await fs.writeFile(path.join(stampDir, DOC_STAMP_FILENAME), JSON.stringify(fakeStamp), "utf-8");

    const result = await docsCheckHandler(tmp);
    expect(result.success).toBe(false);
    expect(result.data.stale).toBe(true);
    expect(result.data.reason).toBe("invalid_hash");
  });

  it("reports stale=true with unverified_commits after additional commits", async () => {
    await docsStampHandler(tmp, "human");
    // Add more than one commit after the stamp.
    await fs.writeFile(path.join(tmp, "a.md"), "a\n");
    spawnSync("git", ["add", "."], { cwd: tmp });
    spawnSync("git", ["commit", "-q", "-m", "a"], { cwd: tmp });
    await fs.writeFile(path.join(tmp, "b.md"), "b\n");
    spawnSync("git", ["add", "."], { cwd: tmp });
    spawnSync("git", ["commit", "-q", "-m", "b"], { cwd: tmp });

    const result = await docsCheckHandler(tmp);
    expect(result.success).toBe(false);
    expect(result.data.stale).toBe(true);
    expect(result.data.reason).toBe("unverified_commits");
    expect(result.data.commit_count).toBeGreaterThan(1);
  });
});
