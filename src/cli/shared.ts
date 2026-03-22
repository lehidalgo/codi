import type { Command } from 'commander';
import { Logger } from '../core/output/logger.js';
import { formatHuman, formatJson } from '../core/output/formatter.js';
import type { CommandResult } from '../core/output/types.js';

export interface GlobalOptions {
  json?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  noColor?: boolean;
}

export function addGlobalOptions(cmd: Command): Command {
  return cmd
    .option('-j, --json', 'Output as JSON')
    .option('-v, --verbose', 'Verbose output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--no-color', 'Disable colored output');
}

export function initFromOptions(options: GlobalOptions): void {
  if (options.verbose && options.quiet) {
    process.stderr.write('[ERR] --verbose and --quiet are mutually exclusive\n');
    process.exit(1);
  }

  const level = options.verbose ? 'debug' : options.quiet ? 'error' : 'info';
  const mode = options.json ? 'json' : 'human';
  const noColor = options.noColor ?? false;

  Logger.init({ level, mode, noColor });
}

export function handleOutput(
  result: CommandResult<unknown>,
  options: { json?: boolean },
): void {
  if (options.json) {
    process.stdout.write(formatJson(result) + '\n');
  } else {
    process.stdout.write(formatHuman(result) + '\n');
  }
}
