import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { PROJECT_DIR, PROJECT_NAME } from "#src/constants.js";
import {
  BRAIN_SESSION_START_FILENAME,
  BRAIN_STOP_FILENAME,
  BRAIN_POST_COMMIT_FILENAME,
} from "#src/core/hooks/brain-hooks.js";
import { createMockConfig } from "./mock-config.js";
import type { NormalizedSkill } from "#src/types/config.js";

function brainSkill(name: string): NormalizedSkill {
  return {
    name,
    description: `${name} skill`,
    content: "# skill body",
    category: "Developer Tools",
    compatibility: {},
    managedBy: PROJECT_NAME,
    userInvocable: true,
  } as unknown as NormalizedSkill;
}

describe("claude-code adapter: brain hook wiring", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      `codi-brain-hooks-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes all three brain hook scripts when a codi-brain-* skill is installed", async () => {
    const config = createMockConfig({
      skills: [brainSkill("codi-brain-decide")],
    });
    const files = await claudeCodeAdapter.generate(config, tmpDir);
    const paths = files.map((f) => f.path);
    expect(paths).toContain(`${PROJECT_DIR}/hooks/${BRAIN_SESSION_START_FILENAME}`);
    expect(paths).toContain(`${PROJECT_DIR}/hooks/${BRAIN_STOP_FILENAME}`);
    expect(paths).toContain(`${PROJECT_DIR}/hooks/${BRAIN_POST_COMMIT_FILENAME}`);
  });

  it("registers the three brain hooks in .claude/settings.json", async () => {
    const config = createMockConfig({
      skills: [brainSkill("codi-brain-decide")],
    });
    const files = await claudeCodeAdapter.generate(config, tmpDir);
    const settingsFile = files.find((f) => f.path === ".claude/settings.json");
    expect(settingsFile).toBeDefined();
    const settings = JSON.parse(settingsFile!.content as string);

    expect(settings.hooks.SessionStart).toBeDefined();
    expect(settings.hooks.Stop).toBeDefined();
    expect(settings.hooks.PostToolUse).toBeDefined();

    const allCommands: string[] = [];
    for (const eventArr of [
      settings.hooks.SessionStart ?? [],
      settings.hooks.Stop ?? [],
      settings.hooks.PostToolUse ?? [],
    ]) {
      for (const entry of eventArr) {
        for (const h of entry.hooks) allCommands.push(h.command);
      }
    }
    expect(allCommands.some((c: string) => c.includes(BRAIN_SESSION_START_FILENAME))).toBe(true);
    expect(allCommands.some((c: string) => c.includes(BRAIN_STOP_FILENAME))).toBe(true);
    expect(allCommands.some((c: string) => c.includes(BRAIN_POST_COMMIT_FILENAME))).toBe(true);
  });

  it("emits NO brain hook files when no codi-brain-* skill is installed", async () => {
    const config = createMockConfig({ skills: [] });
    const files = await claudeCodeAdapter.generate(config, tmpDir);
    const paths = files.map((f) => f.path);
    expect(paths.some((p) => p.includes("brain-session-start"))).toBe(false);
    expect(paths.some((p) => p.includes("brain-stop"))).toBe(false);
    expect(paths.some((p) => p.includes("brain-post-commit"))).toBe(false);
  });

  it("omits SessionStart + PostToolUse from settings when no brain skills", async () => {
    const config = createMockConfig({ skills: [] });
    const files = await claudeCodeAdapter.generate(config, tmpDir);
    const settingsFile = files.find((f) => f.path === ".claude/settings.json");
    const settings = JSON.parse(settingsFile!.content as string);
    expect(settings.hooks.SessionStart).toBeUndefined();
    expect(settings.hooks.PostToolUse).toBeUndefined();
    // Stop is still present (heartbeat observer); but no brain entry:
    const stopCmds = (settings.hooks.Stop ?? []).flatMap(
      (e: { hooks: Array<{ command: string }> }) => e.hooks.map((h) => h.command),
    );
    expect(stopCmds.some((c: string) => c.includes("brain-stop"))).toBe(false);
  });
});
