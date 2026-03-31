import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  registerAdapter,
  clearAdapters,
} from "#src/core/generator/adapter-registry.js";
import { generate } from "#src/core/generator/generator.js";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { codexAdapter } from "#src/adapters/codex.js";
import { createMockConfig } from "./mock-config.js";
import { PROJECT_NAME } from "#src/constants.js";

describe("generator", () => {
  const tmpDir = join(tmpdir(), `${PROJECT_NAME}-test-generator-` + Date.now());

  beforeEach(async () => {
    clearAdapters();
    registerAdapter(claudeCodeAdapter);
    registerAdapter(codexAdapter);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    clearAdapters();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("generates files for specified agents", async () => {
    const config = createMockConfig({
      manifest: { name: "test", version: "1", agents: ["claude-code"] },
    });
    const result = await generate(config, tmpDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.agents).toEqual(["claude-code"]);
      expect(result.data.files.length).toBeGreaterThan(0);
    }
  });

  it("writes files to disk", async () => {
    const config = createMockConfig({
      manifest: { name: "test", version: "1", agents: ["codex"] },
    });
    const result = await generate(config, tmpDir);

    expect(result.ok).toBe(true);
    const content = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("Code Style");
  });

  it("skips file writing in dryRun mode", async () => {
    const config = createMockConfig({
      manifest: { name: "test", version: "1", agents: ["codex"] },
    });
    const result = await generate(config, tmpDir, { dryRun: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.files.length).toBeGreaterThan(0);
    }
    // File should not exist on disk
    await expect(
      readFile(join(tmpDir, "AGENTS.md"), "utf-8"),
    ).rejects.toThrow();
  });

  it("returns error for unknown adapter", async () => {
    const config = createMockConfig({
      manifest: { name: "test", version: "1", agents: ["unknown-agent"] },
    });
    const result = await generate(config, tmpDir);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe("ADAPTER_NOT_FOUND");
    }
  });

  it("respects options.agents override", async () => {
    const config = createMockConfig({
      manifest: { name: "test", version: "1", agents: ["claude-code"] },
    });
    const result = await generate(config, tmpDir, { agents: ["codex"] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.agents).toEqual(["codex"]);
    }
  });
});
