import type { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { resolveCodiDir } from '../utils/paths.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { Logger } from '../core/output/logger.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

const execFileAsync = promisify(execFile);

interface PresetData {
  action: 'create' | 'list' | 'install';
  name?: string;
  presets?: Array<{ name: string; description: string }>;
}

export async function presetCreateHandler(
  projectRoot: string,
  name: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const presetDir = path.join(codiDir, 'presets', name);

  try {
    await fs.access(presetDir);
    return createCommandResult({
      success: false,
      command: 'preset create',
      data: { action: 'create', name },
      errors: [{
        code: 'E_GENERAL',
        message: `Preset "${name}" already exists at ${presetDir}`,
        hint: 'Choose a different name or remove the existing preset.',
        severity: 'error',
        context: {},
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  } catch { /* doesn't exist, proceed */ }

  const manifest = { name, description: '', version: '1' };
  const subdirs = ['rules', 'skills', 'agents', 'commands'];

  await fs.mkdir(presetDir, { recursive: true });
  for (const sub of subdirs) {
    await fs.mkdir(path.join(presetDir, sub), { recursive: true });
  }
  await fs.writeFile(path.join(presetDir, 'preset.yaml'), stringifyYaml(manifest), 'utf8');

  log.info(`Created preset "${name}" at .codi/presets/${name}/`);

  return createCommandResult({
    success: true,
    command: 'preset create',
    data: { action: 'create', name },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetListHandler(
  projectRoot: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const presetsDir = path.join(codiDir, 'presets');

  const presets: Array<{ name: string; description: string }> = [];

  try {
    const entries = await fs.readdir(presetsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(presetsDir, entry.name, 'preset.yaml');
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const parsed = parseYaml(raw) as Record<string, unknown>;
        presets.push({
          name: entry.name,
          description: (parsed['description'] as string) ?? '',
        });
      } catch {
        presets.push({ name: entry.name, description: '(no manifest)' });
      }
    }
  } catch { /* presetsDir doesn't exist */ }

  if (presets.length === 0) {
    log.info('No presets found in .codi/presets/');
  } else {
    for (const p of presets) {
      log.info(`  ${p.name} — ${p.description || '(no description)'}`);
    }
  }

  return createCommandResult({
    success: true,
    command: 'preset list',
    data: { action: 'list', presets },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetInstallHandler(
  projectRoot: string,
  name: string,
  from: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const destDir = path.join(codiDir, 'presets', name);

  const tmpDir = path.join(os.tmpdir(), `codi-preset-${Date.now()}`);
  try {
    log.info(`Cloning preset from ${from}...`);
    await execFileAsync('git', ['clone', '--depth', '1', from, tmpDir]);

    const presetSource = path.join(tmpDir, name);
    let sourceDir: string;

    try {
      await fs.access(path.join(presetSource, 'preset.yaml'));
      sourceDir = presetSource;
    } catch {
      sourceDir = tmpDir;
    }

    await fs.mkdir(destDir, { recursive: true });
    await copyDir(sourceDir, destDir);

    log.info(`Installed preset "${name}" to .codi/presets/${name}/`);

    return createCommandResult({
      success: true,
      command: 'preset install',
      data: { action: 'install', name },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } catch (error) {
    return createCommandResult({
      success: false,
      command: 'preset install',
      data: { action: 'install', name },
      errors: [{
        code: 'E_GENERAL',
        message: `Failed to install preset "${name}": ${error instanceof Error ? error.message : String(error)}`,
        hint: 'Check the repository URL and try again.',
        severity: 'error',
        context: {},
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === '.git') continue;
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export function registerPresetCommand(program: Command): void {
  const cmd = program
    .command('preset')
    .description('Manage configuration presets');

  cmd
    .command('create <name>')
    .description('Create a new preset scaffold')
    .action(async (name: string) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetCreateHandler(process.cwd(), name);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command('list')
    .description('List installed presets')
    .action(async () => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetListHandler(process.cwd());
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command('install <name>')
    .requiredOption('--from <repo>', 'Git repository to install from')
    .description('Install a preset from a git repository')
    .action(async (name: string, options: { from: string }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetInstallHandler(process.cwd(), name, options.from);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
