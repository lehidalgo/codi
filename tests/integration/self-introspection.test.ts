import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { cleanupTmpDir } from "../helpers/fs.js";
import os from "node:os";
import { initHandler } from "../../src/cli/init.js";
import { generateHandler } from "../../src/cli/generate.js";
import { statusHandler } from "../../src/cli/status.js";
import { validateHandler } from "../../src/cli/validate.js";
import { addRuleHandler } from "../../src/cli/add.js";
import { Logger } from "../../src/core/output/logger.js";
import { clearAdapters } from "../../src/core/generator/adapter-registry.js";
import {
  prefixedName,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PROJECT_DIR,
  MANIFEST_FILENAME,
} from "../../src/constants.js";

const ALL_AGENTS = ["claude-code", "cursor", "codex", "windsurf", "cline"];

let tmpDir: string;

beforeEach(async () => {
  const base = await fs.mkdtemp(
    path.join(os.tmpdir(), `${PROJECT_NAME}-self-`),
  );
  tmpDir = path.join(base, "test-project");
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ name: "test-project", version: "1.0.0" }),
    "utf-8",
  );
  clearAdapters();
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await cleanupTmpDir(path.dirname(tmpDir));
  clearAdapters();
});

describe("Self-introspection (dogfooding)", () => {
  it("init with --agents specifies all 5 agents", async () => {
    const result = await initHandler(tmpDir, { agents: ALL_AGENTS });
    expect(result.success).toBe(true);
    expect(result.data.agents).toEqual(ALL_AGENTS);

    const yaml = await fs.readFile(
      path.join(tmpDir, PROJECT_DIR, MANIFEST_FILENAME),
      "utf-8",
    );
    for (const agent of ALL_AGENTS) {
      expect(yaml).toContain(agent);
    }
  });

  it("init rejects unknown agent IDs", async () => {
    const result = await initHandler(tmpDir, {
      agents: ["claude-code", "unknown-agent"],
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]?.message).toContain("unknown-agent");
  });

  it(
    "full pipeline: init, add rules, validate, generate, status, drift",
    { timeout: 30000 },
    async () => {
      // 1. Init with all agents
      const initResult = await initHandler(tmpDir, { agents: ALL_AGENTS });
      expect(initResult.success).toBe(true);

      // 2. Add rules
      const codeQuality = await addRuleHandler(tmpDir, "code-quality", {
        template: prefixedName("code-style"),
      });
      expect(codeQuality.success).toBe(true);

      const security = await addRuleHandler(tmpDir, "security", {
        template: prefixedName("security"),
      });
      expect(security.success).toBe(true);

      const testing = await addRuleHandler(tmpDir, "testing-standards", {
        template: prefixedName("testing"),
      });
      expect(testing.success).toBe(true);

      // 3. Validate
      const validateResult = await validateHandler(tmpDir);
      expect(validateResult.success).toBe(true);
      expect(validateResult.data.valid).toBe(true);

      // 4. Generate
      const genResult = await generateHandler(tmpDir, { force: true });
      expect(genResult.success).toBe(true);
      expect(genResult.data.agents).toEqual(ALL_AGENTS);
      expect(genResult.data.filesGenerated).toBeGreaterThan(0);

      // 5. Verify generated files exist and contain verification section
      const expectedFiles = [
        "CLAUDE.md",
        ".cursorrules",
        "AGENTS.md",
        ".windsurfrules",
        ".clinerules",
      ];
      for (const file of expectedFiles) {
        const filePath = path.join(tmpDir, file);
        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);

        const content = await fs.readFile(filePath, "utf-8");
        expect(content.length).toBeGreaterThan(0);
        expect(content).toContain(`## ${PROJECT_NAME_DISPLAY} Verification`);
        expect(content).toMatch(new RegExp(`${PROJECT_NAME}-[a-f0-9]{12}`));
      }

      // 6. Status shows no drift
      const statusResult = await statusHandler(tmpDir);
      expect(statusResult.success).toBe(true);
      expect(statusResult.data.hasDrift).toBe(false);

      // 7. Manually edit a file to create drift
      const claudeMd = path.join(tmpDir, "CLAUDE.md");
      const original = await fs.readFile(claudeMd, "utf-8");
      await fs.writeFile(claudeMd, original + "\n# Manual edit\n", "utf-8");

      // 8. Status detects drift
      const driftResult = await statusHandler(tmpDir);
      expect(driftResult.success).toBe(true);
      expect(driftResult.data.hasDrift).toBe(true);

      // 9. Regenerate with --force
      const regenResult = await generateHandler(tmpDir, { force: true });
      expect(regenResult.success).toBe(true);

      // 10. Status shows no drift again
      const finalStatus = await statusHandler(tmpDir);
      expect(finalStatus.success).toBe(true);
      expect(finalStatus.data.hasDrift).toBe(false);
    },
  );

  it("--agents merges with auto-detection for stack", async () => {
    const result = await initHandler(tmpDir, { agents: ["claude-code"] });
    expect(result.success).toBe(true);
    expect(result.data.agents).toEqual(["claude-code"]);
    expect(result.data.stack).toContain("javascript");
  });
});
