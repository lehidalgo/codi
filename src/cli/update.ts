import type { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import matter from 'gray-matter';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { resolveCodiDir } from '../utils/paths.js';
import { FLAG_CATALOG } from '../core/flags/flag-catalog.js';
import { getPreset, getPresetNames } from '../core/flags/flag-presets.js';
import type { PresetName } from '../core/flags/flag-presets.js';
import { FLAGS_FILENAME, GIT_CLONE_DEPTH } from '../constants.js';
import { registerAllAdapters } from '../adapters/index.js';
import { resolveConfig } from '../core/config/resolver.js';
import { generate } from '../core/generator/generator.js';
import { loadTemplate, AVAILABLE_TEMPLATES } from '../core/scaffolder/template-loader.js';
import { loadSkillTemplate, AVAILABLE_SKILL_TEMPLATES } from '../core/scaffolder/skill-template-loader.js';
import { loadAgentTemplate, AVAILABLE_AGENT_TEMPLATES } from '../core/scaffolder/agent-template-loader.js';
import { loadCommandTemplate, AVAILABLE_COMMAND_TEMPLATES } from '../core/scaffolder/command-template-loader.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { Logger } from '../core/output/logger.js';
import { writeAuditEntry } from '../core/audit/audit-log.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';
import { OperationsLedgerManager } from '../core/audit/operations-ledger.js';

const execFileAsync = promisify(execFile);

interface UpdateOptions extends GlobalOptions {
  preset?: string;
  from?: string;
  rules?: boolean;
  skills?: boolean;
  agents?: boolean;
  commands?: boolean;
  // regenerate is now always-on (removed --regenerate flag)
  dryRun?: boolean;
}

interface UpdateData {
  flagsAdded: string[];
  flagsReset: boolean;
  preset: string | null;
  rulesUpdated: string[];
  rulesSkipped: string[];
  skillsUpdated: string[];
  skillsSkipped: string[];
  agentsUpdated: string[];
  agentsSkipped: string[];
  commandsUpdated: string[];
  commandsSkipped: string[];
  sourceUpdated: string[];
  regenerated: boolean;
}

async function refreshManagedRules(
  codiDir: string,
  dryRun: boolean,
  log: Logger,
): Promise<{ updated: string[]; skipped: string[] }> {
  const rulesDir = path.join(codiDir, 'rules', 'custom');
  const updated: string[] = [];
  const skipped: string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(rulesDir);
  } catch {
    return { updated, skipped };
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(rulesDir, entry);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = matter(raw);
    const managedBy = parsed.data['managed_by'] as string | undefined;

    if (managedBy !== 'codi') {
      skipped.push(entry.replace('.md', ''));
      continue;
    }

    const ruleName = (parsed.data['name'] as string) ?? entry.replace('.md', '');
    const templateName = findMatchingTemplate(ruleName, AVAILABLE_TEMPLATES, RULE_NAME_MAPPINGS);

    if (!templateName) {
      skipped.push(ruleName);
      continue;
    }

    const templateResult = loadTemplate(templateName);
    if (!templateResult.ok) continue;

    const newContent = templateResult.data.replace(/\{\{name\}\}/g, ruleName);

    if (!dryRun) {
      await fs.writeFile(filePath, newContent + '\n', 'utf-8');
    }
    updated.push(ruleName);
    log.info(`${dryRun ? 'Would update' : 'Updated'} rule: ${ruleName}`);
  }

  return { updated, skipped };
}

function findMatchingTemplate(name: string, available: string[], mappings: Record<string, string> = {}): string | null {
  if (available.includes(name)) return name;
  return mappings[name] ?? null;
}

const RULE_NAME_MAPPINGS: Record<string, string> = {
  'code-quality': 'code-style',
  'testing-standards': 'testing',
};

