import type { Command } from 'commander';
import { resolveConfig } from '../core/config/resolver.js';
import { StateManager } from '../core/config/state.js';
import { runAllChecks } from '../core/version/version-checker.js';
import { buildVerificationData } from '../core/verify/token.js';
import { resolveCodiDir } from '../utils/paths.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface ComplianceOptions extends GlobalOptions {
  ci?: boolean;
}

interface ComplianceCheck {
  check: string;
  passed: boolean;
  message: string;
}

interface ComplianceData {
  configValid: boolean;
  versionMatch: boolean;
  hasDrift: boolean;
  ruleCount: number;
  skillCount: number;
  agentCount: number;
  flagCount: number;
  token: string;
  generationAge: string;
  lastGenerated: string | null;
  checks: ComplianceCheck[];
}

function formatAge(isoTimestamp: string): string {
  const generated = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - generated.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute(s) ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour(s) ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day(s) ago`;
}

export async function complianceHandler(
  projectRoot: string,
  options: ComplianceOptions,
): Promise<CommandResult<ComplianceData>> {
  const checks: ComplianceCheck[] = [];

  // Run doctor checks
  const doctorResult = await runAllChecks(projectRoot);
  let configValid = false;
  let versionMatch = true;

  if (doctorResult.ok) {
    for (const r of doctorResult.data.results) {
      checks.push({ check: r.check, passed: r.passed, message: r.message });
      if (r.check === 'codi-directory') configValid = r.passed;
      if (r.check === 'codi-version' && !r.passed) versionMatch = false;
    }
  } else {
    checks.push({
      check: 'doctor',
      passed: false,
      message: 'Doctor checks failed to run.',
    });
  }

  // Resolve config for counts and token
  const configResult = await resolveConfig(projectRoot);
  let ruleCount = 0;
  let skillCount = 0;
  let agentCount = 0;
  let flagCount = 0;
  let token = '';

  if (configResult.ok) {
    const config = configResult.data;
    ruleCount = config.rules.length;
    skillCount = config.skills.length;
    agentCount = config.agents.length;
    flagCount = Object.keys(config.flags).length;

    const verifyData = buildVerificationData(config);
    token = verifyData.token;
  } else {
    checks.push({
      check: 'config-resolve',
      passed: false,
      message: 'Could not resolve config.',
    });
  }

  // Read state for generation info
  const codiDir = resolveCodiDir(projectRoot);
  const stateManager = new StateManager(codiDir, projectRoot);
  const stateResult = await stateManager.read();

  let lastGenerated: string | null = null;
  let generationAge = 'never';
  let hasDrift = false;

  if (stateResult.ok) {
    const state = stateResult.data;
    if (state.lastGenerated) {
      lastGenerated = state.lastGenerated;
      generationAge = formatAge(state.lastGenerated);
    }

    for (const agentId of Object.keys(state.agents)) {
      const driftResult = await stateManager.detectDrift(agentId);
      if (driftResult.ok) {
        const drifted = driftResult.data.files.some(
          (f) => f.status === 'drifted' || f.status === 'missing',
        );
        if (drifted) hasDrift = true;
      }
    }
  }

  if (hasDrift) {
    checks.push({
      check: 'drift',
      passed: false,
      message: 'Generated files have drifted from source.',
    });
  } else {
    checks.push({
      check: 'drift',
      passed: true,
      message: 'No drift detected.',
    });
  }

  const allPassed = checks.every((c) => c.passed);
  const exitCode = allPassed
    ? EXIT_CODES.SUCCESS
    : options.ci
      ? EXIT_CODES.DOCTOR_FAILED
      : EXIT_CODES.SUCCESS;

  return createCommandResult({
    success: allPassed,
    command: 'compliance',
    data: {
      configValid,
      versionMatch,
      hasDrift,
      ruleCount,
      skillCount,
      agentCount,
      flagCount,
      token,
      generationAge,
      lastGenerated,
      checks,
    },
    exitCode,
  });
}

export function registerComplianceCommand(program: Command): void {
  program
    .command('compliance')
    .description('Run full compliance report: doctor + status + verification')
    .option('--ci', 'Exit non-zero on any failure (for CI)')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: ComplianceOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await complianceHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
