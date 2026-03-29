import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRule } from "#src/core/scaffolder/rule-scaffolder.js";

describe("rule scaffolder", () => {
  let tmpDir: string;
  let codiDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-rule-"));
    codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a rule file with default content", async () => {
    const result = await createRule({ name: "my-rule", codiDir });

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
      codiDir,
      template: "security",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("project-security");
  });

  it("replaces {{name}} placeholder in template content", async () => {
    const result = await createRule({
      name: "custom-style",
      codiDir,
      template: "code-style",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).not.toContain("{{name}}");
  });

  it("rejects invalid names", async () => {
    const result = await createRule({ name: "Invalid_Name", codiDir });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("Invalid rule name");
  });

  it("rejects names starting with a digit", async () => {
    const result = await createRule({ name: "1bad", codiDir });
    expect(result.ok).toBe(false);
  });

  it("fails if rule already exists", async () => {
    await createRule({ name: "existing", codiDir });
    const result = await createRule({ name: "existing", codiDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("fails with unknown template", async () => {
    const result = await createRule({
      name: "test",
      codiDir,
      template: "nonexistent-template",
    });

    expect(result.ok).toBe(false);
  });
});
