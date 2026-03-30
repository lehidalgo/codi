import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import type {
  ManagedBy,
  NormalizedRule,
  NormalizedSkill,
  NormalizedAgent,
  NormalizedCommand,
  McpConfig,
} from "../../types/config.js";
import type { FlagDefinition } from "../../types/flags.js";
import { createError } from "../output/errors.js";
import { PresetManifestSchema } from "../../schemas/preset.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";
import {
  MCP_FILENAME,
  PRESET_MANIFEST_FILENAME,
  PROJECT_NAME,
  BRAND_CATEGORY,
} from "#src/constants.js";
import {
  isBuiltinPreset as checkBuiltin,
  materializeBuiltinPreset,
} from "./preset-builtin.js";
import { loadTemplate } from "../scaffolder/template-loader.js";
import { loadSkillTemplateContent } from "../scaffolder/skill-template-loader.js";
import { loadAgentTemplate } from "../scaffolder/agent-template-loader.js";
import { loadCommandTemplate } from "../scaffolder/command-template-loader.js";

export interface LoadedPreset {
  name: string;
  description: string;
  flags: Record<string, FlagDefinition>;
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  agents: NormalizedAgent[];
  commands: NormalizedCommand[];
  mcp: McpConfig;
}

export async function loadPreset(
  name: string,
  presetsDir: string,
): Promise<Result<LoadedPreset>> {
  if (checkBuiltin(name)) {
    return materializeBuiltinPreset(name);
  }

  return loadPresetFromDir(name, presetsDir);
}

/**
 * Loads a preset from a directory under presetsDir.
 * Does NOT check for built-in presets — use loadPreset() for that.
 * Exported for use by preset-resolver which handles source routing separately.
 */
