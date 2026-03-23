import type { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { resolveCodiDir } from '../utils/paths.js';
import { FLAG_CATALOG } from '../core/flags/flag-catalog.js';
import { getPreset } from '../core/flags/flag-presets.js';
import type { PresetName } from '../core/flags/flag-presets.js';
import { registerAllAdapters } from '../adapters/index.js';
import { resolveConfig } from '../core/config/resolver.js';
import { generate } from '../core/generator/generator.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { Logger } from '../core/output/logger.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface UpdateOptions extends GlobalOptions {
  preset?: string;
  regenerate?: boolean;
  dryRun?: boolean;
}

interface UpdateData {
  flagsAdded: string[];
  flagsReset: boolean;
  preset: string | null;
  regenerated: boolean;
}

export async function updateHandler(
  projectRoot: string,
  options: UpdateOptions,
): Promise<CommandResult<UpdateData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const flagsFile = path.join(codiDir, 'flags.yaml');

  let currentFlags: Record<string, unknown>;
  try {
    const raw = await fs.readFile(flagsFile, 'utf8');
    currentFlags = (parseYaml(raw) as Record<string, unknown>) ?? {};
  } catch {
    return createCommandResult({
      success: false,
      command: 'update',
      data: { flagsAdded: [], flagsReset: false, preset: null, regenerated: false },
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
    const validPresets = ['minimal', 'balanced', 'strict'];
    if (!validPresets.includes(presetName)) {
      return createCommandResult({
        success: false,
        command: 'update',
        data: { flagsAdded: [], flagsReset: false, preset: presetName, regenerated: false },
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

  let regenerated = false;
  if (options.regenerate && !options.dryRun) {
    registerAllAdapters();
    const configResult = await resolveConfig(projectRoot);
    if (configResult.ok) {
      const genResult = await generate(configResult.data, projectRoot);
      regenerated = genResult.ok;
    }
  }

  return createCommandResult({
    success: true,
    command: 'update',
    data: { flagsAdded, flagsReset, preset: presetName ?? null, regenerated },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update flags to latest catalog or reset to a preset')
    .option('--preset <preset>', 'Reset flags to preset: minimal, balanced, strict')
    .option('--regenerate', 'Run codi generate after updating')
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
