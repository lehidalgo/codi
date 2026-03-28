import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claudeCodeAdapter } from "../../src/adapters/claude-code.js";
import { cursorAdapter } from "../../src/adapters/cursor.js";
import { codexAdapter } from "../../src/adapters/codex.js";
import { windsurfAdapter } from "../../src/adapters/windsurf.js";
import { clineAdapter } from "../../src/adapters/cline.js";
import { createMockConfig } from "../unit/adapters/mock-config.js";
import type { NormalizedConfig } from "../../src/types/config.js";
import type { ResolvedFlagEntry } from "../../src/types/flags.js";

function makeStrictFlags(): NormalizedConfig["flags"] {
  const entry = (value: unknown): ResolvedFlagEntry => ({
    value,
    mode: "enforced",
    source: "codi.yaml",
    locked: false,
  });

  return {
    allow_force_push: entry(false),
    allow_file_deletion: entry(false),
    allow_shell_commands: entry(false),
    require_pr_review: entry(true),
    test_before_commit: entry(true),
    security_scan: entry(true),
    auto_commit: entry(false),
  };
}

function makePermissiveFlags(): NormalizedConfig["flags"] {
  const entry = (value: unknown): ResolvedFlagEntry => ({
    value,
    mode: "enforced",
    source: "codi.yaml",
    locked: false,
  });

  return {
    allow_force_push: entry(true),
    allow_file_deletion: entry(true),
    allow_shell_commands: entry(true),
    require_pr_review: entry(false),
    test_before_commit: entry(false),
    security_scan: entry(false),
    auto_commit: entry(true),
  };
}

describe("permission enforcement across all agents", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      `codi-perm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("strict flags produce enforcement in all agents", () => {
    const config = createMockConfig({ flags: makeStrictFlags() });

    it("Claude Code: .claude/settings.json has permissions.deny", async () => {
      const files = await claudeCodeAdapter.generate(config, {
        projectRoot: tmpDir,
      });
      const settings = files.find((f) => f.path === ".claude/settings.json");
      expect(settings).toBeDefined();

      const parsed = JSON.parse(settings!.content);
      expect(parsed.permissions).toBeDefined();
      expect(parsed.permissions.deny).toEqual(
        expect.arrayContaining([
          "Bash(git push --force *)",
          "Bash(rm -rf *)",
          "Bash",
        ]),
      );
    });

    it("Cursor: .cursor/hooks.json has beforeShellExecution", async () => {
      const files = await cursorAdapter.generate(config, {
        projectRoot: tmpDir,
      });
      const hooks = files.find((f) => f.path === ".cursor/hooks.json");
      expect(hooks).toBeDefined();

      const parsed = JSON.parse(hooks!.content);
      expect(parsed.beforeShellExecution).toBeDefined();
      expect(parsed.beforeShellExecution.length).toBeGreaterThan(0);
    });

    it("Codex: .codex/config.toml has shell_tool=false and BLOCKED text", async () => {
      const files = await codexAdapter.generate(config, {
        projectRoot: tmpDir,
      });
      const toml = files.find((f) => f.path === ".codex/config.toml");
      expect(toml).toBeDefined();

      expect(toml!.content).toContain("shell_tool = false");
      expect(toml!.content).toContain("BLOCKED");
    });

    it("Windsurf: .windsurfrules has RESTRICTIONS section", async () => {
      const files = await windsurfAdapter.generate(config, {
        projectRoot: tmpDir,
      });
      const rules = files.find((f) => f.path === ".windsurfrules");
      expect(rules).toBeDefined();

      expect(rules!.content).toContain("## RESTRICTIONS (ENFORCED)");
      expect(rules!.content).toContain("BLOCKED: git push --force");
      expect(rules!.content).toContain("BLOCKED: rm -rf");
      expect(rules!.content).toContain("BLOCKED: All shell commands");
      expect(rules!.content).toContain(
        "REQUIRED: All changes must go through pull request",
      );
      expect(rules!.content).toContain("REQUIRED: Run the test suite");
      expect(rules!.content).toContain("REQUIRED: Run security scans");
    });

    it("Cline: .clinerules has RESTRICTIONS section", async () => {
      const files = await clineAdapter.generate(config, {
        projectRoot: tmpDir,
      });
      const rules = files.find((f) => f.path === ".clinerules");
      expect(rules).toBeDefined();

      expect(rules!.content).toContain("## RESTRICTIONS (ENFORCED)");
      expect(rules!.content).toContain("BLOCKED: git push --force");
      expect(rules!.content).toContain("BLOCKED: rm -rf");
      expect(rules!.content).toContain("BLOCKED: All shell commands");
      expect(rules!.content).toContain(
        "REQUIRED: All changes must go through pull request",
      );
    });
  });

  describe("permissive flags produce no restrictions", () => {
    const config = createMockConfig({ flags: makePermissiveFlags() });

    it("Windsurf: no RESTRICTIONS section", async () => {
      const files = await windsurfAdapter.generate(config, {
        projectRoot: tmpDir,
      });
      const rules = files.find((f) => f.path === ".windsurfrules");
      expect(rules!.content).not.toContain("## RESTRICTIONS (ENFORCED)");
    });

    it("Cline: no RESTRICTIONS section", async () => {
      const files = await clineAdapter.generate(config, {
        projectRoot: tmpDir,
      });
      const rules = files.find((f) => f.path === ".clinerules");
      expect(rules!.content).not.toContain("## RESTRICTIONS (ENFORCED)");
    });

    it("Claude Code: no permissions.deny in settings", async () => {
      const files = await claudeCodeAdapter.generate(config, {
        projectRoot: tmpDir,
      });
      const settings = files.find((f) => f.path === ".claude/settings.json");
      if (settings) {
        const parsed = JSON.parse(settings.content);
        expect(parsed.permissions?.deny ?? []).toEqual([]);
      }
    });
  });
});
