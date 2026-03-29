import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import {
  MIN_FEEDBACK_FOR_EVOLVE,
  SKILL_OUTPUT_FILENAME,
} from "../../constants.js";
import { readFeedbackForSkill } from "./feedback-collector.js";
import { aggregateStats } from "./skill-stats.js";
import type { SkillStatsResult } from "./skill-stats.js";
import { getEvalsSummary } from "./evals-manager.js";
import type { FeedbackEntry } from "../../schemas/feedback.js";

export interface ImproveOptions {
  skillName: string;
  skillContent: string;
  stats: SkillStatsResult;
  entries: FeedbackEntry[];
  evalsSummary?: { total: number; passed: number; failed: number };
}

export interface EvolveReadiness {
  ready: boolean;
  skillExists: boolean;
  feedbackCount: number;
  minimumRequired: number;
  reason?: string;
}

export async function validateEvolveReadiness(
  codiDir: string,
  skillName: string,
): Promise<Result<EvolveReadiness>> {
  const skillDir = path.join(codiDir, "skills", skillName);
  const skillPath = path.join(skillDir, SKILL_OUTPUT_FILENAME);

  let skillExists = false;
  try {
    await fs.access(skillPath);
    skillExists = true;
  } catch {
    // skill does not exist
  }

  if (!skillExists) {
    return ok({
      ready: false,
      skillExists: false,
      feedbackCount: 0,
      minimumRequired: MIN_FEEDBACK_FOR_EVOLVE,
      reason: `Skill "${skillName}" not found at ${skillPath}`,
    });
  }

  const fbResult = await readFeedbackForSkill(codiDir, skillName);
  const feedbackCount = fbResult.ok ? fbResult.data.length : 0;

  if (feedbackCount < MIN_FEEDBACK_FOR_EVOLVE) {
    return ok({
      ready: false,
      skillExists: true,
      feedbackCount,
      minimumRequired: MIN_FEEDBACK_FOR_EVOLVE,
      reason: `Skill "${skillName}" needs at least ${MIN_FEEDBACK_FOR_EVOLVE} feedback entries to evolve (has ${feedbackCount})`,
    });
  }

  return ok({
    ready: true,
    skillExists: true,
    feedbackCount,
    minimumRequired: MIN_FEEDBACK_FOR_EVOLVE,
  });
}

export async function generateImprovementPrompt(
  options: ImproveOptions,
): Promise<Result<string>> {
  const { skillName, skillContent, stats, entries, evalsSummary } = options;

  const sections: string[] = [];

  // Header
  sections.push(`# Skill Improvement Request: ${skillName}`);

  // Current skill content
  sections.push("## Current Skill Content\n");
  sections.push("```markdown\n" + skillContent + "\n```");

  // Performance summary
  sections.push(buildPerformanceSummary(stats));

  // Top issues
  const issuesSection = buildIssuesSection(stats, entries);
  if (issuesSection) sections.push(issuesSection);

  // Agent suggestions
  const suggestionsSection = buildSuggestionsSection(entries);
  if (suggestionsSection) sections.push(suggestionsSection);

  // Eval results
  if (evalsSummary && evalsSummary.total > 0) {
    sections.push(buildEvalsSection(evalsSummary));
  }

  // Instructions
  sections.push(buildInstructions());

  return ok(sections.join("\n\n"));
}

function buildPerformanceSummary(stats: SkillStatsResult): string {
  const lines = [
    "## Performance Summary",
    "",
    `- **Health Grade**: ${stats.healthGrade} | **Success Rate**: ${stats.successRate}% | **Trend**: ${stats.trend}`,
    `- **Total feedback entries**: ${stats.totalEntries}`,
  ];
  return lines.join("\n");
}

function buildIssuesSection(
  stats: SkillStatsResult,
  entries: FeedbackEntry[],
): string | null {
  if (stats.topIssues.length === 0) return null;

  const lines = ["## Top Issues (fix these)", ""];

  for (const issue of stats.topIssues) {
    lines.push(`### ${issue.category} (${issue.count} occurrences)`);

    // Collect descriptions for this category from entries
    const descriptions: string[] = [];
    for (const entry of entries) {
      for (const i of entry.issues) {
        if (i.category === issue.category && descriptions.length < 5) {
          descriptions.push(
            `- "${i.description}" (severity: ${i.severity})`,
          );
        }
      }
    }
    lines.push(...descriptions, "");
  }

  return lines.join("\n");
}

function buildSuggestionsSection(entries: FeedbackEntry[]): string | null {
  const allSuggestions = entries.flatMap((e) => e.suggestions);
  if (allSuggestions.length === 0) return null;

  const unique = [...new Set(allSuggestions)].slice(0, 10);
  const lines = [
    "## Agent Suggestions (consider these)",
    "",
    ...unique.map((s) => `- "${s}"`),
  ];
  return lines.join("\n");
}

function buildEvalsSection(summary: {
  total: number;
  passed: number;
  failed: number;
}): string {
  return [
    "## Eval Results",
    "",
    `- **${summary.passed}/${summary.total}** passing`,
    summary.failed > 0 ? `- **${summary.failed}** failing` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInstructions(): string {
  return [
    "## Instructions",
    "",
    "- Fix the issues listed above while preserving all currently passing behaviors",
    "- Do not remove steps that are working well",
    "- Keep the same frontmatter format (name, description, compatibility, managed_by)",
    "- Output the complete improved SKILL.md",
  ].join("\n");
}

/**
 * Convenience: build full ImproveOptions from codiDir + skillName.
 */
export async function buildImproveOptions(
  codiDir: string,
  skillName: string,
): Promise<Result<ImproveOptions>> {
  const skillDir = path.join(codiDir, "skills", skillName);
  const skillPath = path.join(skillDir, SKILL_OUTPUT_FILENAME);

  let skillContent: string;
  try {
    skillContent = await fs.readFile(skillPath, "utf-8");
  } catch {
    return err([
      createError("E_SKILL_NOT_FOUND", {
        name: skillName,
        path: skillPath,
      }),
    ]);
  }

  const fbResult = await readFeedbackForSkill(codiDir, skillName);
  const entries = fbResult.ok ? fbResult.data : [];
  const stats = aggregateStats(entries);

  const evalsResult = await getEvalsSummary(skillDir);
  const evalsSummary = evalsResult.ok ? evalsResult.data : undefined;

  return ok({ skillName, skillContent, stats, entries, evalsSummary });
}
