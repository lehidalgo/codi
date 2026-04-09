import { describe, it, expect, vi, beforeEach } from "vitest";
import { docsHandler } from "#src/cli/docs.js";

vi.mock("#src/core/docs/artifact-catalog-generator.js", () => ({
  generateCatalogMarkdownFiles: vi.fn().mockResolvedValue(undefined),
  writeCatalogMetaJson: vi.fn().mockResolvedValue("/tmp/catalog-meta.json"),
}));

vi.mock("#src/core/docs/skill-docs-generator.js", () => ({
  exportSkillCatalogJson: vi.fn().mockReturnValue(JSON.stringify({ totalSkills: 0, groups: [] })),
  buildSkillDocsFile: vi.fn().mockResolvedValue("/tmp/test-project/docs/index.html"),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe("docsHandler --catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls catalog generators and returns success", async () => {
    const { generateCatalogMarkdownFiles, writeCatalogMetaJson } =
      await import("#src/core/docs/artifact-catalog-generator.js");
    const result = await docsHandler("/tmp/test-project", { catalog: true });
    expect(result.success).toBe(true);
    expect(result.data?.outputPath).toBeTruthy();
    expect(generateCatalogMarkdownFiles).toHaveBeenCalledWith("/tmp/test-project");
    expect(writeCatalogMetaJson).toHaveBeenCalledWith("/tmp/test-project");
  });

  it("does not call catalog when flag is not set", async () => {
    const { generateCatalogMarkdownFiles } =
      await import("#src/core/docs/artifact-catalog-generator.js");
    await docsHandler("/tmp/test-project", { html: true });
    expect(generateCatalogMarkdownFiles).not.toHaveBeenCalled();
  });
});
