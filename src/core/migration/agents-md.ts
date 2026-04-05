import fs from "node:fs/promises";
import path from "node:path";
import type { Result } from "#src/types/result.js";
import type { NormalizedRule } from "#src/types/config.js";
import { ok, err } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import { resolveProjectDir } from "#src/utils/paths.js";

export interface MigrationResult {
  rules: NormalizedRule[];
  warnings: string[];
}

interface Section {
  heading: string;
  content: string;
}

function splitByH2(text: string): Section[] {
  const sections: Section[] = [];
  const lines = text.split("\n");
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const h2Match = /^##\s+(.+)$/.exec(line);
    if (h2Match) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n").trim(),
        });
      }
      currentHeading = h2Match[1]!;
      currentLines = [];
    } else if (currentHeading) {
      currentLines.push(line);
    }
  }

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim(),
    });
  }

  return sections;
}

function headingToSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sectionToRule(section: Section): NormalizedRule {
  return {
    name: headingToSlug(section.heading),
    description: `Imported from AGENTS.md: ${section.heading}`,
    version: 1,
    content: section.content,
    priority: "medium",
    alwaysApply: true,
    managedBy: "user",
  };
}

function buildFrontmatter(rule: NormalizedRule): string {
  const lines = [
    "---",
    `name: ${rule.name}`,
    `description: "${rule.description}"`,
    `version: ${rule.version}`,
    `priority: ${rule.priority}`,
    `alwaysApply: ${rule.alwaysApply}`,
    `managed_by: ${rule.managedBy}`,
    "---",
    "",
    rule.content,
  ];
  return lines.join("\n");
}

export async function importAgentsMd(projectRoot: string): Promise<Result<MigrationResult>> {
  const agentsMdPath = path.join(projectRoot, "AGENTS.md");
  const warnings: string[] = [];

  let raw: string;
  try {
    raw = await fs.readFile(agentsMdPath, "utf-8");
  } catch {
    return err([
      createError("E_MIGRATION_FAILED", {
        file: "AGENTS.md",
        reason: "File not found",
      }),
    ]);
  }

  const sections = splitByH2(raw);
  if (sections.length === 0) {
    warnings.push("No ## sections found in AGENTS.md");
    return ok({ rules: [], warnings });
  }

  const rules: NormalizedRule[] = [];
  const rulesDir = path.join(resolveProjectDir(projectRoot), "rules");

  try {
    await fs.mkdir(rulesDir, { recursive: true });
  } catch {
    return err([
      createError("E_MIGRATION_FAILED", {
        file: "AGENTS.md",
        reason: `Cannot create rules directory: ${rulesDir}`,
      }),
    ]);
  }

  for (const section of sections) {
    const rule = sectionToRule(section);
    rules.push(rule);

    const filePath = path.join(rulesDir, `${rule.name}.md`);
    const content = buildFrontmatter(rule);

    try {
      await fs.writeFile(filePath, content, "utf-8");
    } catch (cause) {
      warnings.push(`Failed to write rule ${rule.name}: ${(cause as Error).message}`);
    }
  }

  return ok({ rules, warnings });
}
