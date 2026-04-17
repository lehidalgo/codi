import { access } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentPaths,
  GeneratedFile,
  GenerateOptions,
} from "../types/agent.js";
import type { NormalizedConfig } from "../types/config.js";
import { hashContent } from "../utils/hash.js";
import { buildFlagInstructions } from "./flag-instructions.js";
import { addGeneratedFooter } from "./generated-header.js";
import { partitionBrandSkills } from "./brand-filter.js";
import { generateSkillFiles, buildSkillCatalog } from "./skill-generator.js";
import {
  buildProjectOverview,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  buildSelfDevWarning,
} from "./section-builder.js";
import { extractDenyRules, buildStrongTextRestrictions } from "./permission-builder.js";
import { CONTEXT_TOKENS_SMALL, MANIFEST_FILENAME } from "../constants.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Adapter for Windsurf — Codeium's AI editor.
 *
 * Detects presence of `.windsurfrules` file.
 * Generates `.windsurfrules` (primary instruction file) and `.windsurf/skills/`.
 * Does not support MCP server configuration.
 */
export const windsurfAdapter: AgentAdapter = {
  id: "windsurf",
  name: "Windsurf",

  paths: {
    configRoot: ".",
    rules: ".",
    skills: ".windsurf/skills",
    agents: null,
    instructionFile: ".windsurfrules",
    mcpConfig: null,
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: true,
    mcp: false,
    frontmatter: false,
    progressiveLoading: false,
    agents: false,
    maxContextTokens: CONTEXT_TOKENS_SMALL,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    return exists(join(projectRoot, ".windsurfrules"));
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const flagText = buildFlagInstructions(config.flags);
    const sections: string[] = [];

    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

    // Self-development mode warning (only when name === "codi")
    const selfDevWarning = buildSelfDevWarning(config);
    if (selfDevWarning) sections.push(selfDevWarning);

    if (flagText) {
      sections.push(flagText);
    }

    const restrictions = buildStrongTextRestrictions(extractDenyRules(config.flags));
    if (restrictions) sections.push(restrictions);

    const devNotes = buildDevelopmentNotes(config);
    if (devNotes) sections.push(devNotes);

    sections.push(buildWorkflowSection());

    // Skill routing table
    const routingTable = buildSkillRoutingTable(config);
    if (routingTable) sections.push(routingTable);

    for (const rule of config.rules) {
      sections.push(`# ${rule.name}\n\n${rule.content}`);
    }

    // Partition skills into regular and brand-category skills
    const { regularSkills, brandSkills } = partitionBrandSkills(config.skills);

    for (const brand of brandSkills) {
      sections.push(`# Brand: ${brand.name}\n\n${brand.content}`);
    }

    // Inline vs catalog: "off" (or unset) inlines full skill content in .windsurfrules,
    // "metadata"/"full" show a catalog table (skills are always full in separate files)
    const plFlag = config.flags["progressive_loading"]?.value ?? "off";
    if (plFlag === "off") {
      for (const skill of regularSkills) {
        sections.push(`# Skill: ${skill.name}\n\n${skill.content}`);
      }
    } else {
      const catalog = buildSkillCatalog(regularSkills);
      if (catalog) sections.push(catalog);
    }

    const content = addGeneratedFooter(sections.join("\n\n"));
    const files: GeneratedFile[] = [
      {
        path: ".windsurfrules",
        content,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(content),
      },
    ];

    // Generate .windsurf/skills/{name}/SKILL.md + supporting files (always full content)
    files.push(
      ...(await generateSkillFiles(
        config.skills,
        ".windsurf/skills",
        _options.projectRoot,
        "",
        "windsurf",
      )),
    );

    // Note: Windsurf does NOT support project-level MCP config.
    // MCP is user-global only at ~/.codeium/windsurf/mcp_config.json.

    return files;
  },
};
