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
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
  buildMcpEnvExample,
  buildSelfDevWarning,
  buildProjectContext,
} from "./section-builder.js";
import {
  CONTEXT_TOKENS_LARGE,
  MANIFEST_FILENAME,
  MCP_FILENAME,
  PROJECT_NAME,
  PROJECT_DIR,
} from "../constants.js";
import { partitionBrandSkills } from "./brand-filter.js";
import {
  buildSkillTrackerScript,
  buildSkillObserverScript,
  HOOKS_SUBDIR,
  SKILL_TRACKER_FILENAME,
  SKILL_OBSERVER_FILENAME,
} from "../core/hooks/heartbeat-hooks.js";

/**
 * Maps the `language` field on a rule to Claude Code `paths:` glob patterns.
 * Used to preserve the intent of `alwaysApply: false` for language-specific rules —
 * Claude Code has no alwaysApply concept, only path scoping.
 */
const LANGUAGE_GLOB_PATTERNS: Record<string, string[]> = {
  typescript: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  python: ["**/*.py"],
  golang: ["**/*.go"],
  rust: ["**/*.rs"],
  java: ["**/*.java"],
  kotlin: ["**/*.kt", "**/*.kts"],
  csharp: ["**/*.cs"],
  swift: ["**/*.swift"],
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Adapter for Claude Code — Anthropic's official CLI for Claude.
 *
 * Detects presence of `CLAUDE.md` or a `.claude/` directory.
 * Generates `CLAUDE.md` (primary instruction file), `.claude/rules/`, `.claude/skills/`,
 * `.claude/agents/`, and `.mcp.json` (MCP server config).
 */
export const claudeCodeAdapter: AgentAdapter = {
  id: "claude-code",
  name: "Claude Code",

  paths: {
    configRoot: ".claude",
    rules: ".claude/rules",
    skills: ".claude/skills",
    agents: ".claude/agents",
    instructionFile: "CLAUDE.md",
    mcpConfig: ".mcp.json",
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: true,
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

    // Self-development mode warning (only when name === "codi")
    const selfDevWarning = buildSelfDevWarning(config);
    if (selfDevWarning) sections.push(selfDevWarning);

    // Project context from manifest.project_context
    const projectContext = buildProjectContext(config);
    if (projectContext) sections.push(projectContext);

    if (flagText) {
      sections.push("## Permissions\n\n" + flagText);
    }

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
      // Explicit scope takes priority; fall back to language-derived patterns
      // for alwaysApply: false rules (Claude Code has no alwaysApply concept).
      let pathPatterns: string[] | undefined = rule.scope?.length ? rule.scope : undefined;
      if (!pathPatterns && !rule.alwaysApply && rule.language) {
        pathPatterns = LANGUAGE_GLOB_PATTERNS[rule.language];
      }
      const header = pathPatterns?.length
        ? `---\npaths:\n${pathPatterns.map((s) => `  - "${s}"`).join("\n")}\n---\n\n`
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
        "",
        "claude-code",
      )),
    );

    // Generate .claude/agents/{name}.md (Claude Code format)
    for (const agent of config.agents) {
      const lines = ["---"];
      lines.push(`name: ${agent.name}`);
      lines.push(`description: ${agent.description}`);
      if (agent.tools) lines.push(`tools: ${agent.tools.join(", ")}`);
      if (agent.disallowedTools) lines.push(`disallowedTools: ${agent.disallowedTools.join(", ")}`);
      if (agent.model) lines.push(`model: ${agent.model}`);
      if (agent.maxTurns) lines.push(`maxTurns: ${agent.maxTurns}`);
      if (agent.effort) lines.push(`effort: ${agent.effort}`);
      if (agent.permissionMode) lines.push(`permissionMode: ${agent.permissionMode}`);
      if (agent.mcpServers?.length) lines.push(`mcpServers: [${agent.mcpServers.join(", ")}]`);
      if (agent.skills?.length) lines.push(`skills: [${agent.skills.join(", ")}]`);
      if (agent.memory) lines.push(`memory: ${agent.memory}`);
      if (agent.background) lines.push(`background: true`);
      if (agent.isolation) lines.push(`isolation: ${agent.isolation}`);
      if (agent.color) lines.push(`color: ${agent.color}`);
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

    // Generate heartbeat hook scripts to .codi/hooks/
    const trackerScript = buildSkillTrackerScript();
    const trackerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}`;
    files.push({
      path: trackerPath,
      content: trackerScript,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(trackerScript),
    });

    const observerScript = buildSkillObserverScript();
    const observerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`;
    files.push({
      path: observerPath,
      content: observerScript,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(observerScript),
    });

    // Generate .claude/settings.json (permissions + heartbeat hooks)
    const settingsJson = buildSettingsJson(config);
    const settingsContent = JSON.stringify(settingsJson, null, 2);
    files.push({
      path: ".claude/settings.json",
      content: settingsContent,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(settingsContent),
    });

    return files;
  },
};

interface ClaudeHookCommand {
  type: "command";
  command: string;
  timeout: number;
  async?: true;
}

interface ClaudeSettings {
  permissions?: { deny?: string[] };
  hooks?: Record<string, ClaudeHookCommand[]>;
}

function buildSettingsJson(config: NormalizedConfig): ClaudeSettings {
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

  // Heartbeat hooks — always present so the feedback loop works out of the box.
  // Users who need personal hooks must use .claude/settings.local.json (auto-merged by Claude Code).
  const hooksDir = `.${PROJECT_NAME}/hooks`;
  settings.hooks = {
    InstructionsLoaded: [
      {
        type: "command",
        command: `${hooksDir}/${PROJECT_NAME}-skill-tracker.mjs`,
        timeout: 5,
        async: true,
      },
    ],
    Stop: [
      {
        type: "command",
        command: `${hooksDir}/${PROJECT_NAME}-skill-observer.mjs`,
        timeout: 15,
      },
    ],
  };

  return settings;
}
