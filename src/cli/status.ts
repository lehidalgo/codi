import type { Command } from 'commander';
import { StateManager } from '../core/config/state.js';
import type { DriftReport } from '../core/config/state.js';
import { resolveCodiDir } from '../utils/paths.js';
import { resolveConfig } from '../core/config/resolver.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface StatusData {
  lastGenerated: string;
  agents: DriftReport[];
  hasDrift: boolean;
}

export async function statusHandler(
  projectRoot: string,
): Promise<CommandResult<StatusData>> {
  const configResult = await resolveConfig(projectRoot);
  const driftMode = configResult.ok
    ? (configResult.data.flags['drift_detection']?.value as string) ?? 'warn'
    : 'warn';

  if (driftMode === 'off') {
    return createCommandResult({
      success: true,
      command: 'status',
      data: { lastGenerated: '', agents: [], hasDrift: false },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  const codiDir = resolveCodiDir(projectRoot);
  const stateManager = new StateManager(codiDir, projectRoot);

  const stateResult = await stateManager.read();
  if (!stateResult.ok) {
    return createCommandResult({
      success: false,
      command: 'status',
      data: { lastGenerated: '', agents: [], hasDrift: false },
      errors: stateResult.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const state = stateResult.data;
  const reports: DriftReport[] = [];
  let hasDrift = false;

  for (const agentId of Object.keys(state.agents)) {
    const driftResult = await stateManager.detectDrift(agentId);
    if (!driftResult.ok) continue;

    reports.push(driftResult.data);
    const drifted = driftResult.data.files.some(
      (f) => f.status === 'drifted' || f.status === 'missing',
    );
    if (drifted) hasDrift = true;
  }

  const exitCode = hasDrift && driftMode === 'error'
    ? EXIT_CODES.DRIFT_DETECTED
    : EXIT_CODES.SUCCESS;

  return createCommandResult({
    success: true,
    command: 'status',
    data: {
      lastGenerated: state.lastGenerated,
      agents: reports,
      hasDrift,
    },
    exitCode,
  });
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show drift status for generated agent files')
    .action(async () => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await statusHandler(process.cwd());
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
