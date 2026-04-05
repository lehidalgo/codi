import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { docsHandler, registerDocsCommand } from "#src/cli/docs.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

vi.mock("#src/core/docs/docs-generator.js", () => ({
  validateSections: vi.fn(),
  injectSections: vi.fn(),
}));

vi.mock("#src/core/docs/skill-docs-generator.js", () => ({
  exportSkillCatalogJson: vi.fn(),
  buildSkillDocsFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#src/cli/shared.js", () => ({
  initFromOptions: vi.fn(),
  handleOutput: vi.fn(),
}));

import { validateSections, injectSections } from "#src/core/docs/docs-generator.js";
import { exportSkillCatalogJson, buildSkillDocsFile } from "#src/core/docs/skill-docs-generator.js";

const mockValidateSections = vi.mocked(validateSections);
const mockInjectSections = vi.mocked(injectSections);
const mockExportJson = vi.mocked(exportSkillCatalogJson);
const mockBuildDocs = vi.mocked(buildSkillDocsFile);

describe("docsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when --validate finds no stale sections", async () => {
    mockValidateSections.mockResolvedValue({
      ok: true,
      data: { inSync: true, staleFiles: [], staleSections: [] },
    });

    const result = await docsHandler("/tmp/project", { validate: true });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.sectionsStale).toBe(0);
    expect(mockValidateSections).toHaveBeenCalledWith("/tmp/project");
  });

  it("returns failure when --validate finds stale sections", async () => {
    mockValidateSections.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "STALE",
          message: "section out of date",
          hint: "regenerate",
          severity: "error",
        },
      ],
    });

    const result = await docsHandler("/tmp/project", { validate: true });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.data.sectionsStale).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it("returns success when --generate injects sections", async () => {
    mockInjectSections.mockResolvedValue({
      ok: true,
      data: { updated: ["README.md"], unchanged: [], missing: [] },
    });

    const result = await docsHandler("/tmp/project", { generate: true });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.sectionsUpdated).toBe(1);
    expect(mockInjectSections).toHaveBeenCalledWith("/tmp/project");
  });

  it("returns failure when --generate encounters errors", async () => {
    mockInjectSections.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "WRITE_ERR",
          message: "cannot write",
          hint: "check perms",
          severity: "error",
        },
      ],
    });

    const result = await docsHandler("/tmp/project", { generate: true });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors).toHaveLength(1);
  });

  it("outputs JSON catalog to stdout with --json", async () => {
    const catalog = JSON.stringify({ totalSkills: 5, groups: [] });
    mockExportJson.mockReturnValue(catalog);
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const result = await docsHandler("/tmp/project", { json: true });

    expect(result.success).toBe(true);
    expect(result.data.outputPath).toBe("stdout");
    expect(result.data.totalSkills).toBe(5);
    expect(stdoutSpy).toHaveBeenCalledWith(catalog);

    stdoutSpy.mockRestore();
  });

  it("generates HTML docs by default", async () => {
    mockBuildDocs.mockResolvedValue("/tmp/project/docs/codi_docs/index.html");
    mockExportJson.mockReturnValue(JSON.stringify({ totalSkills: 3, groups: [] }));

    const result = await docsHandler("/tmp/project", {});

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.outputPath).toBe("/tmp/project/docs/codi_docs/index.html");
    expect(result.data.totalSkills).toBe(3);
    expect(mockBuildDocs).toHaveBeenCalledWith("/tmp/project");
  });

  it("skips JSON sidecar when --output is specified", async () => {
    const { writeFile: mockWriteFile } = await import("node:fs/promises");
    mockBuildDocs.mockResolvedValue("/custom/path/index.html");
    mockExportJson.mockReturnValue(JSON.stringify({ totalSkills: 2, groups: [] }));

    await docsHandler("/tmp/project", { output: "/custom/path" });

    // writeFile should NOT be called for the JSON sidecar
    expect(mockWriteFile).not.toHaveBeenCalled();
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
    expect(optionNames).toContain("--json");
    expect(optionNames).toContain("--html");
    expect(optionNames).toContain("--generate");
    expect(optionNames).toContain("--validate");
    expect(optionNames).toContain("--output");
  });
});
