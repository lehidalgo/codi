import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { stringify as stringifyYaml } from "yaml";
import { generateHandler } from "#src/cli/generate.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import {
  PROJECT_NAME,
  PROJECT_DIR,
  MANIFEST_FILENAME,
} from "#src/constants.js";

describe("generate command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-gen-`));
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it(`fails when no ${PROJECT_DIR}/ directory exists`, async () => {
    const result = await generateHandler(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
  });

  it("generates files for configured agents", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });

    const manifest = { name: "test", version: "1", agents: ["claude-code"] };
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      stringifyYaml(manifest),
      "utf-8",
    );
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({}),
      "utf-8",
    );

    const result = await generateHandler(tmpDir, {});
    expect(result.success).toBe(true);
    expect(result.data.agents).toContain("claude-code");
    expect(result.data.filesGenerated).toBeGreaterThanOrEqual(0);
  });

  it("supports --dry-run without writing files", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });

    const manifest = { name: "test", version: "1", agents: ["claude-code"] };
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      stringifyYaml(manifest),
      "utf-8",
    );
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      stringifyYaml({}),
      "utf-8",
    );

    const result = await generateHandler(tmpDir, { dryRun: true });
    expect(result.success).toBe(true);

    // state.json should not be written in dry-run mode
    const stateExists = await fs
      .access(path.join(configDir, "state.json"))
      .then(() => true)
      .catch(() => false);
    expect(stateExists).toBe(false);
  });
});
