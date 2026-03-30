import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parse as parseYaml } from "yaml";
import { presetCreateHandler } from "#src/cli/preset.js";
import { Logger } from "#src/core/output/logger.js";
import {
  PRESET_MANIFEST_FILENAME,
  PRESET_LOCK_FILENAME,
  PROJECT_NAME,
  PROJECT_DIR,
  MANIFEST_FILENAME,
} from "#src/constants.js";

describe("presetCreateHandler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-preset-create-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates preset directory with manifest", async () => {
    // Arrange
    const presetName = "my-preset";

    // Act
    const result = await presetCreateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe("create");
    expect(result.data.name).toBe(presetName);

    const presetDir = path.join(tmpDir, PROJECT_DIR, "presets", presetName);
    const stat = await fs.stat(presetDir);
    expect(stat.isDirectory()).toBe(true);

    const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);
    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest = parseYaml(raw) as Record<string, unknown>;

    expect(manifest.name).toBe(presetName);
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.artifacts).toEqual({
      rules: [],
      skills: [],
      agents: [],
      commands: [],
    });
  });

  it("returns error if preset already exists", async () => {
    // Arrange
    const presetName = "existing-preset";
    const presetDir = path.join(tmpDir, PROJECT_DIR, "presets", presetName);
    await fs.mkdir(presetDir, { recursive: true });

    // Act
    const result = await presetCreateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]!.message).toContain("already exists");
    expect(result.data.name).toBe(presetName);
  });

  it("creates nested preset names with slashes", async () => {
    // Arrange
    const presetName = "org/team-preset";

    // Act
    const result = await presetCreateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(true);

    const presetDir = path.join(tmpDir, PROJECT_DIR, "presets", presetName);
    const stat = await fs.stat(presetDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("manifest has empty description field", async () => {
    // Arrange
    const presetName = "check-desc";

    // Act
    await presetCreateHandler(tmpDir, presetName);

    // Assert
    const manifestPath = path.join(
      tmpDir,
      PROJECT_DIR,
      "presets",
      presetName,
      PRESET_MANIFEST_FILENAME,
    );
    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest = parseYaml(raw) as Record<string, unknown>;
    expect(manifest.description).toBe("");
  });
});

describe("presetUpdateHandler — empty lock file", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-preset-update-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("handles empty lock file (no presets to update)", async () => {
    // Arrange — create config dir with empty lock file
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, PRESET_LOCK_FILENAME),
      JSON.stringify({ presets: {} }, null, 2),
      "utf-8",
    );

    // presetUpdateHandler calls scanProjectDir which needs the manifest
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: test\nversion: "1"\n',
      "utf-8",
    );

    // Dynamic import to avoid top-level import issues with git mocking
    const { presetUpdateHandler } = await import("../../../src/cli/preset.js");

    // Act
    const result = await presetUpdateHandler(tmpDir, false);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe("update");
    expect(result.data.updated).toEqual([]);
  });

  it("handles missing lock file (no presets to update)", async () => {
    // Arrange — create config dir without lock file
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: test\nversion: "1"\n',
      "utf-8",
    );

    const { presetUpdateHandler } = await import("../../../src/cli/preset.js");

    // Act
    const result = await presetUpdateHandler(tmpDir, false);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe("update");
    expect(result.data.updated).toEqual([]);
  });

  it("dry-run with empty lock file returns empty updated list", async () => {
    // Arrange
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, PRESET_LOCK_FILENAME),
      JSON.stringify({ presets: {} }, null, 2),
      "utf-8",
    );
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: test\nversion: "1"\n',
      "utf-8",
    );

    const { presetUpdateHandler } = await import("../../../src/cli/preset.js");

    // Act
    const result = await presetUpdateHandler(tmpDir, true);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.updated).toEqual([]);
  });
});

describe("presetCreateHandler — additional coverage", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-preset-create2-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns correct exit code on success", async () => {
    const result = await presetCreateHandler(tmpDir, "exit-check");
    expect(result.exitCode).toBe(0);
    expect(result.success).toBe(true);
  });

  it("returns correct exit code on duplicate", async () => {
    await presetCreateHandler(tmpDir, "dup-preset");
    const result = await presetCreateHandler(tmpDir, "dup-preset");
    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
  });

  it("creates multiple presets independently", async () => {
    const r1 = await presetCreateHandler(tmpDir, "preset-one");
    const r2 = await presetCreateHandler(tmpDir, "preset-two");
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    const dir1 = path.join(tmpDir, PROJECT_DIR, "presets", "preset-one");
    const dir2 = path.join(tmpDir, PROJECT_DIR, "presets", "preset-two");
    await expect(fs.access(dir1)).resolves.toBeUndefined();
    await expect(fs.access(dir2)).resolves.toBeUndefined();
  });

  it('data.action is "create" on both success and failure', async () => {
    const success = await presetCreateHandler(tmpDir, "new-one");
    expect(success.data.action).toBe("create");

    await presetCreateHandler(tmpDir, "action-check");
    const failure = await presetCreateHandler(tmpDir, "action-check");
    expect(failure.data.action).toBe("create");
  });
});

describe("presetSearchHandler", () => {
  // NOTE: presetSearchHandler requires cloning a git registry, which involves
  // network access and external git operations. Testing it properly would
  // require mocking the cloneRegistry function. The handler's error path
  // (when git clone fails) does return a structured error result, but
  // triggering it reliably in a test without network is fragile.
  // Skipping these tests in favor of testing handlers that work with
  // filesystem setup alone.

  it.skip("requires git clone — not tested with filesystem alone", () => {
    // Placeholder to document the intentional skip
  });
});
