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
import { partitionBrandSkills } from "./brand-filter.js";
import { generateSkillFiles } from "./skill-generator.js";
import {
  buildProjectOverview,
  buildAgentsTable,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
} from "./section-builder.js";
import { extractDenyRules, buildStrongTextRestrictions } from "./permission-builder.js";
import {
  CONTEXT_TOKENS_LARGE,
  MANIFEST_FILENAME,
  MCP_FILENAME,
  PROJECT_CLI,
  PROJECT_NAME_DISPLAY,
} from "../constants.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function toTomlBasicString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Adapter for Codex — OpenAI's coding agent.
 *
 * Detects presence of `AGENTS.md` or a `.agents/` directory.
 * Generates `AGENTS.md` (primary instruction file) and `.codex/agents/`.
 */
export const codexAdapter: AgentAdapter = {
  id: "codex",
  name: "Codex",

  paths: {
    configRoot: ".codex",
    rules: ".",
    skills: ".agents/skills",
    agents: ".codex/agents",
    instructionFile: "AGENTS.md",
    mcpConfig: ".codex/config.toml",
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: true,
    mcp: true,
    frontmatter: false,
    progressiveLoading: false,
    agents: true,
    maxContextTokens: CONTEXT_TOKENS_LARGE,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    const hasFile = await exists(join(projectRoot, "AGENTS.md"));
    const hasDir = await exists(join(projectRoot, ".agents"));
    return hasFile || hasDir;
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const flagText = buildFlagInstructions(config.flags);

    // AGENTS.md — rich project context + rules inline + agents table
    const sections: string[] = [];

    // Project overview from manifest
    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

    if (flagText) {
      sections.push("## Permissions\n\n" + flagText);
    }

    // Agents table with descriptions
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

    // Inline rules (Codex needs rules in AGENTS.md)
    for (const rule of config.rules) {
      sections.push(`## ${rule.name}\n\n${rule.content}`);
    }

    // Partition skills into regular and brand-category skills
    const { regularSkills, brandSkills } = partitionBrandSkills(config.skills);

    // Inline brand-category skills
    for (const brand of brandSkills) {
      sections.push(`## Brand: ${brand.name}\n\n${brand.content}`);
    }
    const content = addGeneratedFooter(sections.join("\n\n"));
    files.push({
      path: "AGENTS.md",
      content,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(content),
    });

    // Generate .agents/skills/{name}/SKILL.md + supporting files (auto-discovered by Codex)
    files.push(
      ...(await generateSkillFiles(
        regularSkills,
        ".agents/skills",
        _options.projectRoot,
        "",
        "codex",
      )),
    );

    // Generate .codex/agents/{name}.toml (Codex TOML format)
    for (const agent of config.agents) {
      const lines: string[] = [];
      lines.push(`name = "${agent.name}"`);
      lines.push(`description = "${agent.description}"`);
      lines.push(`developer_instructions = ${toTomlBasicString(agent.content)}`);
      if (agent.model) lines.push(`model = "${agent.model}"`);
      if (agent.effort) {
        // Codex accepts "low"|"medium"|"high" — clamp "max" to "high"
        const codexEffort = agent.effort === "max" ? "high" : agent.effort;
        lines.push(`model_reasoning_effort = "${codexEffort}"`);
      }
      const tomlContent = addGeneratedFooter(lines.join("\n"), "toml");
      const fileName = agent.name.toLowerCase().replace(/\s+/g, "-") + ".toml";
      files.push({
        path: `.codex/agents/${fileName}`,
        content: tomlContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(tomlContent),
      });
    }

    // Generate .codex/config.toml (native settings + developer_instructions + MCP servers)
    const restrictions = buildFlagRestrictions(config.flags);
    const nativeSettings = buildCodexNativeSettings(config.flags);
    const enabledServers = Object.entries(config.mcp.servers).filter(
      ([, s]) => s.enabled !== false,
    );
    const hasMcp = enabledServers.length > 0;

    if (restrictions || nativeSettings || hasMcp) {
      const configLines = [
        `# Generated by ${PROJECT_NAME_DISPLAY} | Do not edit — run: ${PROJECT_CLI} generate`,
      ];

      // Native settings (machine-enforced, not text)
      if (nativeSettings) {
        configLines.push("", ...nativeSettings);
      }

      if (restrictions) {
        configLines.push("", `developer_instructions = """`, restrictions, `"""`);
      }

      if (hasMcp) {
        configLines.push(
          "",
          "# MCP server environment variables use ${VAR_NAME} syntax.",
          "# Set required values in your project .env file or shell environment.",
        );
        for (const [name, server] of enabledServers) {
          configLines.push("", `[mcp_servers.${name}]`);
          if (server.command) configLines.push(`command = "${server.command}"`);
          if (server.args)
            configLines.push(`args = [${server.args.map((a) => `"${a}"`).join(", ")}]`);
          if (server.url) configLines.push(`url = "${server.url}"`);
          if (server.env) {
            const envKeys = Object.keys(server.env);
            if (envKeys.length > 0) {
              configLines.push(`# Required env vars: ${envKeys.join(", ")}`);
            }
            for (const [k, v] of Object.entries(server.env)) {
              configLines.push(`env.${k} = "${v}"`);
            }
          }
          if (server.headers) {
            for (const [k, v] of Object.entries(server.headers)) {
              configLines.push(`http_headers.${k} = "${v}"`);
            }
          }
        }
      }

      const configContent = configLines.join("\n");
      files.push({
        path: ".codex/config.toml",
        content: configContent,
        sources: [MANIFEST_FILENAME, MCP_FILENAME],
        hash: hashContent(configContent),
      });
    }

    return files;
  },
};

/** Build native Codex config.toml settings from flags. */
function buildCodexNativeSettings(flags: NormalizedConfig["flags"]): string[] | null {
  const lines: string[] = [];
  const flagValue = (key: string): unknown => flags[key]?.value;

  if (flagValue("allow_shell_commands") === false) {
    lines.push("[features]", "shell_tool = false");
  }

  return lines.length > 0 ? lines : null;
}

/** Build command restriction instructions from flags for Codex developer_instructions. */
function buildFlagRestrictions(flags: NormalizedConfig["flags"]): string | null {
  return buildStrongTextRestrictions(extractDenyRules(flags));
}
