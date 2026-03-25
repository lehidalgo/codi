import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import type { NormalizedRule, NormalizedSkill, NormalizedAgent, NormalizedCommand, McpConfig } from '../../types/config.js';
import type { FlagDefinition } from '../../types/flags.js';
import { createError } from '../output/errors.js';
import { PresetManifestSchema } from '../../schemas/preset.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { MCP_FILENAME, PRESET_MANIFEST_FILENAME } from '../../constants.js';
import { isBuiltinPreset as checkBuiltin, materializeBuiltinPreset } from './preset-builtin.js';
import { loadTemplate } from '../scaffolder/template-loader.js';
import { loadSkillTemplate } from '../scaffolder/skill-template-loader.js';
import { loadAgentTemplate } from '../scaffolder/agent-template-loader.js';
import { loadCommandTemplate } from '../scaffolder/command-template-loader.js';

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

export async function loadPreset(name: string, presetsDir: string): Promise<Result<LoadedPreset>> {
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
export async function loadPresetFromDir(name: string, presetsDir: string): Promise<Result<LoadedPreset>> {
  // Check if it's a built-in preset (backward compat for flag-only + full presets)
  if (checkBuiltin(name)) {
    return materializeBuiltinPreset(name);
  }

  const presetDir = path.join(presetsDir, name);
  const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);

  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestPath, 'utf8');
  } catch {
    return err([createError('E_CONFIG_NOT_FOUND', { path: manifestPath })]);
  }

  const parsed = parseYaml(manifestRaw) as Record<string, unknown>;
  const validated = PresetManifestSchema.safeParse(parsed);
  if (!validated.success) {
    return err([createError('E_CONFIG_INVALID', { message: `Invalid preset manifest: ${name}` })]);
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

  // Reference-based: resolve artifacts by name from the artifacts field
  // Fallback: load from preset subdirectories (backward compat)
  let rules: NormalizedRule[];
  let skills: NormalizedSkill[];
  let agents: NormalizedAgent[];
  let commands: NormalizedCommand[];

  if (manifest.artifacts) {
    const codiDir = path.dirname(presetsDir); // .codi/presets → .codi
    const resolved = await resolveArtifactsByName(manifest.artifacts, codiDir);
    rules = resolved.rules;
    skills = resolved.skills;
    agents = resolved.agents;
    commands = resolved.commands;
  } else {
    rules = await loadPresetArtifacts<NormalizedRule>(path.join(presetDir, 'rules'), parseRuleFile);
    skills = await loadPresetArtifacts<NormalizedSkill>(path.join(presetDir, 'skills'), parseSkillFile);
    agents = await loadPresetArtifacts<NormalizedAgent>(path.join(presetDir, 'agents'), parseAgentFile);
    commands = await loadPresetArtifacts<NormalizedCommand>(path.join(presetDir, 'commands'), parseCommandFile);
  }

  let mcp: McpConfig = { servers: {} };
  try {
    const mcpRaw = await fs.readFile(path.join(presetDir, MCP_FILENAME), 'utf8');
    const mcpParsed = parseYaml(mcpRaw) as Record<string, unknown>;
    if (mcpParsed && mcpParsed['servers']) {
      mcp = mcpParsed as unknown as McpConfig;
    }
  } catch { /* no mcp.yaml */ }

  // Merge: parent first, then child overrides
  const mergedFlags = { ...parentFlags, ...(manifest.flags ?? {}) as Record<string, FlagDefinition> };
  const mergedRules = mergeArtifacts(parentRules, rules);
  const mergedSkills = mergeArtifacts(parentSkills, skills);
  const mergedAgents = mergeArtifacts(parentAgents, agents);
  const mergedCommands = mergeArtifacts(parentCommands, commands);
  const mergedMcp: McpConfig = {
    servers: { ...parentMcp.servers, ...mcp.servers },
  };

  return ok({
    name: manifest.name,
    description: manifest.description ?? '',
    flags: mergedFlags,
    rules: mergedRules,
    skills: mergedSkills,
    agents: mergedAgents,
    commands: mergedCommands,
    mcp: mergedMcp,
  });
}

function mergeArtifacts<T extends { name: string }>(parent: T[], child: T[]): T[] {
  const childNames = new Set(child.map(c => c.name));
  const fromParent = parent.filter(p => !childNames.has(p.name));
  return [...fromParent, ...child];
}

async function loadPresetArtifacts<T>(dir: string, parser: (filePath: string) => Promise<T | null>): Promise<T[]> {
  const items: T[] = [];
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const item = await parser(path.join(dir, entry));
      if (item) items.push(item);
    }
  } catch { /* dir doesn't exist */ }
  return items;
}

async function parseRuleFile(filePath: string): Promise<NormalizedRule | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name: (data['name'] as string) ?? path.basename(filePath, '.md'),
      description: (data['description'] as string) ?? '',
      content,
      priority: (data['priority'] as 'high' | 'medium' | 'low') ?? 'medium',
      alwaysApply: (data['alwaysApply'] as boolean) ?? true,
      managedBy: (data['managed_by'] as 'codi' | 'user') ?? 'codi',
    };
  } catch { return null; }
}

