import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import type {
  CodiManifest,
  NormalizedRule,
  NormalizedSkill,
  NormalizedCommand,
  NormalizedAgent,
} from '../../types/config.js';
import type { FlagDefinition } from '../../types/flags.js';
import { CodiManifestSchema } from '../../schemas/manifest.js';
import { FlagDefinitionSchema } from '../../schemas/flag.js';
import { RuleFrontmatterSchema } from '../../schemas/rule.js';
import { SkillFrontmatterSchema } from '../../schemas/skill.js';
import { AgentFrontmatterSchema } from '../../schemas/agent.js';
import { CommandFrontmatterSchema } from '../../schemas/command.js';
import { McpConfigSchema } from '../../schemas/mcp.js';
import { createError, zodToCodiErrors } from '../output/errors.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import type { McpConfig } from '../../types/config.js';

export interface ParsedCodiDir {
  manifest: CodiManifest;
  flags: Record<string, FlagDefinition>;
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  commands: NormalizedCommand[];
  agents: NormalizedAgent[];
  mcp: McpConfig;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readYamlFile(filePath: string): Promise<Result<unknown>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = parseYaml(raw);
    return ok(parsed);
  } catch (cause) {
    return err([createError('E_CONFIG_PARSE_FAILED', { file: filePath }, cause as Error)]);
  }
}

export async function parseManifest(codiDir: string): Promise<Result<CodiManifest>> {
  const manifestPath = path.join(codiDir, 'codi.yaml');
  if (!(await fileExists(manifestPath))) {
    return err([createError('E_CONFIG_NOT_FOUND', { path: manifestPath })]);
  }
  const rawResult = await readYamlFile(manifestPath);
  if (!rawResult.ok) return rawResult;

  const parsed = CodiManifestSchema.safeParse(rawResult.data);
  if (!parsed.success) {
    return err(zodToCodiErrors(parsed.error, manifestPath));
  }
  return ok(parsed.data as CodiManifest);
}

export async function parseFlags(
  codiDir: string,
): Promise<Result<Record<string, FlagDefinition>>> {
  const flagsPath = path.join(codiDir, 'flags.yaml');
  if (!(await fileExists(flagsPath))) {
    return ok({});
  }
  const rawResult = await readYamlFile(flagsPath);
  if (!rawResult.ok) return rawResult;

  const rawObj = rawResult.data as Record<string, unknown> | null;
  if (!rawObj || typeof rawObj !== 'object') {
    return ok({});
  }

  const flags: Record<string, FlagDefinition> = {};
  const errors: ReturnType<typeof createError>[] = [];

  for (const [key, value] of Object.entries(rawObj)) {
    const parsed = FlagDefinitionSchema.safeParse(value);
    if (!parsed.success) {
      errors.push(...zodToCodiErrors(parsed.error, `${flagsPath}#${key}`));
    } else {
      flags[key] = parsed.data as FlagDefinition;
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(flags);
}

export async function scanRules(rulesDir: string): Promise<Result<NormalizedRule[]>> {
  if (!(await fileExists(rulesDir))) {
    return ok([]);
  }
  const rules: NormalizedRule[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  const subdirs = ['generated', 'custom'];
  for (const sub of subdirs) {
    const subPath = path.join(rulesDir, sub);
    if (!(await fileExists(subPath))) continue;
    const files = await collectMarkdownFiles(subPath);
    for (const file of files) {
      const result = await parseRuleFile(file);
      if (!result.ok) {
        errors.push(...result.errors);
      } else {
        rules.push(result.data);
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(rules);
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(fullPath);
      results.push(...nested);
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function scanSkills(skillsDir: string): Promise<Result<NormalizedSkill[]>> {
  if (!(await fileExists(skillsDir))) {
    return ok([]);
  }
  const skills: NormalizedSkill[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  const files = await collectMarkdownFiles(skillsDir);
  for (const file of files) {
    const result = await parseSkillFile(file);
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      skills.push(result.data);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(skills);
}

async function scanCommands(commandsDir: string): Promise<Result<NormalizedCommand[]>> {
  if (!(await fileExists(commandsDir))) {
    return ok([]);
  }
  const commands: NormalizedCommand[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  const files = await collectMarkdownFiles(commandsDir);
  for (const file of files) {
    const result = await parseCommandFile(file);
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      commands.push(result.data);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(commands);
}

async function parseCommandFile(filePath: string): Promise<Result<NormalizedCommand>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const parsed = CommandFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      return err(zodToCodiErrors(parsed.error, filePath));
    }
    const fm = parsed.data;
    return ok({
      name: fm.name,
      description: fm.description,
      content,
    });
  } catch (cause) {
    return err([createError('E_FRONTMATTER_INVALID', {
      file: filePath,
      message: (cause as Error).message,
    })]);
  }
}

async function scanAgents(agentsDir: string): Promise<Result<NormalizedAgent[]>> {
  if (!(await fileExists(agentsDir))) {
    return ok([]);
  }
  const agents: NormalizedAgent[] = [];
  const errors: ReturnType<typeof createError>[] = [];

  const files = await collectMarkdownFiles(agentsDir);
  for (const file of files) {
    const result = await parseAgentFile(file);
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      agents.push(result.data);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(agents);
}

async function parseAgentFile(filePath: string): Promise<Result<NormalizedAgent>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const parsed = AgentFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      return err(zodToCodiErrors(parsed.error, filePath));
    }
    const fm = parsed.data;
    return ok({
      name: fm.name,
      description: fm.description,
      content,
      tools: fm.tools,
      model: fm.model,
      managedBy: fm.managed_by,
    });
  } catch (cause) {
    return err([createError('E_FRONTMATTER_INVALID', {
      file: filePath,
      message: (cause as Error).message,
    })]);
  }
}

async function parseSkillFile(filePath: string): Promise<Result<NormalizedSkill>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const parsed = SkillFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      return err(zodToCodiErrors(parsed.error, filePath));
    }
    const fm = parsed.data;
    return ok({
      name: fm.name,
      description: fm.description,
      content,
      compatibility: fm.compatibility,
      tools: fm.tools,
      managedBy: fm.managed_by,
    });
  } catch (cause) {
    return err([createError('E_FRONTMATTER_INVALID', {
      file: filePath,
      message: (cause as Error).message,
    })]);
  }
}

async function parseRuleFile(filePath: string): Promise<Result<NormalizedRule>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter<Record<string, unknown>>(raw);
    const parsed = RuleFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      return err(zodToCodiErrors(parsed.error, filePath));
    }
    const fm = parsed.data;
    return ok({
      name: fm.name,
      description: fm.description,
      content,
      language: fm.language,
      priority: fm.priority,
      scope: fm.scope,
      alwaysApply: fm.alwaysApply,
      managedBy: fm.managed_by,
    });
  } catch (cause) {
    return err([createError('E_FRONTMATTER_INVALID', {
      file: filePath,
      message: (cause as Error).message,
    })]);
  }
}

