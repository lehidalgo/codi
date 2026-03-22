import type { Command } from 'commander';
import { syncToTeamRepo } from '../core/sync/sync-engine.js';
import { scanCodiDir } from '../core/config/parser.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface SyncOptions extends GlobalOptions {
  dryRun?: boolean;
  message?: string;
}

interface SyncData {
  prUrl: string | null;
  filesAdded: string[];
  filesModified: string[];
}

export async function syncHandler(
  projectRoot: string,
  options: SyncOptions,
): Promise<CommandResult<SyncData>> {
  const configResult = await scanCodiDir(projectRoot);
  if (!configResult.ok) {
    return createCommandResult({
      success: false,
      command: 'sync',
      data: { prUrl: null, filesAdded: [], filesModified: [] },
      errors: configResult.errors,
      exitCode: EXIT_CODES.CONFIG_NOT_FOUND,
    });
  }

  const manifest = configResult.data.manifest;
  if (!manifest.sync) {
    return createCommandResult({
      success: false,
      command: 'sync',
      data: { prUrl: null, filesAdded: [], filesModified: [] },
      errors: [{
        code: 'E_CONFIG_INVALID',
        message: 'No sync configuration found in codi.yaml. Add a sync.repo field.',
        hint: 'Add sync.repo to codi.yaml',
        severity: 'error',
        context: {},
      }],
      exitCode: EXIT_CODES.CONFIG_INVALID,
    });
  }

  const result = await syncToTeamRepo({
    projectRoot,
    config: manifest.sync,
    projectName: manifest.name,
    dryRun: options.dryRun,
    message: options.message,
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: 'sync',
      data: { prUrl: null, filesAdded: [], filesModified: [] },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const data = result.data;
  const totalChanges = data.filesAdded.length + data.filesModified.length;

  if (totalChanges === 0) {
    return createCommandResult({
      success: true,
      command: 'sync',
      data,
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  return createCommandResult({
    success: true,
    command: 'sync',
    data,
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync local rules and skills to team config repo via PR')
    .option('--dry-run', 'Show what would be synced without making changes')
    .option('-m, --message <message>', 'Custom PR description')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: SyncOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await syncHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
