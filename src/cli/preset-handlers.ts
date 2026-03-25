import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import prompts from 'prompts';
import { resolveCodiDir } from '../utils/paths.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { Logger } from '../core/output/logger.js';
import type { CommandResult } from '../core/output/types.js';
import { PRESET_MANIFEST_FILENAME, GIT_CLONE_DEPTH } from '../constants.js';
import {
  readLockFile,
  writeLockFile,
  getPresetVersionFromDir,
  copyDir,
} from '../core/preset/preset-registry.js';
import { parsePresetIdentifier, extractPresetName } from '../core/preset/preset-resolver.js';
import { installPresetFromZip, createPresetZip } from '../core/preset/preset-zip.js';
import { validatePreset } from '../core/preset/preset-validator.js';
import { getBuiltinPresetNames } from '../templates/presets/index.js';
import { PRESET_DESCRIPTIONS, getPresetNames as getFlagPresetNames } from '../core/flags/flag-presets.js';
import { presetInstallHandler } from './preset.js';
import type { PresetData } from './preset.js';
import { printBanner } from './shared.js';
import { AVAILABLE_TEMPLATES } from '../core/scaffolder/template-loader.js';
import { AVAILABLE_SKILL_TEMPLATES } from '../core/scaffolder/skill-template-loader.js';
import { AVAILABLE_AGENT_TEMPLATES } from '../core/scaffolder/agent-template-loader.js';
import { AVAILABLE_COMMAND_TEMPLATES } from '../core/scaffolder/command-template-loader.js';
import { regenerateConfigs } from './shared.js';

const execFileAsync = promisify(execFile);

/**
 * Unified install handler: auto-detects source type from the argument.
 */
