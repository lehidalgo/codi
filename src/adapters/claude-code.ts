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
import {
  generateSkillFiles,
  type ProgressiveLoadingMode,
} from "./skill-generator.js";
import {
  buildProjectOverview,
  buildCommandsTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
} from "./section-builder.js";
import {
  CONTEXT_TOKENS_LARGE,
  MANIFEST_FILENAME,
  MCP_FILENAME,
} from "../constants.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const claudeCodeAdapter: AgentAdapter = {
  id: "claude-code",
  name: "Claude Code",

  paths: {
    configRoot: ".claude",
    rules: ".claude/rules",
    skills: ".claude/skills",
    commands: ".claude/commands",
    agents: ".claude/agents",
    instructionFile: "CLAUDE.md",
    mcpConfig: ".claude/mcp.json",
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
    const hasFile = await exists(join(projectRoot, "CLAUDE.md"));
    const hasDir = await exists(join(projectRoot, ".claude"));
    return hasFile || hasDir;
  },

  async generate(
    config: NormalizedConfig,
    _options: GenerateOptions,
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const flagText = buildFlagInstructions(config.flags);

    // Build CLAUDE.md — rich project context + permissions
    const sections: string[] = [];

    // Project overview from manifest
    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

    if (flagText) {
      sections.push("## Permissions\n\n" + flagText);
    }

    // Commands table
    const commandsTable = buildCommandsTable(config);
    if (commandsTable) sections.push(commandsTable);

    // Development notes from flags
    const devNotes = buildDevelopmentNotes(config);
    if (devNotes) sections.push(devNotes);

    // Workflow guidelines
    sections.push(buildWorkflowSection());

    const mainContent = addGeneratedFooter(sections.join("\n\n"));
    files.push({
      path: "CLAUDE.md",
      content: mainContent,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(mainContent),
    });

    // Generate .claude/rules/*.md (no frontmatter)
    for (const rule of config.rules) {
      const ruleContent = addGeneratedFooter(
        `# (codi-rule) ${rule.name}\n\n${rule.content}`,
      );
      const fileName = rule.name.toLowerCase().replace(/\s+/g, "-") + ".md";
      files.push({
        path: `.claude/rules/${fileName}`,
        content: ruleContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(ruleContent),
      });
    }

    // Generate .claude/skills/{name}/SKILL.md + supporting files
    const plMode = ((config.flags.progressive_loading?.value as string) ??
      "off") as ProgressiveLoadingMode;
    files.push(
      ...(await generateSkillFiles(
        config.skills,
        ".claude/skills",
        plMode,
        _options.projectRoot,
        "(codi-skill) ",
      )),
    );

    // Generate .claude/agents/{name}.md (Claude Code format)
    for (const agent of config.agents) {
      const lines = ["---"];
      lines.push(`name: ${agent.name}`);
      lines.push(`description: (codi-agent) ${agent.description}`);
      if (agent.tools) lines.push(`tools: ${agent.tools.join(", ")}`);
      if (agent.model) lines.push(`model: ${agent.model}`);
      lines.push("---");
      const agentContent = addGeneratedFooter(
        `${lines.join("\n")}\n\n${agent.content}`,
      );
      const fileName = agent.name.toLowerCase().replace(/\s+/g, "-") + ".md";
      files.push({
        path: `.claude/agents/${fileName}`,
        content: agentContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(agentContent),
      });
    }

    // Generate .claude/commands/{name}.md
    for (const cmd of config.commands) {
      const cmdContent = addGeneratedFooter(
        `---\ndescription: (codi-cmd) ${cmd.description}\n---\n\n${cmd.content}`,
      );
      const fileName = cmd.name.toLowerCase().replace(/\s+/g, "-") + ".md";
      files.push({
        path: `.claude/commands/${fileName}`,
        content: cmdContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(cmdContent),
      });
    }

    // Generate .claude/brands/{name}.md
    for (const brand of config.brands) {
      const brandContent = addGeneratedFooter(
        `# (codi-brand) ${brand.name}\n\n${brand.content}`,
      );
      const fileName = brand.name.toLowerCase().replace(/\s+/g, "-") + ".md";
      files.push({
        path: `.claude/brands/${fileName}`,
        content: brandContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(brandContent),
      });
    }

    // Generate .claude/mcp.json if MCP servers are configured
    const enabledMcp = getEnabledMcpServers(config.mcp);
    if (Object.keys(enabledMcp.servers).length > 0) {
      const mcpContent = JSON.stringify(enabledMcp, null, 2);
      files.push({
        path: ".claude/mcp.json",
        content: mcpContent,
        sources: [MCP_FILENAME],
        hash: hashContent(mcpContent),
      });
    }

    // Generate .claude/settings.json (project-level hooks + env)
    const settingsJson = buildSettingsJson(config);
    if (settingsJson) {
      const settingsContent = JSON.stringify(settingsJson, null, 2);
      files.push({
        path: ".claude/settings.json",
        content: settingsContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(settingsContent),
      });
    }

    return files;
  },
};

interface ClaudeSettings {
  permissions?: { deny?: string[] };
  enabledMcpjsonServers?: string[];
  env?: Record<string, string>;
}

function buildSettingsJson(config: NormalizedConfig): ClaudeSettings | null {
  const settings: ClaudeSettings = {};

  // Map flags to permissions.deny (native enforcement — hard blocks tool calls)
  const deny: string[] = [];
  const flagValue = (key: string): unknown => config.flags[key]?.value;

  if (flagValue("allow_force_push") === false) {
    deny.push("Bash(git push --force *)", "Bash(git push -f *)");
  }
  if (flagValue("allow_shell_commands") === false) {
    deny.push("Bash");
  }
  if (flagValue("allow_file_deletion") === false) {
    deny.push("Bash(rm -rf *)", "Bash(rm -r *)");
  }

  if (deny.length > 0) {
    settings.permissions = { deny };
  }

  // Map mcp_allowed_servers to enabledMcpjsonServers (native MCP allowlist)
  const mcpServers = flagValue("mcp_allowed_servers");
  if (Array.isArray(mcpServers) && mcpServers.length > 0) {
    settings.enabledMcpjsonServers = mcpServers as string[];
  }

  // Map flags to env vars
  const env: Record<string, string> = {};
  const maxTokens = config.flags.max_context_tokens?.value;
  if (typeof maxTokens === "number" && maxTokens > 0) {
    // Convert token limit to autocompact percentage (trigger compaction at ~70% of limit)
    const pct = Math.min(
      70,
      Math.round((maxTokens / CONTEXT_TOKENS_LARGE) * 100),
    );
    if (pct < 100) {
      env["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"] = String(pct);
    }
  }

  if (Object.keys(env).length > 0) {
    settings.env = env;
  }

  // Only return if there's content to write
  if (Object.keys(settings).length === 0) return null;
  return settings;
}
