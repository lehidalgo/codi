import type { Command } from 'commander';
import { resolveConfig } from '../core/config/resolver.js';
import { registerAllAdapters } from '../adapters/index.js';
import { generate } from '../core/generator/generator.js';
import { StateManager } from '../core/config/state.js';
import type { GeneratedFileState } from '../core/config/state.js';
import { resolveCodiDir } from '../utils/paths.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { hashContent } from '../utils/hash.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface GenerateCommandOptions extends GlobalOptions {
  agent?: string[];
  dryRun?: boolean;
  force?: boolean;
}

interface GenerateSummary {
  agents: string[];
  filesGenerated: number;
  files: string[];
}

export async function generateHandler(
  projectRoot: string,
  options: GenerateCommandOptions,
): Promise<CommandResult<GenerateSummary>> {
  const configResult = await resolveConfig(projectRoot);
  if (!configResult.ok) {
    return createCommandResult({
      success: false,
      command: 'generate',
      data: { agents: [], filesGenerated: 0, files: [] },
      errors: configResult.errors,
      exitCode: configResult.errors[0]?.code === 'E_CONFIG_NOT_FOUND'
        ? EXIT_CODES.CONFIG_NOT_FOUND
        : EXIT_CODES.CONFIG_INVALID,
    });
  }

  registerAllAdapters();

  const genResult = await generate(configResult.data, projectRoot, {
    agents: options.agent,
    dryRun: options.dryRun,
    force: options.force,
  });

  if (!genResult.ok) {
    return createCommandResult({
      success: false,
      command: 'generate',
      data: { agents: [], filesGenerated: 0, files: [] },
      errors: genResult.errors,
      exitCode: EXIT_CODES.GENERATION_FAILED,
    });
  }

  if (!options.dryRun) {
    const codiDir = resolveCodiDir(projectRoot);
    const stateManager = new StateManager(codiDir, projectRoot);

    for (const agentId of genResult.data.agents) {
      const agentFiles = genResult.data.files
        .filter((f) => f.sources.length > 0)
        .map((f): GeneratedFileState => ({
          path: f.path,
          sourceHash: hashContent(f.sources.join(',')),
          generatedHash: f.hash,
          sources: f.sources,
          timestamp: new Date().toISOString(),
        }));
      await stateManager.updateAgent(agentId, agentFiles);
    }
  }

  return createCommandResult({
    success: true,
    command: 'generate',
    data: {
      agents: genResult.data.agents,
      filesGenerated: genResult.data.files.length,
      files: genResult.data.files.map((f) => f.path),
    },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .alias('gen')
    .description('Generate agent configuration files')
    .option('--agent <agents...>', 'Generate for specific agents only')
    .option('--dry-run', 'Show what would be generated without writing')
    .option('--force', 'Force regeneration even if unchanged')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: GenerateCommandOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await generateHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
