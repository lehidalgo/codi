import { access } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentPaths,
  GeneratedFile,
  GenerateOptions,
} from "../types/agent.js";
import type { NormalizedConfig, NormalizedSkill, NormalizedAgent } from "../types/config.js";
import { hashContent } from "../utils/hash.js";
import { buildFlagInstructions } from "./flag-instructions.js";
import { addGeneratedFooter } from "./generated-header.js";
import { partitionBrandSkills } from "./brand-filter.js";
import { buildSkillCatalog } from "./skill-generator.js";
import {
  buildProjectOverview,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  buildProjectContext,
  buildSelfDevWarning,
  getEnabledMcpServers,
  buildMcpEnvExample,
} from "./section-builder.js";
import { extractDenyRules, buildStrongTextRestrictions } from "./permission-builder.js";
import { CONTEXT_TOKENS_LARGE, MANIFEST_FILENAME, MCP_FILENAME } from "../constants.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a Copilot prompt file (`.prompt.md`) from a Codi skill.
 *
 * Copilot prompt files use flat `.prompt.md` files with YAML frontmatter
 * containing `description`, `agent`, `model`, and `tools` fields.
 */
function buildPromptFile(skill: NormalizedSkill): string {
  const frontmatter: string[] = ["---"];

  frontmatter.push(`description: "${skill.description.replace(/"/g, '\\"')}"`);

  if (skill.model) {
    frontmatter.push(`model: ${skill.model}`);
  }

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatter.push(`tools: [${skill.allowedTools.map((t) => `'${t}'`).join(", ")}]`);
  }

  if (skill.argumentHint) {
    frontmatter.push(`argument-hint: "${skill.argumentHint.replace(/"/g, '\\"')}"`);
  }

  // Default to agent mode (most capable — allows tool use)
  frontmatter.push(`agent: "agent"`);

  frontmatter.push("---");

  // Strip [[]] markers and ${CLAUDE_SKILL_DIR} — Copilot has no equivalent
  const resolvedContent = skill.content
    .replace(/\$\{CLAUDE_SKILL_DIR\}/g, "")
    .replace(/\[\[\s*(\/[^\]]+?)\s*\]\]/g, "$1");

  return `${frontmatter.join("\n")}\n\n${resolvedContent}`;
}

/**
 * Build a Copilot custom agent file from a Codi agent definition.
 *
 * Copilot custom agents use `.md` files with YAML frontmatter
 * containing `name`, `description`, `tools`, and `model` fields.
 */
function buildAgentFile(agent: NormalizedAgent): string {
  const frontmatter: string[] = ["---"];

  frontmatter.push(`name: ${agent.name}`);
  frontmatter.push(`description: "${agent.description.replace(/"/g, '\\"')}"`);

  if (agent.tools && agent.tools.length > 0) {
    frontmatter.push(`tools: [${agent.tools.map((t) => `'${t}'`).join(", ")}]`);
  }

  if (agent.model) {
    frontmatter.push(`model: ${agent.model}`);
  }

  frontmatter.push("---");

  return `${frontmatter.join("\n")}\n\n${agent.content}`;
}

/**
 * Adapter for GitHub Copilot — CLI and VS Code/JetBrains Chat.
 *
 * Detects presence of `.github/copilot-instructions.md`, `.github/prompts/`, or `.github/agents/`.
 * Generates:
 * - `.github/copilot-instructions.md` (repo-wide instructions from rules + flags)
 * - `.github/instructions/{name}.instructions.md` (path-specific rules with scope)
 * - `.github/prompts/{name}.prompt.md` (prompt files from skills)
 * - `.github/agents/{name}.md` (custom agents)
 *
 * Does not support MCP server configuration.
 */
