import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock expensive template-hashing — skill-management tests cover the skill lifecycle
// (add, export, feedback), not hash-registry correctness.
vi.mock("#src/core/version/template-hash-registry.js", () => ({
  buildTemplateHashRegistry: vi.fn(() => ({
    cliVersion: "0.0.0",
    generatedAt: new Date().toISOString(),
    templates: {},
  })),
  getTemplateFingerprint: vi.fn(() => undefined),
  getAllFingerprints: vi.fn(() => []),
  _resetRegistryCache: vi.fn(),
}));
import fs from "node:fs/promises";
import path from "node:path";
import { cleanupTmpDir } from "../helpers/fs.js";
import os from "node:os";
import { initHandler } from "#src/cli/init.js";
import { addSkillHandler } from "#src/cli/add-handlers.js";
import { skillExportHandler, skillFeedbackHandler, skillStatsHandler } from "#src/cli/skill.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";
import { clearAdapters } from "#src/core/generator/adapter-registry.js";

let tmpDir: string;

beforeEach(async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-skill-mgmt-`));
  tmpDir = path.join(base, "test-project");
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ name: "test", version: "1.0.0" }),
    "utf-8",
  );
  clearAdapters();
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await cleanupTmpDir(path.dirname(tmpDir));
  clearAdapters();
});

describe("skill management pipeline", () => {
  it("adds a skill and exports it", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });
    const addResult = await addSkillHandler(tmpDir, "my-test-skill", {});

    expect(addResult.success).toBe(true);
    expect(addResult.data.name).toBe("my-test-skill");

    // Verify skill directory was created
    const skillDir = path.join(tmpDir, PROJECT_DIR, "skills", "my-test-skill");
    const stat = await fs.stat(skillDir);
    expect(stat.isDirectory()).toBe(true);

    // Export the skill
    const exportResult = await skillExportHandler(
      tmpDir,
      "my-test-skill",
      "standard",
      path.join(tmpDir, "dist"),
    );
    expect(exportResult.success).toBe(true);
    expect(exportResult.data.format).toBe("standard");
  });

  it("rejects export with invalid format", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });
    await addSkillHandler(tmpDir, "my-skill", {});

    const result = await skillExportHandler(tmpDir, "my-skill", "invalid", ".");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  it("feedback handler returns empty for fresh project", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });

    const result = await skillFeedbackHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.entries).toEqual([]);
  });

  it("stats handler returns empty for fresh project", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });

    const result = await skillStatsHandler(tmpDir);
    expect(result.success).toBe(true);
  });

  it("adds skill with template", async () => {
    await initHandler(tmpDir, { agents: ["claude-code"] });
    const result = await addSkillHandler(tmpDir, "branded", {
      template: "codi-brand-creator",
    });

    expect(result.success).toBe(true);
    expect(result.data.template).toBe("codi-brand-creator");
  });
});
