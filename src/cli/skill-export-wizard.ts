import * as p from "@clack/prompts";
import path from "node:path";
import { resolveProjectDir } from "../utils/paths.js";
import { listAvailableSkills } from "../core/skill/skill-export.js";
import type { SkillExportFormat } from "../core/skill/skill-export.js";
import { parseSkillFile } from "../core/config/parser.js";
import {
  SKILL_OUTPUT_FILENAME,
  PROJECT_CLI,
  PROJECT_DIR,
} from "../constants.js";

export interface SkillExportWizardResult {
  name: string;
  format: SkillExportFormat;
  outputDir: string;
}

interface SkillOption {
  name: string;
  description: string;
}

/**
 * Interactive wizard for exporting skills to distributable formats.
 */
export async function runSkillExportWizard(
  projectRoot: string,
): Promise<SkillExportWizardResult | null> {
  p.intro(`${PROJECT_CLI} — Skill Export`);

  const configDir = resolveProjectDir(projectRoot);
  const skillNames = await listAvailableSkills(configDir);

  if (skillNames.length === 0) {
    p.cancel(
      `No skills found in ${PROJECT_DIR}/skills/. Create one first with \`${PROJECT_CLI} add skill\`.`,
    );
    return null;
  }

  // Load descriptions for display
  const skillOptions = await loadSkillOptions(configDir, skillNames);

  // Step 1: Select skill
  const selectedSkill = await p.select({
    message: "Select skill to export",
    options: skillOptions.map((s) => ({
      label: s.name,
      value: s.name,
      hint: s.description,
    })),
  });

  if (p.isCancel(selectedSkill)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  // Step 2: Select format
  const selectedFormat = await p.select({
    message: "Export format",
    options: [
      {
        label: "Standard (Agent Skills)",
        value: "standard" as const,
        hint: "Universal — works with 30+ tools (Claude Code, Codex, Cursor, Copilot...)",
      },
      {
        label: "Claude Code Plugin",
        value: "claude-plugin" as const,
        hint: "Plugin bundle for Claude Code",
      },
      {
        label: "Codex Plugin",
        value: "codex-plugin" as const,
        hint: "Plugin bundle for OpenAI Codex",
      },
      {
        label: "ZIP Bundle",
        value: "zip" as const,
        hint: "Standalone ZIP for claude.ai upload or sharing",
      },
    ],
  });

  if (p.isCancel(selectedFormat)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  // Step 3: Output directory
  const outputDir = await p.text({
    message: "Output directory",
    defaultValue: "./dist",
    placeholder: "./dist",
  });

  if (p.isCancel(outputDir)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  // Step 4: Confirm
  const formatLabel = formatDisplayName(selectedFormat);
  const confirmed = await p.confirm({
    message: `Export "${selectedSkill}" as ${formatLabel} to ${outputDir}?`,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Operation cancelled.");
    return null;
  }

  return {
    name: selectedSkill,
    format: selectedFormat,
    outputDir: outputDir ?? "./dist",
  };
}

async function loadSkillOptions(
  configDir: string,
  names: string[],
): Promise<SkillOption[]> {
  const options: SkillOption[] = [];
  for (const name of names) {
    const skillMdPath = path.join(
      configDir,
      "skills",
      name,
      SKILL_OUTPUT_FILENAME,
    );
    let description = "";
    try {
      const result = await parseSkillFile(skillMdPath);
      if (result.ok) {
        description = result.data.description.split("\n")[0]?.trim() ?? "";
        if (description.length > 80) {
          description = description.slice(0, 77) + "...";
        }
      }
    } catch {
      // Skip description on parse failure
    }
    options.push({ name, description });
  }
  return options;
}

function formatDisplayName(format: SkillExportFormat): string {
  switch (format) {
    case "standard":
      return "Agent Skills standard";
    case "claude-plugin":
      return "Claude Code Plugin";
    case "codex-plugin":
      return "Codex Plugin";
    case "zip":
      return "ZIP Bundle";
  }
}
