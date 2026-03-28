import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createCommand } from "../../../src/core/scaffolder/command-scaffolder.js";

describe("command scaffolder", () => {
  let tmpDir: string;
  let codiDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-cmd-"));
    codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a command file with default content", async () => {
    const result = await createCommand({ name: "my-command", codiDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toContain(path.join("commands", "my-command.md"));
    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("name: my-command");
    expect(content).toContain("managed_by: user");
    expect(content).toContain("Add your command instructions here.");
  });

  it("creates a command from a known template", async () => {
    const result = await createCommand({
      name: "my-review",
      codiDir,
      template: "review",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("my-review");
  });

  it("replaces {{name}} placeholder in template content", async () => {
    const result = await createCommand({
      name: "custom-cmd",
      codiDir,
      template: "commit",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).not.toContain("{{name}}");
  });

  it("rejects invalid names", async () => {
    const result = await createCommand({ name: "Invalid_Name", codiDir });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("Invalid command name");
  });

  it("fails if command already exists", async () => {
    await createCommand({ name: "existing", codiDir });
    const result = await createCommand({ name: "existing", codiDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("fails with unknown template", async () => {
    const result = await createCommand({
      name: "test",
      codiDir,
      template: "nonexistent-template",
    });

    expect(result.ok).toBe(false);
  });
});
