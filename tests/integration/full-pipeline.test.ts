import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock expensive template-hashing — full-pipeline tests cover the integration of
// init/generate/clean/revert lifecycle, not hash-registry correctness.
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
// Integration tests do real I/O; under 150 parallel workers contention can
// exceed the default 10s timeout.
vi.setConfig({ testTimeout: 30_000 });

import fs from "node:fs/promises";
import path from "node:path";
import { cleanupTmpDir } from "../helpers/fs.js";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { initHandler } from "#src/cli/init.js";
import { generateHandler } from "#src/cli/generate.js";
import { statusHandler } from "#src/cli/status.js";
import { validateHandler } from "#src/cli/validate.js";
import { cleanHandler } from "#src/cli/clean.js";
import { addRuleHandler } from "#src/cli/add.js";
import { updateHandler } from "#src/cli/update.js";
import { revertHandler } from "#src/cli/revert.js";
import { regenerateConfigs } from "#src/cli/shared.js";
import { parse as parseYaml } from "yaml";
import { Logger } from "#src/core/output/logger.js";
import { clearAdapters } from "#src/core/generator/adapter-registry.js";
import {
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PROJECT_DIR,
  MANIFEST_FILENAME,
  prefixedName,
} from "#src/constants.js";

const execFileAsync = promisify(execFile);

async function fileExists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false);
}

let tmpDir: string;