async function refreshManagedSkills(
  codiDir: string,
  dryRun: boolean,
  log: Logger,
): Promise<{ updated: string[]; skipped: string[] }> {
  const skillsDir = path.join(codiDir, 'skills');
  const updated: string[] = [];
  const skipped: string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return { updated, skipped };
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(skillsDir, entry);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = matter(raw);
    const managedBy = parsed.data['managed_by'] as string | undefined;

    if (managedBy !== 'codi') {
      skipped.push(entry.replace('.md', ''));
      continue;
    }

    const skillName = (parsed.data['name'] as string) ?? entry.replace('.md', '');
    const templateName = findMatchingTemplate(skillName, AVAILABLE_SKILL_TEMPLATES);

    if (!templateName) {
      skipped.push(skillName);
      continue;
    }

    const templateResult = loadSkillTemplate(templateName);
    if (!templateResult.ok) continue;

    const newContent = templateResult.data.replace(/\{\{name\}\}/g, skillName);

    if (!dryRun) {
      await fs.writeFile(filePath, newContent + '\n', 'utf-8');
    }
    updated.push(skillName);
    log.info(`${dryRun ? 'Would update' : 'Updated'} skill: ${skillName}`);
  }

  return { updated, skipped };
}

async function refreshManagedAgents(
  codiDir: string,
  dryRun: boolean,
  log: Logger,
): Promise<{ updated: string[]; skipped: string[] }> {
  const agentsDir = path.join(codiDir, 'agents');
  const updated: string[] = [];
  const skipped: string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(agentsDir);
  } catch {
    return { updated, skipped };
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(agentsDir, entry);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = matter(raw);
    const managedBy = parsed.data['managed_by'] as string | undefined;

    if (managedBy !== 'codi') {
      skipped.push(entry.replace('.md', ''));
      continue;
    }

    const agentName = (parsed.data['name'] as string) ?? entry.replace('.md', '');
    const templateName = findMatchingTemplate(agentName, AVAILABLE_AGENT_TEMPLATES);

    if (!templateName) {
      skipped.push(agentName);
      continue;
    }

    const templateResult = loadAgentTemplate(templateName);
    if (!templateResult.ok) continue;

    const newContent = templateResult.data.replace(/\{\{name\}\}/g, agentName);

    if (!dryRun) {
      await fs.writeFile(filePath, newContent + '\n', 'utf-8');
    }
    updated.push(agentName);
    log.info(`${dryRun ? 'Would update' : 'Updated'} agent: ${agentName}`);
  }

  return { updated, skipped };
}

async function refreshManagedCommands(
  codiDir: string,
  dryRun: boolean,
  log: Logger,
): Promise<{ updated: string[]; skipped: string[] }> {
  const commandsDir = path.join(codiDir, 'commands');
  const updated: string[] = [];
  const skipped: string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(commandsDir);
  } catch {
    return { updated, skipped };
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(commandsDir, entry);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = matter(raw);
    const managedBy = parsed.data['managed_by'] as string | undefined;

    if (managedBy !== 'codi') {
      skipped.push(entry.replace('.md', ''));
      continue;
    }

    const commandName = (parsed.data['name'] as string) ?? entry.replace('.md', '');
    const templateName = findMatchingTemplate(commandName, AVAILABLE_COMMAND_TEMPLATES);

    if (!templateName) {
      skipped.push(commandName);
      continue;
    }

    const templateResult = loadCommandTemplate(templateName);
    if (!templateResult.ok) continue;

    const newContent = templateResult.data.replace(/\{\{name\}\}/g, commandName);

    if (!dryRun) {
      await fs.writeFile(filePath, newContent + '\n', 'utf-8');
    }
    updated.push(commandName);
    log.info(`${dryRun ? 'Would update' : 'Updated'} command: ${commandName}`);
  }

  return { updated, skipped };
}

