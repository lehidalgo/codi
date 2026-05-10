import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { codexAdapter } from "#src/adapters/codex.js";
import type { NormalizedConfig } from "#src/types/config.js";
import type { GeneratedFile, GenerateOptions } from "#src/types/agent.js";

function fakeConfig(): NormalizedConfig {
  return {
    manifest: {
      name: "qa-adapter",
      description: "qa scaffold for hook-selection emission tests",
      version: "0.0.0",
    },
    rules: [],
    skills: [],
    agents: [],
    flags: {},
    mcp: { servers: [] },
  } as unknown as NormalizedConfig;
}

function writeState(projectRoot: string, runtimeSelection: string[]): void {
  mkdirSync(join(projectRoot, ".codi", ".state"), { recursive: true });
  writeFileSync(
    join(projectRoot, ".codi", ".state", "state.json"),
    JSON.stringify(
      {
        version: "1",
        lastGenerated: new Date().toISOString(),
        agents: {},
        hooks: [],
        selectedHooks: { git: [], runtime: runtimeSelection },
      },
      null,
      2,
    ),
  );
}

function findFile(files: GeneratedFile[], suffix: string): GeneratedFile | undefined {
  return files.find((f) => f.path.endsWith(suffix));
}

describe("adapter emission honours selectedHooks.runtime", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "codi-qa-emit-"));
  });

  afterEach(() => rmSync(projectRoot, { recursive: true, force: true }));

  describe("claude-code adapter", () => {
    it("emits skill-tracker + InstructionsLoaded when enabled", async () => {
      writeState(projectRoot, ["skill-tracker", "skill-observer", "security-reminder"]);
      const opts: GenerateOptions = { projectRoot } as unknown as GenerateOptions;
      const files = await claudeCodeAdapter.generate(fakeConfig(), opts);
      const tracker = findFile(files, "codi-skill-tracker.cjs");
      const settings = findFile(files, ".claude/settings.json");
      expect(tracker).toBeDefined();
      expect(settings).toBeDefined();
      const settingsJson = JSON.parse(settings!.content) as { hooks?: Record<string, unknown> };
      expect(settingsJson.hooks).toHaveProperty("InstructionsLoaded");
    });

    it("skips skill-tracker + InstructionsLoaded when not selected", async () => {
      writeState(projectRoot, ["skill-observer", "security-reminder"]);
      const opts: GenerateOptions = { projectRoot } as unknown as GenerateOptions;
      const files = await claudeCodeAdapter.generate(fakeConfig(), opts);
      const tracker = findFile(files, "codi-skill-tracker.cjs");
      const settings = findFile(files, ".claude/settings.json");
      expect(tracker).toBeUndefined();
      expect(settings).toBeDefined();
      const settingsJson = JSON.parse(settings!.content) as { hooks?: Record<string, unknown> };
      expect(settingsJson.hooks).not.toHaveProperty("InstructionsLoaded");
    });
  });

  describe("codex adapter", () => {
    it("emits observer + Stop launcher entry when enabled", async () => {
      writeState(projectRoot, ["skill-observer", "security-reminder"]);
      const opts: GenerateOptions = { projectRoot } as unknown as GenerateOptions;
      const files = await codexAdapter.generate(fakeConfig(), opts);
      const observer = findFile(files, "codi-skill-observer.cjs");
      const hooks = findFile(files, ".codex/hooks.json");
      expect(observer).toBeDefined();
      expect(hooks).toBeDefined();
      const hooksJson = JSON.parse(hooks!.content) as {
        Stop?: Array<{ command: string }>;
      };
      const stopCmds = (hooksJson.Stop ?? []).map((h) => h.command);
      expect(stopCmds.some((c) => c.includes("codi-skill-observer.cjs"))).toBe(true);
    });

    it("skips observer + Stop launcher entry when not selected", async () => {
      writeState(projectRoot, ["security-reminder"]);
      const opts: GenerateOptions = { projectRoot } as unknown as GenerateOptions;
      const files = await codexAdapter.generate(fakeConfig(), opts);
      const observer = findFile(files, "codi-skill-observer.cjs");
      const hooks = findFile(files, ".codex/hooks.json");
      expect(observer).toBeUndefined();
      expect(hooks).toBeDefined();
      const hooksJson = JSON.parse(hooks!.content) as {
        Stop?: Array<{ command: string }>;
      };
      const stopCmds = (hooksJson.Stop ?? []).map((h) => h.command);
      expect(stopCmds.some((c) => c.includes("codi-skill-observer.cjs"))).toBe(false);
      expect(stopCmds.some((c) => c.includes("codi hook stop"))).toBe(true);
    });
  });
});
