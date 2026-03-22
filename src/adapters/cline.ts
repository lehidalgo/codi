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
    skills: null,
    commands: null,
    instructionFile: '.clinerules',
    mcpConfig: null,
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: false,
    commands: false,
    mcp: false,
    frontmatter: false,
    progressiveLoading: false,
    agents: false,
    maxContextTokens: 200000,
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

    const content = sections.join('\n\n');
    return [{
      path: '.clinerules',
      content,
      sources: ['codi.yaml'],
      hash: hashContent(content),
    }];
  },
};