async function pullFromSource(
  repo: string,
  codiDir: string,
  dryRun: boolean,
  log: Logger,
): Promise<string[]> {
  const updated: string[] = [];
  const tmpDir = path.join(os.tmpdir(), `codi-pull-${Date.now()}`);

  try {
    const repoUrl = `https://github.com/${repo}.git`;
    await execFileAsync('git', ['clone', '--depth', GIT_CLONE_DEPTH, repoUrl, tmpDir]);
  } catch {
    log.warn(`Failed to clone source repo: ${repo}`);
    return updated;
  }

  const sourcePaths = ['rules/custom', 'skills', 'agents'];

  for (const syncPath of sourcePaths) {
    const sourceDir = path.join(tmpDir, '.codi', syncPath);
    const localDir = path.join(codiDir, syncPath);

    let entries: string[];
    try {
      entries = await fs.readdir(sourceDir);
    } catch {
      continue;
    }

    await fs.mkdir(localDir, { recursive: true });

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const sourceFile = path.join(sourceDir, entry);
      const localFile = path.join(localDir, entry);

      const sourceContent = await fs.readFile(sourceFile, 'utf8');
      const parsed = matter(sourceContent);
      const managedBy = parsed.data['managed_by'] as string | undefined;

      // Only pull managed_by: codi artifacts
      if (managedBy !== 'codi') continue;

      // Check if local file exists and is user-managed
      try {
        const localContent = await fs.readFile(localFile, 'utf8');
        const localParsed = matter(localContent);
        if (localParsed.data['managed_by'] === 'user') {
          log.info(`Skipping ${entry} (local is managed_by: user)`);
          continue;
        }
      } catch {
        // Local file doesn't exist — will be created
      }

      if (!dryRun) {
        await fs.writeFile(localFile, sourceContent, 'utf-8');
      }
      updated.push(`${syncPath}/${entry}`);
      log.info(`${dryRun ? 'Would pull' : 'Pulled'}: ${syncPath}/${entry}`);
    }
  }

  await fs.rm(tmpDir, { recursive: true, force: true });
  return updated;
}