async function parseMcpConfig(codiDir: string): Promise<Result<McpConfig>> {
  const mcpPath = path.join(codiDir, 'mcp.yaml');
  if (!(await fileExists(mcpPath))) {
    return ok({ servers: {} });
  }
  const rawResult = await readYamlFile(mcpPath);
  if (!rawResult.ok) return rawResult;

  const parsed = McpConfigSchema.safeParse(rawResult.data);
  if (!parsed.success) {
    return err(zodToCodiErrors(parsed.error, mcpPath));
  }
  return ok(parsed.data as McpConfig);
}

export async function scanCodiDir(projectRoot: string): Promise<Result<ParsedCodiDir>> {
  const codiDir = path.join(projectRoot, '.codi');
  if (!(await fileExists(codiDir))) {
    return err([createError('E_CONFIG_NOT_FOUND', { path: codiDir })]);
  }

  const manifestResult = await parseManifest(codiDir);
  if (!manifestResult.ok) return manifestResult;

  const flagsResult = await parseFlags(codiDir);
  if (!flagsResult.ok) return flagsResult;

  const rulesResult = await scanRules(path.join(codiDir, 'rules'));
  if (!rulesResult.ok) return rulesResult;

  const skillsResult = await scanSkills(path.join(codiDir, 'skills'));
  if (!skillsResult.ok) return skillsResult;

  const commandsResult = await scanCommands(path.join(codiDir, 'commands'));
  if (!commandsResult.ok) return commandsResult;

  const agentsResult = await scanAgents(path.join(codiDir, 'agents'));
  if (!agentsResult.ok) return agentsResult;

  const mcpResult = await parseMcpConfig(codiDir);
  if (!mcpResult.ok) return mcpResult;

  return ok({
    manifest: manifestResult.data,
    flags: flagsResult.data,
    rules: rulesResult.data,
    skills: skillsResult.data,
    commands: commandsResult.data,
    agents: agentsResult.data,
    mcp: mcpResult.data,
  });
}
