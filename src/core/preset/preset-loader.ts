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
import { getPreset as getBuiltinPreset, getPresetNames } from '../flags/flag-presets.js';

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

function isBuiltinPreset(name: string): boolean {
  return getPresetNames().includes(name as ReturnType<typeof getPresetNames>[number]);
}

export async function loadPreset(name: string, presetsDir: string): Promise<Result<LoadedPreset>> {
  if (isBuiltinPreset(name)) {
    return ok({
      name,
      description: `Built-in ${name} preset`,
      flags: getBuiltinPreset(name as ReturnType<typeof getPresetNames>[number]),
      rules: [],
      skills: [],
      agents: [],
      commands: [],
      mcp: { servers: {} },
    });
  }

  const presetDir = path.join(presetsDir, name);
  const manifestPath = path.join(presetDir, 'preset.yaml');

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

  const rules = await loadPresetArtifacts<NormalizedRule>(path.join(presetDir, 'rules'), parseRuleFile);
  const skills = await loadPresetArtifacts<NormalizedSkill>(path.join(presetDir, 'skills'), parseSkillFile);
  const agents = await loadPresetArtifacts<NormalizedAgent>(path.join(presetDir, 'agents'), parseAgentFile);
  const commands = await loadPresetArtifacts<NormalizedCommand>(path.join(presetDir, 'commands'), parseCommandFile);

  let mcp: McpConfig = { servers: {} };
  try {
    const mcpRaw = await fs.readFile(path.join(presetDir, 'mcp.yaml'), 'utf8');
    const mcpParsed = parseYaml(mcpRaw) as Record<string, unknown>;
    if (mcpParsed && mcpParsed['servers']) {
      mcp = mcpParsed as unknown as McpConfig;
    }
  } catch { /* no mcp.yaml */ }

  return ok({
    name: manifest.name,
    description: manifest.description ?? '',
    flags: (manifest.flags ?? {}) as Record<string, FlagDefinition>,
    rules,
    skills,
    agents,
    commands,
    mcp,
  });
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
