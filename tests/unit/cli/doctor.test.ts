import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { doctorHandler } from "../../../src/cli/doctor.js";
import { Logger } from "../../../src/core/output/logger.js";
import { EXIT_CODES } from "../../../src/core/output/exit-codes.js";
import {
  PROJECT_NAME,
  PROJECT_DIR,
  MANIFEST_FILENAME,
} from "../../../src/constants.js";

describe("doctor command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-doctor-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("passes with valid project", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      `name: test\nversion: "1"\n`,
    );

    const result = await doctorHandler(tmpDir, {});
    expect(result.success).toBe(true);
    expect(result.data.allPassed).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("fails with --ci when version mismatch", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      `name: test\nversion: "1"\nengine:\n  requiredVersion: ">=99.0.0"\n`,
    );

    const result = await doctorHandler(tmpDir, { ci: true });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.DOCTOR_FAILED);
  });

  it("succeeds without --ci even when checks fail", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      `name: test\nversion: "1"\nengine:\n  requiredVersion: ">=99.0.0"\n`,
    );

    const result = await doctorHandler(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it(`fails when no ${PROJECT_DIR} directory exists`, async () => {
    const result = await doctorHandler(tmpDir, {});
    expect(result.success).toBe(false);
  });

  it("includes check results in data", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      `name: test\nversion: "1"\n`,
    );

    const result = await doctorHandler(tmpDir, {});
    expect(result.data.results.length).toBeGreaterThan(0);
    expect(result.data.results.every((r) => typeof r.check === "string")).toBe(
      true,
    );
  });
});
