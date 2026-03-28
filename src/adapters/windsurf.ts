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
import { addGeneratedHeader } from "./generated-header.js";
import {
  generateSkillFiles,
  buildSkillCatalog,
  type ProgressiveLoadingMode,
} from "./skill-generator.js";
import {
  buildProjectOverview,
  buildDevelopmentNotes,
  buildWorkflowSection,
} from "./section-builder.js";
import {
  extractDenyRules,
  buildStrongTextRestrictions,
} from "./permission-builder.js";
import { CONTEXT_TOKENS_SMALL, MANIFEST_FILENAME } from "../constants.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const windsurfAdapter: AgentAdapter = {
  id: "windsurf",
  name: "Windsurf",

  paths: {
    configRoot: ".",
    rules: ".",
    skills: ".windsurf/skills",
    commands: null,
    agents: null,
    instructionFile: ".windsurfrules",
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
    maxContextTokens: CONTEXT_TOKENS_SMALL,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    return exists(join(projectRoot, ".windsurfrules"));
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

    for (const rule of config.rules) {
      sections.push(`# ${rule.name}\n\n${rule.content}`);
    }

    for (const brand of config.brands) {
      sections.push(`# Brand: ${brand.name}\n\n${brand.content}`);
    }

    const plMode = ((config.flags.progressive_loading?.value as string) ??
      "off") as ProgressiveLoadingMode;
    if (plMode === "off") {
      for (const skill of config.skills) {
        sections.push(`# Skill: ${skill.name}\n\n${skill.content}`);
      }
    } else {
      const catalog = buildSkillCatalog(config.skills);
      if (catalog) sections.push(catalog);
    }

    const content = addGeneratedHeader(sections.join("\n\n"));
    const files: GeneratedFile[] = [
      {
        path: ".windsurfrules",
        content,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(content),
      },
    ];

    // Generate .windsurf/skills/{name}/SKILL.md + supporting files
    files.push(
      ...(await generateSkillFiles(
        config.skills,
        ".windsurf/skills",
        plMode,
        _options.projectRoot,
      )),
    );

    // Note: Windsurf does NOT support project-level MCP config.
    // MCP is user-global only at ~/.codeium/windsurf/mcp_config.json.

    return files;
  },
};
