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
import {
  generateSkillFiles,
  buildSkillCatalog,
  resolveProgressiveLoading,
} from "./skill-generator.js";
import {
  buildProjectOverview,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
} from "./section-builder.js";
import {
  extractDenyRules,
  buildStrongTextRestrictions,
} from "./permission-builder.js";
import { CONTEXT_TOKENS_LARGE, MANIFEST_FILENAME } from "../constants.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const clineAdapter: AgentAdapter = {
  id: "cline",
  name: "Cline",

  paths: {
    configRoot: ".cline",
    rules: ".cline",
    skills: ".cline/skills",
    commands: null,
    agents: null,
    instructionFile: ".clinerules",
    mcpConfig: null,
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: true,
    commands: false,
    mcp: false,
    frontmatter: false,
    progressiveLoading: false,
    agents: false,
    maxContextTokens: CONTEXT_TOKENS_LARGE,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    const hasFile = await exists(join(projectRoot, ".clinerules"));
    const hasDir = await exists(join(projectRoot, ".cline"));
    return hasFile || hasDir;
  },

  async generate(
    config: NormalizedConfig,
    _options: GenerateOptions,
  ): Promise<GeneratedFile[]> {
    const flagText = buildFlagInstructions(config.flags);
    const sections: string[] = [];

    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

    if (flagText) {
      sections.push(flagText);
    }

    const restrictions = buildStrongTextRestrictions(
      extractDenyRules(config.flags),
    );
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

    const plMode = resolveProgressiveLoading(config.flags);
    if (plMode === "off") {
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
        path: ".clinerules",
        content,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(content),
      },
    ];

    // Generate .cline/skills/{name}/SKILL.md + supporting files
    files.push(
      ...(await generateSkillFiles(
        config.skills,
        ".cline/skills",
        plMode,
        _options.projectRoot,
      )),
    );

    return files;
  },
};
