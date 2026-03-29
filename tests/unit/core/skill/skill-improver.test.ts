import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Logger } from "#src/core/output/logger.js";
import {
  validateEvolveReadiness,
  generateImprovementPrompt,
  buildImproveOptions,
} from "#src/core/skill/skill-improver.js";
import type { ImproveOptions } from "#src/core/skill/skill-improver.js";
import { writeFeedback } from "#src/core/skill/feedback-collector.js";
import type { FeedbackEntry } from "#src/schemas/feedback.js";
import type { SkillStatsResult } from "#src/core/skill/skill-stats.js";

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

function makeStats(
  overrides: Partial<SkillStatsResult> = {},
): SkillStatsResult {
  return {
    skillName: "commit",
    totalEntries: 5,
    successRate: 80,
    topIssues: [],
    healthGrade: "B",
    trend: "stable",
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-improver-test-"));
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("validateEvolveReadiness", () => {
  it("returns not ready when skill does not exist", async () => {
    const result = await validateEvolveReadiness(tmpDir, "nonexistent");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ready).toBe(false);
      expect(result.data.skillExists).toBe(false);
    }
  });

  it("returns not ready when insufficient feedback", async () => {
    const skillDir = path.join(tmpDir, "skills", "commit");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# commit");

    // Write only 1 feedback entry (need 3)
    await writeFeedback(tmpDir, makeEntry());

    const result = await validateEvolveReadiness(tmpDir, "commit");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ready).toBe(false);
      expect(result.data.skillExists).toBe(true);
      expect(result.data.feedbackCount).toBe(1);
      expect(result.data.minimumRequired).toBe(3);
    }
  });

  it("returns ready when skill exists and has enough feedback", async () => {
    const skillDir = path.join(tmpDir, "skills", "commit");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# commit");

    for (let i = 0; i < 3; i++) {
      await writeFeedback(tmpDir, makeEntry({}, i));
    }

    const result = await validateEvolveReadiness(tmpDir, "commit");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ready).toBe(true);
      expect(result.data.feedbackCount).toBe(3);
    }
  });
});

describe("generateImprovementPrompt", () => {
  it("includes skill content and performance summary", async () => {
    const options: ImproveOptions = {
      skillName: "commit",
      skillContent: "# commit\n\nStep 1: Review changes",
      stats: makeStats(),
      entries: [makeEntry()],
    };

    const result = await generateImprovementPrompt(options);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain("# Skill Improvement Request: commit");
      expect(result.data).toContain("Step 1: Review changes");
      expect(result.data).toContain("Health Grade");
      expect(result.data).toContain("80%");
      expect(result.data).toContain("## Instructions");
    }
  });

  it("includes top issues when present", async () => {
    const entries = [
      makeEntry({
        outcome: "partial",
        issues: [
          {
            category: "missing-step",
            description: "No CSRF check",
            severity: "high",
          },
        ],
      }),
    ];

    const options: ImproveOptions = {
      skillName: "commit",
      skillContent: "# commit",
      stats: makeStats({
        topIssues: [{ category: "missing-step", count: 1 }],
      }),
      entries,
    };

    const result = await generateImprovementPrompt(options);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain("missing-step");
      expect(result.data).toContain("No CSRF check");
    }
  });

  it("includes suggestions when present", async () => {
    const entries = [makeEntry({ suggestions: ["Add CSRF validation step"] })];

    const options: ImproveOptions = {
      skillName: "commit",
      skillContent: "# commit",
      stats: makeStats(),
      entries,
    };

    const result = await generateImprovementPrompt(options);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain("Add CSRF validation step");
      expect(result.data).toContain("Agent Suggestions");
    }
  });

  it("includes eval results when provided", async () => {
    const options: ImproveOptions = {
      skillName: "commit",
      skillContent: "# commit",
      stats: makeStats(),
      entries: [makeEntry()],
      evalsSummary: { total: 5, passed: 3, failed: 2 },
    };

    const result = await generateImprovementPrompt(options);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain("3/5");
      expect(result.data).toContain("Eval Results");
    }
  });

  it("omits eval section when no evals", async () => {
    const options: ImproveOptions = {
      skillName: "commit",
      skillContent: "# commit",
      stats: makeStats(),
      entries: [makeEntry()],
    };

    const result = await generateImprovementPrompt(options);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toContain("Eval Results");
    }
  });
});

describe("buildImproveOptions", () => {
  it("builds options from codiDir and skillName", async () => {
    const skillDir = path.join(tmpDir, "skills", "commit");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "# commit\n\nDo things",
    );

    for (let i = 0; i < 3; i++) {
      await writeFeedback(tmpDir, makeEntry({}, i));
    }

    const result = await buildImproveOptions(tmpDir, "commit");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.skillName).toBe("commit");
      expect(result.data.skillContent).toContain("# commit");
      expect(result.data.stats.totalEntries).toBe(3);
      expect(result.data.entries).toHaveLength(3);
    }
  });

  it("returns error when skill does not exist", async () => {
    const result = await buildImproveOptions(tmpDir, "nonexistent");
    expect(result.ok).toBe(false);
  });
});
