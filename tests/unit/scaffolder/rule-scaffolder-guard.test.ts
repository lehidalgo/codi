import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";
import { cleanupTmpDir } from "../../helpers/fs.js";

vi.mock("#src/core/scaffolder/template-loader.js", () => ({
  loadTemplate: vi.fn(),
}));

import { loadTemplate } from "#src/core/scaffolder/template-loader.js";
import { createRule } from "#src/core/scaffolder/rule-scaffolder.js";

describe("rule scaffolder frontmatter guard", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-rule-guard-`),
    );
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("falls back to default content when template lacks frontmatter", async () => {
    vi.mocked(loadTemplate).mockReturnValue({
      ok: true,
      data: "# No frontmatter here\n\nJust plain content without YAML header.",
    } as never);

    const result = await createRule({
      name: "broken-template",
      configDir,
      template: "some-template",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    // Should contain default frontmatter fields since the guard kicked in
    expect(content).toContain("---");
    expect(content).toContain("name: broken-template");
    expect(content).toContain("managed_by: user");
    expect(content).toContain("Add your rule content here.");
  });

  it("preserves template content when frontmatter is valid", async () => {
    const validTemplate = [
      "---",
      "name: {{name}}",
      "description: A valid template",
      "priority: high",
      "alwaysApply: true",
      "managed_by: user",
      "---",
      "",
      "# {{name}}",
      "",
      "Valid rule content.",
    ].join("\n");

    vi.mocked(loadTemplate).mockReturnValue({
      ok: true,
      data: validTemplate,
    } as never);

    const result = await createRule({
      name: "valid-rule",
      configDir,
      template: "some-template",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: valid-rule");
    expect(content).toContain("Valid rule content.");
    // Should NOT contain default placeholder text
    expect(content).not.toContain("Add your rule content here.");
  });

  it("handles template with leading whitespace before frontmatter", async () => {
    const templateWithWhitespace = [
      "  ---",
      "name: {{name}}",
      "description: Has leading spaces",
      "---",
      "",
      "Content here.",
    ].join("\n");

    vi.mocked(loadTemplate).mockReturnValue({
      ok: true,
      data: templateWithWhitespace,
    } as never);

    const result = await createRule({
      name: "whitespace-rule",
      configDir,
      template: "some-template",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    // trimStart() should handle leading whitespace, so frontmatter is detected
    expect(content).not.toContain("Add your rule content here.");
  });
});
