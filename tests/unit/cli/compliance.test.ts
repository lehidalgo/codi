import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { complianceHandler } from "#src/cli/compliance.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

describe("compliance command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-compliance-"));
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reports failures when no .codi/ directory exists", async () => {
    const result = await complianceHandler(tmpDir, {});

    expect(result.command).toBe("compliance");
    expect(result.data.configValid).toBe(false);
    expect(result.data.checks.length).toBeGreaterThan(0);
    // Without --ci, exit code should still be SUCCESS even on failure
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("exits non-zero with --ci when checks fail", async () => {
    const result = await complianceHandler(tmpDir, { ci: true });

    expect(result.data.configValid).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.DOCTOR_FAILED);
  });

  it("reports compliance for a valid project", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(path.join(codiDir, "rules"), { recursive: true });

    const manifest = { name: "test", version: "1", agents: ["claude-code"] };
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      stringifyYaml(manifest),
      "utf-8",
    );
    await fs.writeFile(
      path.join(codiDir, "flags.yaml"),
      stringifyYaml({}),
      "utf-8",
    );

    const result = await complianceHandler(tmpDir, {});

    expect(result.data.configValid).toBe(true);
    expect(result.data.token).toMatch(/^codi-[a-f0-9]{12}$/);
    expect(result.data.ruleCount).toBeGreaterThanOrEqual(0);
    expect(result.data.skillCount).toBeGreaterThanOrEqual(0);
    expect(result.data.agentCount).toBeGreaterThanOrEqual(0);
    expect(result.data.flagCount).toBeGreaterThanOrEqual(0);
    expect(typeof result.data.generationAge).toBe("string");
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("includes drift check in results", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      'name: test\nversion: "1"\n',
      "utf-8",
    );

    const result = await complianceHandler(tmpDir, {});

    const driftCheck = result.data.checks.find((c) => c.check === "drift");
    expect(driftCheck).toBeDefined();
  });

  it("returns all expected data fields", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      'name: test\nversion: "1"\n',
      "utf-8",
    );

    const result = await complianceHandler(tmpDir, {});
    const data = result.data;

    expect(typeof data.configValid).toBe("boolean");
    expect(typeof data.versionMatch).toBe("boolean");
    expect(typeof data.hasDrift).toBe("boolean");
    expect(typeof data.ruleCount).toBe("number");
    expect(typeof data.skillCount).toBe("number");
    expect(typeof data.agentCount).toBe("number");
    expect(typeof data.flagCount).toBe("number");
    expect(typeof data.token).toBe("string");
    expect(typeof data.generationAge).toBe("string");
    expect(Array.isArray(data.checks)).toBe(true);
  });
});
