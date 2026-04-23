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
import { sanitizeNameForPath } from "../utils/path-guard.js";
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
  buildSelfDevWarning,
} from "./section-builder.js";
import { extractDenyRules, buildStrongTextRestrictions } from "./permission-builder.js";
import {
  CONTEXT_TOKENS_LARGE,
  MANIFEST_FILENAME,
  MCP_FILENAME,
  PROJECT_CLI,
  PROJECT_NAME_DISPLAY,
  PROJECT_DIR,
} from "../constants.js";
import {
  buildSkillObserverScript,
  HOOKS_SUBDIR,
  SKILL_OBSERVER_FILENAME,
} from "../core/hooks/heartbeat-hooks.js";

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

    // Self-development mode warning (only when name === "codi")
    const selfDevWarning = buildSelfDevWarning(config);
    if (selfDevWarning) sections.push(selfDevWarning);

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
      const fileName = `${sanitizeNameForPath(agent.name)}.toml`;
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
    // Codex only supports stdio MCP transport. HTTP/SSE servers (those
    // with a `url` field) cause Codex to fail at startup with:
    //   "url is not supported for stdio in mcp_servers.<name>".
    // Filter them out here and log a single warning listing the
    // skipped servers so users know where to reconfigure.
    const allEnabled = Object.entries(config.mcp.servers).filter(([, s]) => s.enabled !== false);
    const enabledServers: typeof allEnabled = [];
    const skippedHttpServers: string[] = [];
    for (const entry of allEnabled) {
      const [name, server] = entry;
      if (server.url) {
        skippedHttpServers.push(name);
      } else {
        enabledServers.push(entry);
      }
    }
    if (skippedHttpServers.length > 0 && typeof console !== "undefined") {
      console.warn(
        `[WRN] Codex adapter: skipping ${skippedHttpServers.length} HTTP/SSE MCP server(s) ` +
          `(${skippedHttpServers.join(", ")}) — Codex supports stdio transport only. ` +
          `These servers remain available for agents that support HTTP MCP (Claude Code, Cursor).`,
      );
    }
    const hasMcp = enabledServers.length > 0;

    // The project config is now always emitted. Even when there is no
    // MCP or flag content, Codi's users routinely run local dev servers
    // (content-factory preview, brand preview, docs site) and Codex's
    // default workspace-write sandbox blocks outbound loopback requests.
    // Publishing `sandbox_workspace_write.network_access = true` at the
    // project scope lets Codex call `http://localhost:...` without the
    // user having to escalate to --dangerously-bypass-approvals-and-sandbox.
    {
      const configLines = [
        `# Generated by ${PROJECT_NAME_DISPLAY} | Do not edit — run: ${PROJECT_CLI} generate`,
        "",
        "# Lift the default sandbox network block so Codex can reach local",
        "# dev servers this project starts (content-factory preview, brand",
        "# preview, docs site). Scoped to this project only — the user's",
        "# ~/.codex/config.toml is unaffected. Requires trust_level =",
        '# "trusted" for this path in the user config. Key reference:',
        "# https://developers.openai.com/codex/config-reference",
        "[sandbox_workspace_write]",
        "network_access = true",
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
        // HTTP/SSE servers are filtered upstream (Codex is stdio-only),
        // so `server.url` / `server.headers` paths are unreachable here.
        for (const [name, server] of enabledServers) {
          configLines.push("", `[mcp_servers.${name}]`);
          if (server.command) configLines.push(`command = "${server.command}"`);
          if (server.args)
            configLines.push(`args = [${server.args.map((a) => `"${a}"`).join(", ")}]`);
          if (server.env) {
            const envKeys = Object.keys(server.env);
            if (envKeys.length > 0) {
              configLines.push(`# Required env vars: ${envKeys.join(", ")}`);
            }
            for (const [k, v] of Object.entries(server.env)) {
              configLines.push(`env.${k} = "${v}"`);
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

    // Generate heartbeat hook script and .codex/hooks.json
    // Codex has no InstructionsLoaded — only the Stop observer is needed.
    const observerScript = buildSkillObserverScript();
    const observerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`;
    files.push({
      path: observerPath,
      content: observerScript,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(observerScript),
    });

    // Codex injects no project-dir env variable (see codex-rs/hooks/src/engine/command_runner.rs),
    // and the docs explicitly recommend resolving via `git rev-parse --show-toplevel` because
    // "Codex may be started from a subdirectory". The `|| echo .` fallback preserves today's
    // behavior when git is unavailable so there is no regression. Codex disables hooks on
    // Windows, so POSIX command substitution is safe here.
    const codexProjectRootRef = '"$(git rev-parse --show-toplevel 2>/dev/null || echo .)"';
    const codexHooks = {
      Stop: [
        {
          type: "command",
          command: `node ${codexProjectRootRef}/${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`,
          timeout: 15,
        },
      ],
    };
    const codexHooksContent = JSON.stringify(codexHooks, null, 2);
    files.push({
      path: ".codex/hooks.json",
      content: codexHooksContent,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(codexHooksContent),
    });

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