export async function loadPresetFromDir(
  name: string,
  presetsDir: string,
): Promise<Result<LoadedPreset>> {
  // Check if it's a built-in preset (backward compat for flag-only + full presets)
  if (checkBuiltin(name)) {
    return materializeBuiltinPreset(name);
  }

  const presetDir = path.join(presetsDir, name);
  const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);

  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestPath, "utf8");
  } catch {
    return err([createError("E_CONFIG_NOT_FOUND", { path: manifestPath })]);
  }

  const parsed = parseYaml(manifestRaw) as Record<string, unknown>;
  const validated = PresetManifestSchema.safeParse(parsed);
  if (!validated.success) {
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Invalid preset manifest: ${name}`,
      }),
    ]);
  }

  const manifest = validated.data;

  // Resolve extends: load parent preset first, then merge child on top
  let parentFlags: Record<string, FlagDefinition> = {};
  let parentRules: NormalizedRule[] = [];
  let parentSkills: NormalizedSkill[] = [];
  let parentAgents: NormalizedAgent[] = [];
  let parentCommands: NormalizedCommand[] = [];
  let parentMcp: McpConfig = { servers: {} };

  if (manifest.extends) {
    const parentResult = await loadPreset(manifest.extends, presetsDir);
    if (parentResult.ok) {
      parentFlags = parentResult.data.flags;
      parentRules = parentResult.data.rules;
      parentSkills = parentResult.data.skills;
      parentAgents = parentResult.data.agents;
      parentCommands = parentResult.data.commands;
      parentMcp = parentResult.data.mcp;
    }
  }

  // Resolve artifacts by name from the artifacts field
  // If no artifacts field, treat as flags-only preset (empty artifact lists)
  const configDir = path.dirname(presetsDir);
  const resolved = manifest.artifacts
    ? await resolveArtifactsByName(manifest.artifacts, configDir)
    : { rules: [], skills: [], agents: [], commands: [] };
  const { rules, skills, agents, commands } = resolved;

  let mcp: McpConfig = { servers: {} };
  try {
    const mcpRaw = await fs.readFile(
      path.join(presetDir, MCP_FILENAME),
      "utf8",
    );
    const mcpParsed = parseYaml(mcpRaw) as Record<string, unknown>;
    if (mcpParsed && mcpParsed["servers"]) {
      mcp = mcpParsed as unknown as McpConfig;
    }
  } catch {
    /* no mcp.yaml */
  }

  // Merge: parent first, then child overrides
  const mergedFlags = {
    ...parentFlags,
    ...((manifest.flags ?? {}) as Record<string, FlagDefinition>),
  };
  const mergedRules = mergeArtifacts(parentRules, rules);
  const mergedSkills = mergeArtifacts(parentSkills, skills);
  const mergedAgents = mergeArtifacts(parentAgents, agents);
  const mergedCommands = mergeArtifacts(parentCommands, commands);
  const mergedMcp: McpConfig = {
    servers: { ...parentMcp.servers, ...mcp.servers },
  };

  return ok({
    name: manifest.name,
    description: manifest.description ?? "",
    flags: mergedFlags,
    rules: mergedRules,
    skills: mergedSkills,
    agents: mergedAgents,
    commands: mergedCommands,
    mcp: mergedMcp,
  });
}

function mergeArtifacts<T extends { name: string }>(
  parent: T[],
  child: T[],
): T[] {
  const childNames = new Set(child.map((c) => c.name));
  const fromParent = parent.filter((p) => !childNames.has(p.name));
  return [...fromParent, ...child];
}

interface ArtifactNames {
  rules?: string[];
  skills?: string[];
  agents?: string[];
  commands?: string[];
  // @deprecated — use skills with category: brand instead
  brands?: string[];
}

interface ResolvedArtifacts {
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  agents: NormalizedAgent[];
  commands: NormalizedCommand[];
}

/**
 * Resolves artifact names to full normalized objects.
 * Tries built-in templates first, then custom files in project canonical dirs.
 */
async function resolveArtifactsByName(
  artifacts: ArtifactNames,
  configDir: string,
): Promise<ResolvedArtifacts> {
  const rules: NormalizedRule[] = [];
  for (const name of artifacts.rules ?? []) {
    const rule = resolveRule(name) ?? (await loadRuleFromDir(name, configDir));
    if (rule) rules.push(rule);
  }

  const skills: NormalizedSkill[] = [];
  for (const name of artifacts.skills ?? []) {
    const skill =
      resolveSkill(name) ?? (await loadSkillFromDir(name, configDir));
    if (skill) skills.push(skill);
  }

  const agents: NormalizedAgent[] = [];
  for (const name of artifacts.agents ?? []) {
    const agent =
      resolveAgent(name) ?? (await loadAgentFromDir(name, configDir));
    if (agent) agents.push(agent);
  }

  const commands: NormalizedCommand[] = [];
  for (const name of artifacts.commands ?? []) {
    const cmd =
      resolveCommand(name) ?? (await loadCommandFromDir(name, configDir));
    if (cmd) commands.push(cmd);
  }

  // Convert deprecated brands field to brand-category skills
  for (const name of artifacts.brands ?? []) {
    const brand = await loadLegacyBrandFromDir(name, configDir);
    if (brand) skills.push(brand);
  }

  return { rules, skills, agents, commands };
}

function resolveRule(name: string): NormalizedRule | null {
  const result = loadTemplate(name);
  if (!result.ok) return null;
  try {
    const replaced = result.data.replace(/\{\{name\}\}/g, name);
    const { data, content } =
      parseFrontmatter<Record<string, unknown>>(replaced);
    return {
      name,
      description: (data["description"] as string) ?? "",
      content,
      priority: (data["priority"] as "high" | "medium" | "low") ?? "medium",
      alwaysApply: (data["alwaysApply"] as boolean) ?? true,
      managedBy: PROJECT_NAME,
    };
  } catch {
    return null;
  }
}

function resolveSkill(name: string): NormalizedSkill | null {
  const result = loadSkillTemplateContent(name);
  if (!result.ok) return null;
  try {
    const replaced = result.data.replace(/\{\{name\}\}/g, name);
    const { data, content } =
      parseFrontmatter<Record<string, unknown>>(replaced);
    return {
      name,
      description: (data["description"] as string) ?? "",
      content,
      managedBy: PROJECT_NAME,
    };
  } catch {
    return null;
  }
}

function resolveAgent(name: string): NormalizedAgent | null {
  const result = loadAgentTemplate(name);
  if (!result.ok) return null;
  try {
    const replaced = result.data.replace(/\{\{name\}\}/g, name);
    const { data, content } =
      parseFrontmatter<Record<string, unknown>>(replaced);
    return {
      name,
      description: (data["description"] as string) ?? "",
      content,
      tools: data["tools"] as string[] | undefined,
      model: data["model"] as string | undefined,
      managedBy: PROJECT_NAME,
    };
  } catch {
    return null;
  }
}

function resolveCommand(name: string): NormalizedCommand | null {
  const result = loadCommandTemplate(name);
  if (!result.ok) return null;
  try {
    const replaced = result.data.replace(/\{\{name\}\}/g, name);
    const { data, content } =
      parseFrontmatter<Record<string, unknown>>(replaced);
    return {
      name,
      description: (data["description"] as string) ?? "",
      content,
      managedBy: PROJECT_NAME,
    };
  } catch {
    return null;
  }
}

async function loadRuleFromDir(
  name: string,
  configDir: string,
): Promise<NormalizedRule | null> {
  const paths = [path.join(configDir, "rules", `${name}.md`)];
  for (const p of paths) {
    try {
      const raw = await fs.readFile(p, "utf8");
      const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
      return {
        name,
        description: (data["description"] as string) ?? "",
        content,
        priority: (data["priority"] as "high" | "medium" | "low") ?? "medium",
        alwaysApply: (data["alwaysApply"] as boolean) ?? true,
        managedBy: (data["managed_by"] as ManagedBy) ?? "user",
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function loadSkillFromDir(
  name: string,
  configDir: string,
): Promise<NormalizedSkill | null> {
  try {
    const raw = await fs.readFile(
      path.join(configDir, "skills", name, "SKILL.md"),
      "utf8",
    );
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name,
      description: (data["description"] as string) ?? "",
      content,
      managedBy: (data["managed_by"] as ManagedBy) ?? "user",
    };
  } catch {
    return null;
  }
}

async function loadAgentFromDir(
  name: string,
  configDir: string,
): Promise<NormalizedAgent | null> {
  try {
    const raw = await fs.readFile(
      path.join(configDir, "agents", `${name}.md`),
      "utf8",
    );
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name,
      description: (data["description"] as string) ?? "",
      content,
      tools: data["tools"] as string[] | undefined,
      model: data["model"] as string | undefined,
      managedBy: (data["managed_by"] as ManagedBy) ?? "user",
    };
  } catch {
    return null;
  }
}

async function loadCommandFromDir(
  name: string,
  configDir: string,
): Promise<NormalizedCommand | null> {
  try {
    const raw = await fs.readFile(
      path.join(configDir, "commands", `${name}.md`),
      "utf8",
    );
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name,
      description: (data["description"] as string) ?? "",
      content,
      managedBy: (data["managed_by"] as ManagedBy) ?? "user",
    };
  } catch {
    return null;
  }
}

async function loadLegacyBrandFromDir(
  name: string,
  configDir: string,
): Promise<NormalizedSkill | null> {
  try {
    const raw = await fs.readFile(
      path.join(configDir, "brands", name, "BRAND.md"),
      "utf8",
    );
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name,
      description: (data["description"] as string) ?? "",
      content,
      category: BRAND_CATEGORY,
      managedBy: (data["managed_by"] as ManagedBy) ?? "user",
    };
  } catch {
    return null;
  }
}
