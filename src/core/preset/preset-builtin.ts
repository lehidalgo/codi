import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import type { NormalizedRule, NormalizedSkill, NormalizedAgent, McpConfig } from '../../types/config.js';
import type { LoadedPreset } from './preset-loader.js';
import type { BuiltinPresetDefinition } from '../../templates/presets/types.js';
import { getBuiltinPresetDefinition } from '../../templates/presets/index.js';
import { loadTemplate } from '../scaffolder/template-loader.js';
import { loadSkillTemplate } from '../scaffolder/skill-template-loader.js';
import { loadAgentTemplate } from '../scaffolder/agent-template-loader.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { createError } from '../output/errors.js';

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
    return err([createError('E_PRESET_NOT_FOUND', { name })]);
  }

  return materializeDefinition(definition);
}

function materializeDefinition(def: BuiltinPresetDefinition): Result<LoadedPreset> {
  const mergedFlags = def.flags;

  const rules = materializeRules(def.rules);
  const skills = materializeSkills(def.skills);
  const agents = materializeAgents(def.agents);

  return ok({
    name: def.name,
    description: def.description,
    flags: mergedFlags,
    rules,
    skills,
    agents,
    commands: [],
    mcp: { servers: {} } as McpConfig,
  });
}

function materializeRules(templateNames: string[]): NormalizedRule[] {
  const rules: NormalizedRule[] = [];
  for (const name of templateNames) {
    const result = loadTemplate(name);
    if (!result.ok) continue;

    const rule = parseRuleTemplate(name, result.data);
    if (rule) rules.push(rule);
  }
  return rules;
}

function materializeSkills(templateNames: string[]): NormalizedSkill[] {
  const skills: NormalizedSkill[] = [];
  for (const name of templateNames) {
    const result = loadSkillTemplate(name);
    if (!result.ok) continue;

    const skill = parseSkillTemplate(name, result.data);
    if (skill) skills.push(skill);
  }
  return skills;
}

function materializeAgents(templateNames: string[]): NormalizedAgent[] {
  const agents: NormalizedAgent[] = [];
  for (const name of templateNames) {
    const result = loadAgentTemplate(name);
    if (!result.ok) continue;

    const agent = parseAgentTemplate(name, result.data);
    if (agent) agents.push(agent);
  }
  return agents;
}

function parseRuleTemplate(name: string, content: string): NormalizedRule | null {
  try {
    const { data, content: body } = parseFrontmatter<Record<string, unknown>>(content);
    return {
      name: (data['name'] as string) ?? name,
      description: (data['description'] as string) ?? '',
      content: body,
      priority: (data['priority'] as 'high' | 'medium' | 'low') ?? 'medium',
      alwaysApply: (data['alwaysApply'] as boolean) ?? true,
      managedBy: 'codi',
    };
  } catch {
    return null;
  }
}

function parseSkillTemplate(name: string, content: string): NormalizedSkill | null {
  try {
    const { data, content: body } = parseFrontmatter<Record<string, unknown>>(content);
    return {
      name: (data['name'] as string) ?? name,
      description: (data['description'] as string) ?? '',
      content: body,
      managedBy: 'codi',
    };
  } catch {
    return null;
  }
}

function parseAgentTemplate(name: string, content: string): NormalizedAgent | null {
  try {
    const { data, content: body } = parseFrontmatter<Record<string, unknown>>(content);
    return {
      name: (data['name'] as string) ?? name,
      description: (data['description'] as string) ?? '',
      content: body,
      tools: data['tools'] as string[] | undefined,
      model: data['model'] as string | undefined,
      managedBy: 'codi',
    };
  } catch {
    return null;
  }
}
