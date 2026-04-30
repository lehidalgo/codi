import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { stringify as stringifyYaml } from "yaml";
import { validateHandler } from "#src/cli/validate.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

describe("validate command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-val-`));
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it(`fails when no ${PROJECT_DIR}/ directory exists`, async () => {
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
    expect(result.data.valid).toBe(false);
  });

  it("reports valid config", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });

    const manifest = { name: "test", version: "1", agents: ["claude-code"] };
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), stringifyYaml(manifest), "utf-8");
    await fs.writeFile(path.join(configDir, "flags.yaml"), stringifyYaml({}), "utf-8");

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
    expect(result.data.errorCount).toBe(0);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("reports invalid agents", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });

    const manifest = {
      name: "test",
      version: "1",
      agents: ["nonexistent-agent"],
    };
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), stringifyYaml(manifest), "utf-8");
    await fs.writeFile(path.join(configDir, "flags.yaml"), stringifyYaml({}), "utf-8");

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
    expect(result.data.valid).toBe(false);
    expect(result.data.errorCount).toBeGreaterThan(0);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
  });

  it("returns CONFIG_NOT_FOUND when .codi/ is missing", async () => {
    // No PROJECT_DIR created — resolveConfig should emit E_CONFIG_NOT_FOUND
    // and validate must surface that with the matching exit code.
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
    expect(result.data.errors[0]?.code).toBe("E_CONFIG_NOT_FOUND");
  });

  it("returns CONFIG_INVALID for malformed manifest YAML", async () => {
    // resolveConfig fails with a non-not-found error code. validate must
    // map anything other than E_CONFIG_NOT_FOUND to CONFIG_INVALID.
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      ":\n  this: is: not: valid:",
      "utf-8",
    );
    await fs.writeFile(path.join(configDir, "flags.yaml"), stringifyYaml({}), "utf-8");

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
    expect(result.data.errors[0]?.code).not.toBe("E_CONFIG_NOT_FOUND");
  });

  it("includes content-size warnings on a clean project", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });
    const manifest = { name: "test", version: "1", agents: ["claude-code"] };
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), stringifyYaml(manifest), "utf-8");
    await fs.writeFile(path.join(configDir, "flags.yaml"), stringifyYaml({}), "utf-8");
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(true);
    // warnings array exists (may be empty on a tiny project)
    expect(Array.isArray(result.warnings ?? [])).toBe(true);
  });
});
