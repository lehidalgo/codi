import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createAgent } from "#src/core/scaffolder/agent-scaffolder.js";
import { prefixedName, PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";
import { cleanupTmpDir } from "../../helpers/fs.js";

describe("agent scaffolder", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-agent-`));
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("creates an agent file with default content", async () => {
    const result = await createAgent({ name: "my-agent", configDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toContain(path.join("agents", "my-agent.md"));
    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: my-agent");
    expect(content).toContain("managed_by: user");
    expect(content).toContain("Add your agent system prompt here.");
  });

  it("creates an agent from a known template", async () => {
    const result = await createAgent({
      name: "reviewer",
      configDir,
      template: prefixedName("code-reviewer"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("reviewer");
  });

  it("replaces {{name}} placeholder in template content", async () => {
    const result = await createAgent({
      name: "my-reviewer",
      configDir,
      template: prefixedName("test-generator"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).not.toContain("{{name}}");
  });

  it("rejects invalid names", async () => {
    const result = await createAgent({ name: "Invalid_Name", configDir });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("Invalid agent name");
  });

  it("fails if agent already exists", async () => {
    await createAgent({ name: "existing", configDir });
    const result = await createAgent({ name: "existing", configDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("fails with unknown template", async () => {
    const result = await createAgent({
      name: "test",
      configDir,
      template: "nonexistent-template",
    });

    expect(result.ok).toBe(false);
  });
});
