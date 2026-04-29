import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import {
  checkProjectVersion,
  checkGeneratedFreshness,
  checkProjectDirectory,
  runAllChecks,
} from "#src/core/version/version-checker.js";
import { hashContent } from "#src/utils/hash.js";
import { PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

describe("checkProjectVersion", () => {
  it("passes when version satisfies exact match", () => {
    // This tests against the actual package version
    const result = checkProjectVersion(">=0.0.1");
    expect(result.check).toBe(`${PROJECT_NAME}-version`);
    expect(result.passed).toBe(true);
  });

  it("fails when required version is impossibly high", () => {
    const result = checkProjectVersion(">=99.0.0");
    expect(result.passed).toBe(false);
    expect(result.message).toContain("does not satisfy");
  });
});

describe("checkGeneratedFreshness", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-version-`));
    await fs.mkdir(path.join(tmpDir, PROJECT_DIR), { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("passes when no state file exists", async () => {
    const results = await checkGeneratedFreshness(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(true);
  });

  it("returns passed when driftMode is off", async () => {
    const results = await checkGeneratedFreshness(tmpDir, "off");
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(true);
    expect(results[0]!.message).toContain("disabled");
  });

  it("reports synced when tracked files match", async () => {
    const filePath = path.join(tmpDir, "CLAUDE.md");
    const content = "# Test output";
    await fs.writeFile(filePath, content, "utf-8");

    const stateData = {
      version: "1",
      lastGenerated: new Date().toISOString(),
      agents: {
        "claude-code": [
          {
            path: filePath,
            sourceHash: "abc",
            generatedHash: hashContent(content),
            sources: [MANIFEST_FILENAME],
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
    await fs.writeFile(path.join(tmpDir, PROJECT_DIR, "state.json"), JSON.stringify(stateData));

    const results = await checkGeneratedFreshness(tmpDir);
    const claudeResult = results.find((r) => r.check === "drift-claude-code");
    expect(claudeResult).toBeDefined();
    expect(claudeResult!.passed).toBe(true);
    expect(claudeResult!.message).toContain("up to date");
  });

  it("reports drift when tracked files are missing", async () => {
    const stateData = {
      version: "1",
      lastGenerated: new Date().toISOString(),
      agents: {
        "claude-code": [
          {
            path: "CLAUDE.md",
            sourceHash: "abc",
            generatedHash: "def",
            sources: [MANIFEST_FILENAME],
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
    await fs.writeFile(path.join(tmpDir, PROJECT_DIR, "state.json"), JSON.stringify(stateData));

    const results = await checkGeneratedFreshness(tmpDir);
    const claudeResult = results.find((r) => r.check === "drift-claude-code");
    expect(claudeResult).toBeDefined();
    expect(claudeResult!.passed).toBe(false);
    expect(claudeResult!.message).toContain("out of sync");
  });
});

describe("checkProjectDirectory", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-doctor-dir-`));
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it(`fails when ${PROJECT_DIR} directory does not exist`, async () => {
    const result = await checkProjectDirectory(tmpDir);
    expect(result.passed).toBe(false);
    expect(result.message).toContain(`${PROJECT_DIR}/ directory has issues`);
  });

  it(`passes with valid ${PROJECT_DIR} directory`, async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), `name: test\nversion: "1"\n`);

    const result = await checkProjectDirectory(tmpDir);
    expect(result.passed).toBe(true);
  });
});

describe("runAllChecks", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-all-checks-`));
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("returns report with allPassed when everything is valid", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), `name: test\nversion: "1"\n`);

    // Install both hook scripts so the new hook-installed checks pass
    const hookDir = path.join(tmpDir, ".git", "hooks");
    await fs.mkdir(hookDir, { recursive: true });
    for (const name of [`${PROJECT_NAME}-version-bump.mjs`, `${PROJECT_NAME}-version-verify.mjs`]) {
      const p = path.join(hookDir, name);
      await fs.writeFile(p, "#!/usr/bin/env node\n");
      await fs.chmod(p, 0o755);
    }

    const result = await runAllChecks(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.allPassed).toBe(true);
  });

  it("includes templates-loadable check that passes for the bundle", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), `name: test\nversion: "1"\n`);
    const result = await runAllChecks(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const check = result.data.results.find((c) => c.check === "templates-loadable");
    expect(check).toBeDefined();
    expect(check?.passed).toBe(true);
  });

  it("flags missing pre-commit/pre-push hooks", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), `name: test\nversion: "1"\n`);

    const result = await runAllChecks(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const preCommit = result.data.results.find((c) => c.check === "pre-commit-hook-installed");
    const prePush = result.data.results.find((c) => c.check === "pre-push-hook-installed");
    expect(preCommit?.passed).toBe(false);
    expect(prePush?.passed).toBe(false);
  });

  it("checks version requirement from manifest", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      `name: test\nversion: "1"\nengine:\n  requiredVersion: ">=99.0.0"\n`,
    );

    const result = await runAllChecks(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.allPassed).toBe(false);
    const versionResult = result.data.results.find((r) => r.check === `${PROJECT_NAME}-version`);
    expect(versionResult).toBeDefined();
    expect(versionResult!.passed).toBe(false);
  });

  it("skips drift checks when driftMode is off", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), `name: test\nversion: "1"\n`);

    const result = await runAllChecks(tmpDir, "off");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const freshnessResult = result.data.results.find((r) => r.check === "generated-freshness");
    expect(freshnessResult).toBeDefined();
    expect(freshnessResult!.passed).toBe(true);
    expect(freshnessResult!.message).toContain("disabled");
  });
});
