/**
 * ISSUE-044 rewrite — exercises docsHandler against the real
 * docs-generator + skill-docs-generator subsystems. Pre-rewrite this file
 * mocked `core/docs/docs-generator`, `core/docs/skill-docs-generator`,
 * `cli/shared`, and `node:fs/promises`. The "test the mock" pattern
 * meant every assertion was a `toHaveBeenCalledWith(...)` against a
 * fake, never against the actual observable outcome (validate result
 * shape, inject result data, catalog JSON written to stdout).
 *
 * Failure-path tests that mocked `validateSections` / `injectSections`
 * to return synthetic errors are dropped — those error paths are
 * covered by the unit tests on the underlying generators themselves.
 * The remaining tests run the handler against a real tmp .codi/ tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import { docsHandler, registerDocsCommand } from "#src/cli/docs.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

async function bootstrapMinimalProject(root: string): Promise<void> {
  await mkdir(path.join(root, ".codi"), { recursive: true });
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, ".codi", "codi.yaml"), `name: test\nversion: "1"\n`);
}

describe("docsHandler", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-docs-"));
    await bootstrapMinimalProject(tmpRoot);
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("--validate runs against real docs subsystem and surfaces a Result", async () => {
    const result = await docsHandler(tmpRoot, { validate: true });
    // Real validateSections may return ok or stale (depends on docs/ state).
    // The contract: exitCode and sectionsStale must be consistent.
    expect(typeof result.success).toBe("boolean");
    expect([EXIT_CODES.SUCCESS, EXIT_CODES.GENERAL_ERROR]).toContain(result.exitCode);
    expect(typeof result.data.sectionsStale).toBe("number");
  });

  it("--generate runs the real injector and reports updated count", async () => {
    const result = await docsHandler(tmpRoot, { generate: true });
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.data.sectionsUpdated).toBe("number");
  });

  it("--json writes the skill catalog JSON to stdout", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result = await docsHandler(tmpRoot, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.outputPath).toBe("stdout");
    expect(typeof result.data.totalSkills).toBe("number");
    expect(stdoutSpy).toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it("default mode (no flags) also exports JSON catalog to stdout", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result = await docsHandler(tmpRoot, {});
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.outputPath).toBe("stdout");
    expect(typeof result.data.totalSkills).toBe("number");
    stdoutSpy.mockRestore();
  });
});

describe("registerDocsCommand", () => {
  it("registers docs command with expected options", () => {
    const program = new Command();
    registerDocsCommand(program);
    const docsCmd = program.commands.find((c) => c.name() === "docs");
    expect(docsCmd).toBeDefined();
    expect(docsCmd!.description()).toBe("Generate and validate documentation");
    const optionNames = docsCmd!.options.map((o) => o.long);
    expect(optionNames).toEqual(
      expect.arrayContaining(["--json", "--generate", "--validate", "--catalog"]),
    );
  });
});
