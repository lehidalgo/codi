import { access } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
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
import { generateSkillFiles } from "./skill-generator.js";
import {
  buildProjectOverview,
  buildDevelopmentNotes,
  buildWorkflowSection,
  getEnabledMcpServers,
  buildMcpEnvExample,
  buildSelfDevWarning,
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
  buildLauncherFile,
  launcherCommand,
  HOOKS_SUBDIR,
  LAUNCHER_FILENAME,
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

function readEnabledRuntimeHookNames(projectRoot: string | undefined): string[] | null {
  if (!projectRoot) return null;
  try {
    const stateFile = join(projectRoot, ".codi", "state", "state.json");
    if (!existsSync(stateFile)) return null;
    const parsed = JSON.parse(readFileSync(stateFile, "utf8")) as {
      selectedHooks?: { runtime?: string[] };
    };
    return parsed.selectedHooks?.runtime ?? null;
  } catch {
    return null;
  }
}

function isHeartbeatEnabled(selected: string[] | null, name: string): boolean {
  // No state.json (greenfield) → emit by default to preserve current behaviour.
  if (selected === null) return true;
  return selected.includes(name);
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

    if (flagText) {
      sections.push("## Permissions\n\n" + flagText);
    }

    // Claude Code auto-discovers skills (.claude/skills/) and subagents
    // (.claude/agents/) from their own description frontmatter. Listing them
    // again here would duplicate context and bloat CLAUDE.md per
    // https://code.claude.com/docs/en/best-practices.

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
      const fileName = `${sanitizeNameForPath(rule.name)}.md`;
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
      const fileName = `${sanitizeNameForPath(agent.name)}.md`;
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
      const fileName = `${sanitizeNameForPath(brand.name)}.md`;
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

    // Generate heartbeat hook scripts to .codi/hooks/, gated by selection.
    const enabledRuntime = readEnabledRuntimeHookNames(_options.projectRoot);
    const emitTracker = isHeartbeatEnabled(enabledRuntime, "skill-tracker");
    const emitObserver = isHeartbeatEnabled(enabledRuntime, "skill-observer");

    if (emitTracker) {
      const trackerScript = buildSkillTrackerScript();
      const trackerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_TRACKER_FILENAME}`;
      files.push({
        path: trackerPath,
        content: trackerScript,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(trackerScript),
      });
    }

    if (emitObserver) {
      const observerScript = buildSkillObserverScript();
      const observerPath = `${PROJECT_DIR}/${HOOKS_SUBDIR}/${SKILL_OBSERVER_FILENAME}`;
      files.push({
        path: observerPath,
        content: observerScript,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(observerScript),
      });
    }

    // Ship the node-resolver launcher next to the hook scripts. The hook command
    // in settings.json invokes `/bin/sh <launcher> <script>` so non-interactive
    // hook shells (which do not source ~/.zshrc) can still find a node binary.
    const launcher = buildLauncherFile();
    files.push({
      path: launcher.path,
      content: launcher.content,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(launcher.content),
    });

    // Generate .claude/settings.json (permissions + heartbeat hooks)
    const settingsJson = buildSettingsJson(config, enabledRuntime);
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

interface ClaudeHookEntry {
  matcher: string;
  hooks: ClaudeHookCommand[];
}

interface ClaudeSettings {
  permissions?: { deny?: string[] };
  hooks?: Record<string, ClaudeHookEntry[]>;
}

function buildSettingsJson(
  config: NormalizedConfig,
  enabledRuntime: string[] | null,
): ClaudeSettings {
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

  // Two layers of hooks coexist:
  //
  // 1. Legacy heartbeat (InstructionsLoaded skill-tracker + Stop skill-observer)
  //    — narrow purpose: skill-load tracking + the legacy
  //    `[CODI-OBSERVATION:...]` filesystem feedback channel. Kept intact so
  //    in-flight users do not regress.
  //
  // 2. F6/F7 brain pipeline (UserPromptSubmit + PreToolUse + PostToolUse +
  //    Stop) — the canonical observability + capture + Iron Law channel.
  //    Each event invokes `codi hook <name>` which the codi binary
  //    dispatches to the matching processX orchestrator. The PROJECT_CLI
  //    binary is on the user's PATH because consumers `npm install -g codi`
  //    (or run via npx); no plugin pattern needed.
  //
  // Multiple hook entries per event are allowed by Claude Code; the
  // legacy and F6/F7 Stop hooks coexist on the same event.
  //
  // Users who need personal hooks must use .claude/settings.local.json
  // (auto-merged by Claude Code).
  //
  // Commands resolve the script via $CLAUDE_PROJECT_DIR (officially guaranteed for every
  // hook event, per https://code.claude.com/docs/en/hooks) so they survive session CWD drift
  // into subdirectories. The ${VAR:-.} fallback preserves today's relative-path behavior if
  // the env var is somehow unset, so there is no regression in edge environments.
  const hooksDir = `${PROJECT_DIR}/${HOOKS_SUBDIR}`;
  const projectRootRef = '"${CLAUDE_PROJECT_DIR:-.}"';
  const launcherRef = `${projectRootRef}/${hooksDir}/${LAUNCHER_FILENAME}`;
  const trackerRef = `${projectRootRef}/${hooksDir}/${SKILL_TRACKER_FILENAME}`;
  const observerRef = `${projectRootRef}/${hooksDir}/${SKILL_OBSERVER_FILENAME}`;

  // F6/F7 hook command builder — `cd` into project root so the brain
  // resolver (DEFECT-008) walks up from the project's `.codi/` and we
  // do not accidentally hit the home brain. Stdin is forwarded
  // unchanged so the codi subcommand sees the Claude Code payload.
  const codiHook = (name: string): string =>
    `cd ${projectRootRef} && codi hook ${name} --agent claude-code`;

  const trackerEnabled = isHeartbeatEnabled(enabledRuntime, "skill-tracker");
  const observerEnabled = isHeartbeatEnabled(enabledRuntime, "skill-observer");

  settings.hooks = {
    ...(trackerEnabled
      ? {
          InstructionsLoaded: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command" as const,
                  command: launcherCommand(launcherRef, trackerRef),
                  timeout: 5,
                  async: true as const,
                },
              ],
            },
          ],
        }
      : {}),
    UserPromptSubmit: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: codiHook("user-prompt-submit"),
            timeout: 10,
          },
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: "Edit|Write|NotebookEdit|Bash",
        hooks: [
          {
            type: "command",
            command: codiHook("pre-tool-use"),
            timeout: 30,
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: "Edit|Write|NotebookEdit|Bash|Read",
        hooks: [
          {
            type: "command",
            command: codiHook("post-tool-use"),
            timeout: 15,
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: "",
        hooks: [
          ...(observerEnabled
            ? [
                {
                  type: "command" as const,
                  command: launcherCommand(launcherRef, observerRef),
                  timeout: 15,
                },
              ]
            : []),
          {
            type: "command" as const,
            command: codiHook("stop"),
            timeout: 15,
          },
        ],
      },
    ],
  };

  return settings;
}
