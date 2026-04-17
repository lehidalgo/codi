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
import { sanitizeNameForPath } from "../utils/path-guard.js";
import { fmStr } from "../utils/yaml-serialize.js";
import { buildFlagInstructions } from "./flag-instructions.js";
import { addGeneratedFooter } from "./generated-header.js";
import { partitionBrandSkills } from "./brand-filter.js";
import { buildSkillCatalog, generateSkillFiles } from "./skill-generator.js";
import {
  buildProjectOverview,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  buildSelfDevWarning,
  getEnabledMcpServers,
  buildMcpEnvExample,
} from "./section-builder.js";
import { extractDenyRules, buildStrongTextRestrictions } from "./permission-builder.js";
import { Logger } from "../core/output/logger.js";
import {
  CONTEXT_TOKENS_LARGE,
  MANIFEST_FILENAME,
  MCP_FILENAME,
  PROJECT_DIR,
  MAX_ARTIFACT_CHARS,
} from "../constants.js";
import {
  buildSkillTrackerScript,
  buildSkillObserverScript,
  SKILL_TRACKER_FILENAME,
  SKILL_OBSERVER_FILENAME,
  HOOKS_SUBDIR,
} from "../core/hooks/heartbeat-hooks.js";

interface CopilotHookCommand {
  type: "command";
  bash: string;
  powershell: string;
  cwd: string;
  timeoutSec: number;
}

interface CopilotHooksConfig {
  version: 1;
  hooks: {
    sessionStart?: CopilotHookCommand[];
    sessionEnd?: CopilotHookCommand[];
  };
}

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

  frontmatter.push(`description: ${fmStr(skill.description)}`);

  if (skill.model) {
    frontmatter.push(`model: ${fmStr(skill.model)}`);
  }

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    const tools = skill.allowedTools.map((t) => fmStr(t)).join(", ");
    frontmatter.push(`tools: [${tools}]`);
  }

  if (skill.argumentHint) {
    frontmatter.push(`argument-hint: ${fmStr(skill.argumentHint)}`);
  }

  frontmatter.push(`agent: "agent"`);

  frontmatter.push("---");

  const skillDir = `${COPILOT_PATHS.skills}/${sanitizeNameForPath(skill.name)}`;
  const resolvedContent = skill.content
    .replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir)
    .replace(/\[\[\s*(\/[^\]]+?)\s*\]\]/g, `${skillDir}$1`);

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

  frontmatter.push(`name: ${fmStr(agent.name)}`);
  frontmatter.push(`description: ${fmStr(agent.description)}`);

  if (agent.tools && agent.tools.length > 0) {
    const tools = agent.tools.map((t) => fmStr(t)).join(", ");
    frontmatter.push(`tools: [${tools}]`);
  }

  if (agent.model) {
    frontmatter.push(`model: ${fmStr(agent.model)}`);
  }

  frontmatter.push("---");

  return `${frontmatter.join("\n")}\n\n${agent.content}`;
}

const HOOK_TIMEOUT_SESSION_START = 10; // seconds — allow skill-tracker to complete
const HOOK_TIMEOUT_SESSION_END = 15; // seconds — allow skill-observer to write feedback

// Single source of truth for Copilot output paths.
// AgentPaths fields are re-exposed on copilotAdapter.paths; extras (prompts, hooks, hooksFile)
// are copilot-specific artefacts not in the shared AgentPaths interface.
const GITHUB_DIR = ".github";
const VSCODE_DIR = ".vscode";
const COPILOT_PATHS = {
  configRoot: GITHUB_DIR,
  rules: `${GITHUB_DIR}/instructions`,
  skills: `${GITHUB_DIR}/skills`,
  agents: `${GITHUB_DIR}/agents`,
  instructionFile: `${GITHUB_DIR}/copilot-instructions.md`,
  mcpConfig: `${VSCODE_DIR}/mcp.json`,
  prompts: `${GITHUB_DIR}/prompts`,
  hooks: `${GITHUB_DIR}/hooks`,
  hooksFile: `${GITHUB_DIR}/hooks/codi-hooks.json`,
} as const;

function buildCopilotHooksFiles(): GeneratedFile[] {
  const trackerScript = buildSkillTrackerScript();
  const trackerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}`;

  const observerScript = buildSkillObserverScript();
  const observerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`;

  const copilotHooks: CopilotHooksConfig = {
    version: 1,
    hooks: {
      sessionStart: [
        {
          type: "command",
          bash: `node "${trackerPath}"`,
          powershell: `node "${trackerPath}"`,
          cwd: ".",
          timeoutSec: HOOK_TIMEOUT_SESSION_START,
        },
      ],
      sessionEnd: [
        {
          type: "command",
          bash: `node "${observerPath}"`,
          powershell: `node "${observerPath}"`,
          cwd: ".",
          timeoutSec: HOOK_TIMEOUT_SESSION_END,
        },
      ],
    },
  };
  const hooksContent = JSON.stringify(copilotHooks, null, 2);

  return [
    {
      path: trackerPath,
      content: trackerScript,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(trackerScript),
    },
    {
      path: observerPath,
      content: observerScript,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(observerScript),
    },
    {
      path: COPILOT_PATHS.hooksFile,
      content: hooksContent,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(hooksContent),
    },
  ];
}

