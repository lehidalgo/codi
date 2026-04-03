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
import { generateSkillFiles } from "./skill-generator.js";
import {
  buildProjectOverview,
  buildAgentsTable,
  buildCommandsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
  buildMcpEnvExample,
} from "./section-builder.js";
import {
  CONTEXT_TOKENS_LARGE,
  MANIFEST_FILENAME,
  MCP_FILENAME,
  PROJECT_NAME,
} from "../constants.js";
import { partitionBrandSkills } from "./brand-filter.js";

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
    mcpConfig: ".mcp.json",
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

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
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

    // Agents table
    const agentsTable = buildAgentsTable(config);
    if (agentsTable) sections.push(agentsTable);

    // Skill routing table
    const routingTable = buildSkillRoutingTable(config);
    if (routingTable) sections.push(routingTable);

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

    // Generate .claude/rules/*.md (with paths frontmatter for scoped rules)
    for (const rule of config.rules) {
      const header =
        rule.scope && rule.scope.length > 0
          ? `---\npaths:\n${rule.scope.map((s) => `  - "${s}"`).join("\n")}\n---\n\n`
          : "";
      const ruleContent = addGeneratedFooter(
        `${header}# (${PROJECT_NAME}-rule) ${rule.name}\n\n${rule.content}`,
      );
      const fileName = rule.name.toLowerCase().replace(/\s+/g, "-") + ".md";
      files.push({
        path: `.claude/rules/${fileName}`,
        content: ruleContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(ruleContent),
      });
    }

    // Partition skills into regular and brand-category skills
    const { regularSkills, brandSkills } = partitionBrandSkills(config.skills);

    // Generate .claude/skills/{name}/SKILL.md + supporting files
    files.push(
      ...(await generateSkillFiles(
        regularSkills,
        ".claude/skills",
        _options.projectRoot,
        `(${PROJECT_NAME}-skill) `,
        "claude-code",
      )),
    );

    // Generate .claude/agents/{name}.md (Claude Code format)
    for (const agent of config.agents) {
      const lines = ["---"];
      lines.push(`name: ${agent.name}`);
      lines.push(`description: (${PROJECT_NAME}-agent) ${agent.description}`);
      if (agent.tools) lines.push(`tools: ${agent.tools.join(", ")}`);
      if (agent.disallowedTools) lines.push(`disallowedTools: ${agent.disallowedTools.join(", ")}`);
      if (agent.model) lines.push(`model: ${agent.model}`);
      if (agent.maxTurns) lines.push(`maxTurns: ${agent.maxTurns}`);
      if (agent.effort) lines.push(`effort: ${agent.effort}`);
      lines.push("---");
      const agentContent = addGeneratedFooter(`${lines.join("\n")}\n\n${agent.content}`);
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
        `---\ndescription: (${PROJECT_NAME}-cmd) ${cmd.description}\n---\n\n${cmd.content}`,
      );
      const fileName = cmd.name.toLowerCase().replace(/\s+/g, "-") + ".md";
      files.push({
        path: `.claude/commands/${fileName}`,
        content: cmdContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(cmdContent),
      });
    }

    // Generate .claude/brands/{name}.md from brand-category skills
    for (const brand of brandSkills) {
      const brandContent = addGeneratedFooter(
        `# (${PROJECT_NAME}-brand) ${brand.name}\n\n${brand.content}`,
      );
      const fileName = brand.name.toLowerCase().replace(/\s+/g, "-") + ".md";
      files.push({
        path: `.claude/brands/${fileName}`,
        content: brandContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(brandContent),
      });
    }

    // Generate .mcp.json (project-scoped MCP for Claude Code)
    const enabledMcp = getEnabledMcpServers(config.mcp);
    if (Object.keys(enabledMcp.servers).length > 0) {
      const mcpOutput = {
        _instructions: [
          `Generated by ${PROJECT_NAME} — do not edit manually, run: codi generate`,
          "Environment variables use ${VAR_NAME} syntax.",
          "Set required values in your project .env file or shell environment.",
          "See .mcp.env.example for the full list of required variables.",
        ].join(" "),
        mcpServers: enabledMcp.servers,
      };
      const mcpContent = JSON.stringify(mcpOutput, null, 2);
      files.push({
        path: ".mcp.json",
        content: mcpContent,
        sources: [MCP_FILENAME],
        hash: hashContent(mcpContent),
      });

      const envExample = buildMcpEnvExample(enabledMcp.servers);
      if (envExample) {
        files.push({
          path: ".mcp.env.example",
          content: envExample,
          sources: [MCP_FILENAME],
          hash: hashContent(envExample),
        });
      }
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

  // Only return if there's content to write
  if (Object.keys(settings).length === 0) return null;
  return settings;
}
