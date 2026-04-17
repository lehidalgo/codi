import { access } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentPaths,
  GeneratedFile,
  GenerateOptions,
} from "../types/agent.js";
import type { NormalizedConfig, NormalizedRule } from "../types/config.js";
import { hashContent } from "../utils/hash.js";
import { sanitizeNameForPath } from "../utils/path-guard.js";
import { buildFlagInstructions } from "./flag-instructions.js";
import { addGeneratedFooter } from "./generated-header.js";
import { partitionBrandSkills } from "./brand-filter.js";
import { generateSkillFiles } from "./skill-generator.js";
import {
  buildProjectOverview,
  buildSkillRoutingTable,
  buildDevelopmentNotes,
  buildWorkflowSection,
  buildSelfDevWarning,
  getEnabledMcpServers,
  buildMcpEnvExample,
} from "./section-builder.js";
import {
  CONTEXT_TOKENS_SMALL,
  MANIFEST_FILENAME,
  MCP_FILENAME,
  PROJECT_NAME,
} from "../constants.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function buildMdcFrontmatter(rule: NormalizedRule): string {
  const lines = ["---"];
  lines.push(`description: ${rule.description}`);
  lines.push(`alwaysApply: ${rule.alwaysApply}`);
  if (rule.scope && rule.scope.length > 0) {
    lines.push(`globs: ${rule.scope.join(", ")}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Adapter for Cursor — AI-powered code editor.
 *
 * Detects presence of `.cursor/` directory or `.cursorrules` file.
 * Generates `.cursorrules` (primary instruction file), `.cursor/rules/*.mdc`,
 * and `.cursor/mcp.json` (MCP server config).
 */
export const cursorAdapter: AgentAdapter = {
  id: "cursor",
  name: "Cursor",

  paths: {
    configRoot: ".cursor",
    rules: ".cursor/rules",
    skills: ".cursor/skills",
    agents: null,
    instructionFile: ".cursorrules",
    mcpConfig: ".cursor/mcp.json",
  } satisfies AgentPaths,

  capabilities: {
    rules: true,
    skills: true,
    mcp: true,
    frontmatter: true,
    progressiveLoading: true,
    agents: false,
    maxContextTokens: CONTEXT_TOKENS_SMALL,
  } satisfies AgentCapabilities,

  async detect(projectRoot: string): Promise<boolean> {
    const hasDir = await exists(join(projectRoot, ".cursor"));
    const hasFile = await exists(join(projectRoot, ".cursorrules"));
    return hasDir || hasFile;
  },

  async generate(config: NormalizedConfig, _options: GenerateOptions): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const flagText = buildFlagInstructions(config.flags);

    // Build .cursorrules — project context + rule references
    const sections: string[] = [];

    const overview = buildProjectOverview(config);
    if (overview) sections.push(overview);

    // Self-development mode warning (only when name === "codi")
    const selfDevWarning = buildSelfDevWarning(config);
    if (selfDevWarning) sections.push(selfDevWarning);

    if (flagText) {
      sections.push(flagText);
    }

    const devNotes = buildDevelopmentNotes(config);
    if (devNotes) sections.push(devNotes);

    sections.push(buildWorkflowSection());

    // Skill routing table
    const routingTable = buildSkillRoutingTable(config);
    if (routingTable) sections.push(routingTable);

    const mainContent = addGeneratedFooter(sections.join("\n\n"));
    files.push({
      path: ".cursorrules",
      content: mainContent,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(mainContent),
    });

    // Generate .cursor/rules/*.mdc with YAML frontmatter
    for (const rule of config.rules) {
      const frontmatter = buildMdcFrontmatter(rule);
      const ruleContent = addGeneratedFooter(`${frontmatter}\n\n# ${rule.name}\n\n${rule.content}`);
      const fileName = `${sanitizeNameForPath(rule.name)}.mdc`;
      files.push({
        path: `.cursor/rules/${fileName}`,
        content: ruleContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(ruleContent),
      });
    }

    // Partition skills into regular and brand-category skills
    const { regularSkills, brandSkills } = partitionBrandSkills(config.skills);

    // Generate .cursor/skills/{name}/SKILL.md + supporting files
    files.push(
      ...(await generateSkillFiles(
        regularSkills,
        ".cursor/skills",
        _options.projectRoot,
        "",
        "cursor",
      )),
    );

    // Generate .cursor/brands/{name}.md from brand-category skills
    for (const brand of brandSkills) {
      const brandContent = addGeneratedFooter(`# ${brand.name}\n\n${brand.content}`);
      const fileName = `${sanitizeNameForPath(brand.name)}.md`;
      files.push({
        path: `.cursor/brands/${fileName}`,
        content: brandContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(brandContent),
      });
    }

    // Generate .cursor/mcp.json if MCP servers are configured
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
        path: ".cursor/mcp.json",
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

    // Generate .cursor/hooks.json for native flag enforcement
    const hooksJson = buildCursorHooks(config);
    if (hooksJson) {
      const hooksContent = JSON.stringify(hooksJson, null, 2);
      files.push({
        path: ".cursor/hooks.json",
        content: hooksContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(hooksContent),
      });
    }

    return files;
  },
};

interface CursorHook {
  command: string;
  args?: string[];
}

interface CursorHooks {
  beforeShellExecution?: CursorHook[];
}

function buildCursorHooks(config: NormalizedConfig): CursorHooks | null {
  const flagValue = (key: string): unknown => config.flags[key]?.value;
  const denyPatterns: string[] = [];

  if (flagValue("allow_force_push") === false) {
    denyPatterns.push("git push --force", "git push -f");
  }
  if (flagValue("allow_file_deletion") === false) {
    denyPatterns.push("rm -rf", "rm -r");
  }

  if (denyPatterns.length === 0) return null;

  // Build inline shell command that checks stdin JSON for denied patterns
  const patternsArg = denyPatterns.join("|");
  const script = `read input; cmd=$(echo "$input" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//'); if echo "$cmd" | grep -qE '${patternsArg}'; then echo '{"permission":"deny"}'; else echo '{}'; fi`;

  return {
    beforeShellExecution: [{ command: "bash", args: ["-c", script] }],
  };
}
