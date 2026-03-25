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

  const rules = await loadPresetArtifacts<NormalizedRule>(path.join(presetDir, 'rules'), parseRuleFile);
  const skills = await loadPresetArtifacts<NormalizedSkill>(path.join(presetDir, 'skills'), parseSkillFile);
  const agents = await loadPresetArtifacts<NormalizedAgent>(path.join(presetDir, 'agents'), parseAgentFile);
  const commands = await loadPresetArtifacts<NormalizedCommand>(path.join(presetDir, 'commands'), parseCommandFile);

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