export const copilotAdapter: AgentAdapter = {
  id: "copilot",
  name: "GitHub Copilot",

  paths: {
    configRoot: ".github",
    rules: ".github/instructions",
    skills: ".github/prompts",
    agents: ".github/agents",
    instructionFile: ".github/copilot-instructions.md",
    mcpConfig: ".vscode/mcp.json",
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: true,
    mcp: true,
    frontmatter: true,
    progressiveLoading: false,
    agents: true,
    maxContextTokens: CONTEXT_TOKENS_LARGE,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    const hasInstructions = await exists(join(projectRoot, ".github/copilot-instructions.md"));
    const hasPrompts = await exists(join(projectRoot, ".github/prompts"));
    const hasAgents = await exists(join(projectRoot, ".github/agents"));
    return hasInstructions || hasPrompts || hasAgents;
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // --- 1. Main instruction file: .github/copilot-instructions.md ---
    const sections: string[] = [];

    const selfDevWarning = buildSelfDevWarning(config);
    if (selfDevWarning) sections.push(selfDevWarning);

    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

    const projectContext = buildProjectContext(config);
    if (projectContext) sections.push(projectContext);

    const flagText = buildFlagInstructions(config.flags);
    if (flagText) sections.push(flagText);

    const restrictions = buildStrongTextRestrictions(extractDenyRules(config.flags));
    if (restrictions) sections.push(restrictions);

    const devNotes = buildDevelopmentNotes(config);
    if (devNotes) sections.push(devNotes);

    sections.push(buildWorkflowSection());

    const routingTable = buildSkillRoutingTable(config);
    if (routingTable) sections.push(routingTable);

    const agentsTable = buildAgentsTable(config);
    if (agentsTable) sections.push(agentsTable);

    // Inline global rules (no scope) into the main instruction file
    for (const rule of config.rules) {
      if (!rule.scope || rule.scope.length === 0) {
        sections.push(`# ${rule.name}\n\n${rule.content}`);
      }
    }

    // Partition skills into regular and brand-category skills
    const { regularSkills, brandSkills } = partitionBrandSkills(config.skills);

    for (const brand of brandSkills) {
      sections.push(`# Brand: ${brand.name}\n\n${brand.content}`);
    }

    // Inline vs catalog: "off" (or unset) inlines full skill content,
    // "metadata"/"full" show a catalog table (skills are always in separate prompt files)
    const plFlag = config.flags["progressive_loading"]?.value ?? "off";
    if (plFlag === "off") {
      for (const skill of regularSkills) {
        sections.push(`# Skill: ${skill.name}\n\n${skill.content}`);
      }
    } else {
      const catalog = buildSkillCatalog(regularSkills);
      if (catalog) sections.push(catalog);
    }

    const mainContent = addGeneratedFooter(sections.join("\n\n"));
    files.push({
      path: ".github/copilot-instructions.md",
      content: mainContent,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(mainContent),
    });

    // --- 2. Path-specific instruction files for scoped rules ---
    for (const rule of config.rules) {
      if (rule.scope && rule.scope.length > 0) {
        const instrLines: string[] = ["---"];
        instrLines.push(`applyTo: "${rule.scope.join(", ")}"`);
        instrLines.push("---");
        instrLines.push("");
        instrLines.push(`# ${rule.name}\n\n${rule.content}`);

        const instrContent = addGeneratedFooter(instrLines.join("\n"));
        files.push({
          path: `.github/instructions/${rule.name.toLowerCase().replace(/\s+/g, "-")}.instructions.md`,
          content: instrContent,
          sources: [MANIFEST_FILENAME],
          hash: hashContent(instrContent),
        });
      }
    }

    // --- 3. Prompt files from skills ---
    for (const skill of regularSkills) {
      const promptContent = addGeneratedFooter(buildPromptFile(skill));
      files.push({
        path: `.github/prompts/${skill.name}.prompt.md`,
        content: promptContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(promptContent),
      });
    }

    // --- 4. Custom agent files (.agent.md — Copilot's required extension) ---
    for (const agent of config.agents) {
      const agentContent = addGeneratedFooter(buildAgentFile(agent));
      files.push({
        path: `.github/agents/${agent.name}.agent.md`,
        content: agentContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(agentContent),
      });
    }

    // --- 5. MCP server configuration: .vscode/mcp.json ---
    const enabledMcp = getEnabledMcpServers(config.mcp);
    if (Object.keys(enabledMcp.servers).length > 0) {
      // Copilot uses { "servers": { ... } } format (not mcpServers)
      const mcpOutput = {
        _instructions: `Generated by Codi — do not edit manually, run: codi generate`,
        servers: enabledMcp.servers,
      };
      const mcpContent = JSON.stringify(mcpOutput, null, 2);
      files.push({
        path: ".vscode/mcp.json",
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

    return files;
  },
};
