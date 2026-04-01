import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { Logger } from "#src/core/output/logger.js";
import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";
import {
  skillEvolveHandler,
  skillVersionsHandler,
} from "#src/cli/skill-evolve-handler.js";
import { writeFeedback } from "#src/core/skill/feedback-collector.js";
import { saveVersion } from "#src/core/skill/version-manager.js";
import type { FeedbackEntry } from "#src/schemas/feedback.js";

let tmpDir: string;
let originalCwd: string;

function makeEntry(
  overrides: Partial<FeedbackEntry> = {},
  index = 0,
): FeedbackEntry {
  return {
    id: `a1b2c3d4-e5f6-7890-abcd-ef123456789${index}`,
    skillName: "commit",
    timestamp: `2026-03-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
    agent: "claude-code",
    taskSummary: `Task ${index}`,
    outcome: "success",
    issues: [],
    suggestions: [],
    ...overrides,
  };
}

async function setupSkillWithFeedback(
  configDir: string,
  skillName: string,
  feedbackCount: number,
): Promise<string> {
  const skillDir = path.join(configDir, "skills", skillName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    `# ${skillName}\n\nDo things.\n`,
  );

  for (let i = 0; i < feedbackCount; i++) {
    await writeFeedback(configDir, makeEntry({ skillName }, i));
  }

  return skillDir;
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `${PROJECT_NAME}-handler-test-`),
  );
  // Create config structure so resolveProjectDir works
  const configDir = path.join(tmpDir, PROJECT_DIR);
  await fs.mkdir(configDir, { recursive: true });
  Logger.init({ level: "error", mode: "human", noColor: true });
  originalCwd = process.cwd();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await cleanupTmpDir(tmpDir);
});

describe("skillEvolveHandler", () => {
  it("returns failure when skill is not ready", async () => {
    const configDir = path.join(tmpDir, ".codi");
    await setupSkillWithFeedback(configDir, "commit", 1); // only 1, need 3

    const result = await skillEvolveHandler(tmpDir, "commit", false);
    expect(result.success).toBe(false);
  });

  it("returns success with prompt when skill has enough feedback", async () => {
    const configDir = path.join(tmpDir, ".codi");
    await setupSkillWithFeedback(configDir, "commit", 3);

    const result = await skillEvolveHandler(tmpDir, "commit", false);
    expect(result.success).toBe(true);
    expect(result.data.action).toBe("evolve");
    expect(result.data.skillName).toBe("commit");
    expect(result.data.version).toBe(1);
    expect(result.data.prompt).toContain("# Skill Improvement Request: commit");
  });

  it("dry-run does not save a version", async () => {
    const configDir = path.join(tmpDir, ".codi");
    const skillDir = await setupSkillWithFeedback(configDir, "commit", 3);

    const result = await skillEvolveHandler(tmpDir, "commit", true);
    expect(result.success).toBe(true);
    expect(result.data.version).toBeUndefined();
    expect(result.data.prompt).toContain("Skill Improvement Request");

    // Verify no versions directory was created
    const versionsDir = path.join(skillDir, "versions");
    await expect(fs.access(versionsDir)).rejects.toThrow();
  });

  it("returns failure when skill does not exist", async () => {
    const result = await skillEvolveHandler(tmpDir, "nonexistent", false);
    expect(result.success).toBe(false);
  });
});

describe("skillVersionsHandler", () => {
  it("lists versions as table", async () => {
    const configDir = path.join(tmpDir, ".codi");
    const skillDir = await setupSkillWithFeedback(configDir, "commit", 0);

    // Save two versions
    await saveVersion(skillDir);
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "# commit v2\n\nUpdated.\n",
    );
    await saveVersion(skillDir);

    const result = await skillVersionsHandler(tmpDir, "commit", {});
    expect(result.success).toBe(true);
    expect(result.data.versions).toHaveLength(2);
  });

  it("returns empty list when no versions exist", async () => {
    const configDir = path.join(tmpDir, ".codi");
    await setupSkillWithFeedback(configDir, "commit", 0);

    const result = await skillVersionsHandler(tmpDir, "commit", {});
    expect(result.success).toBe(true);
    expect(result.data.versions).toHaveLength(0);
  });

  it("restores a version", async () => {
    const configDir = path.join(tmpDir, ".codi");
    const skillDir = await setupSkillWithFeedback(configDir, "commit", 0);
    const original = await fs.readFile(
      path.join(skillDir, "SKILL.md"),
      "utf-8",
    );

    await saveVersion(skillDir);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# modified\n");

    const result = await skillVersionsHandler(tmpDir, "commit", {
      restore: 1,
    });
    expect(result.success).toBe(true);

    const restored = await fs.readFile(
      path.join(skillDir, "SKILL.md"),
      "utf-8",
    );
    expect(restored).toBe(original);
  });

  it("returns failure for restoring non-existent version", async () => {
    const configDir = path.join(tmpDir, ".codi");
    await setupSkillWithFeedback(configDir, "commit", 0);

    const result = await skillVersionsHandler(tmpDir, "commit", {
      restore: 99,
    });
    expect(result.success).toBe(false);
  });

  it("shows diff between versions", async () => {
    const configDir = path.join(tmpDir, ".codi");
    const skillDir = await setupSkillWithFeedback(configDir, "commit", 0);

    await saveVersion(skillDir);
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "# commit\n\nNew content.\n",
    );
    await saveVersion(skillDir);

    const result = await skillVersionsHandler(tmpDir, "commit", {
      diff: "1,2",
    });
    expect(result.success).toBe(true);
    expect(result.data.diff).toContain("---");
    expect(result.data.diff).toContain("+++");
  });

  it("rejects invalid diff format", async () => {
    const configDir = path.join(tmpDir, ".codi");
    await setupSkillWithFeedback(configDir, "commit", 0);

    const result = await skillVersionsHandler(tmpDir, "commit", {
      diff: "not-numbers",
    });
    expect(result.success).toBe(false);
  });
});
