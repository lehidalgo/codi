import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Logger } from "#src/core/output/logger.js";
import {
  writeFeedback,
  readAllFeedback,
  readFeedbackForSkill,
  pruneFeedback,
} from "#src/core/skill/feedback-collector.js";
import {
  aggregateStats,
  aggregateAllStats,
  formatStatsTable,
  formatDetailedStats,
} from "#src/core/skill/skill-stats.js";
import type { FeedbackEntry } from "#src/schemas/feedback.js";

let tmpDir: string;

let entryCounter = 0;

function makeEntry(overrides: Partial<FeedbackEntry> = {}): FeedbackEntry {
  entryCounter++;
  return {
    id: crypto.randomUUID(),
    skillName: "commit",
    // Offset each entry by 1 second to avoid filename collisions
    timestamp: new Date(Date.now() + entryCounter * 1000).toISOString(),
    agent: "claude-code",
    taskSummary: "Test pipeline task",
    outcome: "success",
    issues: [],
    suggestions: [],
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-feedback-pipeline-"));
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("Skill feedback pipeline (end-to-end)", () => {
  it("write → read → aggregate → format", async () => {
    // 1. Write feedback entries for two skills
    const entries = [
      makeEntry({ skillName: "commit", outcome: "success" }),
      makeEntry({ skillName: "commit", outcome: "success" }),
      makeEntry({ skillName: "commit", outcome: "partial" }),
      makeEntry({ skillName: "review", outcome: "success" }),
      makeEntry({ skillName: "review", outcome: "failure" }),
    ];

    for (const entry of entries) {
      const writeResult = await writeFeedback(tmpDir, entry);
      expect(writeResult.ok).toBe(true);
    }

    // 2. Read all feedback
    const readResult = await readAllFeedback(tmpDir);
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.data).toHaveLength(5);

    // 3. Read filtered by skill
    const commitResult = await readFeedbackForSkill(tmpDir, "commit");
    expect(commitResult.ok).toBe(true);
    if (commitResult.ok) {
      expect(commitResult.data).toHaveLength(3);
    }

    // 4. Aggregate stats per skill
    const allStats = aggregateAllStats(readResult.data);
    expect(allStats).toHaveLength(2);

    const commitStats = allStats.find((s) => s.skillName === "commit");
    expect(commitStats).toBeDefined();
    expect(commitStats!.totalEntries).toBe(3);
    expect(commitStats!.successRate).toBeCloseTo(66.67, 0);

    const reviewStats = allStats.find((s) => s.skillName === "review");
    expect(reviewStats).toBeDefined();
    expect(reviewStats!.totalEntries).toBe(2);
    expect(reviewStats!.successRate).toBe(50);

    // 5. Format stats table
    const table = formatStatsTable(allStats);
    expect(table).toContain("| commit |");
    expect(table).toContain("| review |");
    expect(table).toContain("| Skill |");

    // 6. Format detailed stats
    const detail = formatDetailedStats(commitStats!);
    expect(detail).toContain("## commit");
    expect(detail).toContain("Success Rate");
  });

  it("write → prune old → verify only recent remain", async () => {
    // Write an old entry and a fresh entry
    const oldEntry = makeEntry({
      skillName: "commit",
      timestamp: "2020-01-01T00:00:00.000Z",
    });
    const newEntry = makeEntry({ skillName: "commit" });

    await writeFeedback(tmpDir, oldEntry);
    await writeFeedback(tmpDir, newEntry);

    // Prune entries older than 30 days
    const pruneResult = await pruneFeedback(tmpDir, 30);
    expect(pruneResult.ok).toBe(true);
    if (pruneResult.ok) {
      expect(pruneResult.data).toBeGreaterThanOrEqual(1);
    }

    // Only the recent entry should remain
    const remaining = await readAllFeedback(tmpDir);
    expect(remaining.ok).toBe(true);
    if (remaining.ok) {
      expect(remaining.data).toHaveLength(1);
      expect(remaining.data[0]!.id).toBe(newEntry.id);
    }
  });

  it("handles mixed valid/invalid feedback gracefully", async () => {
    // Write valid entry via API
    await writeFeedback(tmpDir, makeEntry());

    // Write invalid JSON directly to feedback dir
    const fbDir = path.join(tmpDir, "feedback");
    await fs.writeFile(path.join(fbDir, "corrupt.json"), "not-json", "utf-8");
    await fs.writeFile(
      path.join(fbDir, "bad-schema.json"),
      JSON.stringify({ id: "not-uuid", skillName: "x" }),
      "utf-8",
    );

    // Read should skip invalid, return only the valid entry
    const result = await readAllFeedback(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }

    // Stats should still work with the single valid entry
    const stats = aggregateStats(result.ok ? result.data : []);
    expect(stats.totalEntries).toBe(1);
    expect(stats.successRate).toBe(100);
  });

  it("aggregates issues across entries", async () => {
    const entries = [
      makeEntry({
        outcome: "partial",
        issues: [
          {
            category: "missing-step",
            description: "No CSRF",
            severity: "high",
          },
        ],
      }),
      makeEntry({
        outcome: "failure",
        issues: [
          {
            category: "missing-step",
            description: "No auth",
            severity: "medium",
          },
          {
            category: "wrong-output",
            description: "Bad format",
            severity: "low",
          },
        ],
      }),
    ];

    for (const entry of entries) {
      await writeFeedback(tmpDir, entry);
    }

    const readResult = await readAllFeedback(tmpDir);
    if (!readResult.ok) return;

    const stats = aggregateStats(readResult.data);
    expect(stats.topIssues[0]!.category).toBe("missing-step");
    expect(stats.topIssues[0]!.count).toBe(2);
  });
});
