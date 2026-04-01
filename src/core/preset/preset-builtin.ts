import { PROJECT_NAME } from "#src/constants.js";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import type {
  NormalizedRule,
  NormalizedSkill,
  NormalizedAgent,
  NormalizedCommand,
  McpConfig,
} from "../../types/config.js";
import type { LoadedPreset } from "./preset-loader.js";
import type { BuiltinPresetDefinition } from "../../templates/presets/types.js";
import { getBuiltinPresetDefinition } from "../../templates/presets/index.js";
import { loadTemplate } from "../scaffolder/template-loader.js";
import { loadSkillTemplateContent } from "../scaffolder/skill-template-loader.js";
import { loadAgentTemplate } from "../scaffolder/agent-template-loader.js";
import { loadCommandTemplate } from "../scaffolder/command-template-loader.js";
import { loadMcpServerTemplate } from "../scaffolder/mcp-template-loader.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";
import { createError } from "../output/errors.js";
import { Logger } from "../output/logger.js";

/**
 * Checks if a name corresponds to a built-in preset.
 */
export function isBuiltinPreset(name: string): boolean {
  return getBuiltinPresetDefinition(name) !== undefined;
}

/**
 * Materializes a built-in preset into a LoadedPreset.
 * Each preset is self-contained with all flags inline.
 */
export function materializeBuiltinPreset(name: string): Result<LoadedPreset> {
  const definition = getBuiltinPresetDefinition(name);
  if (!definition) {
    return err([createError("E_PRESET_NOT_FOUND", { name })]);
  }

  return materializeDefinition(definition);
}

function materializeDefinition(
  def: BuiltinPresetDefinition,
): Result<LoadedPreset> {
  const mergedFlags = def.flags;

  const rules = materializeRules(def.rules);
  const skills = materializeSkills(def.skills);
  const agents = materializeAgents(def.agents);
  const commands = materializeCommands(def.commands);
  const mcp = materializeMcpServers(def.mcpServers ?? []);

  return ok({
    name: def.name,
    description: def.description,
    flags: mergedFlags,
    rules,
    skills,
    agents,
    commands,
    mcp,
  });
}

function materializeRules(templateNames: string[]): NormalizedRule[] {
  const log = Logger.getInstance();
  const rules: NormalizedRule[] = [];
  for (const name of templateNames) {
    const result = loadTemplate(name);
    if (!result.ok) {
      log.debug(`Skipped rule template "${name}": load failed`);
      continue;
    }

    const rule = parseRuleTemplate(name, result.data);
    if (rule) rules.push(rule);
  }
  return rules;
}

function materializeSkills(templateNames: string[]): NormalizedSkill[] {
  const log = Logger.getInstance();
  const skills: NormalizedSkill[] = [];
  for (const name of templateNames) {
    const result = loadSkillTemplateContent(name);
    if (!result.ok) {
      log.debug(`Skipped skill template "${name}": load failed`);
      continue;
    }

    const skill = parseSkillTemplate(name, result.data);
    if (skill) skills.push(skill);
  }
  return skills;
}

function materializeAgents(templateNames: string[]): NormalizedAgent[] {
  const log = Logger.getInstance();
  const agents: NormalizedAgent[] = [];
  for (const name of templateNames) {
    const result = loadAgentTemplate(name);
    if (!result.ok) {
      log.debug(`Skipped agent template "${name}": load failed`);
      continue;
    }

    const agent = parseAgentTemplate(name, result.data);
    if (agent) agents.push(agent);
  }
  return agents;
}

function materializeCommands(templateNames: string[]): NormalizedCommand[] {
  const log = Logger.getInstance();
  const commands: NormalizedCommand[] = [];
  for (const name of templateNames) {
    const result = loadCommandTemplate(name);
    if (!result.ok) {
      log.debug(`Skipped command template "${name}": load failed`);
      continue;
    }

    const cmd = parseCommandTemplate(name, result.data);
    if (cmd) commands.push(cmd);
  }
  return commands;
}

function materializeMcpServers(templateNames: string[]): McpConfig {
  const log = Logger.getInstance();
  const servers: Record<string, unknown> = {};
  for (const name of templateNames) {
    const result = loadMcpServerTemplate(name);
    if (!result.ok) {
      log.debug(`Skipped MCP server template "${name}": load failed`);
      continue;
    }
    const tmpl = result.data;
    servers[tmpl.name] = {
      ...(tmpl.type && { type: tmpl.type }),
      ...(tmpl.command && { command: tmpl.command }),
      ...(tmpl.args && tmpl.args.length > 0 && { args: tmpl.args }),
      ...(tmpl.env && Object.keys(tmpl.env).length > 0 && { env: tmpl.env }),
      ...(tmpl.url && { url: tmpl.url }),
      ...(tmpl.headers &&
        Object.keys(tmpl.headers).length > 0 && { headers: tmpl.headers }),
    };
  }
  return { servers } as McpConfig;
}

function parseRuleTemplate(
  name: string,
  content: string,
): NormalizedRule | null {
  try {
    const { data, content: body } =
      parseFrontmatter<Record<string, unknown>>(content);
    return {
      name: (data["name"] as string) ?? name,
      description: (data["description"] as string) ?? "",
      content: body,
      priority: (data["priority"] as "high" | "medium" | "low") ?? "medium",
      alwaysApply: (data["alwaysApply"] as boolean) ?? true,
      managedBy: PROJECT_NAME,
    };
  } catch {
    return null;
  }
}

function parseSkillTemplate(
  name: string,
  content: string,
): NormalizedSkill | null {
  try {
    const { data, content: body } =
      parseFrontmatter<Record<string, unknown>>(content);
    return {
      name: (data["name"] as string) ?? name,
      description: (data["description"] as string) ?? "",
      content: body,
      managedBy: PROJECT_NAME,
    };
  } catch {
    return null;
  }
}

function parseAgentTemplate(
  name: string,
  content: string,
): NormalizedAgent | null {
  try {
    const { data, content: body } =
      parseFrontmatter<Record<string, unknown>>(content);
    return {
      name: (data["name"] as string) ?? name,
      description: (data["description"] as string) ?? "",
      content: body,
      tools: data["tools"] as string[] | undefined,
      model: data["model"] as string | undefined,
      managedBy: PROJECT_NAME,
    };
  } catch {
    return null;
  }
}

function parseCommandTemplate(
  name: string,
  content: string,
): NormalizedCommand | null {
  try {
    const { data, content: body } =
      parseFrontmatter<Record<string, unknown>>(content);
    return {
      name: (data["name"] as string) ?? name,
      description: (data["description"] as string) ?? "",
      content: body,
      managedBy: PROJECT_NAME,
    };
  } catch {
    return null;
  }
}
