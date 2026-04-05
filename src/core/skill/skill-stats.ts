import type { FeedbackEntry, IssueCategory } from "#src/schemas/feedback.js";

export type HealthGrade = "A" | "B" | "C" | "D" | "F";
export type Trend = "improving" | "stable" | "declining";

export interface SkillStatsResult {
  skillName: string;
  totalEntries: number;
  successRate: number;
  topIssues: Array<{ category: IssueCategory; count: number }>;
  healthGrade: HealthGrade;
  trend: Trend;
}

const TREND_WINDOW = 5;

function computeSuccessRate(entries: FeedbackEntry[]): number {
  if (entries.length === 0) return 0;
  const successes = entries.filter((e) => e.outcome === "success").length;
  return (successes / entries.length) * 100;
}

function computeGrade(successRate: number): HealthGrade {
  if (successRate >= 90) return "A";
  if (successRate >= 75) return "B";
  if (successRate >= 60) return "C";
  if (successRate >= 40) return "D";
  return "F";
}

function computeTrend(entries: FeedbackEntry[]): Trend {
  if (entries.length < TREND_WINDOW * 2) return "stable";

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const recent = sorted.slice(-TREND_WINDOW);
  const previous = sorted.slice(-TREND_WINDOW * 2, -TREND_WINDOW);

  const recentRate = computeSuccessRate(recent);
  const previousRate = computeSuccessRate(previous);
  const diff = recentRate - previousRate;

  if (diff > 10) return "improving";
  if (diff < -10) return "declining";
  return "stable";
}

function computeTopIssues(
  entries: FeedbackEntry[],
): Array<{ category: IssueCategory; count: number }> {
  const counts = new Map<IssueCategory, number>();
  for (const entry of entries) {
    for (const issue of entry.issues) {
      counts.set(issue.category, (counts.get(issue.category) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function aggregateStats(entries: FeedbackEntry[]): SkillStatsResult {
  const skillName = entries.length > 0 ? entries[0]!.skillName : "unknown";
  const successRate = computeSuccessRate(entries);

  return {
    skillName,
    totalEntries: entries.length,
    successRate: Math.round(successRate * 10) / 10,
    topIssues: computeTopIssues(entries),
    healthGrade: computeGrade(successRate),
    trend: computeTrend(entries),
  };
}

export function aggregateAllStats(entries: FeedbackEntry[]): SkillStatsResult[] {
  const bySkill = new Map<string, FeedbackEntry[]>();
  for (const entry of entries) {
    const list = bySkill.get(entry.skillName) ?? [];
    list.push(entry);
    bySkill.set(entry.skillName, list);
  }

  return [...bySkill.entries()]
    .map(([, skillEntries]) => aggregateStats(skillEntries))
    .sort((a, b) => a.skillName.localeCompare(b.skillName));
}

export function formatStatsTable(stats: SkillStatsResult[]): string {
  if (stats.length === 0) return "No feedback data found.";

  const lines = [
    "| Skill | Entries | Success | Grade | Trend | Top Issue |",
    "|-------|--------|---------|-------|-------|-----------|",
  ];

  for (const s of stats) {
    const topIssue =
      s.topIssues.length > 0 ? `${s.topIssues[0]!.category} (${s.topIssues[0]!.count})` : "—";
    lines.push(
      `| ${s.skillName} | ${s.totalEntries} | ${s.successRate}% | ${s.healthGrade} | ${s.trend} | ${topIssue} |`,
    );
  }

  return lines.join("\n");
}

export function formatDetailedStats(stats: SkillStatsResult): string {
  const lines = [
    `## ${stats.skillName}`,
    "",
    `- **Entries**: ${stats.totalEntries}`,
    `- **Success Rate**: ${stats.successRate}%`,
    `- **Health Grade**: ${stats.healthGrade}`,
    `- **Trend**: ${stats.trend}`,
  ];

  if (stats.topIssues.length > 0) {
    lines.push("", "### Top Issues", "");
    for (const issue of stats.topIssues) {
      lines.push(`- ${issue.category}: ${issue.count} occurrence(s)`);
    }
  }

  return lines.join("\n");
}