async function parseSkillFile(filePath: string): Promise<NormalizedSkill | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name: (data['name'] as string) ?? path.basename(filePath, '.md'),
      description: (data['description'] as string) ?? '',
      content,
      managedBy: (data['managed_by'] as 'codi' | 'user') ?? 'codi',
    };
  } catch { return null; }
}

async function parseAgentFile(filePath: string): Promise<NormalizedAgent | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name: (data['name'] as string) ?? path.basename(filePath, '.md'),
      description: (data['description'] as string) ?? '',
      content,
      tools: data['tools'] as string[] | undefined,
      model: data['model'] as string | undefined,
      managedBy: (data['managed_by'] as 'codi' | 'user') ?? 'codi',
    };
  } catch { return null; }
}

async function parseCommandFile(filePath: string): Promise<NormalizedCommand | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    return {
      name: (data['name'] as string) ?? path.basename(filePath, '.md'),
      description: (data['description'] as string) ?? '',
      content,
      managedBy: (data['managed_by'] as 'codi' | 'user') ?? 'codi',
    };
  } catch { return null; }
}

interface ArtifactNames {
  rules?: string[];
  skills?: string[];
  agents?: string[];
  commands?: string[];
}

interface ResolvedArtifacts {
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  agents: NormalizedAgent[];
  commands: NormalizedCommand[];
}

/**
 * Resolves artifact names to full normalized objects.
 * Tries built-in templates first, then custom files in .codi/ canonical dirs.
 */
async function resolveArtifactsByName(
  artifacts: ArtifactNames,
  codiDir: string,
): Promise<ResolvedArtifacts> {
  const rules: NormalizedRule[] = [];
  for (const name of artifacts.rules ?? []) {
    const rule = resolveRule(name) ?? await loadRuleFromDir(name, codiDir);
    if (rule) rules.push(rule);
  }

  const skills: NormalizedSkill[] = [];
  for (const name of artifacts.skills ?? []) {
    const skill = resolveSkill(name) ?? await loadSkillFromDir(name, codiDir);
    if (skill) skills.push(skill);
  }

  const agents: NormalizedAgent[] = [];
  for (const name of artifacts.agents ?? []) {
    const agent = resolveAgent(name) ?? await loadAgentFromDir(name, codiDir);
    if (agent) agents.push(agent);
  }

  const commands: NormalizedCommand[] = [];
  for (const name of artifacts.commands ?? []) {
    const cmd = resolveCommand(name) ?? await loadCommandFromDir(name, codiDir);
    if (cmd) commands.push(cmd);
  }

  return { rules, skills, agents, commands };
}

function resolveRule(name: string): NormalizedRule | null {
  const result = loadTemplate(name);
  if (!result.ok) return null;
  try {
    const { data, content } = parseFrontmatter<Record<string, unknown>>(result.data);
    return {
      name: (data['name'] as string) ?? name,
      description: (data['description'] as string) ?? '',
      content,
      priority: (data['priority'] as 'high' | 'medium' | 'low') ?? 'medium',
      alwaysApply: (data['alwaysApply'] as boolean) ?? true,
      managedBy: 'codi',
    };
  } catch { return null; }
}

function resolveSkill(name: string): NormalizedSkill | null {
  const result = loadSkillTemplate(name);
  if (!result.ok) return null;
  try {
    const { data, content } = parseFrontmatter<Record<string, unknown>>(result.data);
    return {
      name: (data['name'] as string) ?? name,
      description: (data['description'] as string) ?? '',
      content,
      managedBy: 'codi',
    };
  } catch { return null; }
}

function resolveAgent(name: string): NormalizedAgent | null {
  const result = loadAgentTemplate(name);
  if (!result.ok) return null;
  try {
    const { data, content } = parseFrontmatter<Record<string, unknown>>(result.data);
    return {
      name: (data['name'] as string) ?? name,
      description: (data['description'] as string) ?? '',
      content,
      tools: data['tools'] as string[] | undefined,
      model: data['model'] as string | undefined,
      managedBy: 'codi',
    };
  } catch { return null; }
}

function resolveCommand(name: string): NormalizedCommand | null {
  const result = loadCommandTemplate(name);
  if (!result.ok) return null;
  try {
    const { data, content } = parseFrontmatter<Record<string, unknown>>(result.data);
    return {
      name: (data['name'] as string) ?? name,
      description: (data['description'] as string) ?? '',
      content,
      managedBy: 'codi',
    };
  } catch { return null; }
}

async function loadRuleFromDir(name: string, codiDir: string): Promise<NormalizedRule | null> {
  const paths = [
    path.join(codiDir, 'rules', 'custom', `${name}.md`),
    path.join(codiDir, 'rules', 'generated', 'common', `${name}.md`),
  ];
  for (const p of paths) {
    const rule = await parseRuleFile(p);
    if (rule) return rule;
  }
  return null;
}

async function loadSkillFromDir(name: string, codiDir: string): Promise<NormalizedSkill | null> {
  return parseSkillFile(path.join(codiDir, 'skills', `${name}.md`));
}

async function loadAgentFromDir(name: string, codiDir: string): Promise<NormalizedAgent | null> {
  return parseAgentFile(path.join(codiDir, 'agents', `${name}.md`));
}

async function loadCommandFromDir(name: string, codiDir: string): Promise<NormalizedCommand | null> {
  return parseCommandFile(path.join(codiDir, 'commands', `${name}.md`));
}
