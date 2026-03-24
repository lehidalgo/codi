import type { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { resolveCodiDir } from '../utils/paths.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { Logger } from '../core/output/logger.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';
import { scanCodiDir } from '../core/config/parser.js';
import {
  getRegistryConfig,
  readLockFile,
  writeLockFile,
  cloneRegistry,
  readRegistryIndex,
  filterEntries,
  getPresetVersionFromDir,
  copyDir,
} from '../core/preset/preset-registry.js';
import type { RegistryEntry } from '../core/preset/preset-registry.js';

const execFileAsync = promisify(execFile);

interface PresetData {
  action: 'create' | 'list' | 'install' | 'search' | 'update';
  name?: string;
  presets?: Array<{ name: string; description: string }>;
  results?: RegistryEntry[];
  updated?: string[];
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

    // Write lock file entry
    const version = await getPresetVersionFromDir(destDir);
    const lock = await readLockFile(codiDir);
    lock.presets[name] = {
      version,
      source: from,
      installedAt: new Date().toISOString(),
    };
    await writeLockFile(codiDir, lock);

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

export async function presetSearchHandler(
  projectRoot: string,
  query: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();

  const codiResult = await scanCodiDir(projectRoot);
  const manifest = codiResult.ok ? codiResult.data.manifest : null;
  const registryConfig = getRegistryConfig(manifest);

  let tmpDir: string | undefined;
  try {
    tmpDir = await cloneRegistry(registryConfig);
    const allEntries = await readRegistryIndex(tmpDir);
    const results = filterEntries(allEntries, query);

    if (results.length === 0) {
      log.info(`No presets found matching "${query}"`);
    } else {
      log.info(`Found ${results.length} preset(s) matching "${query}":`);
      for (const entry of results) {
        const tags = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
        log.info(`  ${entry.name}@${entry.version} — ${entry.description}${tags}`);
      }
    }

    return createCommandResult({
      success: true,
      command: 'preset search',
      data: { action: 'search', results },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } catch (error) {
    return createCommandResult({
      success: false,
      command: 'preset search',
      data: { action: 'search' },
      errors: [{
        code: 'E_GENERAL',
        message: `Failed to search registry: ${error instanceof Error ? error.message : String(error)}`,
        hint: 'Check registry configuration in codi.yaml presetRegistry field.',
        severity: 'error',
        context: {},
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export async function presetUpdateHandler(
  projectRoot: string,
  dryRun: boolean,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);

  const codiResult = await scanCodiDir(projectRoot);
  const manifest = codiResult.ok ? codiResult.data.manifest : null;
  const registryConfig = getRegistryConfig(manifest);
  const lock = await readLockFile(codiDir);

  const installedNames = Object.keys(lock.presets);
  if (installedNames.length === 0) {
    log.info('No presets tracked in lock file. Nothing to update.');
    return createCommandResult({
      success: true,
      command: 'preset update',
      data: { action: 'update', updated: [] },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  let tmpDir: string | undefined;
  try {
    tmpDir = await cloneRegistry(registryConfig);
    const allEntries = await readRegistryIndex(tmpDir);
    const entryMap = new Map(allEntries.map(e => [e.name, e]));

    const updated: string[] = [];

    for (const name of installedNames) {
      const registryEntry = entryMap.get(name);
      if (!registryEntry) {
        log.info(`  ${name}: not found in registry, skipping`);
        continue;
      }

      const lockEntry = lock.presets[name];
      if (!lockEntry) {
        log.info(`  ${name}: missing lock entry, skipping`);
        continue;
      }

      const currentVersion = lockEntry.version;
      if (registryEntry.version === currentVersion) {
        log.info(`  ${name}: up to date (${currentVersion})`);
        continue;
      }

      log.info(`  ${name}: ${currentVersion} -> ${registryEntry.version}`);

      if (!dryRun) {
        const presetSourceDir = path.join(tmpDir, name);
        const destDir = path.join(codiDir, 'presets', name);

        try {
          await fs.access(path.join(presetSourceDir, 'preset.yaml'));
          await fs.rm(destDir, { recursive: true, force: true });
          await fs.mkdir(destDir, { recursive: true });
          await copyDir(presetSourceDir, destDir);

          lock.presets[name] = {
            version: registryEntry.version,
            source: lockEntry.source,
            installedAt: new Date().toISOString(),
          };
          updated.push(name);
        } catch (copyError) {
          log.info(`  ${name}: failed to update — ${copyError instanceof Error ? copyError.message : String(copyError)}`);
        }
      } else {
        updated.push(name);
      }
    }

    if (!dryRun && updated.length > 0) {
      await writeLockFile(codiDir, lock);
    }

    if (updated.length === 0) {
      log.info('All presets are up to date.');
    } else if (dryRun) {
      log.info(`Would update ${updated.length} preset(s). Run without --dry-run to apply.`);
    } else {
      log.info(`Updated ${updated.length} preset(s).`);
    }

    return createCommandResult({
      success: true,
      command: 'preset update',
      data: { action: 'update', updated },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } catch (error) {
    return createCommandResult({
      success: false,
      command: 'preset update',
      data: { action: 'update' },
      errors: [{
        code: 'E_GENERAL',
        message: `Failed to update presets: ${error instanceof Error ? error.message : String(error)}`,
        hint: 'Check registry configuration and network connectivity.',
        severity: 'error',
        context: {},
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
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

  cmd
    .command('search <query>')
    .description('Search preset registry')
    .action(async (query: string) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetSearchHandler(process.cwd(), query);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command('update')
    .description('Update installed presets to latest versions')
    .option('--dry-run', 'Show what would change without writing')
    .action(async (options: { dryRun?: boolean }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetUpdateHandler(process.cwd(), options.dryRun ?? false);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
