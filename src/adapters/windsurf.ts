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
import { generateSkillFiles } from './skill-generator.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const windsurfAdapter: AgentAdapter = {
  id: 'windsurf',
  name: 'Windsurf',

  paths: {
    configRoot: '.',
    rules: '.',
    skills: '.windsurf/skills',
    commands: null,
    agents: null,
    instructionFile: '.windsurfrules',
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
    maxContextTokens: 32000,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    return exists(join(projectRoot, '.windsurfrules'));
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

    const content = sections.join('\n\n');
    const files: GeneratedFile[] = [{
      path: '.windsurfrules',
      content,
      sources: ['codi.yaml'],
      hash: hashContent(content),
    }];

    // Generate .windsurf/skills/{name}/SKILL.md
    files.push(...generateSkillFiles(config.skills, '.windsurf/skills'));

    return files;
  },
};
