/**
 * ISSUE-087 — workflow yaml scaffolder.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createWorkflow } from "#src/core/scaffolder/workflow-scaffolder.js";
import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";
import { cleanupTmpDir } from "#tests/helpers/fs.js";

describe("workflow scaffolder", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-workflow-`));
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("writes a stub workflow.yaml under .codi/workflows/", async () => {
    const result = await createWorkflow({ name: "my-workflow", configDir });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain(path.join("workflows", "my-workflow.yaml"));
    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("id: my-workflow");
    expect(content).toContain("name: my-workflow");
    expect(content).toContain("phases:");
    expect(content).toContain("  intent:");
    expect(content).toContain("  execute:");
    expect(content).toContain("  done:");
    expect(content).toContain("maintainers:");
  });

  it("rejects invalid kebab-case names", async () => {
    const result = await createWorkflow({ name: "Invalid Name", configDir });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("E_CONFIG_INVALID");
  });

  it("rejects existing workflow without --force", async () => {
    await createWorkflow({ name: "dup", configDir });
    const second = await createWorkflow({ name: "dup", configDir });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.errors[0]!.message).toContain("already exists");
  });

  it("overwrites existing workflow with --force", async () => {
    await createWorkflow({ name: "dup-force", configDir });
    const second = await createWorkflow({ name: "dup-force", configDir, force: true });
    expect(second.ok).toBe(true);
  });
});