export async function presetInstallUnifiedHandler(
  projectRoot: string,
  source: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const presetsDir = path.join(codiDir, 'presets');
  const descriptor = parsePresetIdentifier(source);

  try {
    if (descriptor.type === 'zip') {
      log.info(`Installing preset from ZIP: ${source}...`);
      const result = await installPresetFromZip(source, presetsDir);
      if (!result.ok) {
        return createCommandResult({
          success: false, command: 'preset install', data: { action: 'install' },
          errors: result.errors.map(e => ({
            code: e.code, message: e.message, hint: e.hint,
            severity: e.severity as 'error', context: e.context,
          })),
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }
      const { name } = result.data;
      const version = await getPresetVersionFromDir(path.join(presetsDir, name));
      const lock = await readLockFile(codiDir);
      lock.presets[name] = {
        version, source: `zip:${path.resolve(source)}`,
        sourceType: 'zip', installedAt: new Date().toISOString(),
      };
      await writeLockFile(codiDir, lock);
      log.info(`Installed preset "${name}" from ZIP.`);
      return createCommandResult({
        success: true, command: 'preset install',
        data: { action: 'install', name }, exitCode: EXIT_CODES.SUCCESS,
      });
    }

    if (descriptor.type === 'github') {
      return installFromGithub(projectRoot, descriptor, presetsDir);
    }

    // Fallback: treat as registry --from style
    return presetInstallHandler(projectRoot, descriptor.identifier, source);
  } catch (error) {
    return createCommandResult({
      success: false, command: 'preset install', data: { action: 'install' },
      errors: [{
        code: 'E_GENERAL',
        message: `Failed to install: ${error instanceof Error ? error.message : String(error)}`,
        hint: 'Check the source and try again.', severity: 'error', context: {},
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }
}

async function installFromGithub(
  projectRoot: string,
  descriptor: ReturnType<typeof parsePresetIdentifier>,
  presetsDir: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const repoUrl = `https://github.com/${descriptor.identifier}.git`;
  const ref = descriptor.ref ?? 'main';
  log.info(`Cloning preset from ${repoUrl} (ref: ${ref})...`);

  const tmpDir = path.join(os.tmpdir(), `codi-preset-gh-${Date.now()}`);
  try {
    const cloneArgs = ['clone', '--depth', GIT_CLONE_DEPTH];
    if (descriptor.ref) cloneArgs.push('--branch', descriptor.ref);
    cloneArgs.push(repoUrl, tmpDir);
    await execFileAsync('git', cloneArgs);

    const name = extractPresetName(descriptor);
    let sourceDir = tmpDir;
    try {
      await fs.access(path.join(tmpDir, name, PRESET_MANIFEST_FILENAME));
      sourceDir = path.join(tmpDir, name);
    } catch { /* Root is the preset */ }

    const destDir = path.join(presetsDir, name);
    await fs.rm(destDir, { recursive: true, force: true });
    await fs.mkdir(destDir, { recursive: true });
    await copyDir(sourceDir, destDir);

    let commit: string | undefined;
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: tmpDir });
      commit = stdout.trim();
    } catch { /* ignore */ }

    const version = await getPresetVersionFromDir(destDir);
    const lock = await readLockFile(codiDir);
    lock.presets[name] = {
      version,
      source: `github:${descriptor.identifier}${descriptor.ref ? `@${descriptor.ref}` : ''}`,
      sourceType: 'github', commit, installedAt: new Date().toISOString(),
    };
    await writeLockFile(codiDir, lock);
    log.info(`Installed preset "${name}" from GitHub.`);
    return createCommandResult({
      success: true, command: 'preset install',
      data: { action: 'install', name }, exitCode: EXIT_CODES.SUCCESS,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function presetExportHandler(
  projectRoot: string,
  name: string,
  format: string,
  output: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);

  if (format !== 'zip') {
    return createCommandResult({
      success: false, command: 'preset export', data: { action: 'export', name },
      errors: [{
        code: 'E_GENERAL', message: `Unsupported export format: ${format}. Use "zip".`,
        hint: 'Only ZIP format is currently supported.', severity: 'error', context: {},
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const presetDir = path.join(codiDir, 'presets', name);
  try {
    await fs.access(path.join(presetDir, PRESET_MANIFEST_FILENAME));
  } catch {
    return createCommandResult({
      success: false, command: 'preset export', data: { action: 'export', name },
      errors: [{
        code: 'E_GENERAL', message: `Preset "${name}" not found.`,
        hint: 'Run `codi preset list` to see available presets.', severity: 'error', context: {},
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createPresetZip(presetDir, output);
  if (!result.ok) {
    return createCommandResult({
      success: false, command: 'preset export', data: { action: 'export', name },
      errors: result.errors.map(e => ({
        code: e.code, message: e.message, hint: e.hint,
        severity: e.severity as 'error', context: e.context,
      })),
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  log.info(`Exported preset "${name}" to ${result.data.outputPath} (${(result.data.sizeBytes / 1024).toFixed(1)}KB)`);
  return createCommandResult({
    success: true, command: 'preset export',
    data: { action: 'export', name }, exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetValidateHandler(
  projectRoot: string,
  name: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const presetDir = path.join(codiDir, 'presets', name);

  const result = await validatePreset(presetDir);
  if (!result.ok) {
    for (const e of result.errors) log.info(`  Error: ${e.message}`);
    return createCommandResult({
      success: false, command: 'preset validate', data: { action: 'validate', name },
      errors: result.errors.map(e => ({
        code: e.code, message: e.message, hint: e.hint,
        severity: e.severity as 'error', context: e.context,
      })),
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const { manifest, artifactCounts, warnings } = result.data;
  log.info(`Preset "${manifest.name}" is valid.`);
  log.info(`  Version: ${manifest.version ?? 'unset'}`);
  log.info(`  Rules: ${artifactCounts.rules}, Skills: ${artifactCounts.skills}, Agents: ${artifactCounts.agents}, Commands: ${artifactCounts.commands}`);
  for (const w of warnings) log.info(`  Warning: ${w.message}`);

  return createCommandResult({
    success: true, command: 'preset validate',
    data: { action: 'validate', name }, exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetRemoveHandler(
  projectRoot: string,
  name: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const presetDir = path.join(codiDir, 'presets', name);

  try {
    await fs.access(presetDir);
    await fs.rm(presetDir, { recursive: true, force: true });
  } catch {
    return createCommandResult({
      success: false, command: 'preset remove', data: { action: 'remove', name },
      errors: [{
        code: 'E_GENERAL', message: `Preset "${name}" not found.`,
        hint: 'Run `codi preset list` to see installed presets.', severity: 'error', context: {},
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const lock = await readLockFile(codiDir);
  delete lock.presets[name];
  await writeLockFile(codiDir, lock);

  log.info(`Removed preset "${name}".`);
  return createCommandResult({
    success: true, command: 'preset remove',
    data: { action: 'remove', name }, exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetListEnhancedHandler(
  projectRoot: string,
  showBuiltin: boolean,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const presetsDir = path.join(codiDir, 'presets');
  const lock = await readLockFile(codiDir);

  const presets: Array<{ name: string; description: string; sourceType?: string }> = [];

  if (showBuiltin) {
    for (const name of getFlagPresetNames()) {
      presets.push({ name, description: PRESET_DESCRIPTIONS[name] ?? '', sourceType: 'builtin' });
    }
    for (const name of getBuiltinPresetNames()) {
      if (!presets.some(p => p.name === name)) {
        presets.push({ name, description: `Built-in ${name} preset`, sourceType: 'builtin' });
      }
    }
  }

  try {
    const entries = await fs.readdir(presetsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(presetsDir, entry.name, PRESET_MANIFEST_FILENAME);
      const lockEntry = lock.presets[entry.name];
      const sourceType = lockEntry?.sourceType ?? 'local';
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const parsed = parseYaml(raw) as Record<string, unknown>;
        presets.push({
          name: entry.name,
          description: (parsed['description'] as string) ?? '',
          sourceType,
        });
      } catch {
        presets.push({ name: entry.name, description: '(no manifest)', sourceType });
      }
    }
  } catch { /* presetsDir doesn't exist */ }

  if (presets.length === 0) {
    log.info('No presets found. Use --builtin to see built-in presets.');
  } else {
    for (const p of presets) {
      const tag = p.sourceType ? `[${p.sourceType}]` : '';
      log.info(`  ${p.name} ${tag} — ${p.description || '(no description)'}`);
    }
  }

  return createCommandResult({
    success: true, command: 'preset list',
    data: { action: 'list', presets }, exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetEditHandler(
  projectRoot: string,
  name: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  printBanner('Preset Editor');
  const manifestPath = path.join(codiDir, 'presets', name, 'preset.yaml');

  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestPath, 'utf8');
  } catch {
    return createCommandResult({
      success: false, command: 'preset edit', data: { action: 'validate', name },
      errors: [{ code: 'E_GENERAL', message: `Preset "${name}" not found.`, hint: '', severity: 'error', context: {} }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const manifest = parseYaml(manifestRaw) as Record<string, unknown>;
  const current = (manifest['artifacts'] ?? {}) as Record<string, string[]>;

  const currentRules = new Set(current['rules'] ?? []);
  const currentSkills = new Set(current['skills'] ?? []);
  const currentAgents = new Set(current['agents'] ?? []);
  const currentCommands = new Set(current['commands'] ?? []);

  const ruleRes = await prompts({
    type: 'autocompleteMultiselect', name: 'rules',
    message: 'Rules (type to search)',
    choices: AVAILABLE_TEMPLATES.map(t => ({ title: t, value: t, selected: currentRules.has(t) })),
    hint: '- Type to filter, Space to toggle',
  });

  const skillRes = await prompts({
    type: 'autocompleteMultiselect', name: 'skills',
    message: 'Skills (type to search)',
    choices: AVAILABLE_SKILL_TEMPLATES.map(t => ({ title: t, value: t, selected: currentSkills.has(t) })),
    hint: '- Type to filter, Space to toggle',
  });

  const agentRes = await prompts({
    type: 'autocompleteMultiselect', name: 'agents',
    message: 'Agents (type to search)',
    choices: AVAILABLE_AGENT_TEMPLATES.map(t => ({ title: t, value: t, selected: currentAgents.has(t) })),
    hint: '- Type to filter, Space to toggle',
  });

  const cmdRes = await prompts({
    type: 'autocompleteMultiselect', name: 'commands',
    message: 'Commands (type to search)',
    choices: AVAILABLE_COMMAND_TEMPLATES.map(t => ({ title: t, value: t, selected: currentCommands.has(t) })),
    hint: '- Type to filter, Space to toggle',
  });

  manifest['artifacts'] = {
    rules: (ruleRes.rules ?? []) as string[],
    skills: (skillRes.skills ?? []) as string[],
    agents: (agentRes.agents ?? []) as string[],
    commands: (cmdRes.commands ?? []) as string[],
  };

  await fs.writeFile(manifestPath, stringifyYaml(manifest), 'utf8');
  await regenerateConfigs(projectRoot);

  log.info(`Updated preset "${name}".`);
  return createCommandResult({
    success: true, command: 'preset edit',
    data: { action: 'validate', name }, exitCode: EXIT_CODES.SUCCESS,
  });
}
