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
    skills: '.claude/skills',
    commands: '.claude/commands',
    agents: '.claude/agents',
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
    agents: true,
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

    // Build CLAUDE.md (permissions only — rules and skills auto-load from .claude/)
    const sections: string[] = [];
    if (flagText) {
      sections.push('## Permissions\n\n' + flagText);
    }

    // Add config summary section
    const ruleNames = config.rules.map(r => r.name);
    const skillNames = config.skills.map(s => s.name);
    const agentNames = config.agents.map(a => a.name);
    if (ruleNames.length > 0 || skillNames.length > 0 || agentNames.length > 0) {
      const summaryLines = ['## Configuration'];
      if (ruleNames.length > 0) summaryLines.push(`- Rules (${ruleNames.length}): ${ruleNames.join(', ')}`);
      if (skillNames.length > 0) summaryLines.push(`- Skills (${skillNames.length}): ${skillNames.join(', ')}`);
      if (agentNames.length > 0) summaryLines.push(`- Agents (${agentNames.length}): ${agentNames.join(', ')}`);
      summaryLines.push(`- Generated: ${new Date().toISOString()}`);
      sections.push(summaryLines.join('\n'));
    }

    const mainContent = addGeneratedHeader(sections.join('\n\n'));
    files.push({
      path: 'CLAUDE.md',
      content: mainContent,
      sources: ['codi.yaml'],
      hash: hashContent(mainContent),
    });

    // Generate .claude/rules/*.md (no frontmatter)
    for (const rule of config.rules) {
      const ruleContent = addGeneratedHeader(`# ${rule.name}\n\n${rule.content}`);
      const fileName = rule.name.toLowerCase().replace(/\s+/g, '-') + '.md';
      files.push({
        path: `.claude/rules/${fileName}`,
        content: ruleContent,
        sources: ['codi.yaml'],
        hash: hashContent(ruleContent),
      });
    }

    // Generate .claude/skills/{name}/SKILL.md
    files.push(...generateSkillFiles(config.skills, '.claude/skills'));

    // Generate .claude/agents/{name}.md (Claude Code format)
    for (const agent of config.agents) {
      const lines = ['---'];
      lines.push(`name: ${agent.name}`);
      lines.push(`description: ${agent.description}`);
      if (agent.tools) lines.push(`tools: ${agent.tools.join(', ')}`);
      if (agent.model) lines.push(`model: ${agent.model}`);
      lines.push('---');
      const agentContent = addGeneratedHeader(`${lines.join('\n')}\n\n${agent.content}`);
      const fileName = agent.name.toLowerCase().replace(/\s+/g, '-') + '.md';
      files.push({
        path: `.claude/agents/${fileName}`,
        content: agentContent,
        sources: ['codi.yaml'],
        hash: hashContent(agentContent),
      });
    }

    // Generate .claude/commands/{name}.md
    for (const cmd of config.commands) {
      const cmdContent = addGeneratedHeader(`---\ndescription: ${cmd.description}\n---\n\n${cmd.content}`);
      const fileName = cmd.name.toLowerCase().replace(/\s+/g, '-') + '.md';
      files.push({
        path: `.claude/commands/${fileName}`,
        content: cmdContent,
        sources: ['codi.yaml'],
        hash: hashContent(cmdContent),
      });
    }

    // Generate .claude/mcp.json if MCP servers are configured
    if (config.mcp && Object.keys(config.mcp.servers).length > 0) {
      const mcpContent = JSON.stringify(config.mcp, null, 2);
      files.push({
        path: '.claude/mcp.json',
        content: mcpContent,
        sources: ['mcp.yaml'],
        hash: hashContent(mcpContent),
      });
    }

    return files;
  },
};
