import type { Command } from 'commander';
import { validateHandler } from './validate.js';
import { doctorHandler } from './doctor.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface CiData {
  configValid: boolean;
  doctorPassed: boolean;
  allPassed: boolean;
}

export async function ciHandler(
  projectRoot: string,
): Promise<CommandResult<CiData>> {
  // 1. Validate config
  const validateResult = await validateHandler(projectRoot);
  const configValid = validateResult.success;

  // 2. Doctor checks (CI mode — exit non-zero on failure)
  const doctorResult = await doctorHandler(projectRoot, { ci: true });
  const doctorPassed = doctorResult.success;

  // 3. Report combined results
  const allPassed = configValid && doctorPassed;

  const errors = [
    ...validateResult.errors,
    ...doctorResult.errors,
  ];

  return createCommandResult({
    success: allPassed,
    command: 'ci',
    data: {
      configValid,
      doctorPassed,
      allPassed,
    },
    errors,
    exitCode: allPassed ? EXIT_CODES.SUCCESS : EXIT_CODES.DOCTOR_FAILED,
  });
}

export function registerCiCommand(program: Command): void {
  program
    .command('ci')
    .description('Run all validation checks for CI pipelines')
    .action(async () => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await ciHandler(process.cwd());
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
