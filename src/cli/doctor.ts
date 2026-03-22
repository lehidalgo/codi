import type { Command } from 'commander';
import { runAllChecks } from '../core/version/version-checker.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface DoctorOptions extends GlobalOptions {
  ci?: boolean;
}

interface DoctorData {
  results: Array<{
    check: string;
    passed: boolean;
    message: string;
  }>;
  allPassed: boolean;
}

export async function doctorHandler(
  projectRoot: string,
  options: DoctorOptions,
): Promise<CommandResult<DoctorData>> {
  const reportResult = await runAllChecks(projectRoot);

  if (!reportResult.ok) {
    return createCommandResult({
      success: false,
      command: 'doctor',
      data: { results: [], allPassed: false },
      errors: reportResult.errors,
      exitCode: EXIT_CODES.DOCTOR_FAILED,
    });
  }

  const report = reportResult.data;
  const exitCode = report.allPassed
    ? EXIT_CODES.SUCCESS
    : options.ci
      ? EXIT_CODES.DOCTOR_FAILED
      : EXIT_CODES.SUCCESS;

  const errors = report.results
    .filter((r) => !r.passed)
    .map((r) => ({
      code: r.check === 'codi-version' ? 'E_VERSION_MISMATCH' : 'E_FILES_STALE',
      message: r.message,
      hint: r.message,
      severity: 'error' as const,
      context: { check: r.check },
    }));

  return createCommandResult({
    success: report.allPassed,
    command: 'doctor',
    data: report,
    errors: report.allPassed ? [] : errors,
    exitCode,
  });
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check project health: version, generated files, config validity')
    .option('--ci', 'Exit non-zero on any failure (for CI/hooks)')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: DoctorOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await doctorHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
