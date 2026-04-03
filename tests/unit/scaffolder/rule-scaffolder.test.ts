import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRule } from "#src/core/scaffolder/rule-scaffolder.js";
import { prefixedName, PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";
import { cleanupTmpDir } from "../../helpers/fs.js";

describe("rule scaffolder", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-rule-`));
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates a rule file with default content", async () => {
    const result = await createRule({ name: "my-rule", configDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toContain(path.join("rules", "my-rule.md"));
    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: my-rule");
    expect(content).toContain("managed_by: user");
    expect(content).toContain("Add your rule content here.");
  });

  it("creates a rule from a known template", async () => {
    const result = await createRule({
      name: "project-security",
      configDir,
      template: prefixedName("security"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("project-security");
  });

  it("creates a rule from the output-discipline template", async () => {
    const result = await createRule({
      name: "my-output-discipline",
      configDir,
      template: prefixedName("output-discipline"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("my-output-discipline");
    expect(content).not.toContain("{{name}}");
    expect(content).toContain("Output Discipline");
  });

  it("replaces {{name}} placeholder in template content", async () => {
    const result = await createRule({
      name: "custom-style",
      configDir,
      template: prefixedName("code-style"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).not.toContain("{{name}}");
  });

  it("rejects invalid names", async () => {
    const result = await createRule({ name: "Invalid_Name", configDir });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("Invalid rule name");
  });

  it("rejects names starting with a digit", async () => {
    const result = await createRule({ name: "1bad", configDir });
    expect(result.ok).toBe(false);
  });

  it("fails if rule already exists", async () => {
    await createRule({ name: "existing", configDir });
    const result = await createRule({ name: "existing", configDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("fails with unknown template", async () => {
    const result = await createRule({
      name: "test",
      configDir,
      template: "nonexistent-template",
    });

    expect(result.ok).toBe(false);
  });
});
