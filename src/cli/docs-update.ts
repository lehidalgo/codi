import type { Command } from 'commander';
import { checkDocSync, fixDocSync } from '../core/docs/doc-sync.js';
import { createError } from '../core/output/errors.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface DocsUpdateData {
  fixed: string[];
  remaining: Array<{ file: string; description: string }>;
}

export async function docsUpdateHandler(
  projectRoot: string,
): Promise<CommandResult<DocsUpdateData>> {
  const fixed = await fixDocSync(projectRoot);
  const remaining = await checkDocSync(projectRoot);
  const unfixable = remaining.filter((i) => !i.fixable);

  const warnings = unfixable.map((issue) =>
    createError('W_DOCS_STALE', { message: issue.description }),
  );

  return createCommandResult({
    success: true,
    command: 'docs-update',
    data: {
      fixed,
      remaining: unfixable.map((i) => ({ file: i.file, description: i.description })),
    },
    warnings,
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerDocsUpdateCommand(program: Command): void {
  program
    .command('docs-update')
    .description('Update documentation counts to match current templates')
    .action(async () => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await docsUpdateHandler(process.cwd());
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
