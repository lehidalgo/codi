import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { cleanupTmpDir } from "../helpers/fs.js";
import os from "node:os";
import { initHandler } from "#src/cli/init.js";
import { docsHandler } from "#src/cli/docs.js";
import { docsUpdateHandler } from "#src/cli/docs-update.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { PROJECT_NAME } from "#src/constants.js";
import { clearAdapters } from "#src/core/generator/adapter-registry.js";

let tmpDir: string;

beforeEach(async () => {
  const base = await fs.mkdtemp(
    path.join(os.tmpdir(), `${PROJECT_NAME}-docs-gen-`),
  );
  tmpDir = path.join(base, "test-project");
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ name: "test", version: "1.0.0" }),
    "utf-8",
  );
  clearAdapters();
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await cleanupTmpDir(path.dirname(tmpDir));
  clearAdapters();
});

describe("docs generation pipeline", () => {
  it("generates HTML docs after init", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });

    const result = await docsHandler(tmpDir, {});

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.outputPath).toContain("index.html");
    expect(result.data.totalSkills).toBeGreaterThanOrEqual(0);
  });

  it("exports JSON catalog to stdout", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });

    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const result = await docsHandler(tmpDir, { json: true });

    expect(result.success).toBe(true);
    expect(result.data.outputPath).toBe("stdout");
    expect(stdoutSpy).toHaveBeenCalled();

    const output = stdoutSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.totalSkills).toBeGreaterThanOrEqual(0);

    stdoutSpy.mockRestore();
  });

  it("docs-update succeeds after init", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });

    const result = await docsUpdateHandler(tmpDir);

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(Array.isArray(result.data.fixed)).toBe(true);
    expect(Array.isArray(result.data.remaining)).toBe(true);
  });

  it("validate docs succeeds on fresh project", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });

    const result = await docsHandler(tmpDir, { validate: true });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});
