import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { statusHandler } from "../../../src/cli/status.js";
import { StateManager } from "../../../src/core/config/state.js";
import { Logger } from "../../../src/core/output/logger.js";
import { EXIT_CODES } from "../../../src/core/output/exit-codes.js";
import { hashContent } from "../../../src/utils/hash.js";
import { PROJECT_NAME, PROJECT_DIR } from "../../../src/constants.js";

describe("status command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-status-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("reports empty state when no state.json exists", async () => {
    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.agents).toEqual([]);
    expect(result.data.hasDrift).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("detects no drift when files match", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });

    const filePath = path.join(tmpDir, "test-output.md");
    const content = "# Test output";
    await fs.writeFile(filePath, content, "utf-8");

    const stateManager = new StateManager(configDir);
    await stateManager.updateAgent("claude-code", [
      {
        path: filePath,
        sourceHash: "abc",
        generatedHash: hashContent(content),
        sources: ["rules/test.md"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.hasDrift).toBe(false);
    expect(result.data.agents.length).toBe(1);
    expect(result.data.agents[0]!.files[0]!.status).toBe("synced");
  });

  it("detects drift when file content changes", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });

    const filePath = path.join(tmpDir, "test-output.md");
    await fs.writeFile(filePath, "# Modified content", "utf-8");

    const stateManager = new StateManager(configDir);
    await stateManager.updateAgent("claude-code", [
      {
        path: filePath,
        sourceHash: "abc",
        generatedHash: hashContent("# Original content"),
        sources: ["rules/test.md"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.hasDrift).toBe(true);
    // Default drift_detection mode is 'warn' — reports drift but exits SUCCESS
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});
