import type { Command } from 'commander';
import { runAllChecks } from '../core/version/version-checker.js';
import { resolveConfig } from '../core/config/resolver.js';
import { validateContentSize } from '../core/config/validator.js';
import { checkDocSync } from '../core/docs/doc-sync.js';
import { createError } from '../core/output/errors.js';
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
  const configResult = await resolveConfig(projectRoot);
  const driftMode = configResult.ok
    ? (configResult.data.flags['drift_detection']?.value as string) ?? 'warn'
    : 'warn';

  const reportResult = await runAllChecks(projectRoot, driftMode);

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
  const hasDriftFailures = report.results.some(r => !r.passed && r.check.startsWith('drift-'));
  const exitCode = report.allPassed
    ? EXIT_CODES.SUCCESS
    : (options.ci || (driftMode === 'error' && hasDriftFailures))
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

  const contentWarnings = configResult.ok
    ? validateContentSize(configResult.data)
    : [];

  const docIssues = await checkDocSync(projectRoot);
  const docWarnings = docIssues.map((issue) => {
    let message = issue.fixable
      ? `${issue.description} — run: codi docs-update`
      : issue.description;
    if (issue.action) {
      message += `\n  ACTION: ${issue.action}`;
    }
    return createError('W_DOCS_STALE', { message });
  });

  return createCommandResult({
    success: report.allPassed,
    command: 'doctor',
    data: report,
    errors: report.allPassed ? [] : errors,
    warnings: [...contentWarnings, ...docWarnings],
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
