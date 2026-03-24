import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentPaths,
  GeneratedFile,
  GenerateOptions,
} from '../types/agent.js';
import type { NormalizedConfig } from '../types/config.js';
import { hashContent } from '../utils/hash.js';
import { buildFlagInstructions } from './flag-instructions.js';
import { addGeneratedHeader } from './generated-header.js';
import { generateSkillFiles } from './skill-generator.js';
import { CONTEXT_TOKENS_LARGE, MANIFEST_FILENAME } from '../constants.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const clineAdapter: AgentAdapter = {
  id: 'cline',
  name: 'Cline',

  paths: {
    configRoot: '.cline',
    rules: '.cline',
    skills: '.cline/skills',
    commands: null,
    agents: null,
    instructionFile: '.clinerules',
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
    const hasFile = await exists(join(projectRoot, '.clinerules'));
    const hasDir = await exists(join(projectRoot, '.cline'));
    return hasFile || hasDir;
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const flagText = buildFlagInstructions(config.flags);
    const sections: string[] = [];

    if (flagText) {
      sections.push(flagText);
    }
    for (const rule of config.rules) {
      sections.push(`# ${rule.name}\n\n${rule.content}`);
    }
    for (const skill of config.skills) {
      sections.push(`# Skill: ${skill.name}\n\n${skill.content}`);
    }

    const content = addGeneratedHeader(sections.join('\n\n'));
    const files: GeneratedFile[] = [{
      path: '.clinerules',
      content,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(content),
    }];

    // Generate .cline/skills/{name}/SKILL.md
    files.push(...generateSkillFiles(config.skills, '.cline/skills'));

    return files;
  },
};