export async function updateHandler(
  projectRoot: string,
  options: UpdateOptions,
): Promise<CommandResult<UpdateData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const flagsFile = path.join(codiDir, FLAGS_FILENAME);

  let currentFlags: Record<string, unknown>;
  try {
    const raw = await fs.readFile(flagsFile, 'utf8');
    currentFlags = (parseYaml(raw) as Record<string, unknown>) ?? {};
  } catch {
    return createCommandResult({
      success: false,
      command: 'update',
      data: { flagsAdded: [], flagsReset: false, preset: null, rulesUpdated: [], rulesSkipped: [], skillsUpdated: [], skillsSkipped: [], agentsUpdated: [], agentsSkipped: [], commandsUpdated: [], commandsSkipped: [], sourceUpdated: [], regenerated: false },
      errors: [{
        code: 'E_CONFIG_NOT_FOUND',
        message: 'No .codi/flags.yaml found. Run `codi init` first.',
        hint: 'Run `codi init` to create the configuration.',
        severity: 'error',
        context: { path: flagsFile },
      }],
      exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    });
  }

  const flagsAdded: string[] = [];
  let flagsReset = false;
  const presetName = options.preset as PresetName | undefined;

  if (presetName) {
    const validPresets = getPresetNames() as string[];
    if (!validPresets.includes(presetName)) {
      return createCommandResult({
        success: false,
        command: 'update',
        data: { flagsAdded: [], flagsReset: false, preset: presetName, rulesUpdated: [], rulesSkipped: [], skillsUpdated: [], skillsSkipped: [], agentsUpdated: [], agentsSkipped: [], commandsUpdated: [], commandsSkipped: [], sourceUpdated: [], regenerated: false },
        errors: [{
          code: 'E_CONFIG_INVALID',
          message: `Invalid preset "${presetName}". Available: ${validPresets.join(', ')}`,
          hint: `Use one of: ${validPresets.join(', ')}`,
          severity: 'error',
          context: { preset: presetName },
        }],
        exitCode: EXIT_CODES.CONFIG_INVALID,
      });
    }

    const preset = getPreset(presetName);
    const updatedFlags: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(preset)) {
      const entry: Record<string, unknown> = { mode: def.mode, value: def.value };
      if (def.locked) entry['locked'] = true;
      updatedFlags[key] = entry;
    }
    currentFlags = updatedFlags;
    flagsReset = true;
    log.info(`Reset all flags to "${presetName}" preset`);
  } else {
    for (const flagName of Object.keys(FLAG_CATALOG)) {
      if (!(flagName in currentFlags)) {
        const spec = FLAG_CATALOG[flagName]!;
        currentFlags[flagName] = { mode: 'enabled', value: spec.default };
        flagsAdded.push(flagName);
        log.info(`Added missing flag: ${flagName}`);
      }
    }
  }

  if (!options.dryRun) {
    await fs.writeFile(flagsFile, stringifyYaml(currentFlags), 'utf-8');
  }

  let rulesUpdated: string[] = [];
  let rulesSkipped: string[] = [];
  if (options.rules) {
    const result = await refreshManagedRules(codiDir, options.dryRun ?? false, log);
    rulesUpdated = result.updated;
    rulesSkipped = result.skipped;
  }

  let skillsUpdated: string[] = [];
  let skillsSkipped: string[] = [];
  if (options.skills) {
    const result = await refreshManagedSkills(codiDir, options.dryRun ?? false, log);
    skillsUpdated = result.updated;
    skillsSkipped = result.skipped;
  }

  let agentsUpdated: string[] = [];
  let agentsSkipped: string[] = [];
  if (options.agents) {
    const result = await refreshManagedAgents(codiDir, options.dryRun ?? false, log);
    agentsUpdated = result.updated;
    agentsSkipped = result.skipped;
  }

  let commandsUpdated: string[] = [];
  let commandsSkipped: string[] = [];
  if (options.commands) {
    const result = await refreshManagedCommands(codiDir, options.dryRun ?? false, log);
    commandsUpdated = result.updated;
    commandsSkipped = result.skipped;
  }

  let sourceUpdated: string[] = [];
  if (options.from) {
    sourceUpdated = await pullFromSource(options.from, codiDir, options.dryRun ?? false, log);
  }

  let regenerated = false;
  if (!options.dryRun) {
    registerAllAdapters();
    const configResult = await resolveConfig(projectRoot);
    if (configResult.ok) {
      const genResult = await generate(configResult.data, projectRoot);
      regenerated = genResult.ok;
    }
  }

  if (!options.dryRun) {
    await writeAuditEntry(codiDir, {
      type: 'update',
      timestamp: new Date().toISOString(),
      details: {
        flagsAdded,
        flagsReset,
        preset: presetName ?? null,
        rulesUpdated,
        skillsUpdated,
        agentsUpdated,
        commandsUpdated,
        regenerated,
      },
    });

    try {
      const ledger = new OperationsLedgerManager(codiDir);
      await ledger.logOperation({
        type: 'update',
        timestamp: new Date().toISOString(),
        details: {
          flagsAdded, flagsReset, preset: presetName ?? null,
          rulesUpdated, skillsUpdated, agentsUpdated, commandsUpdated,
          regenerated,
        },
      });
    } catch {
      // Best-effort
    }
  }

  return createCommandResult({
    success: true,
    command: 'update',
    data: { flagsAdded, flagsReset, preset: presetName ?? null, rulesUpdated, rulesSkipped, skillsUpdated, skillsSkipped, agentsUpdated, agentsSkipped, commandsUpdated, commandsSkipped, sourceUpdated, regenerated },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update flags, rules, skills, agents, and commands to latest versions')
    .option('--preset <preset>', `Reset flags to preset: ${getPresetNames().join(', ')}`)
    .option('--from <repo>', 'Pull centralized artifacts from a GitHub repo (e.g., org/team-config)')
    .option('--rules', 'Refresh template-managed rules to latest versions')
    .option('--skills', 'Refresh template-managed skills to latest versions')
    .option('--agents', 'Refresh template-managed agents to latest versions')
    .option('--commands', 'Refresh template-managed commands to latest versions')
    .option('--dry-run', 'Show what would change without writing')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: UpdateOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await updateHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
