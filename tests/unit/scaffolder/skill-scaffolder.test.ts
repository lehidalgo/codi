import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createSkill } from "#src/core/scaffolder/skill-scaffolder.js";
import { prefixedName, PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";
import { cleanupTmpDir } from "#tests/helpers/fs.js";

describe("skill scaffolder", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-skill-`));
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates a skill file with default content", async () => {
    const result = await createSkill({ name: "my-skill", configDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toContain(path.join("my-skill", "SKILL.md"));
    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: my-skill");
    expect(content).toContain("managed_by: user");
    expect(content).toContain("Describe when this skill should activate");
  });

  it("creates a skill file with mcp-ops template", async () => {
    const result = await createSkill({
      name: "mcp-usage",
      configDir,
      template: prefixedName("mcp-ops"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: mcp-usage");
    expect(content).toContain("MCP (Model Context Protocol) operations");
  });

  it("creates a skill file with code-review template", async () => {
    const result = await createSkill({
      name: "review",
      configDir,
      template: prefixedName("code-review"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("Structured code review on an uncommitted diff");
  });

  it("creates a skill file with documentation template", async () => {
    const result = await createSkill({
      name: "docs",
      configDir,
      template: prefixedName("project-documentation"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("Documentation creation and maintenance");
  });

  it("rejects invalid skill names", async () => {
    const result = await createSkill({ name: "Invalid_Name", configDir });
    expect(result.ok).toBe(false);
  });

  it("rejects names starting with a digit", async () => {
    const result = await createSkill({ name: "1bad", configDir });
    expect(result.ok).toBe(false);
  });

  it("fails if skill already exists", async () => {
    await createSkill({ name: "existing", configDir });
    const result = await createSkill({ name: "existing", configDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("fails with unknown template", async () => {
    const result = await createSkill({
      name: "test",
      configDir,
      template: "nonexistent",
    });

    expect(result.ok).toBe(false);
  });

  it(`writes to ${PROJECT_DIR}/skills/<name>/SKILL.md directory structure`, async () => {
    const result = await createSkill({ name: "flat-test", configDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expected = path.join(configDir, "skills", "flat-test", "SKILL.md");
    expect(result.data).toBe(expected);

    const evalsJson = await fs.readFile(
      path.join(configDir, "skills", "flat-test", "evals", "evals.json"),
      "utf-8",
    );
    const parsed = JSON.parse(evalsJson);
    expect(parsed.skillName).toBe("flat-test");
    expect(parsed.cases).toEqual([]);

    for (const sub of ["scripts", "references", "assets", "agents"]) {
      const gitkeep = path.join(configDir, "skills", "flat-test", sub, ".gitkeep");
      await expect(fs.access(gitkeep)).resolves.toBeUndefined();
    }
  });

  it("creates LICENSE.txt in skill directory", async () => {
    const result = await createSkill({
      name: "licensed-skill",
      configDir,
      copyrightHolder: "test-project",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const licensePath = path.join(configDir, "skills", "licensed-skill", "LICENSE.txt");
    const content = await fs.readFile(licensePath, "utf-8");
    expect(content).toContain("MIT License");
    expect(content).toContain("test-project");
  });

  it("uses Contributors as default copyright holder", async () => {
    const result = await createSkill({ name: "default-holder", configDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const licensePath = path.join(configDir, "skills", "default-holder", "LICENSE.txt");
    const content = await fs.readFile(licensePath, "utf-8");
    expect(content).toContain("Contributors");
  });
});
