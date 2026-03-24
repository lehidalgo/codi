import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentPaths,
  GeneratedFile,
  GenerateOptions,
} from '../types/agent.js';
import type { NormalizedConfig, NormalizedRule } from '../types/config.js';
import { hashContent } from '../utils/hash.js';
import { buildFlagInstructions } from './flag-instructions.js';
import { addGeneratedHeader } from './generated-header.js';
import { generateSkillFiles } from './skill-generator.js';
import { CONTEXT_TOKENS_SMALL, MANIFEST_FILENAME, MCP_FILENAME } from '../constants.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function buildMdcFrontmatter(rule: NormalizedRule): string {
  const lines = ['---'];
  lines.push(`description: ${rule.description}`);
  lines.push(`alwaysApply: ${rule.alwaysApply}`);
  if (rule.scope && rule.scope.length > 0) {
    lines.push(`globs: ${rule.scope.join(', ')}`);
  }
  lines.push('---');
  return lines.join('\n');
}

export const cursorAdapter: AgentAdapter = {
  id: 'cursor',
  name: 'Cursor',

  paths: {
    configRoot: '.cursor',
    rules: '.cursor/rules',
    skills: null,
    commands: null,
    agents: null,
    instructionFile: '.cursorrules',
    mcpConfig: '.cursor/mcp.json',
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: true,
    commands: false,
    mcp: true,
    frontmatter: true,
    progressiveLoading: false,
    agents: false,
    maxContextTokens: CONTEXT_TOKENS_SMALL,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    const hasDir = await exists(join(projectRoot, '.cursor'));
    const hasFile = await exists(join(projectRoot, '.cursorrules'));
    return hasDir || hasFile;
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const flagText = buildFlagInstructions(config.flags);

    // Build .cursorrules (reference-based — rules live in .cursor/rules/)
    const sections: string[] = [];
    if (flagText) {
      sections.push(flagText);
    }
    if (config.rules.length > 0) {
      const ruleList = config.rules
        .map((r) => `- ${r.name}`)
        .join('\n');
      sections.push(`# Rules\n\nRules are defined in \`.cursor/rules/\`:\n${ruleList}`);
    }
    const mainContent = addGeneratedHeader(sections.join('\n\n'));
    files.push({
      path: '.cursorrules',
      content: mainContent,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(mainContent),
    });

    // Generate .cursor/rules/*.mdc with YAML frontmatter
    for (const rule of config.rules) {
      const frontmatter = buildMdcFrontmatter(rule);
      const ruleContent = addGeneratedHeader(`${frontmatter}\n\n# ${rule.name}\n\n${rule.content}`);
      const fileName = rule.name.toLowerCase().replace(/\s+/g, '-') + '.mdc';
      files.push({
        path: `.cursor/rules/${fileName}`,
        content: ruleContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(ruleContent),
      });
    }

    // Generate .cursor/skills/{name}/SKILL.md
    files.push(...generateSkillFiles(config.skills, '.cursor/skills'));

    // Generate .cursor/mcp.json if MCP servers are configured
    if (config.mcp && Object.keys(config.mcp.servers).length > 0) {
      const mcpContent = JSON.stringify(config.mcp, null, 2);
      files.push({
        path: '.cursor/mcp.json',
        content: mcpContent,
        sources: [MCP_FILENAME],
        hash: hashContent(mcpContent),
      });
    }

    return files;
  },
};
