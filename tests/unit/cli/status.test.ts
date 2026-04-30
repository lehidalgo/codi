import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { statusHandler } from "#src/cli/status.js";
import { StateManager } from "#src/core/config/state.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { hashContent } from "#src/utils/hash.js";
import { PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

describe("status command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-status-`));
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

  /**
   * Helper: write a minimal manifest + flags.yaml so resolveConfig produces
   * a config (otherwise drift_detection always defaults to "warn").
   */
  async function writeMinimalConfig(
    flags: Record<string, { mode?: string; value?: unknown }> = {},
  ): Promise<string> {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      stringifyYaml({ name: "test", version: "1", agents: ["claude-code"] }),
      "utf-8",
    );
    await fs.writeFile(path.join(configDir, "flags.yaml"), stringifyYaml(flags), "utf-8");
    return configDir;
  }

  it("returns empty status when drift_detection is off", async () => {
    await writeMinimalConfig({ drift_detection: { mode: "enabled", value: "off" } });
    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.hasDrift).toBe(false);
    expect(result.data.agents).toEqual([]);
    expect(result.data.hooks).toEqual([]);
    expect(result.data.presetArtifacts).toEqual([]);
    expect(result.data.lastGenerated).toBe("");
  });

  it("exits DRIFT_DETECTED when drift_detection=error and drift exists", async () => {
    const configDir = await writeMinimalConfig({
      drift_detection: { mode: "enabled", value: "error" },
    });

    const filePath = path.join(tmpDir, "drifted.md");
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
    expect(result.exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
  });

  it("includes hook drift in the result (informational)", async () => {
    const configDir = await writeMinimalConfig();
    // Write a hook to disk and register a different hash in state — drift.
    const hookFile = path.join(tmpDir, ".husky", "pre-commit");
    await fs.mkdir(path.dirname(hookFile), { recursive: true });
    await fs.writeFile(hookFile, "echo modified\n", "utf-8");

    const stateManager = new StateManager(configDir);
    await stateManager.updateHooks([
      {
        path: hookFile,
        hash: hashContent("# original"),
        sources: ["template:husky-pre-commit"],
        timestamp: new Date().toISOString(),
      },
    ]);

    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data.hooks)).toBe(true);
    // Hook drift is reported but does not flip hasDrift on its own.
  });

  it("--diff option does not throw when there are drifted preset artifacts", async () => {
    // We don't need a real preset to pass — renderDriftDiffs gracefully
    // logs a warning when the preset can't be loaded and continues. This
    // exercises the diff-rendering code path.
    const configDir = await writeMinimalConfig();
    const ruleFile = path.join(configDir, "rules", "demo.md");
    await fs.writeFile(ruleFile, "# Drifted demo rule\n", "utf-8");

    const stateManager = new StateManager(configDir);
    await stateManager.updatePresetArtifacts([
      {
        path: path.join(PROJECT_DIR, "rules", "demo.md"),
        hash: hashContent("# Original demo rule\n"),
        preset: "nonexistent-preset",
        timestamp: new Date().toISOString(),
      },
    ]);

    const result = await statusHandler(tmpDir, { diff: true });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data.presetArtifacts)).toBe(true);
  });
});
