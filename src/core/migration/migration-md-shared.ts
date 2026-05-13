/**
 * Shared primitives for importing top-level instruction Markdown files
 * (CLAUDE.md, AGENTS.md) into Codi `.codi/rules/`.
 *
 * Both source files follow the same convention — `##` headings define
 * rules, the section body is rule content. The only per-source variances
 * are the filename and the description prefix. Everything else (slug
 * normalisation, frontmatter shape, directory creation, error wrapping)
 * is identical and lives here.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { Result } from "#src/types/result.js";
import type { NormalizedRule } from "#src/types/config.js";
import { ok, err } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import { resolveProjectDir } from "#src/utils/paths.js";
import { MANAGED_BY_USER } from "#src/constants.js";

export interface MigrationResult {
  rules: NormalizedRule[];
  warnings: string[];
}

interface Section {
  heading: string;
  content: string;
}

/**
 * Split a Markdown document into sections keyed by `## ` headings. Content
 * accumulates until the next H2 — `###` and deeper headings stay nested
 * inside their parent section (matches both CLAUDE.md and AGENTS.md
 * conventions exactly).
 */
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

function sectionToRule(section: Section, sourceFilename: string): NormalizedRule {
  return {
    name: headingToSlug(section.heading),
    description: `Imported from ${sourceFilename}: ${section.heading}`,
    version: 1,
    content: section.content,
    priority: "medium",
    alwaysApply: true,
    managedBy: MANAGED_BY_USER,
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

/**
 * Read a top-level instruction Markdown file, split by `##` headings, and
 * emit one rule per section into `.codi/rules/`. Returns the rules created
 * plus any non-fatal warnings (e.g. write failures for individual rules).
 *
 * Returns `err(E_MIGRATION_FAILED)` only when the source file is missing
 * or the destination rules directory cannot be created.
 */
export async function importInstructionMarkdown(
  projectRoot: string,
  sourceFilename: string,
): Promise<Result<MigrationResult>> {
  const sourcePath = path.join(projectRoot, sourceFilename);
  const warnings: string[] = [];

  let raw: string;
  try {
    raw = await fs.readFile(sourcePath, "utf-8");
  } catch {
    return err([
      createError("E_MIGRATION_FAILED", {
        file: sourceFilename,
        reason: "File not found",
      }),
    ]);
  }

  const sections = splitByH2(raw);
  if (sections.length === 0) {
    warnings.push(`No ## sections found in ${sourceFilename}`);
    return ok({ rules: [], warnings });
  }

  const rules: NormalizedRule[] = [];
  const rulesDir = path.join(resolveProjectDir(projectRoot), "rules");

  try {
    await fs.mkdir(rulesDir, { recursive: true });
  } catch {
    return err([
      createError("E_MIGRATION_FAILED", {
        file: sourceFilename,
        reason: `Cannot create rules directory: ${rulesDir}`,
      }),
    ]);
  }

  for (const section of sections) {
    const rule = sectionToRule(section, sourceFilename);
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
