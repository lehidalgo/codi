import { describe, it, expect } from "vitest";
import {
  aggregateStats,
  aggregateAllStats,
  formatStatsTable,
  formatDetailedStats,
} from "#src/core/skill/skill-stats.js";
import type { FeedbackEntry } from "#src/schemas/feedback.js";

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

describe("aggregateStats", () => {
  it("returns 100% success rate for all successes", () => {
    const entries = [makeEntry({}, 0), makeEntry({}, 1), makeEntry({}, 2)];
    const stats = aggregateStats(entries);
    expect(stats.successRate).toBe(100);
    expect(stats.healthGrade).toBe("A");
  });

  it("returns 0% for all failures", () => {
    const entries = [
      makeEntry({ outcome: "failure" }, 0),
      makeEntry({ outcome: "failure" }, 1),
    ];
    const stats = aggregateStats(entries);
    expect(stats.successRate).toBe(0);
    expect(stats.healthGrade).toBe("F");
  });

  it("calculates mixed outcomes correctly", () => {
    const entries = [
      makeEntry({ outcome: "success" }, 0),
      makeEntry({ outcome: "partial" }, 1),
      makeEntry({ outcome: "failure" }, 2),
      makeEntry({ outcome: "success" }, 3),
    ];
    const stats = aggregateStats(entries);
    expect(stats.successRate).toBe(50);
    expect(stats.healthGrade).toBe("D");
  });

  it("counts top issues", () => {
    const entries = [
      makeEntry(
        {
          outcome: "partial",
          issues: [
            {
              category: "missing-step",
              description: "No CSRF",
              severity: "high",
            },
          ],
        },
        0,
      ),
      makeEntry(
        {
          outcome: "partial",
          issues: [
            {
              category: "missing-step",
              description: "No auth",
              severity: "medium",
            },
            {
              category: "unclear-step",
              description: "Ambiguous",
              severity: "low",
            },
          ],
        },
        1,
      ),
    ];
    const stats = aggregateStats(entries);
    expect(stats.topIssues[0]!.category).toBe("missing-step");
    expect(stats.topIssues[0]!.count).toBe(2);
  });

  it("returns stable trend with insufficient data", () => {
    const entries = [makeEntry({}, 0), makeEntry({}, 1)];
    const stats = aggregateStats(entries);
    expect(stats.trend).toBe("stable");
  });

  it("detects improving trend", () => {
    const entries: FeedbackEntry[] = [];
    // 5 old failures
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ outcome: "failure" }, i));
    }
    // 5 recent successes
    for (let i = 5; i < 10; i++) {
      entries.push(makeEntry({ outcome: "success" }, i + 10));
    }
    const stats = aggregateStats(entries);
    expect(stats.trend).toBe("improving");
  });

  it("detects declining trend", () => {
    const entries: FeedbackEntry[] = [];
    // 5 old successes
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ outcome: "success" }, i));
    }
    // 5 recent failures
    for (let i = 5; i < 10; i++) {
      entries.push(makeEntry({ outcome: "failure" }, i + 10));
    }
    const stats = aggregateStats(entries);
    expect(stats.trend).toBe("declining");
  });

  it("handles empty entries", () => {
    const stats = aggregateStats([]);
    expect(stats.totalEntries).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.healthGrade).toBe("F");
  });

  describe("grade boundary thresholds", () => {
    function entriesWithRate(
      successCount: number,
      total: number,
    ): FeedbackEntry[] {
      const entries: FeedbackEntry[] = [];
      for (let i = 0; i < total; i++) {
        entries.push(
          makeEntry({ outcome: i < successCount ? "success" : "failure" }, i),
        );
      }
      return entries;
    }

    it("grades exactly 90% as A", () => {
      const stats = aggregateStats(entriesWithRate(9, 10));
      expect(stats.successRate).toBe(90);
      expect(stats.healthGrade).toBe("A");
    });

    it("grades 89% as B (just below A)", () => {
      // 89/100 = 89%
      const stats = aggregateStats(entriesWithRate(89, 100));
      expect(stats.successRate).toBe(89);
      expect(stats.healthGrade).toBe("B");
    });

    it("grades exactly 75% as B", () => {
      const stats = aggregateStats(entriesWithRate(3, 4));
      expect(stats.successRate).toBe(75);
      expect(stats.healthGrade).toBe("B");
    });

    it("grades 74% as C (just below B)", () => {
      const stats = aggregateStats(entriesWithRate(74, 100));
      expect(stats.successRate).toBe(74);
      expect(stats.healthGrade).toBe("C");
    });

    it("grades exactly 60% as C", () => {
      const stats = aggregateStats(entriesWithRate(3, 5));
      expect(stats.successRate).toBe(60);
      expect(stats.healthGrade).toBe("C");
    });

    it("grades 59% as D (just below C)", () => {
      const stats = aggregateStats(entriesWithRate(59, 100));
      expect(stats.successRate).toBe(59);
      expect(stats.healthGrade).toBe("D");
    });

    it("grades exactly 40% as D", () => {
      const stats = aggregateStats(entriesWithRate(2, 5));
      expect(stats.successRate).toBe(40);
      expect(stats.healthGrade).toBe("D");
    });

    it("grades 39% as F (just below D)", () => {
      const stats = aggregateStats(entriesWithRate(39, 100));
      expect(stats.successRate).toBe(39);
      expect(stats.healthGrade).toBe("F");
    });
  });
});

describe("aggregateAllStats", () => {
  it("groups by skill name", () => {
    const entries = [
      makeEntry({ skillName: "commit" }, 0),
      makeEntry({ skillName: "review" }, 1),
      makeEntry({ skillName: "commit" }, 2),
    ];
    const all = aggregateAllStats(entries);
    expect(all).toHaveLength(2);
    expect(all.find((s) => s.skillName === "commit")!.totalEntries).toBe(2);
    expect(all.find((s) => s.skillName === "review")!.totalEntries).toBe(1);
  });

  it("returns empty array for no entries", () => {
    expect(aggregateAllStats([])).toEqual([]);
  });

  it("returns results sorted alphabetically by skill name", () => {
    const entries = [
      makeEntry({ skillName: "zebra" }, 0),
      makeEntry({ skillName: "alpha" }, 1),
      makeEntry({ skillName: "middle" }, 2),
    ];
    const all = aggregateAllStats(entries);
    expect(all.map((s) => s.skillName)).toEqual(["alpha", "middle", "zebra"]);
  });
});

describe("formatStatsTable", () => {
  it("returns message for empty stats", () => {
    expect(formatStatsTable([])).toBe("No feedback data found.");
  });

  it("produces markdown table", () => {
    const stats = aggregateAllStats([makeEntry({ skillName: "commit" }, 0)]);
    const table = formatStatsTable(stats);
    expect(table).toContain("| commit |");
    expect(table).toContain("| Skill |");
  });
});

describe("formatDetailedStats", () => {
  it("produces markdown with skill name heading", () => {
    const stats = aggregateStats([makeEntry({}, 0)]);
    const detail = formatDetailedStats(stats);
    expect(detail).toContain("## commit");
    expect(detail).toContain("Success Rate");
    expect(detail).toContain("Health Grade");
  });
});