/**
 * Adapter for GitHub Copilot — CLI and VS Code/JetBrains Chat.
 *
 * Detects presence of `.github/copilot-instructions.md`, `.github/prompts/`, `.github/agents/`, or `.github/skills/`.
 * Generates:
 * - `.github/copilot-instructions.md` (repo-wide instructions)
 * - `.github/instructions/{name}.instructions.md` (path-specific scoped rules)
 * - `.github/prompts/{name}.prompt.md` (VS Code Prompt Files — Copilot Chat / IDE)
 * - `.github/skills/{name}/SKILL.md` + supporting dirs (Agent Skills — Copilot Coding Agent / CLI)
 * - `.github/agents/{name}.agent.md` (custom agents)
 * - `.vscode/mcp.json` (MCP server configuration)
 * - `.github/hooks/codi-hooks.json` (Copilot hooks)
 */
export const copilotAdapter: AgentAdapter = {
  id: "copilot",
  name: "GitHub Copilot",

  paths: {
    configRoot: COPILOT_PATHS.configRoot,
    rules: COPILOT_PATHS.rules,
    skills: COPILOT_PATHS.skills,
    agents: COPILOT_PATHS.agents,
    instructionFile: COPILOT_PATHS.instructionFile,
    mcpConfig: COPILOT_PATHS.mcpConfig,
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
    const hasInstructions = await exists(join(projectRoot, COPILOT_PATHS.instructionFile));
    const hasPrompts = await exists(join(projectRoot, COPILOT_PATHS.prompts));
    const hasAgents = await exists(join(projectRoot, COPILOT_PATHS.agents));
    const hasSkills = await exists(join(projectRoot, COPILOT_PATHS.skills));
    return hasInstructions || hasPrompts || hasAgents || hasSkills;
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // --- 1. Main instruction file: .github/copilot-instructions.md ---
    const sections: string[] = [];

    const selfDevWarning = buildSelfDevWarning(config);
    if (selfDevWarning) sections.push(selfDevWarning);

    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

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
        if (rule.content.length <= MAX_ARTIFACT_CHARS) {
          sections.push(`# ${rule.name}\n\n${rule.content}`);
        }
      }
    }

    // Partition skills into regular and brand-category skills
    const { regularSkills, brandSkills } = partitionBrandSkills(config.skills);

    for (const brand of brandSkills) {
      if (brand.content.length <= MAX_ARTIFACT_CHARS) {
        sections.push(`# Brand: ${brand.name}\n\n${brand.content}`);
      }
    }

    // Inline vs catalog: "off" (or unset) inlines full skill content,
    // "metadata"/"full" show a catalog table (skills are always in separate prompt files)
    const plFlag = config.flags["progressive_loading"]?.value ?? "off";
    if (plFlag === "off") {
      for (const skill of regularSkills) {
        if (skill.content.length <= MAX_ARTIFACT_CHARS) {
          sections.push(`# Skill: ${skill.name}\n\n${skill.content}`);
        }
      }
    } else {
      const catalog = buildSkillCatalog(regularSkills);
      if (catalog) sections.push(catalog);
    }

    const mainContent = addGeneratedFooter(sections.join("\n\n"));
    files.push({
      path: COPILOT_PATHS.instructionFile,
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
          path: `${COPILOT_PATHS.rules}/${sanitizeNameForPath(rule.name)}.instructions.md`,
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
        path: `${COPILOT_PATHS.prompts}/${sanitizeNameForPath(skill.name)}.prompt.md`,
        content: promptContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(promptContent),
      });
    }

    // --- 3b. Agent Skills (Copilot Coding Agent / CLI format) ---
    // Generates .github/skills/{name}/SKILL.md + scripts/, references/, assets/ supporting files.
    files.push(
      ...(await generateSkillFiles(
        regularSkills,
        COPILOT_PATHS.skills,
        _options.projectRoot,
        "",
        "copilot",
      )),
    );

    // --- 4. Custom agent files (.agent.md — Copilot's required extension) ---
    for (const agent of config.agents) {
      const agentContent = addGeneratedFooter(buildAgentFile(agent));
      files.push({
        path: `${COPILOT_PATHS.agents}/${sanitizeNameForPath(agent.name)}.agent.md`,
        content: agentContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(agentContent),
      });
    }

    // --- 5. MCP server configuration: .vscode/mcp.json ---
    const enabledMcp = getEnabledMcpServers(config.mcp);
    if (Object.keys(enabledMcp.servers).length > 0) {
      // Warn on potential secret values (raw strings instead of ${VAR_NAME} placeholders)
      for (const [serverName, server] of Object.entries(enabledMcp.servers)) {
        for (const [key, val] of Object.entries(server.env ?? {})) {
          if (typeof val === "string" && !/^\$\{[A-Z_]+\}$/.test(val) && val.length > 20) {
            Logger.getInstance().warn(
              `MCP server "${serverName}" env.${key} looks like a raw secret. Use \${VAR_NAME} placeholders.`,
            );
          }
        }
      }

      // Copilot uses { "servers": { ... } } format (not mcpServers)
      const mcpOutput = {
        _instructions: `Generated by Codi — do not edit manually, run: codi generate`,
        servers: enabledMcp.servers,
      };
      const mcpContent = JSON.stringify(mcpOutput, null, 2);
      files.push({
        path: COPILOT_PATHS.mcpConfig,
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

    // --- 6-7. Heartbeat hook scripts and Copilot hooks config ---
    files.push(...buildCopilotHooksFiles());

    return files;
  },
};
