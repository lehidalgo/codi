import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Logger } from "#src/core/output/logger.js";
import { writeFeedback } from "#src/core/skill/feedback-collector.js";
import {
  saveVersion,
  listVersions,
  restoreVersion,
  diffVersions,
} from "#src/core/skill/version-manager.js";
import {
  validateEvolveReadiness,
  buildImproveOptions,
  generateImprovementPrompt,
} from "#src/core/skill/skill-improver.js";
import type { FeedbackEntry } from "#src/schemas/feedback.js";

let tmpDir: string;

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

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-evolve-pipeline-"));
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("Skill evolve pipeline (end-to-end)", () => {
  it("write feedback → validate → save version → generate prompt", async () => {
    // 1. Create skill
    const skillDir = path.join(tmpDir, "skills", "commit");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: commit\n---\n\n# commit\n\nStep 1: Review changes\nStep 2: Write message\n",
    );

    // 2. Write feedback entries (need >= 3)
    const entries = [
      makeEntry({ outcome: "success" }, 0),
      makeEntry(
        {
          outcome: "partial",
          issues: [
            {
              category: "missing-step",
              description: "No scope check",
              severity: "medium",
            },
          ],
        },
        1,
      ),
      makeEntry(
        { outcome: "success", suggestions: ["Add breaking change detection"] },
        2,
      ),
      makeEntry(
        {
          outcome: "failure",
          issues: [
            {
              category: "missing-step",
              description: "No CSRF",
              severity: "high",
            },
          ],
        },
        3,
      ),
    ];

    for (const entry of entries) {
      const writeResult = await writeFeedback(tmpDir, entry);
      expect(writeResult.ok).toBe(true);
    }

    // 3. Validate readiness
    const readiness = await validateEvolveReadiness(tmpDir, "commit");
    expect(readiness.ok).toBe(true);
    if (!readiness.ok) return;
    expect(readiness.data.ready).toBe(true);
    expect(readiness.data.feedbackCount).toBe(4);

    // 4. Save version before evolving
    const versionResult = await saveVersion(skillDir);
    expect(versionResult.ok).toBe(true);
    if (!versionResult.ok) return;
    expect(versionResult.data.version).toBe(1);

    // 5. Build options and generate prompt
    const optionsResult = await buildImproveOptions(tmpDir, "commit");
    expect(optionsResult.ok).toBe(true);
    if (!optionsResult.ok) return;

    const promptResult = await generateImprovementPrompt(optionsResult.data);
    expect(promptResult.ok).toBe(true);
    if (!promptResult.ok) return;

    // Verify prompt content
    const prompt = promptResult.data;
    expect(prompt).toContain("# Skill Improvement Request: commit");
    expect(prompt).toContain("Step 1: Review changes");
    expect(prompt).toContain("missing-step");
    expect(prompt).toContain("No scope check");
    expect(prompt).toContain("Add breaking change detection");
    expect(prompt).toContain("## Instructions");

    // 6. Verify version was saved
    const versions = await listVersions(skillDir);
    expect(versions.ok).toBe(true);
    if (versions.ok) {
      expect(versions.data).toHaveLength(1);
      expect(versions.data[0]!.version).toBe(1);
    }
  });

  it("save version → modify → evolve → restore → verify original", async () => {
    const skillDir = path.join(tmpDir, "skills", "commit");
    await fs.mkdir(skillDir, { recursive: true });
    const originalContent =
      "---\nname: commit\n---\n\n# commit\n\nStep 1: Review\n";
    await fs.writeFile(path.join(skillDir, "SKILL.md"), originalContent);

    // Write enough feedback
    for (let i = 0; i < 3; i++) {
      await writeFeedback(tmpDir, makeEntry({}, i));
    }

    // Save v1
    const v1 = await saveVersion(skillDir);
    expect(v1.ok).toBe(true);

    // Simulate agent improving the skill
    const improvedContent =
      "---\nname: commit\n---\n\n# commit\n\nStep 1: Review\nStep 2: Validate\n";
    await fs.writeFile(path.join(skillDir, "SKILL.md"), improvedContent);

    // Save v2
    const v2 = await saveVersion(skillDir);
    expect(v2.ok).toBe(true);

    // Verify diff between v1 and v2
    const diff = await diffVersions(skillDir, 1, 2);
    expect(diff.ok).toBe(true);
    if (diff.ok) {
      expect(diff.data).toContain("+Step 2: Validate");
    }

    // Restore to v1
    const restore = await restoreVersion(skillDir, 1);
    expect(restore.ok).toBe(true);

    // Verify restored content matches original
    const restored = await fs.readFile(
      path.join(skillDir, "SKILL.md"),
      "utf-8",
    );
    expect(restored).toBe(originalContent);

    // Verify we have 2 versions in history
    const versions = await listVersions(skillDir);
    expect(versions.ok).toBe(true);
    if (versions.ok) {
      expect(versions.data).toHaveLength(2);
    }
  });

  it("generates clean prompt when all feedback is successful", async () => {
    const skillDir = path.join(tmpDir, "skills", "review");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "# review\n\nReview code.",
    );

    // All successes, no issues, no suggestions
    for (let i = 0; i < 3; i++) {
      await writeFeedback(
        tmpDir,
        makeEntry({ skillName: "review", outcome: "success" }, i),
      );
    }

    const opts = await buildImproveOptions(tmpDir, "review");
    expect(opts.ok).toBe(true);
    if (!opts.ok) return;

    const prompt = await generateImprovementPrompt(opts.data);
    expect(prompt.ok).toBe(true);
    if (!prompt.ok) return;

    // Should have header + content + performance + instructions but NOT issues/suggestions
    expect(prompt.data).toContain("# Skill Improvement Request: review");
    expect(prompt.data).toContain("100%");
    expect(prompt.data).toContain("## Instructions");
    expect(prompt.data).not.toContain("Top Issues");
    expect(prompt.data).not.toContain("Agent Suggestions");
  });

  it("rejects evolve when insufficient feedback", async () => {
    const skillDir = path.join(tmpDir, "skills", "review");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# review");

    // Only 1 entry (need 3)
    await writeFeedback(tmpDir, makeEntry({ skillName: "review" }, 0));

    const readiness = await validateEvolveReadiness(tmpDir, "review");
    expect(readiness.ok).toBe(true);
    if (readiness.ok) {
      expect(readiness.data.ready).toBe(false);
      expect(readiness.data.reason).toContain("at least 3");
    }
  });
});
