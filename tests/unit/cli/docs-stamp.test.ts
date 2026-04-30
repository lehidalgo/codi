import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { docsStampHandler } from "#src/cli/docs-stamp.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { DOC_PROJECT_DIR, DOC_STAMP_FILENAME } from "#src/constants.js";

describe("docs-stamp command handler", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-docs-stamp-"));
    Logger.init({ level: "error", mode: "human", noColor: true });

    // Initialise a real git repo so writeStamp's `git rev-parse HEAD` succeeds.
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

  it("writes a stamp file marked as 'human' by default", async () => {
    const result = await docsStampHandler(tmp, "human");
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.verified_by).toBe("human");
    expect(result.data.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(result.data.stamp_path).toBe(`${DOC_PROJECT_DIR}/${DOC_STAMP_FILENAME}`);

    // Stamp file must exist and contain the same commit.
    const stampPath = path.join(tmp, DOC_PROJECT_DIR, DOC_STAMP_FILENAME);
    const written = JSON.parse(await fs.readFile(stampPath, "utf-8"));
    expect(written.commit).toBe(result.data.commit);
  });

  it("records 'agent' verifier when explicitly passed", async () => {
    const result = await docsStampHandler(tmp, "agent");
    expect(result.success).toBe(true);
    expect(result.data.verified_by).toBe("agent");
  });

  it("creates the docs/project/ directory if missing", async () => {
    const dir = path.join(tmp, DOC_PROJECT_DIR);
    // Directory should not exist before — handler must create it.
    await expect(fs.access(dir)).rejects.toThrow();
    const result = await docsStampHandler(tmp, "human");
    expect(result.success).toBe(true);
    await expect(fs.access(dir)).resolves.toBeUndefined();
  });

  it("returns an ISO timestamp in verified_at", async () => {
    const result = await docsStampHandler(tmp, "human");
    expect(result.data.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
