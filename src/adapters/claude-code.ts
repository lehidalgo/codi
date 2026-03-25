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
import { generateSkillFiles, type ProgressiveLoadingMode } from './skill-generator.js';
import {
  buildProjectOverview,
  buildCommandsTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
} from './section-builder.js';
import { CONTEXT_TOKENS_LARGE, MANIFEST_FILENAME, MCP_FILENAME } from '../constants.js';

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
    progressiveLoading: true,
    agents: true,
    maxContextTokens: CONTEXT_TOKENS_LARGE,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    const hasFile = await exists(join(projectRoot, 'CLAUDE.md'));
    const hasDir = await exists(join(projectRoot, '.claude'));
    return hasFile || hasDir;
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const flagText = buildFlagInstructions(config.flags);

    // Build CLAUDE.md — rich project context + permissions
    const sections: string[] = [];

    // Project overview from manifest
    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

    if (flagText) {
      sections.push('## Permissions\n\n' + flagText);
    }

    // Commands table
    const commandsTable = buildCommandsTable(config);
    if (commandsTable) sections.push(commandsTable);

    // Development notes from flags
    const devNotes = buildDevelopmentNotes(config);
    if (devNotes) sections.push(devNotes);

    // Workflow guidelines
    sections.push(buildWorkflowSection());

    const mainContent = addGeneratedHeader(sections.join('\n\n'));
    files.push({
      path: 'CLAUDE.md',
      content: mainContent,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(mainContent),
    });

    // Generate .claude/rules/*.md (no frontmatter)
    for (const rule of config.rules) {
      const ruleContent = addGeneratedHeader(`# ${rule.name}\n\n${rule.content}`);
      const fileName = rule.name.toLowerCase().replace(/\s+/g, '-') + '.md';
      files.push({
        path: `.claude/rules/${fileName}`,
        content: ruleContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(ruleContent),
      });
    }

    // Generate .claude/skills/{name}/SKILL.md
    const plMode = (config.flags.progressive_loading?.value as string ?? 'off') as ProgressiveLoadingMode;
    files.push(...generateSkillFiles(config.skills, '.claude/skills', plMode));

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
        sources: [MANIFEST_FILENAME],
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
        sources: [MANIFEST_FILENAME],
        hash: hashContent(cmdContent),
      });
    }

    // Generate .claude/mcp.json if MCP servers are configured
    const enabledMcp = getEnabledMcpServers(config.mcp);
    if (Object.keys(enabledMcp.servers).length > 0) {
      const mcpContent = JSON.stringify(enabledMcp, null, 2);
      files.push({
        path: '.claude/mcp.json',
        content: mcpContent,
        sources: [MCP_FILENAME],
        hash: hashContent(mcpContent),
      });
    }

    return files;
  },
};