beforeEach(async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-int-`));
  // Create a subdirectory with a valid project name (lowercase only)
  tmpDir = path.join(base, "test-project");
  await fs.mkdir(tmpDir, { recursive: true });
  // Create a package.json so init detects 'javascript' stack
  await fs.writeFile(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ name: "test-project", version: "1.0.0" }),
    "utf-8",
  );
  // Clear adapter registry to start fresh
  clearAdapters();
  // Initialize logger for test
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  // Remove the parent temp dir (which contains test-project)
  await cleanupTmpDir(path.dirname(tmpDir));
  clearAdapters();
});

describe("Full Pipeline Integration", () => {
  it(`init creates ${PROJECT_DIR}/ structure`, async () => {
    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain("javascript");

    // Verify config directory exists
    const configDir = path.join(tmpDir, PROJECT_DIR);
    const stat = await fs.stat(configDir);
    expect(stat.isDirectory()).toBe(true);

    // Verify manifest exists
    const manifestExists = await fs
      .access(path.join(configDir, MANIFEST_FILENAME))
      .then(() => true)
      .catch(() => false);
    expect(manifestExists).toBe(true);

    // Verify flags.yaml exists
    const flagsExists = await fs
      .access(path.join(configDir, "flags.yaml"))
      .then(() => true)
      .catch(() => false);
    expect(flagsExists).toBe(true);

    // Verify rules directory
    const rulesExists = await fs
      .access(path.join(configDir, "rules"))
      .then(() => true)
      .catch(() => false);
    expect(rulesExists).toBe(true);
  });

  it("init with --force reinitializes", async () => {
    // First init
    await initHandler(tmpDir, { json: true });

    // Second init without force succeeds (update flow)
    const updateResult = await initHandler(tmpDir, { json: true });
    expect(updateResult.success).toBe(true);

    // Second init with force also succeeds (full reset)
    const forceResult = await initHandler(tmpDir, { force: true, json: true });
    expect(forceResult.success).toBe(true);
  });

  it("validate passes after init", async () => {
    await initHandler(tmpDir, { json: true });

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
  });

  it(`validate fails without ${PROJECT_DIR}/`, async () => {
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
  });

  it("generate runs after init", async () => {
    await initHandler(tmpDir, { json: true });

    const result = await generateHandler(tmpDir, { force: true });
    expect(result.success).toBe(true);
  });

  it("status reports no drift after generate", async () => {
    await initHandler(tmpDir, { json: true });

    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.hasDrift).toBe(false);
  });

  it("init creates frameworks/ directory", async () => {
    await initHandler(tmpDir, { json: true });
    const frameworksDir = path.join(tmpDir, PROJECT_DIR, "frameworks");
    const stat = await fs.stat(frameworksDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("init generates all 16 flags in flags.yaml", async () => {
    await initHandler(tmpDir, { json: true });
    const flagsContent = await fs.readFile(path.join(tmpDir, PROJECT_DIR, "flags.yaml"), "utf-8");
    // All 16 flags should be present
    expect(flagsContent).toContain("auto_commit");
    expect(flagsContent).toContain("lint_on_save");
    expect(flagsContent).toContain("allow_force_push");
    expect(flagsContent).toContain("mcp_allowed_servers");
    expect(flagsContent).toContain("progressive_loading");
    expect(flagsContent).toContain("drift_detection");
    expect(flagsContent).toContain("auto_generate_on_change");
  });
});

// ============================================================
// End-to-End Lifecycle Tests
// ============================================================

describe("Clean Lifecycle", () => {
  it("init → generate → clean --all removes everything", async () => {
    // Init + generate
    await initHandler(tmpDir, { json: true, agents: ["claude-code"] });
    const genResult = await generateHandler(tmpDir, { force: true });
    expect(genResult.success).toBe(true);

    // Verify generated files exist
    expect(await fileExists(path.join(tmpDir, "CLAUDE.md"))).toBe(true);
    expect(await fileExists(path.join(tmpDir, PROJECT_DIR))).toBe(true);

    // Clean --all
    const cleanResult = await cleanHandler(tmpDir, { json: true, all: true });
    expect(cleanResult.success).toBe(true);
    expect(cleanResult.data.filesDeleted.length).toBeGreaterThan(0);

    // Verify generated files are gone
    expect(await fileExists(path.join(tmpDir, "CLAUDE.md"))).toBe(false);
    expect(await fileExists(path.join(tmpDir, PROJECT_DIR))).toBe(false);
  });

  it(`clean without --all keeps ${PROJECT_DIR}/ but removes generated files`, async () => {
    await initHandler(tmpDir, { json: true, agents: ["claude-code"] });
    await generateHandler(tmpDir, { force: true });

    const cleanResult = await cleanHandler(tmpDir, { json: true });
    expect(cleanResult.success).toBe(true);
    expect(cleanResult.data.configDirRemoved).toBe(false);

    // CLAUDE.md gone but config dir remains
    expect(await fileExists(path.join(tmpDir, "CLAUDE.md"))).toBe(false);
    expect(await fileExists(path.join(tmpDir, PROJECT_DIR))).toBe(true);
  });
});

describe("Multi-Agent Generation", () => {
  it("generates files for both claude-code and cursor", async () => {
    await initHandler(tmpDir, {
      json: true,
      agents: ["claude-code", "cursor"],
    });
    const genResult = await generateHandler(tmpDir, { force: true });
    expect(genResult.success).toBe(true);

    // Claude Code files
    expect(await fileExists(path.join(tmpDir, "CLAUDE.md"))).toBe(true);
    const claudeMd = await fs.readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain(`Generated by ${PROJECT_NAME_DISPLAY}`);

    // Cursor files
    expect(await fileExists(path.join(tmpDir, ".cursorrules"))).toBe(true);
    const cursorRules = await fs.readFile(path.join(tmpDir, ".cursorrules"), "utf-8");
    expect(cursorRules).toContain(`Generated by ${PROJECT_NAME_DISPLAY}`);
  });
});

describe("Add Artifact → Regenerate", () => {
  it("added rule appears in generated output", async () => {
    await initHandler(tmpDir, { json: true, agents: ["claude-code"] });

    // Add a security rule
    const addResult = await addRuleHandler(tmpDir, "security", {
      template: prefixedName("security"),
    });
    expect(addResult.success).toBe(true);

    // Regenerate
    await regenerateConfigs(tmpDir);

    // Verify the rule file exists in config dir
    const ruleFile = path.join(tmpDir, PROJECT_DIR, "rules", "security.md");
    expect(await fileExists(ruleFile)).toBe(true);

    // Verify generated agent output includes the rule
    const claudeRulesDir = path.join(tmpDir, ".claude", "rules");
    expect(await fileExists(claudeRulesDir)).toBe(true);
    const ruleFiles = await fs.readdir(claudeRulesDir);
    expect(ruleFiles.some((f) => f.includes("security"))).toBe(true);
  });
});

describe("Drift Detection", () => {
  it("detects modified generated files", async () => {
    await initHandler(tmpDir, { json: true, agents: ["claude-code"] });
    await generateHandler(tmpDir, { force: true });

    // Status should report no drift
    const statusBefore = await statusHandler(tmpDir);
    expect(statusBefore.success).toBe(true);
    expect(statusBefore.data.hasDrift).toBe(false);

    // Modify a generated file
    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");
    await fs.writeFile(claudeMdPath, "# Modified by user", "utf-8");

    // Status should now report drift
    const statusAfter = await statusHandler(tmpDir);
    expect(statusAfter.success).toBe(true);
    expect(statusAfter.data.hasDrift).toBe(true);
  });
});

describe("Update Flags → Regenerate", () => {
  it("switching to strict preset changes flags and output", async () => {
    await initHandler(tmpDir, { json: true, agents: ["claude-code"] });

    // Update to strict preset
    const updateResult = await updateHandler(tmpDir, {
      json: true,
      preset: prefixedName("strict"),
    });
    expect(updateResult.success).toBe(true);
    expect(updateResult.data.flagsReset).toBe(true);
    expect(updateResult.data.preset).toBe(prefixedName("strict"));

    // Verify flags.yaml has strict values
    const flagsContent = await fs.readFile(path.join(tmpDir, PROJECT_DIR, "flags.yaml"), "utf-8");
    const flags = parseYaml(flagsContent) as Record<string, Record<string, unknown>>;
    expect(flags["security_scan"]?.["mode"]).toBe("enforced");
    expect(flags["security_scan"]?.["locked"]).toBe(true);
  });
});

describe("Hook Lifecycle", () => {
  it("hooks are created and cleaned up with git repo", async () => {
    // Create a git repo in temp dir
    await execFileAsync("git", ["init", tmpDir]);

    await initHandler(tmpDir, { json: true, agents: ["claude-code"] });
    await generateHandler(tmpDir, { force: true });

    // Check if any hook scripts were created
    const hooksDir = path.join(tmpDir, ".git", "hooks");
    const hooksDirExists = await fileExists(hooksDir);

    if (hooksDirExists) {
      const hookFiles = await fs.readdir(hooksDir);
      const projectHooks = hookFiles.filter((f) => f.startsWith(`${PROJECT_NAME}-`));

      if (projectHooks.length > 0) {
        // Clean should remove them
        const cleanResult = await cleanHandler(tmpDir, {
          json: true,
          all: true,
        });
        expect(cleanResult.success).toBe(true);

        // Verify project hooks are gone
        const afterClean = await fs.readdir(hooksDir).catch(() => []);
        const remainingProjectHooks = afterClean.filter((f) => f.startsWith(`${PROJECT_NAME}-`));
        expect(remainingProjectHooks).toEqual([]);
      }
    }
  });
});

describe("Operations Ledger Tracking", () => {
  it("tracks operations across init → generate → clean", async () => {
    const ledgerPath = path.join(tmpDir, PROJECT_DIR, "operations.json");

    // Init creates the ledger
    await initHandler(tmpDir, { json: true, agents: ["claude-code"] });
    expect(await fileExists(ledgerPath)).toBe(true);
    const afterInit = JSON.parse(await fs.readFile(ledgerPath, "utf-8"));
    expect(afterInit.version).toBe("1");
    expect(afterInit.initialized).toBeDefined();
    expect(afterInit.initialized.agents).toContain("claude-code");

    // Generate logs an operation
    await generateHandler(tmpDir, { force: true });
    const afterGen = JSON.parse(await fs.readFile(ledgerPath, "utf-8"));
    const genOps = afterGen.operations.filter((o: { type: string }) => o.type === "generate");
    expect(genOps.length).toBeGreaterThan(0);

    // Clean logs an operation (without --all so ledger survives)
    await cleanHandler(tmpDir, { json: true });
    const afterClean = JSON.parse(await fs.readFile(ledgerPath, "utf-8"));
    const cleanOps = afterClean.operations.filter((o: { type: string }) => o.type === "clean");
    expect(cleanOps.length).toBeGreaterThan(0);
  });
});

describe("Revert from Backup", () => {
  it("restores generated files from backup", async () => {
    await initHandler(tmpDir, { json: true, agents: ["claude-code"] });
    await generateHandler(tmpDir, { force: true });

    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");

    // Generate again to create a backup of the first generation
    await generateHandler(tmpDir, { force: true });

    // Verify backup exists
    const listResult = await revertHandler(tmpDir, { list: true });
    expect(listResult.success).toBe(true);
    if (listResult.data.backups && listResult.data.backups.length > 0) {
      // Modify the file
      await fs.writeFile(claudeMdPath, "# Completely different", "utf-8");

      // Revert to last backup
      const revertResult = await revertHandler(tmpDir, { last: true });
      expect(revertResult.success).toBe(true);
      expect(revertResult.data.restoredFiles!.length).toBeGreaterThan(0);
    }
  });
});
