import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { initHandler } from "#src/cli/init.js";
import { Logger } from "#src/core/output/logger.js";
import {
  prefixedName,
  PROJECT_NAME,
  PROJECT_DIR,
  MANIFEST_FILENAME,
} from "#src/constants.js";

describe("init command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-init-`));
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it(`creates ${PROJECT_DIR}/ directory structure`, async () => {
    const result = await initHandler(tmpDir, { json: true });

    expect(result.success).toBe(true);
    expect(result.data.configDir).toBe(path.join(tmpDir, PROJECT_DIR));

    const configDir = path.join(tmpDir, PROJECT_DIR);
    const stat = await fs.stat(configDir);
    expect(stat.isDirectory()).toBe(true);

    const manifest = await fs.readFile(
      path.join(configDir, MANIFEST_FILENAME),
      "utf-8",
    );
    expect(manifest).toContain('version: "1"');

    const flags = await fs.readFile(
      path.join(configDir, "flags.yaml"),
      "utf-8",
    );
    expect(flags).toContain("auto_commit:");

    const rulesDir = await fs.stat(path.join(configDir, "rules"));
    expect(rulesDir.isDirectory()).toBe(true);
  });

  it(`fails if ${PROJECT_DIR}/ already exists without --force`, async () => {
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain("already exists");
  });

  it("reinitializes with --force", async () => {
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });

    const result = await initHandler(tmpDir, { force: true, json: true });
    expect(result.success).toBe(true);
  });

  it("detects javascript stack when package.json exists", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), "{}", "utf-8");

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain("javascript");
  });

  it("detects python stack when pyproject.toml exists", async () => {
    await fs.writeFile(
      path.join(tmpDir, "pyproject.toml"),
      "[build-system]",
      "utf-8",
    );

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain("python");
  });

  it("detects multiple stacks simultaneously", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), "{}", "utf-8");
    await fs.writeFile(
      path.join(tmpDir, "pyproject.toml"),
      "[build-system]",
      "utf-8",
    );

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain("javascript");
    expect(result.data.stack).toContain("python");
  });

  it("creates manifest with correct structure", async () => {
    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);

    const manifest = await fs.readFile(
      path.join(tmpDir, PROJECT_DIR, MANIFEST_FILENAME),
      "utf-8",
    );
    expect(manifest).toContain("name:");
    expect(manifest).toContain('version: "1"');
    expect(manifest).toContain("agents:");
  });

  it("creates flags.yaml with preset defaults", async () => {
    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);

    const flagsContent = await fs.readFile(
      path.join(tmpDir, PROJECT_DIR, "flags.yaml"),
      "utf-8",
    );
    expect(flagsContent).toContain("security_scan:");
  });

  it("rejects unknown preset names", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      preset: "nonexistent",
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.code).toBe("E_CONFIG_INVALID");
    expect(result.errors[0]!.message).toContain("Unknown preset");
    expect(result.errors[0]!.message).toContain("nonexistent");
  });

  it("accepts known preset names", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      preset: prefixedName("strict"),
    });
    expect(result.success).toBe(true);
    expect(result.data.preset).toBe(prefixedName("strict"));
  });

  it("rejects unknown agent IDs", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      agents: ["nonexistent-agent"],
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain("Unknown agent");
  });

  it("accepts known agent IDs", async () => {
    const result = await initHandler(tmpDir, {
      json: true,
      agents: ["claude-code"],
    });
    expect(result.success).toBe(true);
    expect(result.data.agents).toContain("claude-code");
  });

  it("creates operations ledger", async () => {
    await initHandler(tmpDir, { json: true });

    const ledgerPath = path.join(tmpDir, PROJECT_DIR, "operations.json");
    const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf-8"));
    expect(ledger.version).toBe("1");
    expect(ledger.initialized).toBeDefined();
    expect(ledger.initialized.timestamp).toBeDefined();
    expect(Array.isArray(ledger.initialized.stack)).toBe(true);
  });
});
