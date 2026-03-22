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

export const claudeCodeAdapter: AgentAdapter = {
  id: 'claude-code',
  name: 'Claude Code',

  paths: {
    configRoot: '.claude',
    rules: '.claude/rules',
    skills: null,
    commands: '.claude/commands',
    instructionFile: 'CLAUDE.md',
    mcpConfig: '.claude/mcp.json',
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: true,
    commands: true,
    mcp: true,
    frontmatter: false,
    progressiveLoading: false,
    agents: false,
    maxContextTokens: 200000,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    const hasFile = await exists(join(projectRoot, 'CLAUDE.md'));
    const hasDir = await exists(join(projectRoot, '.claude'));
    return hasFile || hasDir;
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const flagText = buildFlagInstructions(config.flags);

    // Build CLAUDE.md
    const sections: string[] = [];
    if (flagText) {
      sections.push('## Permissions\n\n' + flagText);
    }
    for (const rule of config.rules) {
      sections.push(`## ${rule.name}\n\n${rule.content}`);
    }
    for (const skill of config.skills) {
      sections.push(`## Skill: ${skill.name}\n\n${skill.content}`);
    }
    const mainContent = sections.join('\n\n');
    files.push({
      path: 'CLAUDE.md',
      content: mainContent,
      sources: ['codi.yaml'],
      hash: hashContent(mainContent),
    });

    // Generate .claude/rules/*.md (no frontmatter)
    for (const rule of config.rules) {
      const ruleContent = `# ${rule.name}\n\n${rule.content}`;
      const fileName = rule.name.toLowerCase().replace(/\s+/g, '-') + '.md';
      files.push({
        path: `.claude/rules/${fileName}`,
        content: ruleContent,
        sources: ['codi.yaml'],
        hash: hashContent(ruleContent),
      });
    }

    return files;
  },
};
